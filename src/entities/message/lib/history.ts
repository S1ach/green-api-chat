import type { Message } from '../model/types';
import { isSameChat } from '@/shared/lib/chatId';
import { isRecord, readNumber, readRecord, readString } from '@/shared/lib/guards';

/**
 * Текст сообщения из элемента GetChatHistory.
 * Текст лежит в `textMessage` (для textMessage и extendedTextMessage),
 * запасные места — `extendedTextMessage.text` и, для цитат, `extendedTextMessageData.text`.
 * Реакции, медиа, опросы и прочее — не текст, возвращаем null.
 */
function extractHistoryText(item: Record<string, unknown>): string | null {
  const typeMessage = readString(item, 'typeMessage');
  if (
    typeMessage !== 'textMessage' &&
    typeMessage !== 'extendedTextMessage' &&
    typeMessage !== 'quotedMessage'
  ) {
    return null;
  }
  const direct = readString(item, 'textMessage');
  if (direct !== null && direct !== '') {
    return direct;
  }
  const extended = readRecord(item, 'extendedTextMessage');
  const fromExtended = extended ? readString(extended, 'text') : null;
  if (fromExtended !== null && fromExtended !== '') {
    return fromExtended;
  }
  const quoted = readRecord(item, 'extendedTextMessageData');
  const fromQuoted = quoted ? readString(quoted, 'text') : null;
  return fromQuoted !== null && fromQuoted !== '' ? fromQuoted : null;
}

/**
 * Переводит один элемент ответа GetChatHistory во внутренний формат.
 * `chatId` — идентификатор чата в приложении: им помечаем сообщение,
 * а сообщения чужих чатов отбрасываем.
 */
export function normalizeHistoryMessage(raw: unknown, chatId: string): Message | null {
  if (!isRecord(raw) || raw.isDeleted === true) {
    return null;
  }
  const type = readString(raw, 'type');
  if (type !== 'incoming' && type !== 'outgoing') {
    return null;
  }
  const idMessage = readString(raw, 'idMessage');
  if (idMessage === null || idMessage === '') {
    return null;
  }
  const rawChatId = readString(raw, 'chatId');
  if (rawChatId !== null && !isSameChat(rawChatId, chatId)) {
    return null;
  }
  const text = extractHistoryText(raw);
  if (text === null) {
    return null;
  }
  const seconds = readNumber(raw, 'timestamp');
  return {
    id: idMessage,
    chatId,
    direction: type,
    text,
    timestamp: seconds !== null ? seconds * 1000 : 0,
  };
}

/** Ответ GetChatHistory (новые сверху) → текстовые сообщения чата от старых к новым. */
export function normalizeHistory(raw: unknown, chatId: string): Message[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const messages = raw
    .map((item) => normalizeHistoryMessage(item, chatId))
    .filter((message): message is Message => message !== null);
  return mergeMessages(messages, []);
}

/**
 * Объединяет историю из API и сообщения, накопленные в приложении
 * (входящие из ReceiveNotification, отправленные, кэш localStorage).
 * Дубли убираются по id (= idMessage GREEN-API); при совпадении
 * побеждает вторая коллекция.
 * Результат отсортирован от старых к новым; сортировка стабильная,
 * поэтому сообщения с одинаковым временем сохраняют порядок поступления.
 */
export function mergeMessages(historyMessages: Message[], realtimeMessages: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const message of historyMessages) {
    byId.set(message.id, message);
  }
  for (const message of realtimeMessages) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
}
