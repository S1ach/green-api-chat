import type {
  CheckAccountResponse,
  Credentials,
  NotificationEnvelope,
  SendMessageResponse,
  StateInstanceResponse,
} from '../types/green';
import { GreenApiError, httpError, networkError } from './errors';
import { isRecord, readNumber, readString } from '../utils/guards';

/** Максимальная длина текстового сообщения в SendMessage. */
export const MAX_MESSAGE_LENGTH = 4000;

function buildUrl(credentials: Credentials, method: string, tail = ''): string {
  const base = credentials.apiUrl.trim().replace(/\/+$/, '');
  return `${base}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}${tail}`;
}

/**
 * Единая точка сетевых вызовов: нормализует ошибки и разбирает тело ответа.
 * Возвращает `null`, если тело пустое или равно литералу `null`.
 */
async function call(url: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, signal ? { ...init, signal } : init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw networkError();
  }

  if (!response.ok) {
    throw httpError(response.status);
  }

  const text = await response.text();
  if (text.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GreenApiError('GREEN-API вернул ответ в неизвестном формате.', 'unknown');
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/** GET /waInstance{id}/getStateInstance/{token} */
export async function getStateInstance(
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<StateInstanceResponse> {
  const data = await call(buildUrl(credentials, 'getStateInstance'), { method: 'GET' }, signal);
  const state = isRecord(data) ? readString(data, 'stateInstance') : null;
  if (state === null) {
    throw new GreenApiError('Не удалось прочитать состояние инстанса.', 'unknown');
  }
  return { stateInstance: state };
}

/**
 * POST /waInstance{id}/checkAccount/{token}
 * Проверяет наличие номера в MAX и возвращает числовой chatId.
 */
export async function checkAccount(
  credentials: Credentials,
  phoneNumber: string,
  signal?: AbortSignal,
): Promise<CheckAccountResponse> {
  const data = await call(
    buildUrl(credentials, 'checkAccount'),
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ phoneNumber: Number(phoneNumber) }),
    },
    signal,
  );

  if (!isRecord(data)) {
    throw new GreenApiError('Не удалось проверить номер: неожиданный ответ сервиса.', 'unknown');
  }
  if (data.status === false) {
    return { status: false, reason: readString(data, 'reason') ?? 'Инстанс не готов к работе.' };
  }
  return {
    exist: data.exist === true,
    chatId: readString(data, 'chatId') ?? '',
    fromCache: data.fromCache === true,
  };
}

/** POST /waInstance{id}/sendMessage/{token} */
export async function sendMessage(
  credentials: Credentials,
  chatId: string,
  message: string,
  signal?: AbortSignal,
): Promise<SendMessageResponse> {
  const data = await call(
    buildUrl(credentials, 'sendMessage'),
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ chatId, message }) },
    signal,
  );
  const idMessage = isRecord(data) ? readString(data, 'idMessage') : null;
  if (idMessage === null) {
    throw new GreenApiError('Сообщение не отправлено: сервис не вернул идентификатор.', 'unknown');
  }
  return { idMessage };
}

/**
 * GET /waInstance{id}/receiveNotification/{token}?receiveTimeout=5
 * `null` — очередь пуста.
 */
export async function receiveNotification(
  credentials: Credentials,
  receiveTimeout = 5,
  signal?: AbortSignal,
): Promise<NotificationEnvelope | null> {
  const url = buildUrl(credentials, 'receiveNotification', `?receiveTimeout=${receiveTimeout}`);
  const data = await call(url, { method: 'GET' }, signal);
  if (!isRecord(data)) {
    return null;
  }
  const receiptId = readNumber(data, 'receiptId');
  if (receiptId === null) {
    return null;
  }
  return { receiptId, body: data.body };
}

/** DELETE /waInstance{id}/deleteNotification/{token}/{receiptId} */
export async function deleteNotification(
  credentials: Credentials,
  receiptId: number,
  signal?: AbortSignal,
): Promise<void> {
  await call(
    buildUrl(credentials, 'deleteNotification', `/${receiptId}`),
    { method: 'DELETE' },
    signal,
  );
}
