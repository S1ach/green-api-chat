import { beforeEach, describe, expect, it } from 'vitest';
import { avatarChecked, chatOpened, chatSelected, selectChats } from '@/entities/chat';
import { sessionEnded, sessionStarted } from '@/entities/session';
import { loadPersistedState, persistState } from './persistState';
import { createAppStore } from './store';
import { testCredentials } from './testing';

const CREDENTIALS_KEY = 'greenapi.credentials';
const CHATS_KEY = `greenapi.chats.v2.${testCredentials.idInstance}`;

function startSession() {
  const store = createAppStore();
  persistState(store);
  store.dispatch(sessionStarted(testCredentials));
  store.dispatch(chatOpened({ chatId: '10000000', phone: '79991234567' }));
  return store;
}

beforeEach(() => {
  localStorage.clear();
});

describe('persistState', () => {
  it('сохраняет учётные данные и чаты текущего инстанса', () => {
    startSession();

    expect(JSON.parse(localStorage.getItem(CREDENTIALS_KEY) ?? 'null')).toEqual(testCredentials);
    expect(localStorage.getItem(CHATS_KEY)).toContain('79991234567');
  });

  it('восстанавливает сессию и чаты после перезагрузки страницы', () => {
    startSession();

    const restored = createAppStore(loadPersistedState());

    expect(restored.getState().session.credentials).toEqual(testCredentials);
    expect(selectChats(restored.getState()).map((chat) => chat.id)).toEqual(['10000000']);
    // Открытый чат не запоминается: после перезагрузки пользователь видит список.
    expect(restored.getState().chat.activeChatId).toBeNull();
  });

  it('ссылка на аватар переживает перезагрузку: заново его запрашивать не придётся', () => {
    const store = startSession();
    const avatar = { url: 'https://i.example/ivan.jpg', refreshAt: Date.now() + 1000 };
    store.dispatch(avatarChecked({ chatId: '10000000', ...avatar }));

    const restored = createAppStore(loadPersistedState());

    expect(selectChats(restored.getState())[0]?.avatar).toEqual(avatar);
  });

  it('при выходе удаляет и учётные данные, и историю переписки', () => {
    const store = startSession();
    expect(localStorage.getItem(CHATS_KEY)).not.toBeNull();

    store.dispatch(sessionEnded());

    expect(selectChats(store.getState())).toEqual([]);
    expect(localStorage).toHaveLength(0);
  });

  it('после выхода опоздавший ответ не возвращает переписку в localStorage', () => {
    const store = startSession();
    store.dispatch(sessionEnded());

    store.dispatch(chatOpened({ chatId: '10000000', phone: '79991234567' }));

    expect(localStorage).toHaveLength(0);
  });

  it('ничего не пишет без активной сессии', () => {
    const store = createAppStore();
    persistState(store);

    store.dispatch(chatSelected(null));
    store.dispatch(chatOpened({ chatId: '10000000', phone: '79991234567' }));

    expect(localStorage).toHaveLength(0);
  });

  it('не восстанавливает состояние, если учётных данных нет или запись повреждена', () => {
    expect(loadPersistedState()).toBeUndefined();

    localStorage.setItem(CREDENTIALS_KEY, '{"idInstance":"1101000001"');
    expect(loadPersistedState()).toBeUndefined();
  });
});
