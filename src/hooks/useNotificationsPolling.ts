import { useEffect, useRef, useState } from 'react';
import { deleteNotification, receiveNotification } from '../api/greenApi';
import { toUserMessage } from '../api/errors';
import type { Credentials } from '../types/green';
import { devLog } from '../utils/devLog';
import { describeNotification } from '../utils/notification';

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
          devLog('Polling', 'Waiting for notification...');
          const envelope = await receiveNotification(credentials, RECEIVE_TIMEOUT_SECONDS, signal);
          failures = 0;
          setError((previous) => (previous === null ? previous : null));

          // Пустой ответ — очередь пуста, сервер уже подождал receiveTimeout: сразу идём на новый круг.
          if (envelope !== null) {
            const summary = describeNotification(envelope.body);
            devLog('Polling', 'Notification received');
            devLog('Polling', 'typeWebhook:', summary.typeWebhook);
            devLog('Polling', 'chatId:', summary.chatId);
            devLog('Polling', 'messageData:', summary.messageData);

            // Сначала обработка, потом удаление. Если обработчик упал — подробно логируем
            // и всё равно удаляем: иначе «битое» уведомление навсегда заблокирует очередь.
            try {
              handlerRef.current(envelope.body);
            } catch (handlerError) {
              console.error(
                `[Polling] Не удалось обработать уведомление receiptId=${envelope.receiptId}`,
                handlerError,
                envelope.body,
              );
            }
            devLog('DeleteNotification', 'receiptId:', envelope.receiptId);
            await deleteNotification(credentials, envelope.receiptId, signal);
          }
        } catch (requestError) {
          if (signal.aborted) {
            return;
          }
          failures += 1;
          console.warn(`[Polling] Ошибка, попытка ${failures}:`, toUserMessage(requestError));
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
