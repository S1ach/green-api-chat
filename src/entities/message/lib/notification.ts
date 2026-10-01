import { devLog } from '@/shared/lib/devLog';
import { isRecord, readNumber, readRecord, readString } from '@/shared/lib/guards';

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
 * Достаёт текст из messageData (формат MAX, GREEN-API v3):
 * - "textMessage"         → textMessageData.textMessage;
 * - "extendedTextMessage" → extendedTextMessageData.text (текст со ссылкой);
 * - "quotedMessage"       → extendedTextMessageData.text (ответ с цитатой).
 * Остальные типы (медиа, реакции, опросы…) — null.
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
  if (typeMessage === 'extendedTextMessage' || typeMessage === 'quotedMessage') {
    const data = readRecord(messageData, 'extendedTextMessageData');
    return data ? readString(data, 'text') : null;
  }
  return null;
}

/** Краткая сводка уведомления для диагностических логов — без разбора на сообщение. */
export function describeNotification(body: unknown): {
  typeWebhook: string | null;
  chatId: string | null;
  messageData: unknown;
} {
  if (!isRecord(body)) {
    return { typeWebhook: null, chatId: null, messageData: undefined };
  }
  const senderData = readRecord(body, 'senderData');
  return {
    typeWebhook: readString(body, 'typeWebhook'),
    chatId: senderData ? readString(senderData, 'chatId') : null,
    messageData: body.messageData,
  };
}

/**
 * Разбирает тело уведомления из ReceiveNotification.
 * Возвращает нормализованное входящее текстовое сообщение либо `null`
 * для всего остального: статусов, исходящих, смены состояния, медиа и т.п.
 * Каждое поле проверяется на существование и тип — структура приходит из сети.
 */
export function parseIncomingNotification(body: unknown): IncomingTextMessage | null {
  if (!isRecord(body)) {
    devLog('Parser', 'Unsupported notification', body);
    return null;
  }

  const typeWebhook = readString(body, 'typeWebhook');
  if (typeWebhook !== 'incomingMessageReceived') {
    devLog('Parser', `Skipped event: ${typeWebhook ?? 'unknown'}`);
    return null;
  }

  const senderData = readRecord(body, 'senderData');
  const chatId = senderData ? readString(senderData, 'chatId') : null;
  const text = extractMessageText(body.messageData);
  if (chatId === null || chatId === '' || text === null) {
    devLog('Parser', 'Unsupported notification', body);
    return null;
  }

  const timestampSeconds = readNumber(body, 'timestamp');
  const timestamp = timestampSeconds !== null ? timestampSeconds * 1000 : Date.now();
  // MAX присылает 0, если номер скрыт или отправитель — группа.
  const senderPhoneNumber = senderData ? readNumber(senderData, 'senderPhoneNumber') : null;

  const message: IncomingTextMessage = {
    // Без idMessage дедупликация невозможна, поэтому подставляем стабильный ключ
    // из chatId и времени: повторная доставка того же уведомления даст тот же ключ.
    idMessage: readString(body, 'idMessage') ?? `${chatId}-${timestamp}`,
    chatId,
    senderName: senderData
      ? readString(senderData, 'senderContactName') ||
        readString(senderData, 'senderName') ||
        readString(senderData, 'chatName') ||
        null
      : null,
    senderPhone:
      senderPhoneNumber !== null && senderPhoneNumber > 0 ? String(senderPhoneNumber) : null,
    text,
    timestamp,
  };
  devLog('Parser', 'Parsed incoming text:', message.text);
  return message;
}
