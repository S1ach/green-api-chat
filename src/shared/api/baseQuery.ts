import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchBaseQueryError,
  type FetchBaseQueryMeta,
} from '@reduxjs/toolkit/query';
import { devLog } from '@/shared/lib/devLog';
import { httpError, networkError, unexpectedResponseError, type GreenApiError } from './errors';
import { postponeMethod, waitBeforeRetry, waitForSlot } from './rateLimiter';
import { rateLimited } from './rateLimitSlice';
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
  /** Сколько раз повторить запрос после ответа 429; по умолчанию `RATE_LIMIT_RETRIES`. */
  rateLimitRetries?: number;
}

/** Повторов после 429 немного и они конечны: дальше ошибку получает вызывающий код. */
const RATE_LIMIT_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 15_000;

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

function isRateLimited(error: FetchBaseQueryError): boolean {
  return error.status === 429 || (error.status === 'PARSING_ERROR' && error.originalStatus === 429);
}

/** Пауза из заголовка `Retry-After` (секунды или HTTP-дата); `null`, если сервер его не прислал. */
function retryAfterMs(meta: FetchBaseQueryMeta | undefined): number | null {
  const header = meta?.response?.headers.get('Retry-After');
  if (header === null || header === undefined || header.trim() === '') {
    return null;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/** Экспоненциальная пауза 1 → 2 → 4 с и случайная добавка, чтобы повторы не шли залпом. */
function backoffMs(attempt: number): number {
  return BASE_RETRY_DELAY_MS * 2 ** attempt + Math.round(Math.random() * 250);
}

const rawBaseQuery = fetchBaseQuery();

/**
 * Единая точка сетевых вызовов GREEN-API.
 *
 * - Учётные данные — часть URL, поэтому адрес собирается здесь: endpoints и UI про токен не знают.
 * - Перед запросом метод ждёт свой слот: лимиты GREEN-API считаются на метод, и запросы
 *   из разных частей приложения не должны сталкиваться.
 * - Ответ 429 не считается ошибкой сразу: запрос повторяется после паузы (`Retry-After`
 *   или экспоненциальная), ограниченное число раз.
 * - Ошибки fetch приводятся к `GreenApiError` с текстом для пользователя.
 */
export const baseQuery: BaseQueryFn<GreenApiRequest, unknown, GreenApiError> = async (
  request,
  api,
  extraOptions,
) => {
  // `RootState` объявлен глобально в app/providers/store — слой shared не импортирует store.
  const credentials = request.credentials ?? (api.getState() as RootState).session.credentials;
  if (credentials === null) {
    return { error: NO_SESSION_ERROR };
  }
  const { idInstance } = credentials;
  const maxRetries = request.rateLimitRetries ?? RATE_LIMIT_RETRIES;

  for (let attempt = 0; ; attempt += 1) {
    await waitForSlot(idInstance, request.method, api.signal);

    const result = await rawBaseQuery(
      {
        url: buildUrl(credentials, request),
        method: request.httpMethod ?? 'GET',
        body: request.body,
      },
      api,
      extraOptions,
    );
    if (result.error === undefined) {
      return { data: result.data };
    }

    if (isRateLimited(result.error) && attempt < maxRetries && !api.signal.aborted) {
      const delay = Math.min(retryAfterMs(result.meta) ?? backoffMs(attempt), MAX_RETRY_DELAY_MS);
      devLog('API', `${request.method}: rate limited, retry after ${Math.ceil(delay / 1000)}s`);
      postponeMethod(idInstance, request.method, delay);
      api.dispatch(rateLimited(Date.now() + delay));
      await waitBeforeRetry(delay, api.signal);
      continue;
    }

    // URL не логируем: в нём apiTokenInstance. Имени метода достаточно для диагностики.
    devLog('API', `${request.method}: ошибка`, result.error.status);
    return { error: toGreenApiError(result.error) };
  }
};
