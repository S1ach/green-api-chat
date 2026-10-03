import { useEffect } from 'react';
import { chatsLoaded, messagesSynced } from '@/entities/chat';
import { normalizeJournal, type ReceivedMessage } from '@/entities/message';
import { getApiErrorMessage, greenApi, isAbortError, useGetChatsQuery } from '@/shared/api';
import { devLog } from '@/shared/lib/devLog';
import { useAppDispatch, type AppThunk } from '@/shared/lib/store';

// сутки — дефолт журналов
const INITIAL_WINDOW_MINUTES = 1440;
const RESYNC_INTERVAL_MS = 30_000;
// окно шире интервала: в журнал сообщение попадает не сразу
const RESYNC_WINDOW_MINUTES = 10;

function warnUnavailable(journal: string, error: unknown): void {
  if (!isAbortError(error)) {
    console.warn(`[ChatSync] Журнал ${journal} недоступен:`, getApiErrorMessage(error));
  }
}

// два запроса на весь аккаунт вместо истории по каждому чату
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

// очередь уведомлений может что-то потерять (забрал другой клиент, выключена настройка),
// поэтому раз в 30 секунд сверяемся с журналами. Дубли отсекаются по idMessage
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

    // при первой загрузке непрочитанные не считаем
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
