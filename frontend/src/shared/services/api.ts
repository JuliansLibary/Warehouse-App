import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../../app/store';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as RootState;
      const token = state.auth.accessToken;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const tenantId = state.tenant.selectedTenantId;
      if (tenantId) {
        headers.set('X-Tenant-Id', String(tenantId));
      }
      const instanceId = state.tenant.selectedInstanceId;
      if (instanceId) {
        headers.set('X-Instance-Id', String(instanceId));
      }
      return headers;
    },
  }),
  tagTypes: [
    'Instance', 'Tenant', 'User', 'Configuration',
    'Cache', 'DocumentLock', 'Printer', 'LabelTemplate',
    'OfflineSync', 'PickList', 'InventoryCount', 'Warehouse',
  ],
  endpoints: () => ({}),
});
