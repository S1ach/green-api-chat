import { useEffect, useState } from 'react';
import { messageReceived, messageStatusChanged } from '@/entities/chat';
import { describeNotification, parseNotification } from '@/entities/message';
import { selectCredentials } from '@/entities/session';
import { getApiErrorMessage, greenApi } from '@/shared/api';
import { devLog } from '@/shared/lib/devLog';
import { sleep } from '@/shared/lib/sleep';
import { useAppDispatch, useAppSelector, type AppThunk } from '@/shared/lib/store';

const RECEIVE_TIMEOUT_SECONDS = 5;
const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
// если сервер отвечает «пусто» мгновенно, не долбим его без паузы
const MIN_CYCLE_MS = 1000;

export interface PollingState {
  error: string | null;
}

interface Abortable<T> {
  abort: () => void;
  unwrap: () => Promise<T>;
}

function applyNotification(body: unknown): AppThunk {
  return (dispatch, getState) => {
    const parsed = parseNotification(body);
    if (parsed === null) {
      return;
    }
    if (parsed.kind === 'status') {
      dispatch(messageStatusChanged(parsed));
      return;
    }
    const before = getState().chat;
    dispatch(messageReceived({ message: parsed.message, chat: parsed.chat }));
    devLog('ChatSync', getState().chat === before ? 'Duplicate ignored' : 'New message received');
  };
}

function retryDelay(failures: number): number {
  return Math.min(BASE_RETRY_MS * 2 ** (failures - 1), MAX_RETRY_MS);
}

// receiveNotification → разбор → deleteNotification, строго по одному
export function useNotificationPolling(): PollingState {
  const dispatch = useAppDispatch();
  const credentials = useAppSelector(selectCredentials);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (credentials === null) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    let failures = 0;

    const run = async <T>(request: Abortable<T>): Promise<T> => {
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      try {
        return await request.unwrap();
      } finally {
        signal.removeEventListener('abort', abort);
      }
    };

    const loop = async (): Promise<void> => {
      while (!signal.aborted) {
        const startedAt = Date.now();
        try {
          const notification = await run(
            dispatch(
              greenApi.endpoints.receiveNotification.initiate(
                { receiveTimeout: RECEIVE_TIMEOUT_SECONDS },
                { track: false },
              ),
            ),
          );
          failures = 0;
          setError(null);

          if (notification === null) {
            const elapsed = Date.now() - startedAt;
            if (elapsed < MIN_CYCLE_MS) {
              await sleep(MIN_CYCLE_MS - elapsed, signal);
            }
            continue;
          }
          devLog('ChatSync', 'Notification received:', describeNotification(notification.body));

          // удаляем в любом случае, иначе битое уведомление заблокирует очередь
          try {
            dispatch(applyNotification(notification.body));
          } catch (handlerError) {
            console.error(
              `[Polling] Не удалось обработать уведомление receiptId=${notification.receiptId}`,
              handlerError,
            );
          }

          await run(
            dispatch(
              greenApi.endpoints.deleteNotification.initiate(
                { receiptId: notification.receiptId },
                { track: false },
              ),
            ),
          );
        } catch (requestError) {
          if (signal.aborted) {
            return;
          }
          failures += 1;
          const message = getApiErrorMessage(requestError);
          console.warn(`[Polling] Ошибка, попытка ${failures}:`, message);
          setError(message);
          await sleep(retryDelay(failures), signal);
        }
      }
    };

    void loop();

    return () => controller.abort();
  }, [credentials, dispatch]);

  return { error };
}
