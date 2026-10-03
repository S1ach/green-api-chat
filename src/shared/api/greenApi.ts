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

const HISTORY_CACHE_SECONDS = 300;
const ACCOUNT_CACHE_SECONDS = 3600;

// 0 — номер скрыт
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
    // contactName — из записной книжки, name — из профиля
    const { chatId, name, contactName, phoneNumber } = parsed.data;
    contacts.push({ chatId, name: contactName || name || '', phone: toPhone(phoneNumber) });
  }
  return contacts;
}

// fileName отдельным полем — так имя доходит в UTF-8
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

export const greenApi = createApi({
  reducerPath: 'greenApi',
  baseQuery,
  tagTypes: ['Settings'],
  catchSchemaFailure: (error, info) => {
    devLog('API', `${info.endpoint}: неожиданный формат ответа`, error.issues);
    return unexpectedResponseError();
  },
  endpoints: (build) => ({
    getStateInstance: build.query<StateInstanceResponse, Credentials>({
      query: (credentials) => ({ method: 'getStateInstance', credentials }),
      rawResponseSchema: stateInstanceSchema,
      keepUnusedDataFor: 0,
    }),

    // chatId своего чата («Избранное»)
    getAccountSettings: build.query<string | null, void>({
      query: () => ({ method: 'getAccountSettings' }),
      rawResponseSchema: accountSettingsSchema,
      transformResponse: ({ chatId }: AccountSettingsResponse) => (chatId ? String(chatId) : null),
      keepUnusedDataFor: ACCOUNT_CACHE_SECONDS,
    }),

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

    // после вызова инстанс перезапускается
    setSettings: build.mutation<null, InstanceSettingsPatch>({
      query: (settings) => ({ method: 'setSettings', httpMethod: 'POST', body: { ...settings } }),
      rawResponseSchema: setSettingsSchema,
      transformResponse: () => null,
      invalidatesTags: ['Settings'],
    }),

    getChats: build.query<RemoteChat[], void>({
      query: () => ({ method: 'getChats' }),
      rawResponseSchema: listSchema,
      transformResponse: toRemoteChats,
    }),

    getContacts: build.query<RemoteContact[], void>({
      query: () => ({ method: 'getContacts' }),
      rawResponseSchema: listSchema,
      transformResponse: toRemoteContacts,
    }),

    checkAccount: build.query<CheckAccountResponse, { phoneNumber: string }>({
      query: ({ phoneNumber }) => ({
        method: 'checkAccount',
        httpMethod: 'POST',
        body: { phoneNumber: Number(phoneNumber) },
      }),
      rawResponseSchema: checkAccountSchema,
    }),

    getAvatar: build.query<string, { chatId: string }>({
      query: ({ chatId }) => ({ method: 'getAvatar', httpMethod: 'POST', body: { chatId } }),
      rawResponseSchema: avatarSchema,
      transformResponse: (raw: AvatarResponse) => raw.urlAvatar ?? '',
      keepUnusedDataFor: 0,
    }),

    // запасной источник аватара, с группами не работает
    getContactInfo: build.query<string, { chatId: string }>({
      query: ({ chatId }) => ({ method: 'getContactInfo', httpMethod: 'POST', body: { chatId } }),
      rawResponseSchema: contactInfoSchema,
      transformResponse: (raw: ContactInfoResponse) => raw.avatar ?? '',
      keepUnusedDataFor: 0,
    }),

    // offset нет: чтобы получить более ранние, увеличиваем count
    getChatHistory: build.query<unknown[], ChatHistoryRequest>({
      query: ({ chatId, count }) => ({
        method: 'getChatHistory',
        httpMethod: 'POST',
        body: { chatId, count },
      }),
      rawResponseSchema: listSchema,
      keepUnusedDataFor: HISTORY_CACHE_SECONDS,
    }),

    // журналы — mutation: кэшировать их незачем
    lastIncomingMessages: build.mutation<unknown[], JournalRequest>({
      query: ({ minutes }) => ({ method: 'lastIncomingMessages', tail: `?minutes=${minutes}` }),
      rawResponseSchema: listSchema,
    }),

    lastOutgoingMessages: build.mutation<unknown[], JournalRequest>({
      query: ({ minutes }) => ({ method: 'lastOutgoingMessages', tail: `?minutes=${minutes}` }),
      rawResponseSchema: listSchema,
    }),

    sendMessage: build.mutation<SendMessageResponse, SendMessageRequest>({
      query: ({ chatId, message }) => ({
        method: 'sendMessage',
        httpMethod: 'POST',
        body: { chatId, message },
      }),
      rawResponseSchema: sendMessageSchema,
    }),

    // по документации файлы лучше слать на mediaUrl
    sendFileByUpload: build.mutation<SendFileResponse, SendFileRequest>({
      query: (request) => ({
        method: 'sendFileByUpload',
        httpMethod: 'POST',
        host: 'media',
        body: buildFileForm(request),
      }),
      rawResponseSchema: sendFileSchema,
    }),

    sendLocation: build.mutation<SendMessageResponse, SendLocationRequest>({
      query: ({ chatId, latitude, longitude }) => ({
        method: 'sendLocation',
        httpMethod: 'POST',
        body: { chatId, latitude, longitude },
      }),
      rawResponseSchema: sendMessageSchema,
    }),

    sendContact: build.mutation<SendMessageResponse, SendContactRequest>({
      query: ({ chatId, contactChatId }) => ({
        method: 'sendContact',
        httpMethod: 'POST',
        body: { chatId, contact: { chatId: contactChatId } },
      }),
      rawResponseSchema: sendMessageSchema,
    }),

    // mutation, а не query: ответ нельзя кэшировать и дедуплицировать
    receiveNotification: build.mutation<NotificationEnvelope | null, { receiveTimeout: number }>({
      query: ({ receiveTimeout }) => ({
        method: 'receiveNotification',
        tail: `?receiveTimeout=${receiveTimeout}`,
        // у цикла опроса свои паузы
        rateLimitRetries: 0,
      }),
      rawResponseSchema: notificationSchema,
      // 400 здесь значит, что у инстанса задан webhookUrl
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
