import { describe, expect, it } from 'vitest';
import type { Message } from '../model/types';
import { mergeMessages, normalizeHistory, normalizeJournal } from './history';

/** Фрагмент ответа GetChatHistory по документации MAX: новые сверху. */
const historyResponse = [
  {
    type: 'incoming',
    idMessage: '1002',
    timestamp: 1_754_999_900,
    typeMessage: 'textMessage',
    chatId: '10000000',
    chatType: 'user',
    textMessage: 'Как дела?',
    senderId: '10000000',
    senderName: 'Иван',
  },
  {
    type: 'outgoing',
    idMessage: '1001',
    timestamp: 1_754_999_812,
    typeMessage: 'extendedTextMessage',
    chatId: '10000000',
    chatType: 'user',
    textMessage: 'Привет! https://green-api.com',
    extendedTextMessage: { text: 'Привет! https://green-api.com', title: '' },
    statusMessage: 'delivered',
    sendByApi: true,
  },
  {
    type: 'incoming',
    idMessage: 'reaction-1',
    timestamp: 1_754_999_850,
    typeMessage: 'reactionMessage',
    chatId: '10000000',
    extendedTextMessageData: { text: '👍' },
  },
  {
    type: 'incoming',
    idMessage: 'other-chat',
    timestamp: 1_754_999_870,
    typeMessage: 'textMessage',
    chatId: '-69876543210123',
    textMessage: 'Из группы',
  },
  {
    type: 'incoming',
    idMessage: 'deleted-1',
    timestamp: 1_754_999_880,
    typeMessage: 'textMessage',
    chatId: '10000000',
    textMessage: 'Удалено',
    isDeleted: true,
  },
];

function message(id: string, timestamp: number, overrides: Partial<Message> = {}): Message {
  return { id, chatId: '10000000', direction: 'incoming', text: id, timestamp, ...overrides };
}

const ids = (messages: Message[]) => messages.map(({ id }) => id);

describe('normalizeHistory', () => {
  it('оставляет сообщения нужного чата и сортирует от старых к новым', () => {
    expect(normalizeHistory(historyResponse, '10000000')).toEqual([
      {
        id: '1001',
        chatId: '10000000',
        direction: 'outgoing',
        text: 'Привет! https://green-api.com',
        timestamp: 1_754_999_812_000,
        status: 'delivered',
      },
      {
        id: '1002',
        chatId: '10000000',
        direction: 'incoming',
        text: 'Как дела?',
        timestamp: 1_754_999_900_000,
      },
    ]);
  });

  it('сохраняет сообщение с файлом как вложение', () => {
    const [image] = normalizeHistory(
      [
        {
          type: 'incoming',
          idMessage: '2001',
          timestamp: 1,
          typeMessage: 'imageMessage',
          chatId: '10000000',
          downloadUrl: 'https://storage.example/a.png',
          caption: 'Описание',
          fileName: 'a.png',
        },
      ],
      '10000000',
    );

    expect(image).toMatchObject({
      text: 'Описание',
      attachment: { kind: 'image', url: 'https://storage.example/a.png', name: 'a.png' },
    });
  });

  it('ставит сообщения одной секунды в порядке отправки, а не в порядке ответа API', () => {
    // GREEN-API отдаёт время в секундах и новые сообщения первыми.
    const sameSecond = ['1005', '1004', '1003'].map((idMessage) => ({
      type: 'incoming',
      idMessage,
      timestamp: 1_754_999_900,
      typeMessage: 'textMessage',
      chatId: '10000000',
      textMessage: idMessage,
    }));

    expect(ids(normalizeHistory(sameSecond, '10000000'))).toEqual(['1003', '1004', '1005']);
  });

  it('устойчив к неожиданному ответу', () => {
    expect(normalizeHistory(null, '1')).toEqual([]);
    expect(normalizeHistory({ error: 'x' }, '1')).toEqual([]);
    expect(normalizeHistory([null, 1, 'x', { type: 'incoming' }], '1')).toEqual([]);
  });
});

