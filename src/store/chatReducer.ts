import type { Chat, ChatMessage, MessageStatus } from '../types/chat';
import type { IncomingTextMessage } from '../utils/notification';
import { formatPhone, phoneFromChatId } from '../utils/phone';

export interface ChatState {
  chats: Record<string, Chat>;
  /** Порядок чатов: свежие сверху. */
  chatOrder: string[];
  messages: Record<string, ChatMessage[]>;
  activeChatId: string | null;
}

export const initialChatState: ChatState = {
  chats: {},
  chatOrder: [],
  messages: {},
  activeChatId: null,
};

export type ChatAction =
  | { type: 'hydrate'; payload: ChatState }
  | { type: 'chat/open'; payload: { chatId: string; phone: string | null; title?: string } }
  | { type: 'chat/select'; payload: { chatId: string | null } }
  | { type: 'message/enqueue'; payload: { message: ChatMessage } }
  | {
      type: 'message/status';
      payload: { chatId: string; localId: string; status: MessageStatus; id?: string; error?: string };
    }
  | { type: 'message/incoming'; payload: IncomingTextMessage }
  | { type: 'reset' };

const PREVIEW_LENGTH = 60;

function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > PREVIEW_LENGTH ? `${oneLine.slice(0, PREVIEW_LENGTH)}…` : oneLine;
}

function moveToTop(order: string[], chatId: string): string[] {
  return [chatId, ...order.filter((id) => id !== chatId)];
}

/**
 * Ищет чат, которому принадлежит входящее сообщение.
 * senderData.chatId бывает числовым (MAX) или вида "номер@c.us",
 * поэтому сверяем и по id, и по сохранённому номеру.
 */
export function resolveChatId(
  state: ChatState,
  chatId: string,
  senderPhone: string | null,
): string | null {
  if (state.chats[chatId]) {
    return chatId;
  }
  const phone = senderPhone ?? phoneFromChatId(chatId);
  if (phone === null) {
    return null;
  }
  return state.chatOrder.find((id) => state.chats[id]?.phone === phone) ?? null;
}

function titleFor(phone: string | null, chatId: string): string {
  return phone !== null ? formatPhone(phone) : chatId;
}

function appendMessage(state: ChatState, chatId: string, message: ChatMessage): ChatState {
  const chatMessages = state.messages[chatId] ?? [];
  return {
    ...state,
    messages: { ...state.messages, [chatId]: [...chatMessages, message] },
    chatOrder: moveToTop(state.chatOrder, chatId),
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'hydrate':
      return action.payload;

    case 'chat/open': {
      const { chatId, phone } = action.payload;
      const existing = state.chats[chatId];
      const chat: Chat = existing
        ? { ...existing, phone: phone ?? existing.phone, unreadCount: 0 }
        : {
            id: chatId,
            phone,
            title: action.payload.title ?? titleFor(phone, chatId),
            unreadCount: 0,
            lastActivity: Date.now(),
            lastPreview: '',
          };
      return {
        ...state,
        chats: { ...state.chats, [chatId]: chat },
        messages: { ...state.messages, [chatId]: state.messages[chatId] ?? [] },
        chatOrder: state.chatOrder.includes(chatId)
          ? state.chatOrder
          : [chatId, ...state.chatOrder],
        activeChatId: chatId,
      };
    }

    case 'chat/select': {
      const { chatId } = action.payload;
      if (chatId === null) {
        return { ...state, activeChatId: null };
      }
      const chat = state.chats[chatId];
      if (!chat) {
        return state;
      }
      return {
        ...state,
        activeChatId: chatId,
        chats: { ...state.chats, [chatId]: { ...chat, unreadCount: 0 } },
      };
    }

    case 'message/enqueue': {
      const { message } = action.payload;
      const chat = state.chats[message.chatId];
      if (!chat) {
        return state;
      }
      const next = appendMessage(state, message.chatId, message);
      return {
        ...next,
        chats: {
          ...next.chats,
          [message.chatId]: {
            ...chat,
            lastActivity: message.timestamp,
            lastPreview: preview(message.text),
          },
        },
      };
    }

    case 'message/status': {
      const { chatId, localId, status, id, error } = action.payload;
      const chatMessages = state.messages[chatId];
      if (!chatMessages) {
        return state;
      }
      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map((message) =>
            message.id === localId
              ? { ...message, status, id: id ?? message.id, ...(error ? { error } : {}) }
              : message,
          ),
        },
      };
    }

    case 'message/incoming': {
      const incoming = action.payload;
      const phone = incoming.senderPhone ?? phoneFromChatId(incoming.chatId);
      const chatId = resolveChatId(state, incoming.chatId, incoming.senderPhone) ?? incoming.chatId;

      // Уведомление может прийти повторно — не дублируем сообщение.
      if ((state.messages[chatId] ?? []).some((message) => message.id === incoming.idMessage)) {
        return state;
      }

      const existing = state.chats[chatId];
      const chat: Chat = existing ?? {
        id: chatId,
        phone,
        title: incoming.senderName ?? titleFor(phone, chatId),
        unreadCount: 0,
        lastActivity: incoming.timestamp,
        lastPreview: '',
      };

      const isActive = state.activeChatId === chatId;
      const withChat: ChatState = {
        ...state,
        chats: { ...state.chats, [chatId]: chat },
        messages: { ...state.messages, [chatId]: state.messages[chatId] ?? [] },
        chatOrder: state.chatOrder.includes(chatId)
          ? state.chatOrder
          : [chatId, ...state.chatOrder],
      };

      const next = appendMessage(withChat, chatId, {
        id: incoming.idMessage,
        chatId,
        direction: 'incoming',
        text: incoming.text,
        timestamp: incoming.timestamp,
        status: 'sent',
      });

      return {
        ...next,
        chats: {
          ...next.chats,
          [chatId]: {
            ...chat,
            phone: chat.phone ?? phone,
            lastActivity: incoming.timestamp,
            lastPreview: preview(incoming.text),
            unreadCount: isActive ? 0 : chat.unreadCount + 1,
          },
        },
      };
    }

    case 'reset':
      return initialChatState;

    default:
      return state;
  }
}

/** Список чатов в порядке отображения. */
export function selectChats(state: ChatState): Chat[] {
  return state.chatOrder
    .map((id) => state.chats[id])
    .filter((chat): chat is Chat => chat !== undefined);
}
