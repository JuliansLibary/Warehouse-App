import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/launchpad/authSlice';
import tenantReducer from '../features/launchpad/tenantSlice';
import offlineReducer from '../offline/offlineSlice';
import { apiSlice } from '../shared/services/api';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tenant: tenantReducer,
    offline: offlineReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
