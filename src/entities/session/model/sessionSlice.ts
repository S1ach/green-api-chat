import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Credentials } from '@/shared/api';

export interface SessionState {
  credentials: Credentials | null;
}

const initialState: SessionState = { credentials: null };

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionStarted(state, action: PayloadAction<Credentials>) {
      state.credentials = action.payload;
    },
    sessionEnded(state) {
      state.credentials = null;
    },
  },
  selectors: {
    selectCredentials: (state) => state.credentials,
  },
});

export const sessionReducer = sessionSlice.reducer;
export const { sessionStarted, sessionEnded } = sessionSlice.actions;
export const { selectCredentials } = sessionSlice.selectors;
