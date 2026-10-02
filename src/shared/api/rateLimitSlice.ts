import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface RateLimitState {
  /** До какого момента (мс) приложение ждёт после ответа 429; `null` — ограничений не было. */
  retryAt: number | null;
}

const initialState: RateLimitState = { retryAt: null };

/**
 * Состояние ограничения частоты запросов. Его выставляет baseQuery, когда GREEN-API отвечает 429
 * и запрос ждёт повтора, — интерфейс показывает спокойное «повторим через N секунд» вместо ошибки.
 */
const rateLimitSlice = createSlice({
  name: 'rateLimit',
  initialState,
  reducers: {
    rateLimited(state, action: PayloadAction<number>) {
      state.retryAt = Math.max(state.retryAt ?? 0, action.payload);
    },
  },
  selectors: {
    selectRetryAt: (state) => state.retryAt,
  },
});

export const rateLimitReducer = rateLimitSlice.reducer;
export const { rateLimited } = rateLimitSlice.actions;
export const { selectRetryAt } = rateLimitSlice.selectors;
