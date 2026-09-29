import { isRecord, readNumber, readRecord, readString } from './guards';

/** Входящее текстовое сообщение, разобранное из уведомления GREEN-API. */
export interface IncomingTextMessage {
  idMessage: string;
  chatId: string;
  senderName: string | null;
  senderPhone: string | null;
  text: string;
  /** Время в миллисекундах. */
  timestamp: number;
}

/**
 * Достаёт текст из messageData: "textMessage" → textMessageData.textMessage,
 * "extendedTextMessage" → extendedTextMessageData.text. Остальные типы — null.
 */
export function extractMessageText(messageData: unknown): string | null {
  if (!isRecord(messageData)) {
    return null;
  }
  const typeMessage = readString(messageData, 'typeMessage');

  if (typeMessage === 'textMessage') {
    const data = readRecord(messageData, 'textMessageData');
    return data ? readString(data, 'textMessage') : null;
  }
  if (typeMessage === 'extendedTextMessage') {
    const data = readRecord(messageData, 'extendedTextMessageData');
    return data ? readString(data, 'text') : null;
  }
  return null;
}

/**
 * Разбирает тело уведомления. Возвращает `null` для всего, что не является
 * входящим текстовым сообщением (статусы, исходящие, другие типы контента).
 */
export function parseIncomingTextMessage(body: unknown): IncomingTextMessage | null {
  if (!isRecord(body) || readString(body, 'typeWebhook') !== 'incomingMessageReceived') {
    return null;
  }

  const senderData = readRecord(body, 'senderData');
  const chatId = senderData ? readString(senderData, 'chatId') : null;
  if (chatId === null || chatId === '') {
    return null;
  }

  const text = extractMessageText(body.messageData);
  if (text === null) {
    return null;
  }

  const timestampSeconds = readNumber(body, 'timestamp');
  const senderPhoneNumber = senderData ? readNumber(senderData, 'senderPhoneNumber') : null;

  return {
    idMessage: readString(body, 'idMessage') ?? `${chatId}-${Date.now()}`,
    chatId,
    senderName: senderData
      ? (readString(senderData, 'senderContactName') ??
        readString(senderData, 'senderName') ??
        readString(senderData, 'chatName'))
      : null,
    senderPhone: senderPhoneNumber !== null ? String(senderPhoneNumber) : null,
    text,
    timestamp: timestampSeconds !== null ? timestampSeconds * 1000 : Date.now(),
  };
}
