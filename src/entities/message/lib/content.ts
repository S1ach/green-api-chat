import { isRecord, readRecord, readString } from '@/shared/lib/guards';
import type { Attachment, AttachmentKind, Message } from '../model/types';

/** Содержимое сообщения: текст (или подпись) и вложение, если оно есть. */
export type MessageContent = Pick<Message, 'text' | 'attachment'>;

/** typeMessage, в которых содержимое — текст. */
const TEXT_TYPES = new Set(['textMessage', 'extendedTextMessage', 'quotedMessage']);

/** typeMessage с вложением. Реакции, правки и удаления сообщениями не считаются. */
const ATTACHMENT_KINDS: Record<string, AttachmentKind> = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
  locationMessage: 'location',
  contactMessage: 'contact',
  pollMessage: 'poll',
};

const ATTACHMENT_LABELS: Record<AttachmentKind, string> = {
  image: 'Фото',
  video: 'Видео',
  audio: 'Аудио',
  document: 'Файл',
  sticker: 'Стикер',
  location: 'Геопозиция',
  contact: 'Контакт',
  poll: 'Опрос',
};

export function attachmentLabel(attachment: Attachment): string {
  return ATTACHMENT_LABELS[attachment.kind];
}

/** Одна строка для списка чатов: текст сообщения, а для вложения без подписи — его название. */
export function previewText(message: Pick<Message, 'text' | 'attachment'>): string {
  if (message.text !== '') {
    return message.text;
  }
  return message.attachment ? attachmentLabel(message.attachment) : '';
}

/** Ссылка приходит из сети и попадает в `href` — пропускаем только http(s). */
function safeUrl(value: string | null): string | null {
  return value !== null && /^https?:\/\//i.test(value) ? value : null;
}

function attachmentFrom(typeMessage: string, file: Record<string, unknown> | null): Attachment {
  return {
    kind: ATTACHMENT_KINDS[typeMessage] ?? 'document',
    url: safeUrl(file ? readString(file, 'downloadUrl') : null),
    fileName: (file ? readString(file, 'fileName') : null) || null,
  };
}

/**
 * Содержимое из `messageData` уведомления (формат MAX, GREEN-API v3):
 * - textMessage → textMessageData.textMessage;
 * - extendedTextMessage (текст со ссылкой), quotedMessage (ответ с цитатой) → extendedTextMessageData.text;
 * - image/video/audio/document/sticker → fileMessageData (downloadUrl, caption, fileName);
 * - location/contact/poll → вложение без файла.
 * `null` — тип не является сообщением (реакция, правка, удаление) или данные повреждены.
 */
export function contentFromNotification(messageData: unknown): MessageContent | null {
  if (!isRecord(messageData)) {
    return null;
  }
  const data = messageData;
  const typeMessage = readString(data, 'typeMessage');
  if (typeMessage === null) {
    return null;
  }

  if (typeMessage === 'textMessage') {
    const text = readTextField(readRecord(data, 'textMessageData'), 'textMessage');
    return text === null ? null : { text };
  }
  if (TEXT_TYPES.has(typeMessage)) {
    const text = readTextField(readRecord(data, 'extendedTextMessageData'), 'text');
    return text === null ? null : { text };
  }
  if (typeMessage in ATTACHMENT_KINDS) {
    const file = readRecord(data, 'fileMessageData');
    return {
      text: (file ? readString(file, 'caption') : null) ?? '',
      attachment: attachmentFrom(typeMessage, file),
    };
  }
  return null;
}

/**
 * Содержимое из элемента GetChatHistory и журналов: поля там лежат на верхнем уровне.
 * Текст — в `textMessage`; запасные места — `extendedTextMessage.text` и,
 * для цитат, `extendedTextMessageData.text`.
 */
export function contentFromHistory(item: Record<string, unknown>): MessageContent | null {
  const typeMessage = readString(item, 'typeMessage');
  if (typeMessage === null) {
    return null;
  }

  if (TEXT_TYPES.has(typeMessage)) {
    const text =
      nonEmpty(readString(item, 'textMessage')) ??
      nonEmpty(readTextField(readRecord(item, 'extendedTextMessage'), 'text')) ??
      nonEmpty(readTextField(readRecord(item, 'extendedTextMessageData'), 'text'));
    return text === null ? null : { text };
  }
  if (typeMessage in ATTACHMENT_KINDS) {
    return {
      text: readString(item, 'caption') ?? '',
      attachment: attachmentFrom(typeMessage, item),
    };
  }
  return null;
}

function readTextField(source: Record<string, unknown> | null, key: string): string | null {
  return source ? readString(source, key) : null;
}

function nonEmpty(value: string | null): string | null {
  return value !== null && value !== '' ? value : null;
}
