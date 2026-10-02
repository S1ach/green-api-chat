import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { chatReducer } from '@/entities/chat';
import { sessionEnded, sessionReducer } from '@/entities/session';
import { greenApi, rateLimitReducer } from '@/shared/api';

const appReducer = combineReducers({
  session: sessionReducer,
  chat: chatReducer,
  rateLimit: rateLimitReducer,
  [greenApi.reducerPath]: greenApi.reducer,
});

/**
 * Выход из инстанса сбрасывает всё состояние одним экшеном: чаты, сообщения и кэш запросов.
 * Так данные одного инстанса не могут остаться в памяти после входа в другой.
 */
const rootReducer: typeof appReducer = (state, action) =>
  appReducer(sessionEnded.match(action) ? undefined : state, action);

export function createAppStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(greenApi.middleware),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;

/**
 * Типы store объявлены глобально, чтобы нижние слои (shared/lib/store, shared/api)
 * пользовались ими без импорта из app — зависимости в FSD идут только сверху вниз.
 */
declare global {
  type RootState = ReturnType<typeof appReducer>;
  type AppDispatch = AppStore['dispatch'];
}
