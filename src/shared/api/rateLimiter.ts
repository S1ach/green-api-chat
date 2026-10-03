import { sleep } from '@/shared/lib/sleep';

// запросов в секунду на метод: https://green-api.com/v3/docs/api/ratelimiter/
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

// запас: сервер считает по своим часам
const SAFETY_FACTOR = 1.2;

const nextSlotAt = new Map<string, number>();

function minInterval(method: string): number {
  const limit = REQUESTS_PER_SECOND[method];
  return limit === undefined ? 0 : Math.ceil((1000 / limit) * SAFETY_FACTOR);
}

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
  // слот занимаем до ожидания, следующий запрос встанет за ним
  nextSlotAt.set(key, slot + interval);
  if (slot > now) {
    await sleep(slot - now, signal);
  }
}

export function postponeMethod(instance: string, method: string, delayMs: number): void {
  const key = `${instance}:${method}`;
  nextSlotAt.set(key, Math.max(nextSlotAt.get(key) ?? 0, Date.now() + delayMs));
}

export function resetRateLimiter(): void {
  nextSlotAt.clear();
}
