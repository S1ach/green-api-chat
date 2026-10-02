/**
 * Сколько запросов в секунду GREEN-API принимает для метода MAX
 * (https://green-api.com/v3/docs/api/ratelimiter/). Сверх лимита сервер отвечает 429.
 * Методов, которых здесь нет (receiveNotification, deleteNotification — 100/с), не касаемся.
 */
const REQUESTS_PER_SECOND: Record<string, number> = {
  getStateInstance: 1,
  getAccountSettings: 1,
  getSettings: 1,
  setSettings: 1,
  getChats: 1,
  getContacts: 1,
  getChatHistory: 1,
  lastIncomingMessages: 1,
  lastOutgoingMessages: 1,
  checkAccount: 10,
  getAvatar: 10,
  getContactInfo: 10,
  sendMessage: 50,
  sendFileByUpload: 50,
  sendLocation: 50,
  sendContact: 50,
};

/** Запас к интервалу: сеть доставляет запросы неравномерно, а сервер считает по своему времени. */
const SAFETY_FACTOR = 1.2;

/** Момент, с которого метод инстанса можно вызывать снова. Ключ — `инстанс:метод`. */
const nextSlotAt = new Map<string, number>();

function minInterval(method: string): number {
  const limit = REQUESTS_PER_SECOND[method];
  return limit === undefined ? 0 : Math.ceil((1000 / limit) * SAFETY_FACTOR);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Ждёт свободный «слот» метода. Запросы одного метода выстраиваются в очередь с интервалом
 * не меньше лимита — сколько бы компонентов ни запросили его одновременно.
 * Отменённый запрос перестаёт ждать сразу.
 */
export async function waitForSlot(
  instance: string,
  method: string,
  signal: AbortSignal,
): Promise<void> {
  const interval = minInterval(method);
  if (interval === 0) {
    return;
  }
  const key = `${instance}:${method}`;
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt.get(key) ?? 0);
  // Слот бронируется сразу, до ожидания: следующий запрос встанет уже за этим.
  nextSlotAt.set(key, slot + interval);
  if (slot > now) {
    await sleep(slot - now, signal);
  }
}

/** Сервер ответил 429: метод нельзя вызывать ещё `delayMs`, очередь сдвигается целиком. */
export function postponeMethod(instance: string, method: string, delayMs: number): void {
  const key = `${instance}:${method}`;
  nextSlotAt.set(key, Math.max(nextSlotAt.get(key) ?? 0, Date.now() + delayMs));
}

/** Ожидание перед повтором после 429 — тоже прерывается отменой запроса. */
export function waitBeforeRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  return sleep(delayMs, signal);
}

/** Сбрасывает очередь — между тестами и при выходе из инстанса. */
export function resetRateLimiter(): void {
  nextSlotAt.clear();
}
