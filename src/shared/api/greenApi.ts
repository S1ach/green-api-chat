import { createApi } from '@reduxjs/toolkit/query/react';
import { devLog } from '@/shared/lib/devLog';
import { baseQuery } from './baseQuery';
import { isGreenApiError, unexpectedResponseError, type GreenApiError } from './errors';
import {
  avatarSchema,
  checkAccountSchema,
  listSchema,
  notificationSchema,
  remoteChatSchema,
  sendMessageSchema,
  settingsSchema,
  stateInstanceSchema,
  type AvatarResponse,
  type CheckAccountResponse,
  type NotificationEnvelope,
  type SendMessageResponse,
  type SettingsResponse,
  type StateInstanceResponse,
} from './schemas';
import type {
  ChatHistoryRequest,
  Credentials,
  InstanceSettings,
  RemoteChat,
  SendMessageRequest,
} from './types';

/** У GetSettings жёсткий лимит частоты: при 429 ждём и повторяем, а не сдаёмся. */
const SETTINGS_RETRIES = 3;
const SETTINGS_RETRY_MS = 5000;

/** Ссылки на аватары живут недолго, но перезапрашивать их при каждом открытии чата незачем. */
const AVATAR_CACHE_SECONDS = 600;

function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function toRemoteChats(items: unknown[]): RemoteChat[] {
  const chats: RemoteChat[] = [];
  for (const item of items) {
    const parsed = remoteChatSchema.safeParse(item);
    if (!parsed.success) {
      continue;
    }
    // phoneNumber = 0, если номер скрыт или это группа.
    const { chatId, name, type, phoneNumber } = parsed.data;
    chats.push({
      chatId,
      name: name ?? '',
      type: type ?? null,
      phone: typeof phoneNumber === 'number' && phoneNumber > 0 ? String(phoneNumber) : null,
    });
  }
  return chats;
}

/**
 * Методы GREEN-API для MAX. Пути и форматы — по официальной документации:
 * `{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}`.
 */
export const greenApi = createApi({
  reducerPath: 'greenApi',
  baseQuery,
  catchSchemaFailure: (error, info) => {
    devLog('API', `${info.endpoint}: неожиданный формат ответа`, error.issues);
    return unexpectedResponseError();
  },
  endpoints: (build) => ({
    /** GET getStateInstance — проверка учётных данных до входа, поэтому они передаются явно. */
    getStateInstance: build.query<StateInstanceResponse, Credentials>({
      query: (credentials) => ({ method: 'getStateInstance', credentials }),
      rawResponseSchema: stateInstanceSchema,
      keepUnusedDataFor: 0,
    }),

    /** GET getSettings — нужны только поля, влияющие на приём сообщений. */
    getSettings: build.query<InstanceSettings, void>({
      query: () => ({ method: 'getSettings' }),
      rawResponseSchema: settingsSchema,
      transformResponse: (raw: SettingsResponse): InstanceSettings => ({
        webhookUrl: raw.webhookUrl ?? '',
        incomingWebhook: raw.incomingWebhook ?? '',
      }),
      extraOptions: {
        retryCondition: (error, _args, { attempt }) =>
          isGreenApiError(error) && error.kind === 'rateLimit' && attempt <= SETTINGS_RETRIES,
        backoff: (_attempt, _maxRetries, signal) => waitFor(SETTINGS_RETRY_MS, signal),
      },
    }),

    /**
     * GET getChats — список чатов аккаунта MAX, тот же, что виден в консоли GREEN-API.
     * Последнего сообщения и времени в ответе нет: их даёт GetChatHistory.
     */
    getChats: build.query<RemoteChat[], void>({
      query: () => ({ method: 'getChats' }),
      rawResponseSchema: listSchema,
      transformResponse: toRemoteChats,
    }),

    /** POST checkAccount — есть ли номер в MAX и какой у него числовой chatId. */
    checkAccount: build.query<CheckAccountResponse, { phoneNumber: string }>({
      query: ({ phoneNumber }) => ({
        method: 'checkAccount',
        httpMethod: 'POST',
        body: { phoneNumber: Number(phoneNumber) },
      }),
      rawResponseSchema: checkAccountSchema,
    }),

    /** POST getAvatar — ссылка на аватар или пустая строка. */
    getAvatar: build.query<string, { chatId: string }>({
      query: ({ chatId }) => ({ method: 'getAvatar', httpMethod: 'POST', body: { chatId } }),
      rawResponseSchema: avatarSchema,
      transformResponse: (raw: AvatarResponse) => raw.urlAvatar ?? '',
      keepUnusedDataFor: AVATAR_CACHE_SECONDS,
    }),

    /**
     * POST getChatHistory — «сырые» сообщения чата (новые сверху), разбор в `entities/message`.
     * MAX отдаёт не больше 5000 сообщений и не глубже 3 месяцев.
     */
    getChatHistory: build.query<unknown[], ChatHistoryRequest>({
      query: ({ chatId, count }) => ({
        method: 'getChatHistory',
        httpMethod: 'POST',
        body: { chatId, count },
      }),
      rawResponseSchema: listSchema,
      // Разобранные сообщения живут в слайсе чатов — копию ответа в кэше не держим.
      keepUnusedDataFor: 0,
    }),

    /** POST sendMessage — отправка текста. */
    sendMessage: build.mutation<SendMessageResponse, SendMessageRequest>({
      query: ({ chatId, message }) => ({
        method: 'sendMessage',
        httpMethod: 'POST',
        body: { chatId, message },
      }),
      rawResponseSchema: sendMessageSchema,
    }),

    /**
     * GET receiveNotification?receiveTimeout=N — следующее уведомление из очереди; `null` — очередь пуста.
     * Это mutation, а не query: ответ нельзя кэшировать, а дедупликация одинаковых
     * запросов помешала бы последовательному циклу опроса.
     */
    receiveNotification: build.mutation<NotificationEnvelope | null, { receiveTimeout: number }>({
      query: ({ receiveTimeout }) => ({
        method: 'receiveNotification',
        tail: `?receiveTimeout=${receiveTimeout}`,
      }),
      rawResponseSchema: notificationSchema,
      // По документации ReceiveNotification отвечает 400, когда у инстанса задан webhookUrl:
      // тогда уведомления уходят на вебхук, а очередь HTTP API недоступна.
      transformErrorResponse: (error: GreenApiError): GreenApiError =>
        error.status === 400
          ? {
              ...error,
              message:
                'Очередь уведомлений недоступна (400): у инстанса задан webhookUrl. ' +
                'Очистите webhookUrl в консоли GREEN-API и подождите около минуты.',
            }
          : error,
    }),

    /** DELETE deleteNotification/{receiptId} — подтверждение обработки уведомления. */
    deleteNotification: build.mutation<null, { receiptId: number }>({
      query: ({ receiptId }) => ({
        method: 'deleteNotification',
        httpMethod: 'DELETE',
        tail: `/${receiptId}`,
      }),
      transformResponse: () => null,
    }),
  }),
});

export const {
  useGetAvatarQuery,
  useGetChatHistoryQuery,
  useGetChatsQuery,
  useGetSettingsQuery,
  useSendMessageMutation,
} = greenApi;
