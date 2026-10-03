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

// выход сбрасывает весь стор разом: чаты, сообщения, кэш запросов
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

// типы стора глобальные, чтобы shared не импортировал из app
declare global {
  type RootState = ReturnType<typeof appReducer>;
  type AppDispatch = AppStore['dispatch'];
}
