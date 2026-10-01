import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { greenApi } from './greenApi';
import type { Credentials } from './types';

const credentials: Credentials = {
  apiUrl: 'https://api.green-api.com/',
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};

const BASE = 'https://api.green-api.com/waInstance1101000001';

/** Минимальный store: baseQuery читает из него только учётные данные сессии. */
function createStore(session: { credentials: Credentials | null } = { credentials }) {
  return configureStore({
    reducer: { session: () => session, [greenApi.reducerPath]: greenApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(greenApi.middleware),
  });
}

const fetchMock = vi.fn<(request: Request) => Promise<Response>>();

function respond(body: unknown, status = 200): void {
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? '' : JSON.stringify(body), { status }),
  );
}

function lastRequest(): Request {
  const request = fetchMock.mock.lastCall?.[0];
  if (request === undefined) {
    throw new Error('fetch не вызывался');
  }
  return request;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sendMessage', () => {
  it('отправляет POST на адрес из учётных данных и возвращает idMessage', async () => {
    respond({ idMessage: '1763115112345' });
    const store = createStore();

    const result = await store
      .dispatch(greenApi.endpoints.sendMessage.initiate({ chatId: '10000000', message: 'Привет' }))
      .unwrap();

    expect(result).toEqual({ idMessage: '1763115112345' });
    const request = lastRequest();
    expect(request.method).toBe('POST');
    expect(request.url).toBe(`${BASE}/sendMessage/test-token`);
    expect(await request.json()).toEqual({ chatId: '10000000', message: 'Привет' });
  });

  it('считает ошибкой ответ без idMessage', async () => {
    respond({ result: 'ok' });
    const store = createStore();

    const result = await store.dispatch(
      greenApi.endpoints.sendMessage.initiate({ chatId: '10000000', message: 'Привет' }),
    );

    expect(result.error).toEqual({
      kind: 'unknown',
      message: 'GREEN-API вернул ответ в неожиданном формате.',
    });
  });

  it('превращает HTTP-статус в понятную ошибку', async () => {
    respond({ message: 'Unauthorized' }, 401);
    const store = createStore();

    const result = await store.dispatch(
      greenApi.endpoints.sendMessage.initiate({ chatId: '10000000', message: 'Привет' }),
    );

    expect(result.error).toMatchObject({ kind: 'unauthorized', status: 401 });
  });

  it('сообщает о сетевой ошибке, если fetch отклонился', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const store = createStore();

    const result = await store.dispatch(
      greenApi.endpoints.sendMessage.initiate({ chatId: '10000000', message: 'Привет' }),
    );

    expect(result.error).toMatchObject({ kind: 'network' });
  });

  it('не обращается к сети без активной сессии', async () => {
    const store = createStore({ credentials: null });

    const result = await store.dispatch(
      greenApi.endpoints.sendMessage.initiate({ chatId: '10000000', message: 'Привет' }),
    );

    expect(result.error).toMatchObject({ kind: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('receiveNotification и deleteNotification', () => {
  it('возвращает конверт уведомления и передаёт receiveTimeout', async () => {
    const body = { typeWebhook: 'incomingMessageReceived' };
    respond({ receiptId: 42, body });
    const store = createStore();

    const result = await store
      .dispatch(greenApi.endpoints.receiveNotification.initiate({ receiveTimeout: 5 }))
      .unwrap();

    expect(result).toEqual({ receiptId: 42, body });
    expect(lastRequest().method).toBe('GET');
    expect(lastRequest().url).toBe(`${BASE}/receiveNotification/test-token?receiveTimeout=5`);
  });

  it('возвращает null, когда очередь пуста (пустое тело или литерал null)', async () => {
    const store = createStore();

    respond(undefined);
    expect(
      await store
        .dispatch(greenApi.endpoints.receiveNotification.initiate({ receiveTimeout: 5 }))
        .unwrap(),
    ).toBeNull();

    respond(null);
    expect(
      await store
        .dispatch(greenApi.endpoints.receiveNotification.initiate({ receiveTimeout: 5 }))
        .unwrap(),
    ).toBeNull();
  });

  it('объясняет ответ 400: у инстанса задан webhookUrl', async () => {
    respond({ message: 'custom webhook url is set' }, 400);
    const store = createStore();

    const result = await store.dispatch(
      greenApi.endpoints.receiveNotification.initiate({ receiveTimeout: 5 }),
    );

    expect(result.error).toMatchObject({ kind: 'badRequest', status: 400 });
    expect(result.error).toHaveProperty('message', expect.stringContaining('webhookUrl'));
  });

  it('удаляет уведомление запросом DELETE с receiptId', async () => {
    respond({ result: true });
    const store = createStore();

    await store
      .dispatch(greenApi.endpoints.deleteNotification.initiate({ receiptId: 42 }))
      .unwrap();

    expect(lastRequest().method).toBe('DELETE');
    expect(lastRequest().url).toBe(`${BASE}/deleteNotification/test-token/42`);
  });
});

describe('справочные методы', () => {
  it('getStateInstance проверяет переданные учётные данные, пока сессии ещё нет', async () => {
    respond({ stateInstance: 'authorized' });
    const store = createStore({ credentials: null });

    const result = await store
      .dispatch(greenApi.endpoints.getStateInstance.initiate(credentials))
      .unwrap();

    expect(result).toEqual({ stateInstance: 'authorized' });
    expect(lastRequest().url).toBe(`${BASE}/getStateInstance/test-token`);
  });

  it('getChats приводит ответ к RemoteChat и пропускает битые элементы', async () => {
    respond([
      { chatId: '10000000', name: 'Иван', type: 'user', phoneNumber: 79991234567 },
      { chatId: '-100', name: 'Группа', type: 'group', phoneNumber: 0 },
      { name: 'без chatId' },
      null,
    ]);
    const store = createStore();

    const chats = await store.dispatch(greenApi.endpoints.getChats.initiate()).unwrap();

    expect(chats).toEqual([
      { chatId: '10000000', name: 'Иван', type: 'user', phone: '79991234567' },
      { chatId: '-100', name: 'Группа', type: 'group', phone: null },
    ]);
  });

  it('checkAccount отправляет номер числом', async () => {
    respond({ exist: true, chatId: '10000000' });
    const store = createStore();

    const account = await store
      .dispatch(greenApi.endpoints.checkAccount.initiate({ phoneNumber: '79991234567' }))
      .unwrap();

    expect(account).toEqual({ exist: true, chatId: '10000000' });
    expect(await lastRequest().json()).toEqual({ phoneNumber: 79991234567 });
  });

  it('getSettings повторяет запрос после 429', async () => {
    vi.useFakeTimers();
    respond({ message: 'Too Many Requests' }, 429);
    respond({ webhookUrl: '', incomingWebhook: 'yes' });
    const store = createStore();

    const pending = store.dispatch(greenApi.endpoints.getSettings.initiate()).unwrap();
    await vi.advanceTimersByTimeAsync(5000);

    expect(await pending).toEqual({ webhookUrl: '', incomingWebhook: 'yes' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
