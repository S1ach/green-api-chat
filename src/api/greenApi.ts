import type {
  CheckAccountResponse,
  Credentials,
  InstanceSettings,
  NotificationEnvelope,
  RemoteChat,
  SendMessageResponse,
  StateInstanceResponse,
} from '../types/green';
import { GreenApiError, httpError, networkError } from './errors';
import { devLog } from '../utils/devLog';
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
    // URL не логируем: в нём apiTokenInstance. Имени метода достаточно для диагностики.
    const method = /\/waInstance\d+\/([^/?]+)/.exec(url)?.[1] ?? 'unknown';
    devLog('API', `${method}: сетевой сбой`, error instanceof Error ? error.message : error);
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

/**
 * POST /waInstance{id}/getAvatar/{token}
 * Возвращает ссылку на аватар или пустую строку, если аватара нет
 * либо он скрыт настройками приватности.
 */
export async function getAvatar(
  credentials: Credentials,
  chatId: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await call(
    buildUrl(credentials, 'getAvatar'),
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ chatId }) },
    signal,
  );
  return (isRecord(data) ? readString(data, 'urlAvatar') : null) ?? '';
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
 * POST /waInstance{id}/getChatHistory/{token}
 * Возвращает «сырой» массив сообщений чата (новые сверху) — разбор в `utils/history.ts`.
 * MAX отдаёт не больше 5000 сообщений и не глубже 3 месяцев.
 */
export async function getChatHistory(
  credentials: Credentials,
  chatId: string,
  count: number,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const data = await call(
    buildUrl(credentials, 'getChatHistory'),
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ chatId, count }) },
    signal,
  );
  return Array.isArray(data) ? (data as unknown[]) : [];
}

/**
 * GET /waInstance{id}/getChats/{token}
 * Список чатов аккаунта MAX — тот же, что виден в консоли GREEN-API.
 * Последнего сообщения и времени в ответе нет: их даёт GetChatHistory при открытии чата.
 */
export async function getChats(
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<RemoteChat[]> {
  const data = await call(buildUrl(credentials, 'getChats'), { method: 'GET' }, signal);
  if (!Array.isArray(data)) {
    return [];
  }
  const chats: RemoteChat[] = [];
  for (const item of data as unknown[]) {
    if (!isRecord(item)) {
      continue;
    }
    const chatId = readString(item, 'chatId');
    if (chatId === null || chatId === '') {
      continue;
    }
    // phoneNumber = 0, если номер скрыт или это группа.
    const phoneNumber = readNumber(item, 'phoneNumber');
    chats.push({
      chatId,
      name: readString(item, 'name') ?? '',
      type: readString(item, 'type'),
      phone: phoneNumber !== null && phoneNumber > 0 ? String(phoneNumber) : null,
    });
  }
  return chats;
}

/** GET /waInstance{id}/getSettings/{token} — нужны только поля, влияющие на приём сообщений. */
export async function getSettings(
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<InstanceSettings> {
  const data = await call(buildUrl(credentials, 'getSettings'), { method: 'GET' }, signal);
  if (!isRecord(data)) {
    throw new GreenApiError('Не удалось прочитать настройки инстанса.', 'unknown');
  }
  return {
    webhookUrl: readString(data, 'webhookUrl') ?? '',
    incomingWebhook: readString(data, 'incomingWebhook') ?? '',
  };
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
  let data: unknown;
  try {
    data = await call(url, { method: 'GET' }, signal);
  } catch (error) {
    // По документации ReceiveNotification отвечает 400, когда у инстанса задан webhookUrl:
    // тогда уведомления уходят на вебхук, а очередь HTTP API недоступна.
    if (error instanceof GreenApiError && error.status === 400) {
      throw new GreenApiError(
        'Очередь уведомлений недоступна (400): у инстанса задан webhookUrl. ' +
          'Очистите webhookUrl в консоли GREEN-API и подождите около минуты.',
        'badRequest',
        400,
      );
    }
    throw error;
  }
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