describe('normalizeJournal', () => {
  it('разбирает сообщения разных чатов и имя собеседника', () => {
    const received = normalizeJournal(
      [
        {
          type: 'incoming',
          idMessage: '3001',
          timestamp: 100,
          typeMessage: 'textMessage',
          chatId: '10000000',
          chatType: 'user',
          textMessage: 'Привет',
          senderName: 'Иван',
          senderContactName: 'Иван П.',
        },
        {
          idMessage: '3002',
          timestamp: 200,
          typeMessage: 'textMessage',
          chatId: '10000001',
          textMessage: 'Ещё',
        },
        { idMessage: '3003', typeMessage: 'reactionMessage', chatId: '10000001' },
      ],
      'incoming',
    );

    expect(received).toEqual([
      {
        message: {
          id: '3001',
          chatId: '10000000',
          direction: 'incoming',
          text: 'Привет',
          timestamp: 100_000,
        },
        chat: { name: 'Иван П.', phone: null, type: 'user' },
      },
      {
        // Поля type нет — направление задаёт сам журнал.
        message: {
          id: '3002',
          chatId: '10000001',
          direction: 'incoming',
          text: 'Ещё',
          timestamp: 200_000,
        },
        chat: { name: null, phone: null, type: null },
      },
    ]);
  });

  it('отмечает исходящие статусом из журнала', () => {
    const [received] = normalizeJournal(
      [
        {
          idMessage: '4001',
          timestamp: 1,
          typeMessage: 'textMessage',
          chatId: '1',
          textMessage: 'x',
          statusMessage: 'read',
        },
      ],
      'outgoing',
    );

    expect(received?.message).toMatchObject({ direction: 'outgoing', status: 'read' });
  });
});

describe('mergeMessages', () => {
  it('добавляет новые сообщения, убирает дубли и сортирует по времени', () => {
    const merged = mergeMessages(
      [message('a', 1), message('b', 3)],
      [message('b', 3), message('c', 2)],
    );

    expect(ids(merged)).toEqual(['a', 'c', 'b']);
  });

  it('не теряет уже известные сообщения, которых нет в новом ответе', () => {
    const merged = mergeMessages([message('old', 1), message('mid', 2)], [message('new', 3)]);

    expect(ids(merged)).toEqual(['old', 'mid', 'new']);
  });

  it('возвращает тот же массив, если ничего не изменилось', () => {
    const current = [message('a', 1), message('b', 2)];

    expect(mergeMessages(current, [message('a', 1)])).toBe(current);
    expect(mergeMessages(current, [])).toBe(current);
  });

  it('повышает статус, но не понижает его', () => {
    const sent = message('a', 1, { direction: 'outgoing', status: 'sent' });
    const read = mergeMessages([sent], [{ ...sent, status: 'read' }]);
    expect(read[0]?.status).toBe('read');

    // Запоздавший ответ истории со старым статусом ничего не откатывает.
    const stale = mergeMessages(read, [{ ...sent, status: 'delivered' }]);
    expect(stale[0]?.status).toBe('read');
  });

  it('не теряет ссылку на вложение, если новый ответ пришёл без неё', () => {
    const withUrl = message('a', 1, {
      attachment: { kind: 'image', url: 'https://storage.example/a.png', name: 'a.png' },
    });
    const merged = mergeMessages(
      [withUrl],
      [{ ...withUrl, text: 'подпись', attachment: { kind: 'image', url: null, name: null } }],
    );

    expect(merged[0]).toMatchObject({
      text: 'подпись',
      attachment: { url: 'https://storage.example/a.png' },
    });
  });

  it('не теряет подпись вложения (имя контакта), если история пришла без неё', () => {
    const sent = message('a', 1, {
      direction: 'outgoing',
      status: 'sent',
      attachment: { kind: 'contact', url: null, name: 'Люся Сидорова' },
    });
    const merged = mergeMessages(
      [sent],
      [{ ...sent, status: 'read', attachment: { kind: 'contact', url: null, name: null } }],
    );

    expect(merged[0]).toMatchObject({
      status: 'read',
      attachment: { kind: 'contact', name: 'Люся Сидорова' },
    });
  });

  it('держит ещё не отправленные сообщения в конце ленты', () => {
    // Часы клиента отстают: локальное время меньше серверного.
    const pending = message('local-1', 5, { direction: 'outgoing', status: 'sending' });
    const merged = mergeMessages([pending], [message('server', 10)]);

    expect(ids(merged)).toEqual(['server', 'local-1']);
  });
});
