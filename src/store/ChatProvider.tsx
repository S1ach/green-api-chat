import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  checkAccount,
  getAvatar,
  getChatHistory,
  getChats,
  getSettings,
  sendMessage,
} from '../api/greenApi';
import { GreenApiError, toUserMessage } from '../api/errors';
import { useNotificationsPolling } from '../hooks/useNotificationsPolling';
import type { Chat, ChatMessage, MessageStatus } from '../types/chat';
import type { InstanceSettings } from '../types/green';
import { devLog } from '../utils/devLog';
import { isRecord, readNumber, readString } from '../utils/guards';
import { normalizeHistory } from '../utils/history';
import { parseIncomingNotification } from '../utils/notification';
import { fallbackChatId, formatPhone, normalizePhone } from '../utils/phone';
import { loadJson, saveJson } from '../utils/storage';
import { useAuth } from './authContext';
import { chatReducer, initialChatState, selectChats, type ChatState } from './chatReducer';
import { ChatContext, type ChatContextValue, type OpenChatResult } from './chatContext';

/** Сколько последних сообщений чата сохраняем в localStorage. */
const HISTORY_LIMIT = 300;

/**
 * Сколько сообщений запрашивать в GetChatHistory.
 * Сам MAX отдаёт не больше 5000 сообщений и не глубже 3 месяцев.
 */
const HISTORY_COUNT = 1000;

/** Для превью в списке чатов хватает нескольких последних сообщений. */
const PREVIEW_COUNT = 5;
/** Пауза между запросами превью, чтобы не упереться в лимит частоты (429). */
const PREVIEW_DELAY_MS = 1000;

const SETTINGS_ATTEMPTS = 4;
const SETTINGS_RETRY_MS = 5000;

