import { useEffect, useRef, useState } from 'react';
import { deleteNotification, receiveNotification } from '../api/greenApi';
import { toUserMessage } from '../api/errors';
import type { Credentials } from '../types/green';

/** Сколько секунд сервер держит открытым запрос, если очередь пуста. */
const RECEIVE_TIMEOUT_SECONDS = 5;
const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;

export interface PollingState {
  /** Текст последней сетевой ошибки; `null`, когда опрос идёт нормально. */
  error: string | null;
}

interface Options {
  credentials: Credentials | null;
  /** Вызывается для каждого полученного тела уведомления. */
  onNotification: (body: unknown) => void;
}

function retryDelay(failures: number): number {
  return Math.min(BASE_RETRY_MS * 2 ** (failures - 1), MAX_RETRY_MS);
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
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
 * Последовательный HTTP-опрос очереди уведомлений (без вебхуков).
 * Следующий запрос уходит только после обработки предыдущего;
 * каждое полученное уведомление обязательно удаляется через deleteNotification,
 * даже если оно нерелевантно, иначе очередь встанет.
 */
export function useNotificationsPolling({ credentials, onNotification }: Options): PollingState {
  const [error, setError] = useState<string | null>(null);
  const handlerRef = useRef(onNotification);

  useEffect(() => {
    handlerRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (credentials === null) {
      setError(null);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    let failures = 0;

    const loop = async (): Promise<void> => {
      while (!signal.aborted) {
        try {
          const envelope = await receiveNotification(credentials, RECEIVE_TIMEOUT_SECONDS, signal);
          failures = 0;
          setError((previous) => (previous === null ? previous : null));

          if (envelope !== null) {
            try {
              handlerRef.current(envelope.body);
            } catch (handlerError) {
              console.error('Не удалось обработать уведомление', handlerError);
            } finally {
              // Удаляем всегда: статусы и прочие типы тоже блокируют очередь.
              await deleteNotification(credentials, envelope.receiptId, signal);
            }
          }
        } catch (requestError) {
          if (signal.aborted) {
            return;
          }
          failures += 1;
          setError(toUserMessage(requestError));
          await wait(retryDelay(failures), signal);
        }
      }
    };

    void loop();

    return () => {
      controller.abort();
    };
  }, [credentials]);

  return { error };
}
