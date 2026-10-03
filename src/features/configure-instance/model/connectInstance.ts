import { chatsRestored, loadChatCache } from '@/entities/chat';
import { sessionEnded, sessionStarted } from '@/entities/session';
import { getApiErrorMessage, greenApi, resetRateLimiter, type Credentials } from '@/shared/api';
import type { AppThunk } from '@/shared/lib/store';
import { stateHint } from './stateHints';

export type ConnectResult = { ok: true } | { ok: false; error: string };

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

// опрос очереди остановится сам, когда размонтируется страница чата
export function disconnectInstance(): AppThunk {
  return (dispatch) => {
    dispatch(sessionEnded());
    dispatch(greenApi.util.resetApiState());
    resetRateLimiter();
  };
}
