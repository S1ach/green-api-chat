import { useEffect } from 'react';
import { historyLoaded } from '@/entities/chat';
import { normalizeHistory } from '@/entities/message';
import { getApiErrorMessage, useGetChatHistoryQuery } from '@/shared/api';
import { useAppDispatch } from '@/shared/lib/store';

/**
 * Сколько сообщений запрашивать в GetChatHistory.
 * Сам MAX отдаёт не больше 5000 сообщений и не глубже 3 месяцев.
 */
const HISTORY_COUNT = 1000;

interface ChatHistory {
  isLoading: boolean;
  /** Текст ошибки загрузки; `null`, если история получена или ещё загружается. */
  error: string | null;
}

/**
 * История открытого чата. Источник — сервер GREEN-API, а не только localStorage: так переписка
 * появляется и после очистки браузера, и на другом компьютере. Запрос повторяется при каждом
 * открытии чата; сообщения сливаются с уже известными по idMessage, дублей не возникает.
 */
export function useChatHistory(chatId: string): ChatHistory {
  const dispatch = useAppDispatch();
  const {
    currentData: history,
    isFetching,
    error,
  } = useGetChatHistoryQuery({ chatId, count: HISTORY_COUNT }, { refetchOnMountOrArgChange: true });

  // `currentData` всегда относится к текущему чату и текущей сессии: устаревшие ответы
  // (после смены чата или выхода) RTK Query отбрасывает сам, в слайс они не попадут.
  useEffect(() => {
    if (history !== undefined) {
      dispatch(historyLoaded({ chatId, messages: normalizeHistory(history, chatId) }));
    }
  }, [history, chatId, dispatch]);

  return {
    isLoading: isFetching,
    error: error === undefined ? null : getApiErrorMessage(error),
  };
}
