import { useEffect, useState } from 'react';
import { historyLoaded } from '@/entities/chat';
import { normalizeHistory } from '@/entities/message';
import { getApiErrorMessage, useGetChatHistoryQuery } from '@/shared/api';
import { devLog } from '@/shared/lib/devLog';
import { useAppDispatch } from '@/shared/lib/store';

const PAGE_SIZE = 100;
const FRESH_SECONDS = 60;

interface ChatHistory {
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

export function useChatHistory(chatId: string): ChatHistory {
  const dispatch = useAppDispatch();
  const [count, setCount] = useState(PAGE_SIZE);
  const {
    currentData: history,
    isFetching,
    error,
    refetch,
  } = useGetChatHistoryQuery({ chatId, count }, { refetchOnMountOrArgChange: FRESH_SECONDS });

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
    // offset у метода нет: пришло столько, сколько просили, — возможно, есть ещё
    hasMore: history !== undefined && history.length >= count,
    loadMore: () => setCount((current) => current + PAGE_SIZE),
    retry: () => void refetch(),
  };
}
