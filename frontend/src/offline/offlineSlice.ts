import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  syncInProgress: boolean;
  lastSyncAt: string | null;
  syncErrors: string[];
}

const initialState: OfflineState = {
  isOnline: navigator.onLine,
  pendingCount: 0,
  syncInProgress: false,
  lastSyncAt: null,
  syncErrors: [],
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setOnlineStatus(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
    setPendingCount(state, action: PayloadAction<number>) {
      state.pendingCount = action.payload;
    },
    incrementPendingCount(state) {
      state.pendingCount++;
    },
    setSyncInProgress(state, action: PayloadAction<boolean>) {
      state.syncInProgress = action.payload;
    },
    setSyncComplete(state, action: PayloadAction<{ errors: string[] }>) {
      state.syncInProgress = false;
      state.lastSyncAt = new Date().toISOString();
      state.syncErrors = action.payload.errors;
      state.pendingCount = action.payload.errors.length;
    },
  },
});

export const {
  setOnlineStatus,
  setPendingCount,
  incrementPendingCount,
  setSyncInProgress,
  setSyncComplete,
} = offlineSlice.actions;
export default offlineSlice.reducer;
