import { vi } from 'vitest';

type Reply = { status?: number; body?: unknown } | Error;

export interface RecordedCall {
  method: string;
  url: string;
  httpMethod: string;
  signal: AbortSignal;
  answered: boolean;
  body: unknown;
  release: (body?: unknown) => void;
}

function methodName(url: string): string {
  return /\/waInstance[^/]+\/([^/?]+)/.exec(url)?.[1] ?? 'unknown';
}

// ответы задаются очередью на метод; если очередь пуста, запрос висит, как long polling
export function mockGreenApi() {
  const replies = new Map<string, Reply[]>();
  const calls: RecordedCall[] = [];

  const fetchMock = vi.fn((request: Request): Promise<Response> => {
    const method = methodName(request.url);
    const reply = replies.get(method)?.shift();
    const call: RecordedCall = {
      method,
      url: request.url,
      httpMethod: request.method,
      signal: request.signal,
      answered: reply !== undefined,
      body: undefined,
      release: () => undefined,
    };
    calls.push(call);
    void request
      .clone()
      .json()
      .then((body: unknown) => {
        call.body = body;
      })
      .catch(() => undefined);

    if (reply === undefined) {
      return new Promise((resolve, reject) => {
        call.release = (body) => {
          call.answered = true;
          resolve(new Response(body === undefined ? '' : JSON.stringify(body)));
        };
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
    pending(method: string): RecordedCall[] {
      return calls.filter(
        (call) => call.method === method && !call.answered && !call.signal.aborted,
      );
    },
    methods(): string[] {
      return calls.map((call) => call.method);
    },
    callsOf(method: string): RecordedCall[] {
      return calls.filter((call) => call.method === method);
    },
  };
}
