import { useEffect, useState } from 'react';
import { messageReceived, messageStatusChanged } from '@/entities/chat';
import { describeNotification, parseNotification } from '@/entities/message';
import { selectCredentials } from '@/entities/session';
import { getApiErrorMessage, greenApi } from '@/shared/api';
import { devLog } from '@/shared/lib/devLog';
import { useAppDispatch, useAppSelector, type AppThunk } from '@/shared/lib/store';

/** Сколько секунд сервер держит открытым запрос, если очередь пуста. */
const RECEIVE_TIMEOUT_SECONDS = 5;
const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
/**
 * Минимальная длительность одного круга опроса. Обычно сервер сам держит запрос
 * receiveTimeout секунд, но если он ответит «пусто» мгновенно, цикл не должен
 * превратиться в поток запросов.
 */
const MIN_CYCLE_MS = 1000;

export interface PollingState {
  /** Текст последней сетевой ошибки; `null`, когда опрос идёт нормально. */
  error: string | null;
}

/** Запрос RTK Query, запущенный через `initiate`: его можно отменить и дождаться результата. */
interface Abortable<T> {
  abort: () => void;
  unwrap: () => Promise<T>;
}

/** Кладёт уведомление в состояние чатов: новое сообщение либо смена статуса отправленного. */
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
    // Редьюсер не меняет состояние, если сообщение уже есть (пришло из истории или журнала).
    devLog('ChatSync', getState().chat === before ? 'Duplicate ignored' : 'New message received');
  };
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
 * Приём входящих по технологии HTTP API (без вебхуков): последовательный цикл
 * receiveNotification → разбор → deleteNotification → следующий receiveNotification.
 *
 * - Цикл один: его запускает эффект, а cleanup останавливает — при размонтировании,
 *   выходе и смене учётных данных. Отменяется и уже отправленный запрос.
 * - Следующий запрос уходит только после обработки предыдущего.
 * - Каждое уведомление удаляется, даже нерелевантное, иначе очередь встанет.
 * - При ошибках — пауза с экспоненциальным ростом от 1 до 30 секунд.
 */
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

    // Отмена цикла отменяет и запрос, который сейчас в полёте (long polling держит его до 5 секунд).
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

          // Пустой ответ — очередь пуста: сервер уже подождал receiveTimeout, идём на новый круг.
          if (notification === null) {
            const elapsed = Date.now() - startedAt;
            if (elapsed < MIN_CYCLE_MS) {
              await wait(MIN_CYCLE_MS - elapsed, signal);
            }
            continue;
          }
          devLog('ChatSync', 'Notification received:', describeNotification(notification.body));

          // Сначала обработка, потом удаление. Служебные уведомления парсер превращает
          // в `null`: в чат они не попадают, но из очереди удаляются. Если обработка упала —
          // логируем и всё равно удаляем, иначе «битое» уведомление заблокирует очередь.
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
          await wait(retryDelay(failures), signal);
        }
      }
    };

    void loop();

    return () => controller.abort();
  }, [credentials, dispatch]);

  return { error };
}
