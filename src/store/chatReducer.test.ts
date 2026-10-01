import { describe, expect, it } from 'vitest';
import { chatReducer, initialChatState, resolveChatId, selectChats } from './chatReducer';
import type { IncomingTextMessage } from '../utils/notification';

function openChat(chatId: string, phone: string | null) {
  return chatReducer(initialChatState, {
    type: 'chat/open',
    payload: { chatId, phone },
  });
}

const incoming: IncomingTextMessage = {
  idMessage: 'msg-1',
  chatId: '10000000',
  senderName: 'Иван',
  senderPhone: '79991234567',
  text: 'Привет!',
  timestamp: 1_700_000_000_000,
};

describe('resolveChatId', () => {
  it('находит чат по совпадающему chatId', () => {
    const state = openChat('10000000', '79991234567');
    expect(resolveChatId(state, '10000000', null)).toBe('10000000');
  });

  it('находит чат, созданный с запасным chatId, по номеру отправителя', () => {
    const state = openChat('79991234567@c.us', '79991234567');
    expect(resolveChatId(state, '10000000', '79991234567')).toBe('79991234567@c.us');
  });

  it('сопоставляет числовой чат с уведомлением в формате номер@c.us', () => {
    const state = openChat('10000000', '79991234567');
    expect(resolveChatId(state, '79991234567@c.us', null)).toBe('10000000');
  });

  it('возвращает null, если подходящего чата нет', () => {
    expect(resolveChatId(initialChatState, '10000000', '79991234567')).toBeNull();
  });
});

describe('chatReducer: входящие сообщения', () => {
  it('создаёт чат автоматически и считает непрочитанные', () => {
    const state = chatReducer(initialChatState, { type: 'message/incoming', payload: incoming });
    const [chat] = selectChats(state);

    expect(chat?.id).toBe('10000000');
    expect(chat?.phone).toBe('79991234567');
    expect(chat?.unreadCount).toBe(1);
    expect(state.messages['10000000']?.[0]?.text).toBe('Привет!');
  });

  it('не увеличивает счётчик для открытого чата', () => {
    const opened = openChat('10000000', '79991234567');
    const state = chatReducer(opened, { type: 'message/incoming', payload: incoming });
    expect(state.chats['10000000']?.unreadCount).toBe(0);
  });

  it('не дублирует повторно доставленное уведомление', () => {
    const once = chatReducer(initialChatState, { type: 'message/incoming', payload: incoming });
    const twice = chatReducer(once, { type: 'message/incoming', payload: incoming });
    expect(twice.messages['10000000']).toHaveLength(1);
  });

  it('сбрасывает счётчик при выборе чата', () => {
    const withUnread = chatReducer(initialChatState, {
      type: 'message/incoming',
      payload: incoming,
    });
    const selected = chatReducer(withUnread, {
      type: 'chat/select',
      payload: { chatId: '10000000' },
    });
    expect(selected.chats['10000000']?.unreadCount).toBe(0);
  });
});

describe('chatReducer: история из GetChatHistory', () => {
  const fromHistory = {
    id: 'msg-1',
    chatId: '10000000',
    direction: 'incoming' as const,
    text: 'Привет!',
    timestamp: 1_700_000_000_000,
    status: 'sent' as const,
  };

  it('не дублирует сообщение, пришедшее и из истории, и из ReceiveNotification', () => {
    const opened = openChat('10000000', '79991234567');
    const withRealtime = chatReducer(opened, { type: 'message/incoming', payload: incoming });
    const withHistory = chatReducer(withRealtime, {
      type: 'history/loaded',
      payload: { chatId: '10000000', messages: [fromHistory] },
    });
    expect(withHistory.messages['10000000']).toHaveLength(1);

    const reloaded = chatReducer(withHistory, {
      type: 'history/loaded',
      payload: { chatId: '10000000', messages: [fromHistory] },
    });
    expect(reloaded.messages['10000000']).toHaveLength(1);
  });

  it('вставляет старые сообщения перед новыми и обновляет превью пустого чата', () => {
    const opened = openChat('10000000', '79991234567');
    const state = chatReducer(opened, {
      type: 'history/loaded',
      payload: {
        chatId: '10000000',
        messages: [
          { ...fromHistory, id: 'old', text: 'Старое', timestamp: 1 },
          { ...fromHistory, id: 'new', text: 'Новое', timestamp: 2 },
        ],
      },
    });
    expect(state.messages['10000000']?.map((m) => m.id)).toEqual(['old', 'new']);
    expect(state.chats['10000000']?.lastPreview).toBe('Новое');
  });

  it('схлопывает отправленное сообщение, если история вернула его раньше ответа SendMessage', () => {
    const opened = openChat('10000000', '79991234567');
    const queued = chatReducer(opened, {
      type: 'message/enqueue',
      payload: {
        message: { ...fromHistory, id: 'local-1', direction: 'outgoing', status: 'sending' },
      },
    });
    const withHistory = chatReducer(queued, {
      type: 'history/loaded',
      payload: {
        chatId: '10000000',
        messages: [{ ...fromHistory, id: 'BAE5', direction: 'outgoing' }],
      },
    });
    const sent = chatReducer(withHistory, {
      type: 'message/status',
      payload: { chatId: '10000000', localId: 'local-1', status: 'sent', id: 'BAE5' },
    });
    expect(sent.messages['10000000']).toHaveLength(1);
  });
});

