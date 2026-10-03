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

export interface ChatState {
  chats: Record<string, Chat>;
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

// chatId бывает числовым или вида номер@c.us, поэтому ищем и по id, и по номеру
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

// сервер может знать чат под другим chatId, чем тот, по которому его создали:
// тогда общее сообщение — единственное, что их связывает
function findChatByMessage(state: ChatState, messageId: string, except?: string): string | null {
  return (
    state.chatOrder.find(
      (id) => id !== except && state.messages[id]?.some((message) => message.id === messageId),
    ) ?? null
  );
}

// пока шёл запрос, чат могли перенести на другой chatId
function locateMessage(state: ChatState, chatId: string, messageId: string): string | null {
  if (state.messages[chatId]?.some(({ id }) => id === messageId)) {
    return chatId;
  }
  return findChatByMessage(state, messageId);
}

function sortChats(state: ChatState): void {
  const sorted = [...state.chatOrder].sort(
    (a, b) => (state.chats[b]?.lastActivity ?? 0) - (state.chats[a]?.lastActivity ?? 0),
  );
  if (sorted.some((id, index) => id !== state.chatOrder[index])) {
    state.chatOrder = sorted;
  }
}

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

// переносит чат на другой chatId; если такой чат уже есть — сливает их в один
function moveChat(state: ChatState, fromId: string, toId: string): void {
  const from = state.chats[fromId];
  if (!from || fromId === toId) {
    return;
  }
  const moved = (state.messages[fromId] ?? NO_MESSAGES).map((message) => ({
    ...message,
    chatId: toId,
  }));
  state.messages[toId] = mergeMessages(state.messages[toId] ?? NO_MESSAGES, moved);
  delete state.messages[fromId];

  const to = state.chats[toId];
  if (to) {
    // имя с сервера оставляем, а chatId вместо имени меняем на номер
    if (to.title === titleFor(to.phone, toId)) {
      to.title = from.title;
    }
    to.phone ??= from.phone;
    to.unreadCount += from.unreadCount;
    to.lastActivity = Math.max(to.lastActivity, from.lastActivity);
    to.avatar ??= from.avatar;
    state.chatOrder = state.chatOrder.filter((id) => id !== fromId);
  } else {
    state.chats[toId] = { ...from, id: toId };
    state.chatOrder = state.chatOrder.map((id) => (id === fromId ? toId : id));
  }
  delete state.chats[fromId];

  if (state.activeChatId === fromId) {
    state.activeChatId = toId;
  }
  const merged = state.chats[toId];
  if (merged && state.activeChatId === toId) {
    merged.unreadCount = 0;
  }
  summarize(state, toId);
}

// эхо отправленного сообщения приходит с серверным chatId: чат, созданный по запасному
// номер@c.us, узнаём по idMessage и переносим на серверный chatId
function adoptServerChatId(state: ChatState, message: Message): string | null {
  const holder = findChatByMessage(state, message.id);
  if (holder === null) {
    return null;
  }
  moveChat(state, holder, message.chatId);
  return message.chatId;
}

// countUnread выключен при первой загрузке: непонятно, что пользователь уже видел
function applyReceived(state: ChatState, received: ReceivedMessage, countUnread: boolean): void {
  const { message, chat: hint } = received;
  const phone = hint.phone ?? phoneFromChatId(message.chatId);
  const chatId =
    resolveChatId(state, message.chatId, hint.phone) ??
    adoptServerChatId(state, message) ??
    message.chatId;

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
    chatsRestored: (_state, action: PayloadAction<ChatState>) => action.payload,

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

    // чаты из GetChats не дублируем, только уточняем имя и номер
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

    // url: null — запрос не удался, старая ссылка остаётся
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

    historyLoaded(state, action: PayloadAction<{ chatId: string; messages: Message[] }>) {
      const { chatId, messages } = action.payload;
      if (!state.chats[chatId]) {
        return;
      }
      state.messages[chatId] = mergeMessages(state.messages[chatId] ?? NO_MESSAGES, messages);
      summarize(state, chatId);
    },

    messageReceived(state, action: PayloadAction<ReceivedMessage>) {
      applyReceived(state, action.payload, true);
    },

    messagesSynced(
      state,
      action: PayloadAction<{ received: ReceivedMessage[]; countUnread: boolean }>,
    ) {
      for (const received of action.payload.received) {
        applyReceived(state, received, action.payload.countUnread);
      }
    },

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
      const chatId =
        resolveChatId(state, action.payload.chatId, null) ?? findChatByMessage(state, idMessage);
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
      // статус только повышается
      state.messages[chatId] = mergeMessages(list, [{ ...message, status }]);
    },

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

    // временный id меняем на idMessage; если сообщение уже пришло из очереди или истории, остаётся одно
    messageSendSucceeded(
      state,
      action: PayloadAction<{
        chatId: string;
        localId: string;
        idMessage: string;
        fileUrl?: string | null;
      }>,
    ) {
      const { localId, idMessage, fileUrl } = action.payload;
      const chatId = locateMessage(state, action.payload.chatId, localId);
      const list = chatId === null ? undefined : state.messages[chatId];
      const local = list?.find(({ id }) => id === localId);
      if (chatId === null || list === undefined || local === undefined) {
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

      // эхо пришло раньше ответа и уже завело чат под серверным chatId
      const echoed = findChatByMessage(state, idMessage, chatId);
      if (echoed !== null) {
        moveChat(state, chatId, echoed);
      }
    },

    messageSendFailed(
      state,
      action: PayloadAction<{ chatId: string; localId: string; error: string }>,
    ) {
      const { localId, error } = action.payload;
      const chatId = locateMessage(state, action.payload.chatId, localId);
      const message =
        chatId === null ? undefined : state.messages[chatId]?.find(({ id }) => id === localId);
      if (message) {
        message.status = 'error';
        message.error = error;
      }
    },

    messageRetried(state, action: PayloadAction<{ chatId: string; localId: string }>) {
      const { chatId, localId } = action.payload;
      const message = state.messages[chatId]?.find(({ id }) => id === localId);
      if (message) {
        message.status = 'sending';
        delete message.error;
      }
    },

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
