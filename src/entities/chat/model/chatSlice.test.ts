import { describe, expect, it } from 'vitest';
import type { IncomingTextMessage, Message } from '@/entities/message/@x/chat';
import {
  chatOpened,
  chatReducer,
  chatSelected,
  chatsLoaded,
  historyLoaded,
  initialChatState,
  messageReceived,
  messageSent,
  resolveChatId,
} from './chatSlice';

function openChat(chatId: string, phone: string | null) {
  return chatReducer(initialChatState, chatOpened({ chatId, phone }));
}

const incoming: IncomingTextMessage = {
  idMessage: 'msg-1',
  chatId: '10000000',
  senderName: 'Иван',
  senderPhone: '79991234567',
  text: 'Привет!',
  timestamp: 1_700_000_000_000,
};

const fromHistory: Message = {
  id: 'msg-1',
  chatId: '10000000',
  direction: 'incoming',
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

describe('chatSlice: входящие сообщения', () => {
  it('создаёт чат автоматически и считает непрочитанные', () => {
    const state = chatReducer(initialChatState, messageReceived(incoming));

    expect(state.chatOrder).toEqual(['10000000']);
    expect(state.chats['10000000']?.phone).toBe('79991234567');
    expect(state.chats['10000000']?.title).toBe('Иван');
    expect(state.chats['10000000']?.unreadCount).toBe(1);
    expect(state.messages['10000000']).toEqual([fromHistory]);
  });

  it('не увеличивает счётчик для открытого чата', () => {
    const opened = openChat('10000000', '79991234567');
    const state = chatReducer(opened, messageReceived(incoming));
    expect(state.chats['10000000']?.unreadCount).toBe(0);
  });

  it('не дублирует повторно доставленное уведомление', () => {
    const once = chatReducer(initialChatState, messageReceived(incoming));
    const twice = chatReducer(once, messageReceived(incoming));

    expect(twice.messages['10000000']).toHaveLength(1);
    expect(twice.chats['10000000']?.unreadCount).toBe(1);
  });

  it('кладёт сообщение в чат, созданный по запасному chatId, а не заводит второй', () => {
    const opened = openChat('79991234567@c.us', '79991234567');
    const state = chatReducer(opened, messageReceived(incoming));

    expect(state.chatOrder).toEqual(['79991234567@c.us']);
    expect(state.messages['79991234567@c.us']?.[0]?.text).toBe('Привет!');
  });

  it('поднимает чат с новым сообщением наверх списка', () => {
    const first = openChat('10000000', '79991234567');
    const second = chatReducer(first, chatOpened({ chatId: '20000000', phone: '79990000000' }));
    expect(second.chatOrder).toEqual(['20000000', '10000000']);

    const state = chatReducer(second, messageReceived(incoming));
    expect(state.chatOrder).toEqual(['10000000', '20000000']);
  });

  it('сбрасывает счётчик при выборе чата', () => {
    const withUnread = chatReducer(initialChatState, messageReceived(incoming));
    const selected = chatReducer(withUnread, chatSelected('10000000'));

    expect(selected.activeChatId).toBe('10000000');
    expect(selected.chats['10000000']?.unreadCount).toBe(0);
  });
});

describe('chatSlice: история из GetChatHistory', () => {
  it('не дублирует сообщение, пришедшее и из истории, и из ReceiveNotification', () => {
    const opened = openChat('10000000', '79991234567');
    const withRealtime = chatReducer(opened, messageReceived(incoming));
    const withHistory = chatReducer(
      withRealtime,
      historyLoaded({ chatId: '10000000', messages: [fromHistory] }),
    );
    expect(withHistory.messages['10000000']).toHaveLength(1);

    const reloaded = chatReducer(
      withHistory,
      historyLoaded({ chatId: '10000000', messages: [fromHistory] }),
    );
    expect(reloaded.messages['10000000']).toHaveLength(1);
  });

  it('вставляет старые сообщения перед новыми и обновляет превью пустого чата', () => {
    const opened = openChat('10000000', '79991234567');
    const state = chatReducer(
      opened,
      historyLoaded({
        chatId: '10000000',
        messages: [
          { ...fromHistory, id: 'old', text: 'Старое', timestamp: 1 },
          { ...fromHistory, id: 'new', text: 'Новое', timestamp: 2 },
        ],
      }),
    );

    expect(state.messages['10000000']?.map((message) => message.id)).toEqual(['old', 'new']);
    expect(state.chats['10000000']?.lastPreview).toBe('Новое');
  });

  it('игнорирует историю неизвестного чата', () => {
    const state = chatReducer(
      initialChatState,
      historyLoaded({ chatId: 'нет-такого', messages: [fromHistory] }),
    );
    expect(state).toEqual(initialChatState);
  });
});

describe('chatSlice: список чатов из GetChats', () => {
  it('добавляет чаты с сервера и не дублирует уже известные', () => {
    const opened = openChat('79991234567@c.us', '79991234567');
    const state = chatReducer(
      opened,
      chatsLoaded([
        { chatId: '10000000', name: 'Иван', phone: '79991234567', type: 'user' },
        { chatId: '10000001', name: '', phone: null, type: 'user' },
      ]),
    );

    expect(state.chatOrder).toEqual(['79991234567@c.us', '10000001']);
    expect(state.chats['79991234567@c.us']?.title).toBe('Иван');
    expect(state.chats['10000001']?.title).toBe('10000001');

    const again = chatReducer(
      state,
      chatsLoaded([{ chatId: '10000001', name: 'Пётр', phone: null, type: 'user' }]),
    );
    expect(again.chatOrder).toHaveLength(2);
    expect(again.chats['10000001']?.title).toBe('Пётр');
  });

  it('поднимает наверх чат, у которого история оказалась свежее', () => {
    const loaded = chatReducer(
      initialChatState,
      chatsLoaded([
        { chatId: 'a', name: 'A', phone: null, type: 'user' },
        { chatId: 'b', name: 'B', phone: null, type: 'user' },
      ]),
    );
    const message = (chatId: string, timestamp: number): Message => ({
      id: `${chatId}-1`,
      chatId,
      direction: 'incoming',
      text: `из ${chatId}`,
      timestamp,
    });
    const withA = chatReducer(
      loaded,
      historyLoaded({ chatId: 'a', messages: [message('a', 100)] }),
    );
    const withB = chatReducer(withA, historyLoaded({ chatId: 'b', messages: [message('b', 200)] }));

    expect(withB.chatOrder).toEqual(['b', 'a']);
    expect(withB.chats['b']?.lastPreview).toBe('из b');
  });
});

describe('chatSlice: исходящие сообщения', () => {
  const outgoing: Message = {
    id: 'BAE5',
    chatId: '10000000',
    direction: 'outgoing',
    text: 'Привет из GREEN-API',
    timestamp: 1_700_000_000_000,
  };

  it('добавляет подтверждённое сообщение в чат и обновляет превью', () => {
    const opened = openChat('10000000', '79991234567');
    const sent = chatReducer(opened, messageSent(outgoing));

    expect(sent.messages['10000000']).toEqual([outgoing]);
    expect(sent.chats['10000000']?.lastPreview).toBe('Привет из GREEN-API');
  });

  it('не дублирует сообщение, если история вернула его раньше ответа SendMessage', () => {
    const opened = openChat('10000000', '79991234567');
    const withHistory = chatReducer(
      opened,
      historyLoaded({ chatId: '10000000', messages: [outgoing] }),
    );
    const sent = chatReducer(withHistory, messageSent(outgoing));

    expect(sent.messages['10000000']).toHaveLength(1);
  });

  it('игнорирует сообщение для неизвестного чата', () => {
    expect(chatReducer(initialChatState, messageSent(outgoing))).toEqual(initialChatState);
  });
});
