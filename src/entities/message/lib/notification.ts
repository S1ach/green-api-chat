import { isRecord, readNumber, readRecord, readString } from '@/shared/lib/guards';
import type { MessageStatus, ReceivedMessage } from '../model/types';
import { contentFromNotification } from './content';

export type ParsedNotification =
  | ({ kind: 'message' } & ReceivedMessage)
  | { kind: 'status'; chatId: string; idMessage: string; status: MessageStatus; error?: string };

const MESSAGE_WEBHOOKS: Record<string, 'incoming' | 'outgoing'> = {
  incomingMessageReceived: 'incoming',
  // с телефона или из другого клиента
  outgoingMessageReceived: 'outgoing',
  // через API
  outgoingAPIMessageReceived: 'outgoing',
};

const FAILED_STATUSES: Record<string, string> = {
  failed: 'MAX не принял сообщение.',
  noAccount: 'У получателя нет аккаунта MAX.',
  notInGroup: 'Вы не состоите в этом групповом чате.',
};

// для логов, без текста сообщения
export function describeNotification(body: unknown): string {
  if (!isRecord(body)) {
    return 'unknown';
  }
  const typeWebhook = readString(body, 'typeWebhook') ?? 'unknown';
  const messageData = readRecord(body, 'messageData');
  const typeMessage = messageData ? readString(messageData, 'typeMessage') : null;
  return typeMessage === null ? typeWebhook : `${typeWebhook}/${typeMessage}`;
}

function parseStatus(body: Record<string, unknown>): ParsedNotification | null {
  const chatId = readString(body, 'chatId');
  const idMessage = readString(body, 'idMessage');
  const status = readString(body, 'status');
  if (!chatId || !idMessage || status === null) {
    return null;
  }
  if (status === 'sent' || status === 'delivered' || status === 'read') {
    return { kind: 'status', chatId, idMessage, status };
  }
  const error = FAILED_STATUSES[status];
  return error === undefined ? null : { kind: 'status', chatId, idMessage, status: 'error', error };
}

// null — уведомление нам не нужно или оно битое
export function parseNotification(body: unknown): ParsedNotification | null {
  if (!isRecord(body)) {
    return null;
  }
  const typeWebhook = readString(body, 'typeWebhook');
  if (typeWebhook === 'outgoingMessageStatus') {
    return parseStatus(body);
  }

  const direction = typeWebhook === null ? undefined : MESSAGE_WEBHOOKS[typeWebhook];
  if (direction === undefined) {
    return null;
  }

  const senderData = readRecord(body, 'senderData');
  const chatId = senderData ? readString(senderData, 'chatId') : null;
  const content = contentFromNotification(body.messageData);
  if (senderData === null || !chatId || content === null) {
    return null;
  }

  const timestampSeconds = readNumber(body, 'timestamp');
  const timestamp = timestampSeconds !== null ? timestampSeconds * 1000 : Date.now();
  const chatType = readString(senderData, 'chatType');
  const chatName = readString(senderData, 'chatName') || null;
  const personalName =
    readString(senderData, 'senderContactName') || readString(senderData, 'senderName') || null;
  const isPersonalIncoming = direction === 'incoming' && chatType !== 'group';
  // 0 — номер скрыт
  const phoneNumber = readNumber(senderData, 'senderPhoneNumber');

  return {
    kind: 'message',
    message: {
      // нет idMessage — собираем ключ сами, чтобы повторная доставка не дала дубль
      id: readString(body, 'idMessage') || `${chatId}-${timestamp}`,
      chatId,
      direction,
      timestamp,
      ...content,
      ...(direction === 'outgoing' ? { status: 'sent' as const } : {}),
    },
    chat: {
      name: isPersonalIncoming ? (personalName ?? chatName) : chatName,
      phone:
        isPersonalIncoming && phoneNumber !== null && phoneNumber > 0 ? String(phoneNumber) : null,
      type: chatType,
    },
  };
}
