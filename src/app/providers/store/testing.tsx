import { render, renderHook, type RenderOptions } from '@testing-library/react';
import { StrictMode, type ReactElement, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import type { Credentials } from '@/shared/api';
import { createAppStore, type AppStore } from './store';

/** Учётные данные для тестов: настоящих значений в репозитории нет. */
export const testCredentials: Credentials = {
  apiUrl: 'https://api.green-api.com',
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};

interface StoreOptions {
  /** Начальное состояние; по умолчанию — активная сессия с тестовыми учётными данными. */
  preloadedState?: Partial<RootState>;
  store?: AppStore;
  /** Как в приложении: эффекты монтируются дважды, что выявляет дублирующиеся циклы и подписки. */
  strict?: boolean;
}

function createWrapper(store: AppStore, strict: boolean) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const tree = <Provider store={store}>{children}</Provider>;
    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  };
}

function resolveStore({ preloadedState, store }: StoreOptions): AppStore {
  return store ?? createAppStore(preloadedState ?? { session: { credentials: testCredentials } });
}

/** Рендерит компонент с настоящим store приложения. */
export function renderWithStore(
  ui: ReactElement,
  { strict = false, ...options }: StoreOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  const store = resolveStore(options);
  return { store, ...render(ui, { wrapper: createWrapper(store, strict) }) };
}

/** Запускает хук с настоящим store приложения. */
export function renderHookWithStore<Result>(
  hook: () => Result,
  { strict = false, ...options }: StoreOptions = {},
) {
  const store = resolveStore(options);
  return { store, ...renderHook(hook, { wrapper: createWrapper(store, strict) }) };
}
