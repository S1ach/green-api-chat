import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFileForm, greenApi } from './greenApi';
import { rateLimitReducer } from './rateLimitSlice';
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
    reducer: {
      session: () => session,
      rateLimit: rateLimitReducer,
      [greenApi.reducerPath]: greenApi.reducer,
    },
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

describe('отправка файла, геопозиции и контакта', () => {
  const file = new File(['%PDF-1.4'], 'Договор.pdf', { type: 'application/pdf' });

  it('buildFileForm собирает форму SendFileByUpload: чат, имя файла, подпись и сам файл', () => {
    const form = buildFileForm({ chatId: '10000000', file, caption: 'На подпись' });

    expect(form.get('chatId')).toBe('10000000');
    expect(form.get('fileName')).toBe('Договор.pdf');
    expect(form.get('caption')).toBe('На подпись');
    expect(form.get('file')).toBeInstanceOf(File);
    expect((form.get('file') as File).name).toBe('Договор.pdf');
  });

  it('buildFileForm не добавляет пустую подпись', () => {
    expect(buildFileForm({ chatId: '10000000', file, caption: '' }).has('caption')).toBe(false);
  });

  it('sendFileByUpload отправляет файл на mediaUrl и возвращает ссылку на него', async () => {
    respond({ idMessage: '1763115112345', urlFile: 'https://storage.example/contract.pdf' });
    const store = createStore({
      credentials: { ...credentials, mediaUrl: 'https://media.green-api.com/' },
    });

    const result = await store
      .dispatch(
        greenApi.endpoints.sendFileByUpload.initiate({ chatId: '10000000', file, caption: '' }),
      )
      .unwrap();

    expect(result).toEqual({
      idMessage: '1763115112345',
      urlFile: 'https://storage.example/contract.pdf',
    });
    const request = lastRequest();
    expect(request.method).toBe('POST');
    expect(request.url).toBe(
      'https://media.green-api.com/waInstance1101000001/sendFileByUpload/test-token',
    );
    // Заголовок JSON к форме не добавляется: границу multipart выставляет сам браузер.
    expect(request.headers.get('content-type') ?? '').not.toContain('application/json');
  });

  it('без mediaUrl отправляет файл через apiUrl', async () => {
    respond({ idMessage: '1763115112345' });
    const store = createStore();

    await store
      .dispatch(
        greenApi.endpoints.sendFileByUpload.initiate({ chatId: '10000000', file, caption: '' }),
      )
      .unwrap();

    expect(lastRequest().url).toBe(`${BASE}/sendFileByUpload/test-token`);
  });

  it('объясняет ответ 413: файл слишком большой', async () => {
    respond({ message: 'request entity too large' }, 413);
    const store = createStore();

    const result = await store.dispatch(
      greenApi.endpoints.sendFileByUpload.initiate({ chatId: '10000000', file, caption: '' }),
    );

    expect(result.error).toMatchObject({ status: 413 });
    expect((result.error as { message: string }).message).toContain('до 100 МБ');
  });

  it('sendLocation отправляет координаты числами', async () => {
    respond({ idMessage: '1762333029830' });
    const store = createStore();

    await store
      .dispatch(
        greenApi.endpoints.sendLocation.initiate({
          chatId: '10000000',
          latitude: 51.1035035,
          longitude: 71.3996933,
        }),
      )
      .unwrap();

    const request = lastRequest();
    expect(request.url).toBe(`${BASE}/sendLocation/test-token`);
    expect(await request.json()).toEqual({
      chatId: '10000000',
      latitude: 51.1035035,
      longitude: 71.3996933,
    });
  });

  it('sendContact передаёт chatId контакта во вложенном объекте contact', async () => {
    respond({ idMessage: '1762333029831' });
    const store = createStore();

    await store
      .dispatch(
        greenApi.endpoints.sendContact.initiate({ chatId: '10000000', contactChatId: '10000001' }),
      )
      .unwrap();

    const request = lastRequest();
    expect(request.url).toBe(`${BASE}/sendContact/test-token`);
    expect(await request.json()).toEqual({ chatId: '10000000', contact: { chatId: '10000001' } });
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

  it('getContacts берёт имя из записной книжки, а без него — из профиля', async () => {
    respond([
      { chatId: '10000001', name: 'Люся', contactName: 'Люся Сидорова', phoneNumber: 79998887766 },
      { chatId: '10000002', name: 'Профиль', contactName: '', phoneNumber: 0 },
      { name: 'без chatId' },
    ]);
    const store = createStore();

    const contacts = await store.dispatch(greenApi.endpoints.getContacts.initiate()).unwrap();

    expect(lastRequest().url).toBe(`${BASE}/getContacts/test-token`);
    expect(contacts).toEqual([
      { chatId: '10000001', name: 'Люся Сидорова', phone: '79998887766' },
      { chatId: '10000002', name: 'Профиль', phone: null },
    ]);
  });

  it('getAccountSettings возвращает chatId собственного чата', async () => {
    respond({ phone: '79991234567', stateInstance: 'authorized', chatId: '10000000' });
    const store = createStore();

    const chatId = await store.dispatch(greenApi.endpoints.getAccountSettings.initiate()).unwrap();

    expect(lastRequest().url).toBe(`${BASE}/getAccountSettings/test-token`);
    expect(chatId).toBe('10000000');
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

  it('getSettings возвращает настройки приёма, setSettings меняет только переданные', async () => {
    respond({ webhookUrl: '', incomingWebhook: 'no', outgoingWebhook: 'yes' });
    const store = createStore();

    const settings = await store.dispatch(greenApi.endpoints.getSettings.initiate()).unwrap();
    expect(settings).toEqual({
      webhookUrl: '',
      incomingWebhook: 'no',
      outgoingWebhook: 'yes',
      outgoingMessageWebhook: '',
    });

    respond({ saveSettings: true });
    // Сохранение сбрасывает кэш настроек — приложение перечитывает их.
    respond({ webhookUrl: '', incomingWebhook: 'yes' });
    await store
      .dispatch(greenApi.endpoints.setSettings.initiate({ incomingWebhook: 'yes' }))
      .unwrap();

    const request = fetchMock.mock.calls[1]?.[0];
    expect(request?.url).toBe(`${BASE}/setSettings/test-token`);
    expect(await request?.json()).toEqual({ incomingWebhook: 'yes' });
  });

  it('журналы запрашивают сообщения за указанное число минут', async () => {
    respond([{ idMessage: '1' }]);
    const store = createStore();

    const journal = await store
      .dispatch(greenApi.endpoints.lastIncomingMessages.initiate({ minutes: 10 }))
      .unwrap();

    expect(journal).toEqual([{ idMessage: '1' }]);
    expect(lastRequest().url).toBe(`${BASE}/lastIncomingMessages/test-token?minutes=10`);
  });
});

describe('ограничение частоты запросов', () => {
  const history = { chatId: '10000000', count: 100 };
  const rateLimitedUntil = (store: ReturnType<typeof createStore>) =>
    store.getState().rateLimit.retryAt;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('после 429 ждёт и повторяет запрос, а вызывающий код ошибки не видит', async () => {
    respond({ message: 'Too Many Requests' }, 429);
    respond([{ idMessage: '1' }]);
    const store = createStore();

    const pending = store.dispatch(greenApi.endpoints.getChatHistory.initiate(history)).unwrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Интерфейс узнаёт, до какого момента ждать: показывает «повторим через N секунд».
    expect(rateLimitedUntil(store)).toBeGreaterThan(Date.now());

    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toEqual([{ idMessage: '1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('учитывает заголовок Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{}', { status: 429, headers: { 'Retry-After': '7' } }),
    );
    respond([]);
    const store = createStore();

    const pending = store.dispatch(greenApi.endpoints.getChatHistory.initiate(history)).unwrap();
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('повторяет ограниченное число раз и затем отдаёт понятную ошибку', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('{}', { status: 429 })));
    const store = createStore();

    const pending = store.dispatch(greenApi.endpoints.getChatHistory.initiate(history));
    await vi.advanceTimersByTimeAsync(60_000);

    expect((await pending).error).toMatchObject({ kind: 'rateLimit', status: 429 });
    // Первый запрос и три повтора — не бесконечный цикл.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('не отправляет два запроса одного метода чаще лимита, кто бы их ни вызвал', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('[]')));
    const store = createStore();

    // Два разных чата — два разных запроса одного метода с лимитом 1 запрос в секунду.
    const first = store.dispatch(greenApi.endpoints.getChatHistory.initiate(history));
    const second = store.dispatch(
      greenApi.endpoints.getChatHistory.initiate({ chatId: '20000000', count: 100 }),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await Promise.all([first, second]);
  });

  it('одинаковые запросы объединяет в один', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('[]')));
    const store = createStore();

    await Promise.all([
      store.dispatch(greenApi.endpoints.getChatHistory.initiate(history)),
      store.dispatch(greenApi.endpoints.getChatHistory.initiate(history)),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('опрос очереди при 429 не повторяет запрос сам: паузу выдерживает цикл опроса', async () => {
    respond({}, 429);
    const store = createStore();

    const result = await store.dispatch(
      greenApi.endpoints.receiveNotification.initiate({ receiveTimeout: 5 }),
    );

    expect(result.error).toMatchObject({ kind: 'rateLimit' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
