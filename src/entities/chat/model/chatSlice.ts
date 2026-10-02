import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  mergeMessages,
  previewText,
  type Message,
  type MessageStatus,
  type ReceivedMessage,
} from '@/entities/message/@x/chat';
import type { RemoteChat } from '@/shared/api';
import { isSameChat } from '@/shared/lib/chatId';
import { formatPhone, phoneFromChatId } from '@/shared/lib/phone';
import type { Chat } from './types';

/**
 * Чаты и их сообщения. Данные приходят из нескольких источников — GetChats, GetChatHistory,
 * журналы, очередь уведомлений и отправка, — поэтому сводятся здесь в один список без дублей.
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

const PREVIEW_LENGTH = 80;
const NO_MESSAGES: Message[] = [];

function preview(message: Message): string {
  const oneLine = previewText(message).replace(/\s+/g, ' ').trim();
  return oneLine.length > PREVIEW_LENGTH ? `${oneLine.slice(0, PREVIEW_LENGTH)}…` : oneLine;
}

function titleFor(phone: string | null, chatId: string): string {
  return phone !== null ? formatPhone(phone) : chatId;
}

/**
 * Ищет чат, которому принадлежит сообщение.
 * chatId бывает числовым (MAX) или вида "номер@c.us",
 * поэтому сверяем и по id, и по сохранённому номеру.
 */
export function resolveChatId(
  state: ChatState,
  chatId: string,
  phone: string | null,
): string | null {
  if (state.chats[chatId]) {
    return chatId;
  }
  const sameId = state.chatOrder.find((id) => isSameChat(id, chatId));
  if (sameId !== undefined) {
    return sameId;
  }
  const knownPhone = phone ?? phoneFromChatId(chatId);
  if (knownPhone === null) {
    return null;
  }
  return state.chatOrder.find((id) => state.chats[id]?.phone === knownPhone) ?? null;
}

/** Как в мессенджере: сверху чаты с самыми свежими сообщениями (сортировка стабильная). */
function sortChats(state: ChatState): void {
  const sorted = [...state.chatOrder].sort(
    (a, b) => (state.chats[b]?.lastActivity ?? 0) - (state.chats[a]?.lastActivity ?? 0),
  );
  if (sorted.some((id, index) => id !== state.chatOrder[index])) {
    state.chatOrder = sorted;
  }
}

/** Превью и время чата всегда выводятся из его последнего сообщения. */
function summarize(state: ChatState, chatId: string): void {
  const chat = state.chats[chatId];
  const list = state.messages[chatId];
  const last = list?.[list.length - 1];
  if (!chat || last === undefined) {
    return;
  }
  chat.lastPreview = preview(last);
  chat.lastActivity = Math.max(chat.lastActivity, last.timestamp);
  sortChats(state);
}

/**
 * Кладёт сообщение из GREEN-API (уведомление или журнал) в нужный чат.
 * Чата ещё нет — создаёт его. Уже известное сообщение не дублируется, но может
 * обновить статус. `countUnread` выключают при первоначальной загрузке: тогда
 * неизвестно, какие из сообщений пользователь уже видел.
 */
