import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface RateLimitState {
  // до какого момента ждём после 429
  retryAt: number | null;
}

const initialState: RateLimitState = { retryAt: null };

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
