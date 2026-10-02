import { useEffect } from 'react';
import { chatsLoaded, messagesSynced } from '@/entities/chat';
import { normalizeJournal, type ReceivedMessage } from '@/entities/message';
import { getApiErrorMessage, greenApi, isAbortError, useGetChatsQuery } from '@/shared/api';
import { devLog } from '@/shared/lib/devLog';
import { useAppDispatch, type AppThunk } from '@/shared/lib/store';

/** При входе берём сообщения за сутки — это значение журналов по умолчанию. */
const INITIAL_WINDOW_MINUTES = 1440;
/** Как часто сверяться с журналами, пока приложение открыто. */
const RESYNC_INTERVAL_MS = 30_000;
/** Окно сверки шире интервала: сообщение попадает в журнал не мгновенно. */
const RESYNC_WINDOW_MINUTES = 10;

function warnUnavailable(journal: string, error: unknown): void {
  // Отмена при выходе из инстанса — штатная ситуация, а не сбой журнала.
  if (!isAbortError(error)) {
    console.warn(`[ChatSync] Журнал ${journal} недоступен:`, getApiErrorMessage(error));
  }
}

/**
 * Последние сообщения всех чатов из журналов LastIncomingMessages и LastOutgoingMessages:
 * два запроса на весь аккаунт вместо запроса истории на каждый чат.
 * Сбой одного журнала не отменяет результат другого.
 */
function loadJournals(minutes: number): AppThunk<Promise<ReceivedMessage[]>> {
  return async (dispatch) => {
    const options = { track: false } as const;
    const [incoming, outgoing] = await Promise.allSettled([
      dispatch(greenApi.endpoints.lastIncomingMessages.initiate({ minutes }, options)).unwrap(),
      dispatch(greenApi.endpoints.lastOutgoingMessages.initiate({ minutes }, options)).unwrap(),
    ]);

    const received: ReceivedMessage[] = [];
    if (incoming.status === 'fulfilled') {
      received.push(...normalizeJournal(incoming.value, 'incoming'));
    } else {
      warnUnavailable('входящих', incoming.reason);
    }
    if (outgoing.status === 'fulfilled') {
      received.push(...normalizeJournal(outgoing.value, 'outgoing'));
    } else {
      warnUnavailable('исходящих', outgoing.reason);
    }
    return received;
  };
}

/**
 * Синхронизация списка чатов и сообщений с сервером.
 *
 * - Список чатов — из GetChats, как в консоли GREEN-API: он есть и на новом компьютере.
 * - Последние сообщения и превью — из журналов за сутки, одним проходом на все чаты.
 * - Пока приложение открыто, журналы перечитываются раз в 30 секунд. Основной канал
 *   новых сообщений — очередь уведомлений; сверка страхует случаи, когда уведомление
 *   не дошло: его забрал другой клиент или инстанс не кладёт входящие в очередь.
 *   Дубли отсекаются по idMessage, поэтому лишняя сверка ничего не меняет.
 * - В скрытой вкладке сверка не идёт и выполняется сразу при возвращении.
 */
export function useChatSync(): { isLoading: boolean } {
  const dispatch = useAppDispatch();
  const { currentData: remoteChats, error, isLoading } = useGetChatsQuery();

  useEffect(() => {
    if (error !== undefined) {
      console.warn('[ChatSync] Не удалось загрузить список чатов:', getApiErrorMessage(error));
    }
  }, [error]);

  useEffect(() => {
    if (remoteChats !== undefined) {
      devLog('ChatSync', `Received ${remoteChats.length} chats`);
      dispatch(chatsLoaded(remoteChats));
    }
  }, [remoteChats, dispatch]);

  useEffect(() => {
    // Флаг вместо отмены запросов: после выхода или смены инстанса ответы просто игнорируются.
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sync = async (minutes: number, countUnread: boolean): Promise<void> => {
      if (running) {
        return;
      }
      running = true;
      devLog('ChatSync', `Fetching journals for the last ${minutes} min`);
      const received = await dispatch(loadJournals(minutes));
      running = false;
      if (stopped) {
        return;
      }
      devLog('ChatSync', `Received ${received.length} messages`);
      if (received.length > 0) {
        dispatch(messagesSynced({ received, countUnread }));
      }
      schedule();
    };

    const schedule = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          void sync(RESYNC_WINDOW_MINUTES, true);
        } else {
          schedule();
        }
      }, RESYNC_INTERVAL_MS);
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        void sync(RESYNC_WINDOW_MINUTES, true);
      }
    };

    // Первая загрузка непрочитанные не считает: неизвестно, что пользователь уже видел.
    void sync(INITIAL_WINDOW_MINUTES, false);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [dispatch]);

  return { isLoading };
}
