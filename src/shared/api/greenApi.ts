import { createApi } from '@reduxjs/toolkit/query/react';
import { devLog } from '@/shared/lib/devLog';
import { baseQuery } from './baseQuery';
import { unexpectedResponseError, type GreenApiError } from './errors';
import {
  accountSettingsSchema,
  avatarSchema,
  checkAccountSchema,
  contactInfoSchema,
  listSchema,
  notificationSchema,
  remoteChatSchema,
  remoteContactSchema,
  sendFileSchema,
  sendMessageSchema,
  setSettingsSchema,
  settingsSchema,
  stateInstanceSchema,
  type AccountSettingsResponse,
  type AvatarResponse,
  type CheckAccountResponse,
  type ContactInfoResponse,
  type NotificationEnvelope,
  type SendFileResponse,
  type SendMessageResponse,
  type SettingsResponse,
  type StateInstanceResponse,
} from './schemas';
import type {
  ChatHistoryRequest,
  Credentials,
  InstanceSettings,
  InstanceSettingsPatch,
  JournalRequest,
  RemoteChat,
  RemoteContact,
  SendContactRequest,
  SendFileRequest,
  SendLocationRequest,
  SendMessageRequest,
} from './types';

/** Историю чата держим в кэше, чтобы возврат в недавно открытый чат обходился без запроса. */
const HISTORY_CACHE_SECONDS = 300;
/** chatId собственного чата у аккаунта не меняется — достаточно узнать его один раз за сессию. */
const ACCOUNT_CACHE_SECONDS = 3600;

/** Номер из GREEN-API: 0 означает, что он скрыт или его нет. */
function toPhone(phoneNumber: number | null | undefined): string | null {
  return typeof phoneNumber === 'number' && phoneNumber > 0 ? String(phoneNumber) : null;
}

function toRemoteChats(items: unknown[]): RemoteChat[] {
  const chats: RemoteChat[] = [];
  for (const item of items) {
    const parsed = remoteChatSchema.safeParse(item);
    if (!parsed.success) {
      continue;
    }
    const { chatId, name, type, phoneNumber } = parsed.data;
    chats.push({ chatId, name: name ?? '', type: type ?? null, phone: toPhone(phoneNumber) });
  }
  return chats;
}

function toRemoteContacts(items: unknown[]): RemoteContact[] {
  const contacts: RemoteContact[] = [];
  for (const item of items) {
    const parsed = remoteContactSchema.safeParse(item);
    if (!parsed.success) {
      continue;
    }
    // contactName — имя из записной книжки, name — из профиля MAX.
    const { chatId, name, contactName, phoneNumber } = parsed.data;
    contacts.push({ chatId, name: contactName || name || '', phone: toPhone(phoneNumber) });
  }
  return contacts;
}

/** Форма SendFileByUpload. Имя файла передаётся отдельным полем: так оно доходит в UTF-8. */
export function buildFileForm({ chatId, file, caption }: SendFileRequest): FormData {
  const form = new FormData();
  form.append('chatId', chatId);
  form.append('fileName', file.name);
  if (caption !== '') {
    form.append('caption', caption);
  }
  form.append('file', file, file.name);
  return form;
}

/**
 * Методы GREEN-API для MAX. Пути и форматы — по официальной документации:
 * `{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}`.
 */
