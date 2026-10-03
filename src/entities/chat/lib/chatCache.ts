import type { Attachment, Message, MessageStatus } from '@/entities/message/@x/chat';
import { isRecord, readNumber, readRecord, readString } from '@/shared/lib/guards';
import { loadJson, saveJson } from '@/shared/lib/storage';
import { initialChatState, type ChatState } from '../model/chatSlice';
import type { Chat, ChatAvatarInfo } from '../model/types';

// кэш на каждый инстанс свой; нужен, чтобы список появлялся сразу после перезагрузки
const KEY_PREFIX = 'greenapi.chats.v2.';

const HISTORY_LIMIT = 300;

function parseAvatar(raw: Record<string, unknown> | null): ChatAvatarInfo | null {
  const url = raw ? readString(raw, 'url') : null;
  const refreshAt = raw ? readNumber(raw, 'refreshAt') : null;
  return url === null || refreshAt === null ? null : { url, refreshAt };
}

function parseChat(raw: unknown): Chat | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = readString(raw, 'id');
  if (id === null) {
    return null;
  }
  const avatar = parseAvatar(readRecord(raw, 'avatar'));
  return {
    id,
    phone: readString(raw, 'phone'),
    title: readString(raw, 'title') ?? id,
    chatType: readString(raw, 'chatType'),
    unreadCount: readNumber(raw, 'unreadCount') ?? 0,
    lastActivity: readNumber(raw, 'lastActivity') ?? Date.now(),
    lastPreview: readString(raw, 'lastPreview') ?? '',
    ...(avatar !== null ? { avatar } : {}),
  };
}

const STATUSES: MessageStatus[] = ['sending', 'sent', 'delivered', 'read', 'error'];
const ATTACHMENT_KINDS: Attachment['kind'][] = [
  'image',
  'video',
  'audio',
  'document',
  'sticker',
  'location',
  'contact',
  'poll',
];

function parseAttachment(raw: Record<string, unknown> | null): Attachment | null {
  const kind = ATTACHMENT_KINDS.find((value) => value === raw?.kind);
  if (raw === null || kind === undefined) {
    return null;
  }
  // fileName — старое имя поля
  const name = readString(raw, 'name') ?? readString(raw, 'fileName');
  return { kind, url: readString(raw, 'url'), name };
}

function parseMessage(raw: unknown): Message | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = readString(raw, 'id');
  const chatId = readString(raw, 'chatId');
  const text = readString(raw, 'text');
  if (id === null || chatId === null || text === null) {
    return null;
  }
  const message: Message = {
    id,
    chatId,
    direction: readString(raw, 'direction') === 'incoming' ? 'incoming' : 'outgoing',
    text,
    timestamp: readNumber(raw, 'timestamp') ?? Date.now(),
  };

  const attachment = parseAttachment(readRecord(raw, 'attachment'));
  if (attachment !== null) {
    message.attachment = attachment;
  }
  const status = STATUSES.find((value) => value === raw.status);
  if (message.direction === 'outgoing' && status !== undefined) {
    // недоотправленное до перезагрузки считаем ошибкой
    message.status = status === 'sending' ? 'error' : status;
    const error =
      status === 'sending' ? 'Отправка прервана перезагрузкой страницы.' : readString(raw, 'error');
    if (message.status === 'error' && error !== null) {
      message.error = error;
    }
  }
  return message;
}

// в localStorage может лежать что угодно
function parseChatState(raw: unknown): ChatState | null {
  if (!isRecord(raw)) {
    return null;
  }
  const rawChats = isRecord(raw.chats) ? raw.chats : {};
  const rawMessages = isRecord(raw.messages) ? raw.messages : {};

  const chats: Record<string, Chat> = {};
  for (const [id, value] of Object.entries(rawChats)) {
    const chat = parseChat(value);
    if (chat !== null) {
      chats[id] = chat;
    }
  }

  const messages: Record<string, Message[]> = {};
  for (const [id, value] of Object.entries(rawMessages)) {
    if (!Array.isArray(value)) {
      continue;
    }
    messages[id] = value
      .map(parseMessage)
      .filter((message): message is Message => message !== null);
  }

  const chatOrder = Array.isArray(raw.chatOrder)
    ? raw.chatOrder.filter((id): id is string => typeof id === 'string' && id in chats)
    : [];

  return { chats, chatOrder, messages, activeChatId: null };
}

export function loadChatCache(idInstance: string): ChatState {
  return parseChatState(loadJson(KEY_PREFIX + idInstance)) ?? initialChatState;
}

export function saveChatCache(idInstance: string, state: ChatState): void {
  const messages: Record<string, Message[]> = {};
  for (const [chatId, list] of Object.entries(state.messages)) {
    messages[chatId] = list.slice(-HISTORY_LIMIT);
  }
  saveJson(KEY_PREFIX + idInstance, { ...state, messages });
}
