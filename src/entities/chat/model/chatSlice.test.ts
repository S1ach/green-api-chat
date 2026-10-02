import { describe, expect, it } from 'vitest';
import type { Message, ReceivedMessage } from '@/entities/message/@x/chat';
import {
  chatOpened,
  chatReducer,
  chatSelected,
  chatsLoaded,
  historyLoaded,
  initialChatState,
  messageQueued,
  messageReceived,
  messageRemoved,
  messageRetried,
  messageSendFailed,
  messageSendSucceeded,
  messageStatusChanged,
  messagesSynced,
  resolveChatId,
  type ChatState,
} from './chatSlice';

const CHAT = '10000000';

function openChat(chatId: string, phone: string | null) {
  return chatReducer(initialChatState, chatOpened({ chatId, phone }));
}

function incomingMessage(id: string, timestamp: number, text = 'Привет!'): Message {
  return { id, chatId: CHAT, direction: 'incoming', text, timestamp };
}

function received(message: Message, name: string | null = 'Иван'): ReceivedMessage {
  return { message, chat: { name, phone: '79991234567', type: 'user' } };
}

const incoming = received(incomingMessage('msg-1', 1_700_000_000_000));

const ids = (state: ChatState, chatId = CHAT) => state.messages[chatId]?.map(({ id }) => id);

describe('resolveChatId', () => {
  it('находит чат по совпадающему chatId', () => {
    expect(resolveChatId(openChat(CHAT, '79991234567'), CHAT, null)).toBe(CHAT);
  });

  it('находит чат, созданный с запасным chatId, по номеру отправителя', () => {
    const state = openChat('79991234567@c.us', '79991234567');
    expect(resolveChatId(state, CHAT, '79991234567')).toBe('79991234567@c.us');
  });

  it('сопоставляет числовой чат с идентификатором в формате номер@c.us', () => {
    expect(resolveChatId(openChat(CHAT, '79991234567'), '79991234567@c.us', null)).toBe(CHAT);
  });

  it('возвращает null, если подходящего чата нет', () => {
    expect(resolveChatId(initialChatState, CHAT, '79991234567')).toBeNull();
  });
});

describe('chatSlice: сообщения из очереди уведомлений', () => {
  it('создаёт чат автоматически и считает непрочитанные', () => {
    const state = chatReducer(initialChatState, messageReceived(incoming));

    expect(state.chatOrder).toEqual([CHAT]);
    expect(state.chats[CHAT]).toMatchObject({
      phone: '79991234567',
      title: 'Иван',
      unreadCount: 1,
      lastPreview: 'Привет!',
    });
    expect(state.messages[CHAT]).toEqual([incoming.message]);
  });

  it('не увеличивает счётчик для открытого чата', () => {
    const state = chatReducer(openChat(CHAT, '79991234567'), messageReceived(incoming));
    expect(state.chats[CHAT]?.unreadCount).toBe(0);
  });

  it('не дублирует повторно доставленное уведомление и не меняет состояние', () => {
    const once = chatReducer(initialChatState, messageReceived(incoming));
    const twice = chatReducer(once, messageReceived(incoming));

    expect(twice).toBe(once);
  });

  it('кладёт сообщение в чат, созданный по запасному chatId, а не заводит второй', () => {
    const opened = openChat('79991234567@c.us', '79991234567');
    const state = chatReducer(opened, messageReceived(incoming));

    expect(state.chatOrder).toEqual(['79991234567@c.us']);
    expect(state.messages['79991234567@c.us']?.[0]?.text).toBe('Привет!');
  });

  it('поднимает чат с новым сообщением наверх списка', () => {
    const first = openChat(CHAT, '79991234567');
    const second = chatReducer(first, chatOpened({ chatId: '20000000', phone: '79990000000' }));
    const later = received(incomingMessage('msg-2', Date.now() + 60_000));

    expect(chatReducer(second, messageReceived(later)).chatOrder).toEqual([CHAT, '20000000']);
  });

  it('показывает сообщение, отправленное с телефона, и не считает его непрочитанным', () => {
    const fromPhone = received(
      {
        id: 'out-1',
        chatId: CHAT,
        direction: 'outgoing',
        text: 'С телефона',
        timestamp: 5,
        status: 'sent',
      },
      'Иван',
    );
    const state = chatReducer(initialChatState, messageReceived(fromPhone));

    expect(ids(state)).toEqual(['out-1']);
    expect(state.chats[CHAT]?.unreadCount).toBe(0);
  });

  it('сбрасывает счётчик при выборе чата', () => {
    const withUnread = chatReducer(initialChatState, messageReceived(incoming));
    const selected = chatReducer(withUnread, chatSelected(CHAT));

    expect(selected.activeChatId).toBe(CHAT);
    expect(selected.chats[CHAT]?.unreadCount).toBe(0);
  });

  it('для вложения без подписи показывает в превью его название', () => {
    const photo = received({
      ...incomingMessage('photo-1', 10, ''),
      attachment: { kind: 'image', url: 'https://storage.example/a.png', fileName: 'a.png' },
    });

    expect(chatReducer(initialChatState, messageReceived(photo)).chats[CHAT]?.lastPreview).toBe(
      'Фото',
    );
  });
});

