import { useEffect, useState } from 'react';
import { historyLoaded } from '@/entities/chat';
import { normalizeHistory } from '@/entities/message';
import { getApiErrorMessage, useGetChatHistoryQuery } from '@/shared/api';
import { devLog } from '@/shared/lib/devLog';
import { useAppDispatch } from '@/shared/lib/store';

/** Сколько сообщений запрашивать за раз. Сам MAX отдаёт не больше 5000 и не глубже 3 месяцев. */
const PAGE_SIZE = 100;
/** Не перезапрашиваем историю, если она получена недавно: новые сообщения приносит очередь. */
const FRESH_SECONDS = 60;

interface ChatHistory {
  /** Идёт запрос истории: первый, повторный или подгрузка более ранних сообщений. */
  isLoading: boolean;
  /** Текст ошибки последнего запроса; `null`, если он удался или ещё выполняется. */
  error: string | null;
  /** На сервере могут быть сообщения старше загруженных. */
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

/**
 * История открытого чата. Источник — сервер GREEN-API, а не localStorage: переписка
 * появляется и после очистки браузера, и на другом компьютере.
 *
 * Хук рассчитан на один чат: компонент чата пересоздаётся при переключении (`key`),
 * поэтому глубина подгрузки у каждого чата своя.
 */
export function useChatHistory(chatId: string): ChatHistory {
  const dispatch = useAppDispatch();
  const [count, setCount] = useState(PAGE_SIZE);
  const {
    currentData: history,
    isFetching,
    error,
    refetch,
  } = useGetChatHistoryQuery({ chatId, count }, { refetchOnMountOrArgChange: FRESH_SECONDS });

  // `currentData` всегда относится к текущему запросу и текущей сессии: устаревшие ответы
  // (после смены чата или выхода) RTK Query отбрасывает сам, в слайс они не попадут.
  useEffect(() => {
    if (history !== undefined) {
      const messages = normalizeHistory(history, chatId);
      devLog('ChatSync', `History: ${history.length} items, ${messages.length} messages`);
      dispatch(historyLoaded({ chatId, messages }));
    }
  }, [history, chatId, dispatch]);

  return {
    isLoading: isFetching,
    error: error === undefined || isFetching ? null : getApiErrorMessage(error),
    // У GetChatHistory нет смещения: вернулось столько, сколько просили, — возможно, есть ещё.
    hasMore: history !== undefined && history.length >= count,
    loadMore: () => setCount((current) => current + PAGE_SIZE),
    retry: () => void refetch(),
  };
}
