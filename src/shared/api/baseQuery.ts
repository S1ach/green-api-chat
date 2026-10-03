import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchBaseQueryError,
  type FetchBaseQueryMeta,
} from '@reduxjs/toolkit/query';
import { devLog } from '@/shared/lib/devLog';
import { sleep } from '@/shared/lib/sleep';
import { httpError, networkError, unexpectedResponseError, type GreenApiError } from './errors';
import { postponeMethod, waitForSlot } from './rateLimiter';
import { rateLimited } from './rateLimitSlice';
import type { Credentials } from './types';

export interface GreenApiRequest {
  method: string;
  httpMethod?: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, unknown> | FormData;
  host?: 'api' | 'media';
  // то, что идёт после токена: /{receiptId} или ?receiveTimeout=5
  tail?: string;
  credentials?: Credentials;
  rateLimitRetries?: number;
}

const RATE_LIMIT_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 15_000;

const NO_SESSION_ERROR: GreenApiError = {
  kind: 'unauthorized',
  message: 'Нет активной сессии. Введите idInstance и apiTokenInstance.',
};

function buildUrl(credentials: Credentials, { method, host, tail = '' }: GreenApiRequest): string {
  // mediaUrl может быть не задан, тогда шлём на apiUrl
  const hostUrl = (host === 'media' && credentials.mediaUrl) || credentials.apiUrl;
  const base = hostUrl.trim().replace(/\/+$/, '');
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

// Retry-After бывает в секундах или датой
function retryAfterMs(meta: FetchBaseQueryMeta | undefined): number | null {
  const header = meta?.response?.headers.get('Retry-After');
  if (!header?.trim()) {
    return null;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

// 1 → 2 → 4 с плюс джиттер
function backoffMs(attempt: number): number {
  return BASE_RETRY_DELAY_MS * 2 ** attempt + Math.round(Math.random() * 250);
}

const rawBaseQuery = fetchBaseQuery();

export const baseQuery: BaseQueryFn<GreenApiRequest, unknown, GreenApiError> = async (
  request,
  api,
  extraOptions,
) => {
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
      await sleep(delay, api.signal);
      continue;
    }

    // URL не логируем, в нём токен
    devLog('API', `${request.method}: ошибка`, result.error.status);
    return { error: toGreenApiError(result.error) };
  }
};