describe('chatSlice: история из GetChatHistory', () => {
  it('не дублирует сообщение, пришедшее и из истории, и из очереди', () => {
    const withRealtime = chatReducer(openChat(CHAT, '79991234567'), messageReceived(incoming));
    const withHistory = chatReducer(
      withRealtime,
      historyLoaded({ chatId: CHAT, messages: [incoming.message] }),
    );

    expect(withHistory.messages[CHAT]).toHaveLength(1);
  });

  it('повторная загрузка той же истории не меняет состояние', () => {
    const loaded = chatReducer(
      openChat(CHAT, '79991234567'),
      historyLoaded({ chatId: CHAT, messages: [incomingMessage('a', 1), incomingMessage('b', 2)] }),
    );
    const reloaded = chatReducer(
      loaded,
      historyLoaded({ chatId: CHAT, messages: [incomingMessage('a', 1), incomingMessage('b', 2)] }),
    );

    expect(reloaded).toBe(loaded);
  });

  it('дополняет ленту, а не заменяет её: старые сообщения не пропадают', () => {
    const first = chatReducer(
      openChat(CHAT, '79991234567'),
      historyLoaded({ chatId: CHAT, messages: [incomingMessage('old', 1, 'Старое')] }),
    );
    // Следующий ответ истории старое сообщение уже не содержит.
    const second = chatReducer(
      first,
      historyLoaded({ chatId: CHAT, messages: [incomingMessage('new', 2, 'Новое')] }),
    );

    expect(ids(second)).toEqual(['old', 'new']);
    expect(second.chats[CHAT]?.lastPreview).toBe('Новое');
  });

  it('игнорирует историю неизвестного чата', () => {
    const state = chatReducer(
      initialChatState,
      historyLoaded({ chatId: 'нет-такого', messages: [incomingMessage('a', 1)] }),
    );
    expect(state).toBe(initialChatState);
  });
});

describe('chatSlice: сверка по журналам', () => {
  it('раскладывает сообщения по чатам и заполняет превью', () => {
    const loaded = chatReducer(
      initialChatState,
      chatsLoaded([
        { chatId: 'a', name: 'A', phone: null, type: 'user' },
        { chatId: 'b', name: 'B', phone: null, type: 'user' },
      ]),
    );
    const journal = (chatId: string, timestamp: number): ReceivedMessage => ({
      message: {
        id: `${chatId}-1`,
        chatId,
        direction: 'incoming',
        text: `из ${chatId}`,
        timestamp,
      },
      chat: { name: null, phone: null, type: 'user' },
    });
    const state = chatReducer(
      loaded,
      messagesSynced({ received: [journal('a', 100), journal('b', 200)], countUnread: false }),
    );

    // Сверху чат с более свежим сообщением.
    expect(state.chatOrder).toEqual(['b', 'a']);
    expect(state.chats['b']).toMatchObject({ lastPreview: 'из b', title: 'B', unreadCount: 0 });
  });

  it('первая загрузка не считает непрочитанные, а сверка — считает', () => {
    const initial = chatReducer(
      initialChatState,
      messagesSynced({ received: [incoming], countUnread: false }),
    );
    expect(initial.chats[CHAT]?.unreadCount).toBe(0);

    const next = received(incomingMessage('msg-2', 1_700_000_100_000, 'Вы тут?'));
    const resynced = chatReducer(
      initial,
      messagesSynced({ received: [incoming, next], countUnread: true }),
    );

    // Уже известное сообщение непрочитанным не становится.
    expect(resynced.chats[CHAT]?.unreadCount).toBe(1);
    expect(ids(resynced)).toEqual(['msg-1', 'msg-2']);
  });

  it('сверка без новых сообщений не меняет состояние', () => {
    const once = chatReducer(
      initialChatState,
      messagesSynced({ received: [incoming], countUnread: false }),
    );
    const again = chatReducer(once, messagesSynced({ received: [incoming], countUnread: true }));

    expect(again).toBe(once);
  });
});

