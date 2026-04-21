import { Routes, Route, Navigate } from 'react-router-dom';
import { BusyIndicator } from '@ui5/webcomponents-react';
import { OfflineBanner } from './shared/components/OfflineBanner';
import { AppShell } from './shared/components/AppShell';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
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

function Wrapped({ name, children }: { name: string; children: React.ReactNode }) {
  return <ErrorBoundary moduleName={name}>{children}</ErrorBoundary>;
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <BusyIndicator active size="L" text="Loading Warehouse App..." />
      </div>
    );
  }

  return (
    <ErrorBoundary moduleName="App">
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
          <Route path="launchpad" element={<Wrapped name="Launchpad"><LaunchpadPage /></Wrapped>} />
          <Route path="admin/*" element={<Wrapped name="Admin"><AdminPage /></Wrapped>} />
          <Route path="pick/*" element={<Wrapped name="Pick"><PickPage /></Wrapped>} />
          <Route path="pack/*" element={<Wrapped name="Pack"><PackPage /></Wrapped>} />
          <Route path="inventory-count/*" element={<Wrapped name="InventoryCount"><InventoryCountPage /></Wrapped>} />
          <Route path="inventory-transfer/*" element={<Wrapped name="InventoryTransfer"><InventoryTransferPage /></Wrapped>} />
          <Route path="stock-transfer/*" element={<Wrapped name="StockTransfer"><StockTransferPage /></Wrapped>} />
          <Route path="purchase-delivery/*" element={<Wrapped name="PurchaseDelivery"><PurchaseDeliveryPage /></Wrapped>} />
          <Route path="purchase-delivery-adhoc/*" element={<Wrapped name="PurchaseDeliveryAdhoc"><PurchaseDeliveryAdhocPage /></Wrapped>} />
          <Route path="sales-delivery/*" element={<Wrapped name="SalesDelivery"><SalesDeliveryPage /></Wrapped>} />
          <Route path="label-generator/*" element={<Wrapped name="LabelGenerator"><LabelGeneratorPage /></Wrapped>} />
          <Route path="info-point/*" element={<Wrapped name="InfoPoint"><InfoPointPage /></Wrapped>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
