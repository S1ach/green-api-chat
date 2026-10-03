import { loadChatCache, saveChatCache } from '@/entities/chat';
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
  selectCredentials,
} from '@/entities/session';
import type { AppStore } from './store';

export function loadPersistedState(): Partial<RootState> | undefined {
  const credentials = loadCredentials();
  if (credentials === null) {
    return undefined;
  }
  return { session: { credentials }, chat: loadChatCache(credentials.idInstance) };
}

// без сессии чаты не пишем, иначе выход затрёт кэш пустым состоянием
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