describe('chatReducer: список чатов из GetChats', () => {
  it('добавляет чаты с сервера и не дублирует уже известные', () => {
    const opened = openChat('79991234567@c.us', '79991234567');
    const state = chatReducer(opened, {
      type: 'chats/loaded',
      payload: {
        chats: [
          { chatId: '10000000', name: 'Иван', phone: '79991234567', type: 'user' },
          { chatId: '10000001', name: '', phone: null, type: 'user' },
        ],
      },
    });

    expect(state.chatOrder).toEqual(['79991234567@c.us', '10000001']);
    expect(state.chats['79991234567@c.us']?.title).toBe('Иван');
    expect(state.chats['10000001']?.title).toBe('10000001');

    const again = chatReducer(state, {
      type: 'chats/loaded',
      payload: { chats: [{ chatId: '10000001', name: 'Пётр', phone: null, type: 'user' }] },
    });
    expect(again.chatOrder).toHaveLength(2);
    expect(again.chats['10000001']?.title).toBe('Пётр');
  });

  it('поднимает наверх чат, у которого история оказалась свежее', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'chats/loaded',
      payload: {
        chats: [
          { chatId: 'a', name: 'A', phone: null, type: 'user' },
          { chatId: 'b', name: 'B', phone: null, type: 'user' },
        ],
      },
    });
    const message = (chatId: string, timestamp: number) => ({
      id: `${chatId}-1`,
      chatId,
      direction: 'incoming' as const,
      text: `из ${chatId}`,
      timestamp,
      status: 'sent' as const,
    });
    const withA = chatReducer(loaded, {
      type: 'history/loaded',
      payload: { chatId: 'a', messages: [message('a', 100)] },
    });
    const withB = chatReducer(withA, {
      type: 'history/loaded',
      payload: { chatId: 'b', messages: [message('b', 200)] },
    });

    expect(withB.chatOrder).toEqual(['b', 'a']);
    expect(withB.chats['b']?.lastPreview).toBe('из b');
  });
});

describe('chatReducer: исходящие сообщения', () => {
  it('обновляет статус и идентификатор после ответа API', () => {
    const opened = openChat('10000000', '79991234567');
    const queued = chatReducer(opened, {
      type: 'message/enqueue',
      payload: {
        message: {
          id: 'local-1',
          chatId: '10000000',
          direction: 'outgoing',
          text: 'Привет из GREEN-API',
          timestamp: 1_700_000_000_000,
          status: 'sending',
        },
      },
    });
    expect(queued.messages['10000000']?.[0]?.status).toBe('sending');

    const sent = chatReducer(queued, {
      type: 'message/status',
      payload: { chatId: '10000000', localId: 'local-1', status: 'sent', id: 'BAE5' },
    });
    const message = sent.messages['10000000']?.[0];

    expect(message?.status).toBe('sent');
    expect(message?.id).toBe('BAE5');
    expect(sent.chats['10000000']?.lastPreview).toBe('Привет из GREEN-API');
  });

  it('сохраняет ссылку на аватар и отличает «не запрашивали» от «аватара нет»', () => {
    const opened = openChat('10000000', '79991234567');
    expect(opened.chats['10000000']?.avatarUrl).toBeNull();

    const withAvatar = chatReducer(opened, {
      type: 'chat/avatar',
      payload: { chatId: '10000000', avatarUrl: 'https://cdn.example/a.jpg' },
    });
    expect(withAvatar.chats['10000000']?.avatarUrl).toBe('https://cdn.example/a.jpg');

    const withoutAvatar = chatReducer(opened, {
      type: 'chat/avatar',
      payload: { chatId: '10000000', avatarUrl: '' },
    });
    expect(withoutAvatar.chats['10000000']?.avatarUrl).toBe('');
  });

  it('не создаёт новый объект состояния, если аватар не изменился', () => {
    const opened = openChat('10000000', '79991234567');
    const withAvatar = chatReducer(opened, {
      type: 'chat/avatar',
      payload: { chatId: '10000000', avatarUrl: '' },
    });

    expect(
      chatReducer(withAvatar, {
        type: 'chat/avatar',
        payload: { chatId: '10000000', avatarUrl: '' },
      }),
    ).toBe(withAvatar);
  });

  it('игнорирует аватар для неизвестного чата', () => {
    const opened = openChat('10000000', '79991234567');
    expect(
      chatReducer(opened, {
        type: 'chat/avatar',
        payload: { chatId: 'нет-такого', avatarUrl: 'https://cdn.example/a.jpg' },
      }),
    ).toBe(opened);
  });
});