/** Что в настройках инстанса мешает приёму через ReceiveNotification; `null` — всё в порядке. */
function settingsProblem(settings: InstanceSettings): string | null {
  if (settings.webhookUrl.trim() !== '') {
    return 'в настройках инстанса задан webhookUrl — уведомления уходят на вебхук, а не в очередь HTTP API. Очистите поле webhookUrl в консоли GREEN-API.';
  }
  if (settings.incomingWebhook !== 'yes') {
    return 'в настройках инстанса выключено «Получать уведомления о входящих сообщениях» (incomingWebhook). Включите его в консоли GREEN-API — входящие не попадают в очередь.';
  }
  return null;
}

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
    chatType: readString(raw, 'chatType'),
    avatarUrl: readString(raw, 'avatarUrl'),
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

  // Аватар не приходит ни в CheckAccount, ни в уведомлениях — его тянем отдельно,
  // по одному запросу на чат. Множество попыток защищает от повторов при
  // ошибках и лимите запросов у GetAvatar.
  const avatarAttempts = useRef<Set<string>>(new Set());

  useEffect(() => {
    avatarAttempts.current.clear();
  }, [storageKey]);

  useEffect(() => {
    if (credentials === null) {
      return;
    }
    const pending = state.chatOrder.filter(
      (chatId) => state.chats[chatId]?.avatarUrl === null && !avatarAttempts.current.has(chatId),
    );
    if (pending.length === 0) {
      return;
    }

    const controller = new AbortController();
    for (const chatId of pending) {
      avatarAttempts.current.add(chatId);
      void getAvatar(credentials, chatId, controller.signal)
        .then((avatarUrl) => {
          dispatch({ type: 'chat/avatar', payload: { chatId, avatarUrl } });
        })
        .catch(() => {
          // Запрос отменён перезапуском эффекта — разрешаем повторить его на следующем проходе.
          if (controller.signal.aborted) {
            avatarAttempts.current.delete(chatId);
          }
          // Иначе аватар — украшение: молча остаёмся с инициалами.
        });
    }
    return () => controller.abort();
  }, [credentials, state.chatOrder, state.chats]);

  // Список чатов берём с сервера (GetChats) — как в консоли GREEN-API, поэтому он
  // есть и на новом компьютере. Затем по очереди подгружаем последнее сообщение
  // каждого чата для превью: строго последовательно и с паузой из-за лимитов частоты.
  useEffect(() => {
    if (credentials === null || storageKey === null || hydratedKey !== storageKey) {
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;

    const load = async (): Promise<void> => {
      const remote = await getChats(credentials, signal);
      devLog('Chats', `Received: ${remote.length} chats`);
      dispatch({ type: 'chats/loaded', payload: { chats: remote } });

      for (const chat of remote) {
        if (signal.aborted) {
          return;
        }
        try {
          const raw = await getChatHistory(credentials, chat.chatId, PREVIEW_COUNT, signal);
          const messages = normalizeHistory(raw, chat.chatId);
          dispatch({ type: 'history/loaded', payload: { chatId: chat.chatId, messages } });
        } catch (error) {
          if (signal.aborted) {
            return;
          }
          console.warn(`[Chats] Нет превью для чата ${chat.chatId}:`, toUserMessage(error));
        }
        await new Promise((resolve) => setTimeout(resolve, PREVIEW_DELAY_MS));
      }
    };

    load().catch((error: unknown) => {
      if (!signal.aborted) {
        console.warn('[Chats] Не удалось загрузить список чатов', error);
      }
    });
    return () => controller.abort();
  }, [credentials, storageKey, hydratedKey]);

  // Источник истории — сервер GREEN-API, а не только localStorage: так переписка
  // появляется и после очистки браузера, и на другом компьютере.
  // Запрос повторяется при каждом открытии чата; дубли с кэшем убирает mergeMessages.
  const [historyError, setHistoryError] = useState<string | null>(null);
  const activeChatId = state.activeChatId;

  useEffect(() => {
    setHistoryError(null);
    if (credentials === null || activeChatId === null) {
      return;
    }
    const controller = new AbortController();
    devLog('History', 'Loading chat history...', activeChatId);
    getChatHistory(credentials, activeChatId, HISTORY_COUNT, controller.signal)
      .then((raw) => {
        const messages = normalizeHistory(raw, activeChatId);
        devLog('History', `Received: ${raw.length} messages (текстовых: ${messages.length})`);
        dispatch({ type: 'history/loaded', payload: { chatId: activeChatId, messages } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error('[History] Не удалось загрузить историю', error);
        setHistoryError(toUserMessage(error));
      });
    return () => controller.abort();
  }, [credentials, activeChatId]);

  // Входящие не придут, если инстанс настроен на вебхук или не отдаёт входящие в очередь.
  // Проверяем это один раз после входа и явно сообщаем, что проблема в настройках, а не в коде.
  const [settingsWarning, setSettingsWarning] = useState<string | null>(null);

  useEffect(() => {
    setSettingsWarning(null);
    if (credentials === null) {
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;

    // У GetSettings жёсткий лимит частоты: при 429 ждём и повторяем, а не сдаёмся.
    const loadSettings = async (): Promise<InstanceSettings> => {
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await getSettings(credentials, signal);
        } catch (error) {
          const isRateLimit = error instanceof GreenApiError && error.kind === 'rateLimit';
          if (!isRateLimit || attempt >= SETTINGS_ATTEMPTS || signal.aborted) {
            throw error;
          }
          devLog('Settings', `429, повтор через ${SETTINGS_RETRY_MS / 1000} с`);
          await new Promise((resolve) => setTimeout(resolve, SETTINGS_RETRY_MS));
        }
      }
    };

    loadSettings()
      .then((settings) => {
        if (signal.aborted) {
          return;
        }
        devLog('Settings', 'webhookUrl пустой:', settings.webhookUrl === '');
        devLog('Settings', 'incomingWebhook:', settings.incomingWebhook);
        const problem = settingsProblem(settings);
        if (problem !== null) {
          console.warn(`[Settings] ${problem}`);
        }
        setSettingsWarning(problem);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.warn('[Settings] Не удалось проверить настройки инстанса', error);
        }
      });
    return () => controller.abort();
  }, [credentials]);

  const handleNotification = useCallback((body: unknown) => {
    const incoming = parseIncomingNotification(body);
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
      historyError,
      settingsWarning,
      openChatByPhone,
      selectChat,
      closeChat,
      sendText,
    };
  }, [
    state,
    pollingError,
    historyError,
    settingsWarning,
    openChatByPhone,
    selectChat,
    closeChat,
    sendText,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
