import { isRecord, readNumber, readRecord, readString } from '@/shared/lib/guards';
import { formatPhone } from '@/shared/lib/phone';
import type { Attachment, AttachmentKind, Message } from '../model/types';

export type MessageContent = Pick<Message, 'text' | 'attachment'>;

const TEXT_TYPES = new Set(['textMessage', 'extendedTextMessage', 'quotedMessage']);

// реакции, правки и удаления сюда не попадают
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

export function attachmentKindOfFile(mimeType: string): AttachmentKind {
  const [group] = mimeType.split('/');
  return group === 'image' || group === 'video' || group === 'audio' ? group : 'document';
}

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

export function previewText(message: MessageContent): string {
  if (message.text !== '') {
    return message.text;
  }
  return message.attachment ? attachmentLabel(message.attachment) : '';
}

// попадает в href — пропускаем только http(s)
export function safeUrl(value: string | null | undefined): string | null {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
}

export function locationAttachment(latitude: number, longitude: number): Attachment {
  return {
    kind: 'location',
    // у Яндекс Карт сначала долгота
    url: `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=16&l=map`,
    name: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
  };
}

export function contactAttachment(name: string | null): Attachment {
  return { kind: 'contact', url: null, name: name || null };
}

function locationFrom(data: Record<string, unknown> | null): Attachment {
  const latitude = data ? readNumber(data, 'latitude') : null;
  const longitude = data ? readNumber(data, 'longitude') : null;
  const isValid =
    latitude !== null &&
    longitude !== null &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  return isValid
    ? locationAttachment(latitude, longitude)
    : { kind: 'location', url: null, name: null };
}

function contactFrom(data: Record<string, unknown> | null): Attachment {
  const phoneNumber = data ? readNumber(data, 'phoneNumber') : null;
  const phone = phoneNumber !== null && phoneNumber > 0 ? formatPhone(String(phoneNumber)) : null;
  return contactAttachment((data ? readString(data, 'displayName') : null) || phone);
}

function attachmentFrom(typeMessage: string, source: Record<string, unknown>): Attachment {
  // в уведомлении файл лежит в fileMessageData, в истории — на верхнем уровне
  if (typeMessage === 'locationMessage') {
    return locationFrom(
      readRecord(source, 'locationMessageData') ?? readRecord(source, 'location'),
    );
  }
  if (typeMessage === 'contactMessage') {
    return contactFrom(readRecord(source, 'contactMessageData') ?? readRecord(source, 'contact'));
  }
  const file = readRecord(source, 'fileMessageData') ?? source;
  return {
    kind: ATTACHMENT_KINDS[typeMessage] ?? 'document',
    url: safeUrl(readString(file, 'downloadUrl')),
    name: readString(file, 'fileName') || null,
  };
}

// null — это не сообщение (реакция, правка, удаление) или данные битые
export function contentFromNotification(messageData: unknown): MessageContent | null {
  if (!isRecord(messageData)) {
    return null;
  }
  const typeMessage = readString(messageData, 'typeMessage');
  if (typeMessage === null) {
    return null;
  }

  if (typeMessage === 'textMessage') {
    const text = readTextField(readRecord(messageData, 'textMessageData'), 'textMessage');
    return text === null ? null : { text };
  }
  if (TEXT_TYPES.has(typeMessage)) {
    const text = readTextField(readRecord(messageData, 'extendedTextMessageData'), 'text');
    return text === null ? null : { text };
  }
  if (typeMessage in ATTACHMENT_KINDS) {
    const file = readRecord(messageData, 'fileMessageData');
    return {
      text: (file ? readString(file, 'caption') : null) ?? '',
      attachment: attachmentFrom(typeMessage, messageData),
    };
  }
  return null;
}

// в истории и журналах поля лежат на верхнем уровне
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
