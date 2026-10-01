import { loadChatCache, saveChatCache } from '@/entities/chat';
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
  selectCredentials,
} from '@/entities/session';
import type { AppStore } from './store';

/** Состояние из localStorage: учётные данные прошлого входа и кэш чатов этого инстанса. */
export function loadPersistedState(): Partial<RootState> | undefined {
  const credentials = loadCredentials();
  if (credentials === null) {
    return undefined;
  }
  return { session: { credentials }, chat: loadChatCache(credentials.idInstance) };
}

/**
 * Сохраняет в localStorage учётные данные и чаты текущего инстанса при их изменении.
 * Без активной сессии чаты не пишутся — выход не затирает кэш пустым состоянием.
 */
export function persistState(store: AppStore): void {
  let saved = store.getState();

  store.subscribe(() => {
    const state = store.getState();
    const credentials = selectCredentials(state);

    if (credentials !== selectCredentials(saved)) {
      if (credentials === null) {
        clearCredentials();
      } else {
        saveCredentials(credentials);
      }
    }
    if (credentials !== null && state.chat !== saved.chat) {
      saveChatCache(credentials.idInstance, state.chat);
    }
    saved = state;
  });
}
