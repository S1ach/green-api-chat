import { vi } from 'vitest';

type Reply = { status?: number; body?: unknown } | Error;

/** Запрос к GREEN-API, увиденный подменённым fetch. */
export interface RecordedCall {
  /** Имя метода из URL: `sendMessage`, `receiveNotification`… */
  method: string;
  url: string;
  httpMethod: string;
  signal: AbortSignal;
  /** Ответ уже отдан; `false` — запрос «висит» в ожидании. */
  answered: boolean;
}

function methodName(url: string): string {
  return /\/waInstance[^/]+\/([^/?]+)/.exec(url)?.[1] ?? 'unknown';
}

/**
 * Подмена fetch для тестов: ответы задаются очередью на каждый метод GREEN-API.
 * Если очередь метода пуста, запрос «висит», как long polling на пустой очереди,
 * и завершается только отменой — так видно, сколько запросов сейчас в полёте.
 */
export function mockGreenApi() {
  const replies = new Map<string, Reply[]>();
  const calls: RecordedCall[] = [];

  const fetchMock = vi.fn((request: Request): Promise<Response> => {
    const method = methodName(request.url);
    const reply = replies.get(method)?.shift();
    calls.push({
      method,
      url: request.url,
      httpMethod: request.method,
      signal: request.signal,
      answered: reply !== undefined,
    });

    if (reply === undefined) {
      return new Promise((_resolve, reject) => {
        request.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    }
    if (reply instanceof Error) {
      return Promise.reject(reply);
    }
    const text = reply.body === undefined ? '' : JSON.stringify(reply.body);
    return Promise.resolve(new Response(text, { status: reply.status ?? 200 }));
  });

  vi.stubGlobal('fetch', fetchMock);

  return {
    calls,
    /** Ставит ответ в очередь метода: тело JSON (по умолчанию 200) или ошибка сети. */
    reply(method: string, body?: unknown, status?: number) {
      const queue = replies.get(method) ?? [];
      queue.push({ body, status });
      replies.set(method, queue);
    },
    fail(method: string, error: Error = new TypeError('Failed to fetch')) {
      const queue = replies.get(method) ?? [];
      queue.push(error);
      replies.set(method, queue);
    },
    /** Запросы метода, которые сейчас в полёте: ответа ещё нет и их не отменили. */
    pending(method: string): RecordedCall[] {
      return calls.filter(
        (call) => call.method === method && !call.answered && !call.signal.aborted,
      );
    },
    methods(): string[] {
      return calls.map((call) => call.method);
    },
  };
}
