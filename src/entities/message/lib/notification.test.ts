import { describe, expect, it } from 'vitest';
import { extractMessageText, parseIncomingNotification } from './notification';

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

describe('parseIncomingNotification', () => {
  it('разбирает входящее текстовое сообщение', () => {
    expect(parseIncomingNotification(incomingTextMessage)).toEqual({
      idMessage: '1763115112345',
      chatId: '10000000',
      senderName: 'Иван П.',
      senderPhone: '79876543210',
      text: 'Привет!',
      timestamp: 1763115112000,
    });
  });

  it('разбирает extendedTextMessage и chatId вида номер@c.us', () => {
    const parsed = parseIncomingNotification({
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
    expect(parseIncomingNotification({ typeWebhook: 'outgoingMessageStatus' })).toBeNull();
    expect(
      parseIncomingNotification({
        ...incomingTextMessage,
        typeWebhook: 'outgoingAPIMessageReceived',
      }),
    ).toBeNull();
  });

  it('игнорирует нетекстовые типы сообщений', () => {
    expect(
      parseIncomingNotification({
        ...incomingTextMessage,
        messageData: { typeMessage: 'imageMessage', fileMessageData: { downloadUrl: 'https://x' } },
      }),
    ).toBeNull();
  });

  it('не падает на мусорных данных', () => {
    expect(parseIncomingNotification(null)).toBeNull();
    expect(parseIncomingNotification('null')).toBeNull();
    expect(parseIncomingNotification({})).toBeNull();
    expect(parseIncomingNotification({ ...incomingTextMessage, senderData: {} })).toBeNull();
  });

  it('разбирает ответ с цитатой (quotedMessage)', () => {
    const parsed = parseIncomingNotification({
      ...incomingTextMessage,
      messageData: {
        typeMessage: 'quotedMessage',
        extendedTextMessageData: { text: 'Отвечаю на это', stanzaId: '1164', participant: '1' },
      },
    });
    expect(parsed?.text).toBe('Отвечаю на это');
  });

  it('не считает номером senderPhoneNumber = 0 (номер скрыт)', () => {
    const parsed = parseIncomingNotification({
      ...incomingTextMessage,
      senderData: { ...incomingTextMessage.senderData, senderPhoneNumber: 0 },
    });
    expect(parsed?.senderPhone).toBeNull();
  });

  it('не принимает за сообщение статусы и смену состояния', () => {
    expect(
      parseIncomingNotification({
        typeWebhook: 'outgoingMessageStatus',
        chatId: '10000000',
        idMessage: 'BAE5',
        status: 'delivered',
      }),
    ).toBeNull();
    expect(
      parseIncomingNotification({
        typeWebhook: 'stateInstanceChanged',
        stateInstance: 'authorized',
      }),
    ).toBeNull();
  });

  it('подставляет текущее время, если timestamp отсутствует', () => {
    const { timestamp, ...withoutTimestamp } = incomingTextMessage;
    expect(timestamp).toBeDefined();
    const parsed = parseIncomingNotification(withoutTimestamp);
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
