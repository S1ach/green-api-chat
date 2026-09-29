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
});
