import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TenantState {
  selectedTenantId: number | null;
  selectedTenantName: string | null;
  selectedInstanceId: number | null;
  selectedWarehouseCode: string | null;
  selectedWarehouseName: string | null;
}

const initialState: TenantState = {
  selectedTenantId: Number(localStorage.getItem('tenant_id')) || null,
  selectedTenantName: localStorage.getItem('tenant_name'),
  selectedInstanceId: Number(localStorage.getItem('instance_id')) || null,
  selectedWarehouseCode: localStorage.getItem('warehouse_code'),
  selectedWarehouseName: localStorage.getItem('warehouse_name'),
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    selectTenant(state, action: PayloadAction<{ id: number; name: string; instanceId: number }>) {
      state.selectedTenantId = action.payload.id;
      state.selectedTenantName = action.payload.name;
      state.selectedInstanceId = action.payload.instanceId;
      localStorage.setItem('tenant_id', String(action.payload.id));
      localStorage.setItem('tenant_name', action.payload.name);
      localStorage.setItem('instance_id', String(action.payload.instanceId));
    },
    selectWarehouse(state, action: PayloadAction<{ code: string; name: string }>) {
      state.selectedWarehouseCode = action.payload.code;
      state.selectedWarehouseName = action.payload.name;
      localStorage.setItem('warehouse_code', action.payload.code);
      localStorage.setItem('warehouse_name', action.payload.name);
    },
    clearTenant(state) {
      state.selectedTenantId = null;
      state.selectedTenantName = null;
      state.selectedInstanceId = null;
      state.selectedWarehouseCode = null;
      state.selectedWarehouseName = null;
      localStorage.removeItem('tenant_id');
      localStorage.removeItem('tenant_name');
      localStorage.removeItem('instance_id');
      localStorage.removeItem('warehouse_code');
      localStorage.removeItem('warehouse_name');
    },
  },
});

export const { selectTenant, selectWarehouse, clearTenant } = tenantSlice.actions;
export default tenantSlice.reducer;