function applyReceived(state: ChatState, received: ReceivedMessage, countUnread: boolean): void {
  const { message, chat: hint } = received;
  const phone = hint.phone ?? phoneFromChatId(message.chatId);
  const chatId = resolveChatId(state, message.chatId, hint.phone) ?? message.chatId;

  const known = state.messages[chatId] ?? NO_MESSAGES;
  const isNew = !known.some(({ id }) => id === message.id);
  const merged = mergeMessages(known, [{ ...message, chatId }]);
  if (merged === known) {
    return;
  }
  state.messages[chatId] = merged;

  const chat = (state.chats[chatId] ??= {
    id: chatId,
    phone,
    title: hint.name ?? titleFor(phone, chatId),
    chatType: hint.type,
    unreadCount: 0,
    lastActivity: 0,
    lastPreview: '',
  });
  if (!state.chatOrder.includes(chatId)) {
    state.chatOrder.push(chatId);
  }
  chat.phone ??= phone;
  if (isNew && countUnread && message.direction === 'incoming' && state.activeChatId !== chatId) {
    chat.unreadCount += 1;
  }
  summarize(state, chatId);
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

    /** Выбор чата в списке; `null` — закрыть открытый чат. */
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

    /**
     * Аватар чата запрошен. `url: null` — запрос не удался: прежняя ссылка остаётся,
     * меняется только время следующей попытки.
     */
    avatarChecked(
      state,
      action: PayloadAction<{ chatId: string; url: string | null; refreshAt: number }>,
    ) {
      const { chatId, url, refreshAt } = action.payload;
      const chat = state.chats[chatId];
      if (chat) {
        chat.avatar = { url: url ?? chat.avatar?.url ?? '', refreshAt };
      }
    },

    /** Сообщения чата из GetChatHistory: дополняют уже известные, ничего не затирая. */
    historyLoaded(state, action: PayloadAction<{ chatId: string; messages: Message[] }>) {
      const { chatId, messages } = action.payload;
      if (!state.chats[chatId]) {
        return;
      }
      state.messages[chatId] = mergeMessages(state.messages[chatId] ?? NO_MESSAGES, messages);
      summarize(state, chatId);
    },

    /** Новое сообщение из очереди уведомлений: входящее либо отправленное с другого устройства. */
    messageReceived(state, action: PayloadAction<ReceivedMessage>) {
      applyReceived(state, action.payload, true);
    },

    /** Сообщения разных чатов из журналов: первоначальная загрузка и страховочная сверка. */
    messagesSynced(
      state,
      action: PayloadAction<{ received: ReceivedMessage[]; countUnread: boolean }>,
    ) {
      for (const received of action.payload.received) {
        applyReceived(state, received, action.payload.countUnread);
      }
    },

    /** Изменился статус отправленного сообщения (доставлено, прочитано, не доставлено). */
    messageStatusChanged(
      state,
      action: PayloadAction<{
        chatId: string;
        idMessage: string;
        status: MessageStatus;
        error?: string;
      }>,
    ) {
      const { idMessage, status, error } = action.payload;
      const chatId = resolveChatId(state, action.payload.chatId, null);
      if (chatId === null) {
        return;
      }
      const list = state.messages[chatId] ?? NO_MESSAGES;
      const message = list.find(({ id }) => id === idMessage);
      if (message === undefined) {
        return;
      }
      if (status === 'error') {
        message.status = 'error';
        if (error !== undefined) {
          message.error = error;
        }
        return;
      }
      // Слияние повышает статус, но не понижает: «прочитано» не станет «доставлено».
      state.messages[chatId] = mergeMessages(list, [{ ...message, status }]);
    },

    /** Пользователь отправил сообщение: оно сразу появляется в чате со статусом «отправляется». */
    messageQueued(state, action: PayloadAction<Message>) {
      const message = action.payload;
      if (!state.chats[message.chatId]) {
        return;
      }
      state.messages[message.chatId] = mergeMessages(
        state.messages[message.chatId] ?? NO_MESSAGES,
        [message],
      );
      summarize(state, message.chatId);
    },

    /**
     * GREEN-API подтвердил отправку: временный идентификатор заменяется на idMessage.
     * Если уведомление или история успели принести это сообщение раньше, остаётся одно.
     * `fileUrl` — ссылка на загруженный файл из ответа SendFileByUpload.
     */
    messageSendSucceeded(
      state,
      action: PayloadAction<{
        chatId: string;
        localId: string;
        idMessage: string;
        fileUrl?: string | null;
      }>,
    ) {
      const { chatId, localId, idMessage, fileUrl } = action.payload;
      const list = state.messages[chatId];
      const local = list?.find(({ id }) => id === localId);
      if (list === undefined || local === undefined) {
        return;
      }
      const sent: Message = { ...local, id: idMessage, status: 'sent' };
      delete sent.error;
      if (sent.attachment && fileUrl) {
        sent.attachment = { ...sent.attachment, url: fileUrl };
      }
      state.messages[chatId] = mergeMessages(
        list.filter(({ id }) => id !== localId),
        list.some(({ id }) => id === idMessage) ? [] : [sent],
      );
      summarize(state, chatId);
    },

    /** GREEN-API не принял сообщение: оно остаётся в чате с ошибкой и возможностью повтора. */
    messageSendFailed(
      state,
      action: PayloadAction<{ chatId: string; localId: string; error: string }>,
    ) {
      const { chatId, localId, error } = action.payload;
      const message = state.messages[chatId]?.find(({ id }) => id === localId);
      if (message) {
        message.status = 'error';
        message.error = error;
      }
    },

    /** Повторная отправка сообщения с ошибкой. */
    messageRetried(state, action: PayloadAction<{ chatId: string; localId: string }>) {
      const { chatId, localId } = action.payload;
      const message = state.messages[chatId]?.find(({ id }) => id === localId);
      if (message) {
        message.status = 'sending';
        delete message.error;
      }
    },

    /** Пользователь убрал неотправленное сообщение. */
    messageRemoved(state, action: PayloadAction<{ chatId: string; id: string }>) {
      const { chatId, id } = action.payload;
      const list = state.messages[chatId];
      if (list === undefined) {
        return;
      }
      state.messages[chatId] = list.filter((message) => message.id !== id);
      const chat = state.chats[chatId];
      if (chat && state.messages[chatId]?.length === 0) {
        chat.lastPreview = '';
      }
      summarize(state, chatId);
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
  avatarChecked,
  chatsRestored,
  chatOpened,
  chatSelected,
  chatsLoaded,
  historyLoaded,
  messageReceived,
  messagesSynced,
  messageStatusChanged,
  messageQueued,
  messageSendSucceeded,
  messageSendFailed,
  messageRetried,
  messageRemoved,
} = chatSlice.actions;
export const { selectChats, selectActiveChat, selectMessages } = chatSlice.selectors;
