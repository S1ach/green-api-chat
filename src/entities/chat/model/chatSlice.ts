import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { mergeMessages, type IncomingTextMessage, type Message } from '@/entities/message/@x/chat';
import type { RemoteChat } from '@/shared/api';
import { isSameChat } from '@/shared/lib/chatId';
import { formatPhone, phoneFromChatId } from '@/shared/lib/phone';
import type { Chat } from './types';

/**
 * Чаты и их сообщения. Данные приходят из четырёх источников — GetChats, GetChatHistory,
 * очередь уведомлений и отправка, — поэтому сводятся здесь в один список без дублей.
 */
export interface ChatState {
  chats: Record<string, Chat>;
  /** Порядок чатов: свежие сверху. */
  chatOrder: string[];
  messages: Record<string, Message[]>;
  activeChatId: string | null;
}

export const initialChatState: ChatState = {
  chats: {},
  chatOrder: [],
  messages: {},
  activeChatId: null,
};

const PREVIEW_LENGTH = 60;
const NO_MESSAGES: Message[] = [];

function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > PREVIEW_LENGTH ? `${oneLine.slice(0, PREVIEW_LENGTH)}…` : oneLine;
}

function moveToTop(order: string[], chatId: string): string[] {
  return [chatId, ...order.filter((id) => id !== chatId)];
}

function titleFor(phone: string | null, chatId: string): string {
  return phone !== null ? formatPhone(phone) : chatId;
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
  const sameId = state.chatOrder.find((id) => isSameChat(id, chatId));
  if (sameId !== undefined) {
    return sameId;
  }
  const phone = senderPhone ?? phoneFromChatId(chatId);
  if (phone === null) {
    return null;
  }
  return state.chatOrder.find((id) => state.chats[id]?.phone === phone) ?? null;
}