export const greenApi = createApi({
  reducerPath: 'greenApi',
  baseQuery,
  tagTypes: ['Settings'],
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

    /**
     * GET getAccountSettings — chatId собственного чата аккаунта: это «Избранное»,
     * сообщения самому себе. `null`, если API его не отдал.
     */
    getAccountSettings: build.query<string | null, void>({
      query: () => ({ method: 'getAccountSettings' }),
      rawResponseSchema: accountSettingsSchema,
      transformResponse: ({ chatId }: AccountSettingsResponse) =>
        chatId === null || chatId === undefined || chatId === '' ? null : String(chatId),
      keepUnusedDataFor: ACCOUNT_CACHE_SECONDS,
    }),

    /** GET getSettings — поля, от которых зависит приём сообщений и статусов. */
    getSettings: build.query<InstanceSettings, void>({
      query: () => ({ method: 'getSettings' }),
      rawResponseSchema: settingsSchema,
      transformResponse: (raw: SettingsResponse): InstanceSettings => ({
        webhookUrl: raw.webhookUrl ?? '',
        incomingWebhook: raw.incomingWebhook ?? '',
        outgoingWebhook: raw.outgoingWebhook ?? '',
        outgoingMessageWebhook: raw.outgoingMessageWebhook ?? '',
      }),
      providesTags: ['Settings'],
    }),

    /**
     * POST setSettings — меняет только переданные настройки. Инстанс после вызова
     * перезапускается, настройки применяются в течение нескольких минут.
     */
    setSettings: build.mutation<null, InstanceSettingsPatch>({
      query: (settings) => ({ method: 'setSettings', httpMethod: 'POST', body: { ...settings } }),
      rawResponseSchema: setSettingsSchema,
      transformResponse: () => null,
      invalidatesTags: ['Settings'],
    }),

    /**
     * GET getChats — список чатов аккаунта MAX, тот же, что виден в консоли GREEN-API.
     * Последнего сообщения и времени в ответе нет: их дают журналы сообщений.
     */
    getChats: build.query<RemoteChat[], void>({
      query: () => ({ method: 'getChats' }),
      rawResponseSchema: listSchema,
      transformResponse: toRemoteChats,
    }),

    /**
     * GET getContacts — контакты аккаунта MAX. Только ими можно делиться через SendContact.
     * Список обновляется на стороне GREEN-API с задержкой до 5 минут.
     */
    getContacts: build.query<RemoteContact[], void>({
      query: () => ({ method: 'getContacts' }),
      rawResponseSchema: listSchema,
      transformResponse: toRemoteContacts,
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

    /**
     * POST getAvatar — ссылка на аватар или пустая строка. На бесплатном тарифе у метода
     * квота 100 запросов в месяц, поэтому ссылку хранит сам чат (`loadChatAvatar`).
     */
    getAvatar: build.query<string, { chatId: string }>({
      query: ({ chatId }) => ({ method: 'getAvatar', httpMethod: 'POST', body: { chatId } }),
      rawResponseSchema: avatarSchema,
      transformResponse: (raw: AvatarResponse) => raw.urlAvatar ?? '',
      keepUnusedDataFor: 0,
    }),

    /**
     * POST getContactInfo — запасной источник ссылки на аватар личного чата и бота,
     * когда GetAvatar недоступен. С группами метод не работает.
     */
    getContactInfo: build.query<string, { chatId: string }>({
      query: ({ chatId }) => ({ method: 'getContactInfo', httpMethod: 'POST', body: { chatId } }),
      rawResponseSchema: contactInfoSchema,
      transformResponse: (raw: ContactInfoResponse) => raw.avatar ?? '',
      keepUnusedDataFor: 0,
    }),

    /**
     * POST getChatHistory — «сырые» сообщения чата (новые сверху), разбор в `entities/message`.
     * Смещения у метода нет: более ранние сообщения получают, увеличивая `count`.
     * MAX отдаёт не больше 5000 сообщений и не глубже 3 месяцев.
     */
    getChatHistory: build.query<unknown[], ChatHistoryRequest>({
      query: ({ chatId, count }) => ({
        method: 'getChatHistory',
        httpMethod: 'POST',
        body: { chatId, count },
      }),
      rawResponseSchema: listSchema,
      keepUnusedDataFor: HISTORY_CACHE_SECONDS,
    }),

    /**
     * GET lastIncomingMessages?minutes=N — входящие сообщения всех чатов за последние N минут.
     * Журналы, как и receiveNotification, объявлены mutation: это разовые чтения для сверки,
     * кэшировать их незачем, а каждый вызов должен получить собственный ответ.
     */
    lastIncomingMessages: build.mutation<unknown[], JournalRequest>({
      query: ({ minutes }) => ({ method: 'lastIncomingMessages', tail: `?minutes=${minutes}` }),
      rawResponseSchema: listSchema,
    }),

    /** GET lastOutgoingMessages?minutes=N — исходящие сообщения всех чатов за последние N минут. */
    lastOutgoingMessages: build.mutation<unknown[], JournalRequest>({
      query: ({ minutes }) => ({ method: 'lastOutgoingMessages', tail: `?minutes=${minutes}` }),
      rawResponseSchema: listSchema,
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
     * POST sendFileByUpload — файл с диска (до 100 МБ) формой multipart/form-data.
     * Документация рекомендует для этого метода хост mediaUrl из личного кабинета.
     * Тип сообщения (фото, видео, аудио, документ) MAX определяет сам по расширению файла.
     */
    sendFileByUpload: build.mutation<SendFileResponse, SendFileRequest>({
      query: (request) => ({
        method: 'sendFileByUpload',
        httpMethod: 'POST',
        host: 'media',
        body: buildFileForm(request),
      }),
      rawResponseSchema: sendFileSchema,
    }),

    /** POST sendLocation — геопозиция по координатам. */
    sendLocation: build.mutation<SendMessageResponse, SendLocationRequest>({
      query: ({ chatId, latitude, longitude }) => ({
        method: 'sendLocation',
        httpMethod: 'POST',
        body: { chatId, latitude, longitude },
      }),
      rawResponseSchema: sendMessageSchema,
    }),

    /** POST sendContact — поделиться контактом из списка контактов инстанса. */
    sendContact: build.mutation<SendMessageResponse, SendContactRequest>({
      query: ({ chatId, contactChatId }) => ({
        method: 'sendContact',
        httpMethod: 'POST',
        body: { chatId, contact: { chatId: contactChatId } },
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
        // У цикла опроса своя пауза между попытками — повторы внутри запроса ему не нужны.
        rateLimitRetries: 0,
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
  useGetAccountSettingsQuery,
  useGetChatHistoryQuery,
  useGetChatsQuery,
  useGetContactsQuery,
  useGetSettingsQuery,
  useSetSettingsMutation,
} = greenApi;
