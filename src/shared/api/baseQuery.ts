import {
  fetchBaseQuery,
  retry,
  type BaseQueryFn,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query';
import { devLog } from '@/shared/lib/devLog';
import { httpError, networkError, unexpectedResponseError, type GreenApiError } from './errors';
import type { Credentials } from './types';

/** Описание вызова GREEN-API: его возвращают `query` в endpoints. */
export interface GreenApiRequest {
  /** Имя метода: `sendMessage`, `receiveNotification`… */
  method: string;
  httpMethod?: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, unknown>;
  /** Хвост URL после токена: `/{receiptId}` или `?receiveTimeout=5`. */
  tail?: string;
  /** Учётные данные для запроса до входа (getStateInstance); по умолчанию берутся из store. */
  credentials?: Credentials;
}

const NO_SESSION_ERROR: GreenApiError = {
  kind: 'unauthorized',
  message: 'Нет активной сессии. Введите idInstance и apiTokenInstance.',
};

function buildUrl(credentials: Credentials, { method, tail = '' }: GreenApiRequest): string {
  const base = credentials.apiUrl.trim().replace(/\/+$/, '');
  return `${base}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}${tail}`;
}

function toGreenApiError(error: FetchBaseQueryError): GreenApiError {
  if (typeof error.status === 'number') {
    return httpError(error.status);
  }
  if (error.status === 'PARSING_ERROR') {
    return error.originalStatus >= 400
      ? httpError(error.originalStatus)
      : unexpectedResponseError();
  }
  return networkError();
}

const rawBaseQuery = fetchBaseQuery();

/**
 * Единая точка сетевых вызовов. У GREEN-API учётные данные — часть URL,
 * поэтому адрес собирается здесь: endpoints и UI про токен не знают.
 * Ошибки fetch приводятся к `GreenApiError` с текстом для пользователя.
 */
const greenBaseQuery: BaseQueryFn<GreenApiRequest, unknown, GreenApiError> = async (
  request,
  api,
  extraOptions,
) => {
  // `RootState` объявлен глобально в app/providers/store — слой shared не импортирует store.
  const credentials = request.credentials ?? (api.getState() as RootState).session.credentials;
  if (credentials === null) {
    return { error: NO_SESSION_ERROR };
  }

  const result = await rawBaseQuery(
    {
      url: buildUrl(credentials, request),
      method: request.httpMethod ?? 'GET',
      body: request.body,
    },
    api,
    extraOptions,
  );
  if (result.error) {
    // URL не логируем: в нём apiTokenInstance. Имени метода достаточно для диагностики.
    devLog('API', `${request.method}: ошибка`, result.error.status);
    return { error: toGreenApiError(result.error) };
  }
  return { data: result.data };
};

/** По умолчанию запросы не повторяются; endpoint может включить повторы через `extraOptions`. */
export const baseQuery = retry(greenBaseQuery, { maxRetries: 0 });