const chatSlice = createSlice({
  name: 'chat',
  initialState: initialChatState,
  reducers: {
    /** Чаты инстанса, сохранённые в localStorage в прошлый раз. */
    chatsRestored: (_state, action: PayloadAction<ChatState>) => action.payload,

    /** Пользователь создал чат по номеру (или открыл уже существующий). */
    chatOpened: {
      prepare: (payload: { chatId: string; phone: string | null; title?: string }) => ({
        payload: { ...payload, openedAt: Date.now() },
      }),
      reducer(
        state,
        action: PayloadAction<{
          chatId: string;
          phone: string | null;
          title?: string;
          openedAt: number;
        }>,
      ) {
        const { chatId, phone, title, openedAt } = action.payload;
        const existing = state.chats[chatId];
        if (existing) {
          existing.phone = phone ?? existing.phone;
          existing.unreadCount = 0;
        } else {
          state.chats[chatId] = {
            id: chatId,
            phone,
            title: title ?? titleFor(phone, chatId),
            chatType: 'user',
            unreadCount: 0,
            lastActivity: openedAt,
            lastPreview: '',
          };
          state.chatOrder.unshift(chatId);
        }
        state.messages[chatId] ??= [];
        state.activeChatId = chatId;
      },
    },

    /** Выбор чата в списке; `null` — вернуться к списку (мобильный вид). */
    chatSelected(state, action: PayloadAction<string | null>) {
      const chatId = action.payload;
      if (chatId === null) {
        state.activeChatId = null;
        return;
      }
      const chat = state.chats[chatId];
      if (!chat) {
        return;
      }
      state.activeChatId = chatId;
      chat.unreadCount = 0;
    },

    /**
     * Список чатов из GetChats дополняет локальный: уже известные (в том числе созданные
     * по запасному chatId "номер@c.us") не дублируем, а лишь уточняем имя и номер.
     */
    chatsLoaded(state, action: PayloadAction<RemoteChat[]>) {
      for (const remote of action.payload) {
        const knownId = resolveChatId(state, remote.chatId, remote.phone);
        const known = knownId !== null ? state.chats[knownId] : undefined;
        if (known) {
          known.phone ??= remote.phone;
          known.title = remote.name !== '' ? remote.name : known.title;
          known.chatType = remote.type ?? known.chatType;
          continue;
        }
        state.chats[remote.chatId] = {
          id: remote.chatId,
          phone: remote.phone,
          title: remote.name !== '' ? remote.name : titleFor(remote.phone, remote.chatId),
          chatType: remote.type,
          unreadCount: 0,
          lastActivity: 0,
          lastPreview: '',
        };
        state.chatOrder.push(remote.chatId);
      }
    },

    /** Сообщения чата из GetChatHistory: сливаются с уже известными без дублей. */
    historyLoaded(state, action: PayloadAction<{ chatId: string; messages: Message[] }>) {
      const { chatId, messages } = action.payload;
      const chat = state.chats[chatId];
      if (!chat) {
        return;
      }
      const merged = mergeMessages(messages, state.messages[chatId] ?? []);
      state.messages[chatId] = merged;

      const last = merged[merged.length - 1];
      if (last === undefined || (last.timestamp < chat.lastActivity && chat.lastPreview !== '')) {
        return;
      }
      chat.lastActivity = Math.max(chat.lastActivity, last.timestamp);
      chat.lastPreview = preview(last.text);
      // Как в мессенджере: сверху чаты с самыми свежими сообщениями (сортировка стабильная).
      state.chatOrder.sort(
        (a, b) => (state.chats[b]?.lastActivity ?? 0) - (state.chats[a]?.lastActivity ?? 0),
      );
    },

    /** SendMessage подтвердил отправку: исходящее сообщение появляется в чате. */
    messageSent(state, action: PayloadAction<Message>) {
      const message = action.payload;
      const chat = state.chats[message.chatId];
      if (!chat) {
        return;
      }
      // GetChatHistory мог вернуть это же сообщение раньше — оставляем одно.
      state.messages[chat.id] = mergeMessages(state.messages[chat.id] ?? [], [message]);
      chat.lastActivity = message.timestamp;
      chat.lastPreview = preview(message.text);
      state.chatOrder = moveToTop(state.chatOrder, chat.id);
    },

    /** Входящее текстовое сообщение из очереди уведомлений. */
    messageReceived(state, action: PayloadAction<IncomingTextMessage>) {
      const incoming = action.payload;
      const phone = incoming.senderPhone ?? phoneFromChatId(incoming.chatId);
      const chatId = resolveChatId(state, incoming.chatId, incoming.senderPhone) ?? incoming.chatId;

      const messages = (state.messages[chatId] ??= []);
      // Уведомление может прийти повторно — не дублируем сообщение.
      if (messages.some((message) => message.id === incoming.idMessage)) {
        return;
      }
      messages.push({
        id: incoming.idMessage,
        chatId,
        direction: 'incoming',
        text: incoming.text,
        timestamp: incoming.timestamp,
      });

      // Чата ещё нет — создаём его автоматически.
      const chat = (state.chats[chatId] ??= {
        id: chatId,
        phone,
        title: incoming.senderName ?? titleFor(phone, chatId),
        chatType: null,
        unreadCount: 0,
        lastActivity: incoming.timestamp,
        lastPreview: '',
      });
      chat.phone ??= phone;
      chat.lastActivity = incoming.timestamp;
      chat.lastPreview = preview(incoming.text);
      chat.unreadCount = state.activeChatId === chatId ? 0 : chat.unreadCount + 1;
      state.chatOrder = moveToTop(state.chatOrder, chatId);
    },
  },
  selectors: {
    /** Список чатов в порядке отображения. */
    selectChats: createSelector(
      [(state: ChatState) => state.chats, (state: ChatState) => state.chatOrder],
      (chats, chatOrder) =>
        chatOrder.map((id) => chats[id]).filter((chat): chat is Chat => chat !== undefined),
    ),
    selectActiveChat: (state) =>
      state.activeChatId === null ? null : (state.chats[state.activeChatId] ?? null),
    selectMessages: (state, chatId: string) => state.messages[chatId] ?? NO_MESSAGES,
  },
});

export const chatReducer = chatSlice.reducer;
export const {
  chatsRestored,
  chatOpened,
  chatSelected,
  chatsLoaded,
  historyLoaded,
  messageSent,
  messageReceived,
} = chatSlice.actions;
export const { selectChats, selectActiveChat, selectMessages } = chatSlice.selectors;