describe('chatSlice: список чатов из GetChats', () => {
  it('добавляет чаты с сервера и не дублирует уже известные', () => {
    const state = chatReducer(
      openChat('79991234567@c.us', '79991234567'),
      chatsLoaded([
        { chatId: CHAT, name: 'Иван', phone: '79991234567', type: 'user' },
        { chatId: '10000001', name: '', phone: null, type: 'user' },
      ]),
    );

    expect(state.chatOrder).toEqual(['79991234567@c.us', '10000001']);
    expect(state.chats['79991234567@c.us']?.title).toBe('Иван');
    expect(state.chats['10000001']?.title).toBe('10000001');
  });
});

describe('chatSlice: отправка', () => {
  const queued: Message = {
    id: 'local-1',
    chatId: CHAT,
    direction: 'outgoing',
    text: 'Привет из GREEN-API',
    timestamp: 1_700_000_000_000,
    status: 'sending',
  };
  const sending = chatReducer(openChat(CHAT, '79991234567'), messageQueued(queued));

  it('сразу показывает сообщение со статусом «отправляется»', () => {
    expect(sending.messages[CHAT]).toEqual([queued]);
    expect(sending.chats[CHAT]?.lastPreview).toBe('Привет из GREEN-API');
  });

  it('после ответа API заменяет временный идентификатор на idMessage', () => {
    const sent = chatReducer(
      sending,
      messageSendSucceeded({ chatId: CHAT, localId: 'local-1', idMessage: 'BAE5' }),
    );

    expect(sent.messages[CHAT]).toEqual([{ ...queued, id: 'BAE5', status: 'sent' }]);
  });

  it('не показывает сообщение второй раз, если история вернула его раньше ответа SendMessage', () => {
    const fromHistory: Message = { ...queued, id: 'BAE5', status: 'delivered' };
    const withHistory = chatReducer(
      sending,
      historyLoaded({ chatId: CHAT, messages: [fromHistory] }),
    );
    expect(ids(withHistory)).toEqual(['BAE5', 'local-1']);

    const sent = chatReducer(
      withHistory,
      messageSendSucceeded({ chatId: CHAT, localId: 'local-1', idMessage: 'BAE5' }),
    );

    expect(sent.messages[CHAT]).toEqual([fromHistory]);
  });

  it('не показывает сообщение второй раз, когда оно позже приходит из очереди или истории', () => {
    const sent = chatReducer(
      sending,
      messageSendSucceeded({ chatId: CHAT, localId: 'local-1', idMessage: 'BAE5' }),
    );
    const echoed = chatReducer(
      sent,
      messageReceived(received({ ...queued, id: 'BAE5', status: 'sent' })),
    );

    expect(ids(echoed)).toEqual(['BAE5']);
  });

  it('при ошибке оставляет сообщение в ленте и позволяет повторить или убрать его', () => {
    const failed = chatReducer(
      sending,
      messageSendFailed({ chatId: CHAT, localId: 'local-1', error: 'Нет сети' }),
    );
    expect(failed.messages[CHAT]?.[0]).toMatchObject({ status: 'error', error: 'Нет сети' });

    const retried = chatReducer(failed, messageRetried({ chatId: CHAT, localId: 'local-1' }));
    expect(retried.messages[CHAT]?.[0]).toEqual(queued);

    const removed = chatReducer(failed, messageRemoved({ chatId: CHAT, id: 'local-1' }));
    expect(removed.messages[CHAT]).toEqual([]);
    expect(removed.chats[CHAT]?.lastPreview).toBe('');
  });

  it('обновляет статус по уведомлению и не понижает его', () => {
    const sent = chatReducer(
      sending,
      messageSendSucceeded({ chatId: CHAT, localId: 'local-1', idMessage: 'BAE5' }),
    );
    const read = chatReducer(
      sent,
      messageStatusChanged({ chatId: CHAT, idMessage: 'BAE5', status: 'read' }),
    );
    expect(read.messages[CHAT]?.[0]?.status).toBe('read');

    const late = chatReducer(
      read,
      messageStatusChanged({ chatId: CHAT, idMessage: 'BAE5', status: 'delivered' }),
    );
    expect(late).toBe(read);
  });

  it('игнорирует сообщение и статус для неизвестного чата', () => {
    expect(chatReducer(initialChatState, messageQueued(queued))).toBe(initialChatState);
    expect(
      chatReducer(
        initialChatState,
        messageStatusChanged({ chatId: CHAT, idMessage: 'x', status: 'read' }),
      ),
    ).toBe(initialChatState);
  });
});
