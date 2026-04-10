import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Title,
  List,
  StandardListItem,
  Dialog,
  Button,
  Select,
  Option,
  MessageStrip,
  FlexBox,
  FlexBoxDirection,
  FlexBoxJustifyContent,
  Card,
  CardHeader,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { selectTenant, selectWarehouse } from './tenantSlice';
import { useTenants } from './hooks/useTenants';
import { ModuleTile } from './ModuleTile';

export function LaunchpadPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedTenantId, selectedTenantName, selectedWarehouseCode } = useSelector((s: RootState) => s.tenant);

  const { tenants, loading } = useTenants();
  const [showTenantDialog, setShowTenantDialog] = useState(!selectedTenantId);

  const modules = [
    { id: 'pick', path: '/pick', icon: 'checklist', title: 'Kommissionierung', description: 'Picklisten bearbeiten' },
    { id: 'pack', path: '/pack', icon: 'product', title: 'Verpackung', description: 'Pakete erstellen & NVE' },
    { id: 'inventory-count', path: '/inventory-count', icon: 'activity-2', title: 'Inventur', description: 'Bestandsaufnahme' },
    { id: 'inventory-transfer', path: '/inventory-transfer', icon: 'journey-change', title: 'Bestandsumlagerung', description: 'Lager zu Lager' },
    { id: 'stock-transfer', path: '/stock-transfer', icon: 'transfer', title: 'Umlagerungsanfrage', description: 'Anfragen erstellen' },
    { id: 'purchase-delivery', path: '/purchase-delivery', icon: 'cart-approval', title: 'Wareneingang', description: 'Lieferschein buchen' },
    { id: 'purchase-delivery-adhoc', path: '/purchase-delivery-adhoc', icon: 'add-product', title: 'WE Adhoc', description: 'Ohne Referenz buchen' },
    { id: 'sales-delivery', path: '/sales-delivery', icon: 'shipping-status', title: 'Warenausgang', description: 'Lieferung erstellen' },
    { id: 'label-generator', path: '/label-generator', icon: 'bar-code', title: 'Etiketten', description: 'Labels drucken' },
    { id: 'info-point', path: '/info-point', icon: 'hint', title: 'InfoPoint', description: 'Artikelinformationen' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level="H2">Launchpad</Title>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {selectedTenantName && (
            <MessageStrip design="Information" hideCloseButton>
              Mandant: <strong>{selectedTenantName}</strong>
              {selectedWarehouseCode && <> · Lager: <strong>{selectedWarehouseCode}</strong></>}
            </MessageStrip>
          )}
          <Button icon="settings" onClick={() => setShowTenantDialog(true)}>
            Mandant wechseln
          </Button>
        </div>
      </div>

      {!selectedTenantId && (
        <MessageStrip design="Warning" style={{ marginBottom: '1rem' }}>
          Bitte wählen Sie einen Mandanten aus, um fortzufahren.
        </MessageStrip>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem',
      }}>
        {modules.map(mod => (
          <ModuleTile
            key={mod.id}
            icon={mod.icon}
            title={mod.title}
            description={mod.description}
            onClick={() => selectedTenantId && navigate(mod.path)}
            disabled={!selectedTenantId}
          />
        ))}
      </div>

      {/* Tenant Selection Dialog */}
      <Dialog
        open={showTenantDialog}
        headerText="Mandant auswählen"
        onAfterClose={() => selectedTenantId && setShowTenantDialog(false)}
        footer={
          <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            {selectedTenantId && (
              <Button onClick={() => setShowTenantDialog(false)}>Schließen</Button>
            )}
          </div>
        }
      >
        <div style={{ minWidth: 300, padding: '1rem' }}>
          {loading ? (
            <MessageStrip design="Information">Mandanten werden geladen...</MessageStrip>
          ) : tenants.length === 0 ? (
            <MessageStrip design="Warning">
              Keine Mandanten konfiguriert. Bitte wenden Sie sich an den Administrator.
            </MessageStrip>
          ) : (
            <List
              onItemClick={(e: any) => {
                const item = e.detail?.item;
                const tenantId = Number(item?.dataset?.tenantId);
                const tenantName = item?.dataset?.tenantName;
                const instanceId = Number(item?.dataset?.instanceId);
                if (tenantId && tenantName && instanceId) {
                  dispatch(selectTenant({ id: tenantId, name: tenantName, instanceId }));
                  setShowTenantDialog(false);
                }
              }}
            >
              {tenants.map(t => (
                <StandardListItem
                  key={t.Id}
                  data-tenant-id={t.Id}
                  data-tenant-name={t.Name}
                  data-instance-id={t.InstanceId}
                  description={t.CompanyDb}
                  selected={t.Id === selectedTenantId}
                >
                  {t.Name}
                </StandardListItem>
              ))}
            </List>
          )}
        </div>
      </Dialog>
    </div>
  );
}
