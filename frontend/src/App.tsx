import { Routes, Route, Navigate } from 'react-router-dom';
import { BusyIndicator } from '@ui5/webcomponents-react';
import { OfflineBanner } from './shared/components/OfflineBanner';
import { AppShell } from './shared/components/AppShell';
import { LoginPage } from './features/launchpad/LoginPage';
import { LaunchpadPage } from './features/launchpad/LaunchpadPage';
import { AdminPage } from './features/admin/AdminPage';
import { PickPage } from './features/pick/PickPage';
import { PackPage } from './features/pack/PackPage';
import { InventoryCountPage } from './features/inventory-count/InventoryCountPage';
import { InventoryTransferPage } from './features/inventory-transfer/InventoryTransferPage';
import { StockTransferPage } from './features/stock-transfer/StockTransferPage';
import { PurchaseDeliveryPage } from './features/purchase-delivery/PurchaseDeliveryPage';
import { PurchaseDeliveryAdhocPage } from './features/purchase-delivery-adhoc/PurchaseDeliveryAdhocPage';
import { SalesDeliveryPage } from './features/sales-delivery/SalesDeliveryPage';
import { LabelGeneratorPage } from './features/label-generator/LabelGeneratorPage';
import { InfoPointPage } from './features/info-point/InfoPointPage';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { useAuth } from './shared/hooks/useAuth';

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <BusyIndicator active size="Large" text="Loading Warehouse App..." />
      </div>
    );
  }

  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        } />
        <Route path="/" element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/launchpad" replace />} />
          <Route path="launchpad" element={<LaunchpadPage />} />
          <Route path="admin/*" element={<AdminPage />} />
          <Route path="pick/*" element={<PickPage />} />
          <Route path="pack/*" element={<PackPage />} />
          <Route path="inventory-count/*" element={<InventoryCountPage />} />
          <Route path="inventory-transfer/*" element={<InventoryTransferPage />} />
          <Route path="stock-transfer/*" element={<StockTransferPage />} />
          <Route path="purchase-delivery/*" element={<PurchaseDeliveryPage />} />
          <Route path="purchase-delivery-adhoc/*" element={<PurchaseDeliveryAdhocPage />} />
          <Route path="sales-delivery/*" element={<SalesDeliveryPage />} />
          <Route path="label-generator/*" element={<LabelGeneratorPage />} />
          <Route path="info-point/*" element={<InfoPointPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
