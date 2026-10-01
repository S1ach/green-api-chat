import { chatsRestored, loadChatCache } from '@/entities/chat';
import { sessionEnded, sessionStarted } from '@/entities/session';
import { getApiErrorMessage, greenApi, type Credentials } from '@/shared/api';
import type { AppThunk } from '@/shared/lib/store';
import { stateHint } from './stateHints';

export type ConnectResult = { ok: true } | { ok: false; error: string };

/**
 * Подключение инстанса: проверяет учётные данные через getStateInstance и начинает сессию.
 * Возвращает текст ошибки, если данные неверны или инстанс не авторизован в MAX.
 */
export function connectInstance(credentials: Credentials): AppThunk<Promise<ConnectResult>> {
  return async (dispatch) => {
    let stateInstance: string;
    try {
      ({ stateInstance } = await dispatch(
        greenApi.endpoints.getStateInstance.initiate(credentials, {
          subscribe: false,
          forceRefetch: true,
        }),
      ).unwrap());
    } catch (error) {
      return { ok: false, error: getApiErrorMessage(error) };
    }

    if (stateInstance !== 'authorized') {
      return { ok: false, error: stateHint(stateInstance) };
    }

    dispatch(chatsRestored(loadChatCache(credentials.idInstance)));
    dispatch(sessionStarted(credentials));
    return { ok: true };
  };
}

/**
 * Выход: сбрасывает состояние приложения и кэш запросов. Опрос очереди
 * останавливается сам — страница чата размонтируется и отменяет свой цикл.
 */
export function disconnectInstance(): AppThunk {
  return (dispatch) => {
    dispatch(sessionEnded());
    dispatch(greenApi.util.resetApiState());
  };
}
