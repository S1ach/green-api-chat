import { describe, expect, it } from 'vitest';
import type { Message } from '../model/types';
import { mergeMessages, normalizeHistory } from './history';

/** Фрагмент ответа GetChatHistory по документации MAX: новые сверху. */
const historyResponse = [
  {
    type: 'incoming',
    idMessage: 'in-2',
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
    idMessage: 'out-1',
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
    idMessage: 'sticker-1',
    timestamp: 1_754_999_860,
    typeMessage: 'stickerMessage',
    chatId: '10000000',
    downloadUrl: 'https://example/x.png',
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

function message(id: string, timestamp: number, text = id): Message {
  return { id, chatId: '10000000', direction: 'incoming', text, timestamp };
}

describe('normalizeHistory', () => {
  it('оставляет только текст нужного чата, определяет направление и сортирует от старых к новым', () => {
    expect(normalizeHistory(historyResponse, '10000000')).toEqual([
      {
        id: 'out-1',
        chatId: '10000000',
        direction: 'outgoing',
        text: 'Привет! https://green-api.com',
        timestamp: 1_754_999_812_000,
      },
      {
        id: 'in-2',
        chatId: '10000000',
        direction: 'incoming',
        text: 'Как дела?',
        timestamp: 1_754_999_900_000,
      },
    ]);
  });

  it('устойчив к неожиданному ответу', () => {
    expect(normalizeHistory(null, '1')).toEqual([]);
    expect(normalizeHistory({ error: 'x' }, '1')).toEqual([]);
    expect(normalizeHistory([null, 1, 'x', { type: 'incoming' }], '1')).toEqual([]);
  });
});

describe('mergeMessages', () => {
  it('убирает дубли по idMessage и сортирует по времени', () => {
    const history = [message('a', 1), message('b', 3)];
    const realtime = [message('b', 3), message('c', 2)];
    expect(mergeMessages(history, realtime).map((m) => m.id)).toEqual(['a', 'c', 'b']);
  });

  it('при совпадении id берёт версию из второй коллекции', () => {
    const merged = mergeMessages([message('a', 1, 'старое')], [message('a', 1, 'новое')]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.text).toBe('новое');
  });
});
