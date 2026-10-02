import { useEffect } from 'react';
import { chatsLoaded, historyLoaded } from '@/entities/chat';
import { normalizeHistory } from '@/entities/message';
import { getApiErrorMessage, greenApi, useGetChatsQuery } from '@/shared/api';
import { useAppDispatch } from '@/shared/lib/store';

/** Для превью в списке чатов хватает нескольких последних сообщений. */
const PREVIEW_COUNT = 5;
/** Пауза между запросами превью, чтобы не упереться в лимит частоты (429). */
const PREVIEW_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Список чатов берём с сервера (GetChats) — как в консоли GREEN-API, поэтому он есть
 * и на новом компьютере. Затем по очереди подгружаем последние сообщения каждого чата
 * для превью: строго последовательно и с паузой из-за лимитов частоты.
 */
export function useLoadChats(): { isLoading: boolean } {
  const dispatch = useAppDispatch();
  const { currentData: remoteChats, error, isLoading } = useGetChatsQuery();

  useEffect(() => {
    if (error !== undefined) {
      console.warn('[Chats] Не удалось загрузить список чатов:', getApiErrorMessage(error));
    }
  }, [error]);

  useEffect(() => {
    if (remoteChats === undefined) {
      return;
    }
    dispatch(chatsLoaded(remoteChats));

    // Флаг вместо отмены запроса: после выхода или смены инстанса ответы просто игнорируются.
    let cancelled = false;

    const loadPreviews = async (): Promise<void> => {
      for (const { chatId } of remoteChats) {
        if (cancelled) {
          return;
        }
        try {
          const raw = await dispatch(
            greenApi.endpoints.getChatHistory.initiate(
              { chatId, count: PREVIEW_COUNT },
              { subscribe: false, forceRefetch: true },
            ),
          ).unwrap();
          if (cancelled) {
            return;
          }
          dispatch(historyLoaded({ chatId, messages: normalizeHistory(raw, chatId) }));
        } catch (previewError) {
          console.warn(`[Chats] Нет превью для чата ${chatId}:`, getApiErrorMessage(previewError));
        }
        await sleep(PREVIEW_DELAY_MS);
      }
    };

    void loadPreviews();
    return () => {
      cancelled = true;
    };
  }, [remoteChats, dispatch]);

  return { isLoading };
}
