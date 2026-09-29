import { describe, expect, it } from 'vitest';
import { extractMessageText, parseIncomingTextMessage } from './notification';

const incomingTextMessage = {
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 3100000000, wid: '79991234567@c.us', typeInstance: 'v3' },
  timestamp: 1763115112,
  idMessage: '1763115112345',
  senderData: {
    chatId: '10000000',
    chatName: 'Иван Петров',
    chatType: 'user',
    sender: '10000000',
    senderName: 'Иван Петров',
    senderContactName: 'Иван П.',
    senderPhoneNumber: 79876543210,
  },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'Привет!', isForwarded: false, forwardingScore: 0 },
  },
};

describe('parseIncomingTextMessage', () => {
  it('разбирает входящее текстовое сообщение', () => {
    expect(parseIncomingTextMessage(incomingTextMessage)).toEqual({
      idMessage: '1763115112345',
      chatId: '10000000',
      senderName: 'Иван П.',
      senderPhone: '79876543210',
      text: 'Привет!',
      timestamp: 1763115112000,
    });
  });

  it('разбирает extendedTextMessage и chatId вида номер@c.us', () => {
    const parsed = parseIncomingTextMessage({
      ...incomingTextMessage,
      senderData: { chatId: '79876543210@c.us', sender: '79876543210@c.us' },
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'Ссылка: https://green-api.com', title: 'GREEN-API' },
      },
    });

    expect(parsed?.chatId).toBe('79876543210@c.us');
    expect(parsed?.text).toBe('Ссылка: https://green-api.com');
    expect(parsed?.senderName).toBeNull();
  });

  it('игнорирует уведомления о статусах и исходящих сообщениях', () => {
    expect(parseIncomingTextMessage({ typeWebhook: 'outgoingMessageStatus' })).toBeNull();
    expect(
      parseIncomingTextMessage({
        ...incomingTextMessage,
        typeWebhook: 'outgoingAPIMessageReceived',
      }),
    ).toBeNull();
  });

  it('игнорирует нетекстовые типы сообщений', () => {
    expect(
      parseIncomingTextMessage({
        ...incomingTextMessage,
        messageData: { typeMessage: 'imageMessage', fileMessageData: { downloadUrl: 'https://x' } },
      }),
    ).toBeNull();
  });

  it('не падает на мусорных данных', () => {
    expect(parseIncomingTextMessage(null)).toBeNull();
    expect(parseIncomingTextMessage('null')).toBeNull();
    expect(parseIncomingTextMessage({})).toBeNull();
    expect(parseIncomingTextMessage({ ...incomingTextMessage, senderData: {} })).toBeNull();
  });

  it('подставляет текущее время, если timestamp отсутствует', () => {
    const { timestamp, ...withoutTimestamp } = incomingTextMessage;
    expect(timestamp).toBeDefined();
    const parsed = parseIncomingTextMessage(withoutTimestamp);
    expect(parsed?.timestamp).toBeGreaterThan(0);
  });
});

describe('extractMessageText', () => {
  it('возвращает null, если данные сообщения повреждены', () => {
    expect(extractMessageText({ typeMessage: 'textMessage' })).toBeNull();
    expect(extractMessageText({ typeMessage: 'textMessage', textMessageData: {} })).toBeNull();
    expect(extractMessageText(undefined)).toBeNull();
  });
});
