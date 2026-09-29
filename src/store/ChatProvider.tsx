import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { checkAccount, sendMessage } from '../api/greenApi';
import { GreenApiError } from '../api/errors';
import { useNotificationsPolling } from '../hooks/useNotificationsPolling';
import type { Chat, ChatMessage, MessageStatus } from '../types/chat';
import { isRecord, readNumber, readString } from '../utils/guards';
import { parseIncomingTextMessage } from '../utils/notification';
import { fallbackChatId, formatPhone, normalizePhone } from '../utils/phone';
import { loadJson, saveJson } from '../utils/storage';
import { useAuth } from './authContext';
import { chatReducer, initialChatState, selectChats, type ChatState } from './chatReducer';
import { ChatContext, type ChatContextValue, type OpenChatResult } from './chatContext';

/** Сколько последних сообщений чата сохраняем в localStorage. */
const HISTORY_LIMIT = 300;

/** Ошибки, при которых нельзя подменять CheckAccount запасным chatId. */
const FATAL_CHECK_KINDS = new Set(['unauthorized', 'quota', 'rateLimit', 'network']);

function parseChat(raw: unknown): Chat | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = readString(raw, 'id');
  if (id === null) {
    return null;
  }
  return {
    id,
    phone: readString(raw, 'phone'),
    title: readString(raw, 'title') ?? id,
    unreadCount: readNumber(raw, 'unreadCount') ?? 0,
    lastActivity: readNumber(raw, 'lastActivity') ?? Date.now(),
    lastPreview: readString(raw, 'lastPreview') ?? '',
  };
}

function parseMessage(raw: unknown): ChatMessage | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = readString(raw, 'id');
  const chatId = readString(raw, 'chatId');
  const text = readString(raw, 'text');
  if (id === null || chatId === null || text === null) {
    return null;
  }
  const status = readString(raw, 'status');
  const isIncoming = readString(raw, 'direction') === 'incoming';
  // Отправка не переживает перезагрузку — восстанавливаем такие сообщения как ошибочные.
  const restoredStatus: MessageStatus = isIncoming || status === 'sent' ? 'sent' : 'error';
  return {
    id,
    chatId,
    direction: isIncoming ? 'incoming' : 'outgoing',
    text,
    timestamp: readNumber(raw, 'timestamp') ?? Date.now(),
    status: restoredStatus,
    ...(status === 'sending' ? { error: 'Отправка прервана перезагрузкой страницы.' } : {}),
  };
}

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

  const messages: Record<string, ChatMessage[]> = {};
  for (const [id, value] of Object.entries(rawMessages)) {
    if (!Array.isArray(value)) {
      continue;
    }
    messages[id] = value
      .map(parseMessage)
      .filter((message): message is ChatMessage => message !== null);
  }

  const chatOrder = Array.isArray(raw.chatOrder)
    ? raw.chatOrder.filter((id): id is string => typeof id === 'string' && id in chats)
    : [];

  return { chats, chatOrder, messages, activeChatId: null };
}

function serialize(state: ChatState): ChatState {
  const messages: Record<string, ChatMessage[]> = {};
  for (const [chatId, list] of Object.entries(state.messages)) {
    messages[chatId] = list.slice(-HISTORY_LIMIT);
  }
  return { ...state, messages };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { credentials } = useAuth();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  const storageKey = credentials === null ? null : `greenapi.chats.${credentials.idInstance}`;

  useEffect(() => {
    if (storageKey === null) {
      dispatch({ type: 'reset' });
      setHydratedKey(null);
      return;
    }
    dispatch({
      type: 'hydrate',
      payload: parseChatState(loadJson(storageKey)) ?? initialChatState,
    });
    setHydratedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (storageKey === null || hydratedKey !== storageKey) {
      return;
    }
    saveJson(storageKey, serialize(state));
  }, [state, storageKey, hydratedKey]);

  const handleNotification = useCallback((body: unknown) => {
    const incoming = parseIncomingTextMessage(body);
    if (incoming !== null) {
      dispatch({ type: 'message/incoming', payload: incoming });
    }
  }, []);

  const { error: pollingError } = useNotificationsPolling({
    credentials,
    onNotification: handleNotification,
  });

  const openChatByPhone = useCallback(
    async (input: string): Promise<OpenChatResult> => {
      if (credentials === null) {
        throw new Error('Нет активной сессии.');
      }
      const phone = normalizePhone(input);
      if (phone === null) {
        throw new Error('Не удалось распознать номер. Пример: +7 999 123-45-67.');
      }

      const existing = selectChats(state).find((chat) => chat.phone === phone);
      if (existing) {
        dispatch({ type: 'chat/select', payload: { chatId: existing.id } });
        return { chatId: existing.id, warning: null };
      }

      let chatId = fallbackChatId(phone);
      let warning: string | null = null;

      try {
        const result = await checkAccount(credentials, phone);
        if ('status' in result) {
          throw new GreenApiError(result.reason, 'forbidden');
        }
        if (!result.exist) {
          throw new Error(`Номер ${formatPhone(phone)} не зарегистрирован в MAX.`);
        }
        if (result.chatId !== '') {
          chatId = result.chatId;
        }
      } catch (error) {
        if (error instanceof GreenApiError && !FATAL_CHECK_KINDS.has(error.kind)) {
          warning = `Проверка номера недоступна (${error.message}) — чат создан по запасному идентификатору.`;
        } else {
          throw error;
        }
      }

      dispatch({ type: 'chat/open', payload: { chatId, phone, title: formatPhone(phone) } });
      return { chatId, warning };
    },
    [credentials, state],
  );

  const selectChat = useCallback((chatId: string) => {
    dispatch({ type: 'chat/select', payload: { chatId } });
  }, []);

  const closeChat = useCallback(() => {
    dispatch({ type: 'chat/select', payload: { chatId: null } });
  }, []);

  const sendText = useCallback(
    async (text: string) => {
      const chatId = state.activeChatId;
      if (credentials === null || chatId === null) {
        return;
      }
      const localId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      dispatch({
        type: 'message/enqueue',
        payload: {
          message: {
            id: localId,
            chatId,
            direction: 'outgoing',
            text,
            timestamp: Date.now(),
            status: 'sending',
          },
        },
      });

      try {
        const { idMessage } = await sendMessage(credentials, chatId, text);
        dispatch({
          type: 'message/status',
          payload: { chatId, localId, status: 'sent', id: idMessage },
        });
      } catch (error) {
        dispatch({
          type: 'message/status',
          payload: {
            chatId,
            localId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Не удалось отправить сообщение.',
          },
        });
      }
    },
    [credentials, state.activeChatId],
  );

  const value = useMemo<ChatContextValue>(() => {
    const activeChat =
      state.activeChatId === null ? null : (state.chats[state.activeChatId] ?? null);
    return {
      chats: selectChats(state),
      activeChat,
      activeMessages: activeChat === null ? [] : (state.messages[activeChat.id] ?? []),
      pollingError,
      openChatByPhone,
      selectChat,
      closeChat,
      sendText,
    };
  }, [state, pollingError, openChatByPhone, selectChat, closeChat, sendText]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
