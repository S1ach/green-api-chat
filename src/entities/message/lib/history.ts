import { isSameChat } from '@/shared/lib/chatId';
import { isRecord, readNumber, readString } from '@/shared/lib/guards';
import type { Message, MessageDirection, MessageStatus, ReceivedMessage } from '../model/types';
import { contentFromHistory } from './content';

function readStatus(item: Record<string, unknown>): MessageStatus {
  const status = readString(item, 'statusMessage');
  return status === 'delivered' || status === 'read' ? status : 'sent';
}

/**
 * Переводит элемент GetChatHistory или журнала во внутренний формат.
 * Запасные значения нужны, когда поле не пришло: в журналах направление задаёт
 * сам метод, а в истории чат известен из запроса.
 */
function normalizeItem(
  raw: unknown,
  fallback: { direction?: MessageDirection; chatId?: string },
): Message | null {
  if (!isRecord(raw) || raw.isDeleted === true) {
    return null;
  }
  const type = readString(raw, 'type');
  const direction = type === 'incoming' || type === 'outgoing' ? type : fallback.direction;
  const id = readString(raw, 'idMessage');
  const chatId = readString(raw, 'chatId') || fallback.chatId;
  const content = contentFromHistory(raw);
  if (direction === undefined || !id || !chatId || content === null) {
    return null;
  }
  const seconds = readNumber(raw, 'timestamp');
  return {
    id,
    chatId,
    direction,
    timestamp: seconds !== null ? seconds * 1000 : 0,
    ...content,
    ...(direction === 'outgoing' ? { status: readStatus(raw) } : {}),
  };
}

/**
 * Ответ GetChatHistory (новые сверху) → сообщения чата от старых к новым.
 * `chatId` — идентификатор чата в приложении: им помечаем сообщения,
 * а сообщения чужих чатов отбрасываем.
 */
export function normalizeHistory(raw: unknown, chatId: string): Message[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const messages: Message[] = [];
  for (const item of raw) {
    const message = normalizeItem(item, { chatId });
    if (message !== null && isSameChat(message.chatId, chatId)) {
      messages.push({ ...message, chatId });
    }
  }
  return mergeMessages([], messages);
}

/**
 * Ответ LastIncomingMessages / LastOutgoingMessages → сообщения разных чатов
 * со сведениями о чате (имя собеседника есть только у входящих личных сообщений).
 */
export function normalizeJournal(raw: unknown, direction: MessageDirection): ReceivedMessage[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const received: ReceivedMessage[] = [];
  for (const item of raw) {
    const message = normalizeItem(item, { direction });
    if (message === null || !isRecord(item)) {
      continue;
    }
    const type = readString(item, 'chatType');
    const isPersonalIncoming = message.direction === 'incoming' && type !== 'group';
    received.push({
      message,
      chat: {
        name: isPersonalIncoming
          ? readString(item, 'senderContactName') || readString(item, 'senderName') || null
          : null,
        phone: null,
        type,
      },
    });
  }
  return received;
}

/** Статус только «растёт»: устаревший ответ истории не вернёт «прочитано» обратно в «отправлено». */
const STATUS_RANK: Record<MessageStatus, number> = {
  error: 0,
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

function laterStatus(a: MessageStatus | undefined, b: MessageStatus | undefined) {
  if (a === undefined || b === undefined) {
    return a ?? b;
  }
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a;
}

function isLocal(message: Message): boolean {
  return message.status === 'sending' || message.status === 'error';
}

/**
 * Порядок сообщений в ленте: по времени, а внутри одной секунды (GREEN-API отдаёт время
 * в секундах) — по idMessage, у MAX он числовой и растёт. Ещё не отправленные сообщения
 * всегда в конце: часы клиента могут отставать от серверных.
 */
export function compareMessages(a: Message, b: Message): number {
  if (isLocal(a) !== isLocal(b)) {
    return isLocal(a) ? 1 : -1;
  }
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }
  if (/^\d+$/.test(a.id) && /^\d+$/.test(b.id)) {
    return a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }
  return 0;
}

function sameContent(a: Message, b: Message): boolean {
  return (
    a.text === b.text &&
    a.timestamp === b.timestamp &&
    a.status === b.status &&
    a.attachment?.url === b.attachment?.url &&
    a.attachment?.name === b.attachment?.name
  );
}

/**
 * Добавляет к уже известным сообщениям чата полученные из API (история, журнал, уведомление).
 * - Дубли убираются по id (= idMessage GREEN-API).
 * - Для известного сообщения берутся свежие данные с сервера, а статус только повышается.
 * - Старые сообщения не пропадают: история дополняет ленту, а не заменяет её.
 * - Если ничего не изменилось, возвращается тот же массив — без лишних перерисовок.
 */
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  let changed = false;

  for (const message of incoming) {
    const known = byId.get(message.id);
    if (known === undefined) {
      byId.set(message.id, message);
      changed = true;
      continue;
    }
    const status = laterStatus(known.status, message.status);
    const merged: Message = { ...known, ...message, ...(status ? { status } : {}) };
    // Ссылку и подпись вложения отдают не все методы: уже известные не теряем.
    if (merged.attachment && known.attachment) {
      merged.attachment = {
        ...merged.attachment,
        url: merged.attachment.url ?? known.attachment.url,
        name: merged.attachment.name ?? known.attachment.name,
      };
    }
    if (merged.status !== 'error') {
      delete merged.error;
    }
    if (!sameContent(known, merged)) {
      byId.set(message.id, merged);
      changed = true;
    }
  }

  return changed ? [...byId.values()].sort(compareMessages) : current;
}
