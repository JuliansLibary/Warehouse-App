import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Title,
  List,
  StandardListItem,
  Dialog,
  Button,
  MessageStrip,
  Input,
  Label,
  Bar,
  BusyIndicator,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { selectTenant, selectWarehouse } from './tenantSlice';
import { useTenants } from './hooks/useTenants';
import { ModuleTile } from './ModuleTile';
import { API_BASE } from '../../shared/services/api';

const modules = [
  { id: 'pick',                    path: '/pick',                    icon: 'checklist',       title: 'Kommissionierung',   description: 'Picklisten bearbeiten' },
  { id: 'pack',                    path: '/pack',                    icon: 'product',         title: 'Verpackung',         description: 'Pakete & NVE' },
  { id: 'inventory-count',         path: '/inventory-count',         icon: 'activity-2',      title: 'Inventur',           description: 'Bestandsaufnahme' },
  { id: 'inventory-transfer',      path: '/inventory-transfer',      icon: 'journey-change',  title: 'Bestandsumlagerung', description: 'Lager zu Lager' },
  { id: 'stock-transfer',          path: '/stock-transfer',          icon: 'transfer',        title: 'Umlagerungsanfrage', description: 'Anfragen erstellen' },
  { id: 'purchase-delivery',       path: '/purchase-delivery',       icon: 'cart-approval',   title: 'Wareneingang',       description: 'Lieferschein buchen' },
  { id: 'purchase-delivery-adhoc', path: '/purchase-delivery-adhoc', icon: 'add-product',     title: 'WE Adhoc',           description: 'Ohne Referenz buchen' },
  { id: 'sales-delivery',          path: '/sales-delivery',          icon: 'shipping-status', title: 'Warenausgang',       description: 'Lieferung erstellen' },
  { id: 'label-generator',         path: '/label-generator',         icon: 'bar-code',        title: 'Etiketten',          description: 'Labels drucken' },
  { id: 'info-point',              path: '/info-point',              icon: 'hint',            title: 'InfoPoint',          description: 'Artikelinformationen' },
];

export function LaunchpadPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedTenantId, selectedTenantName, selectedWarehouseCode, selectedInstanceId } =
    useSelector((s: RootState) => s.tenant);
  const { accessToken } = useSelector((s: RootState) => s.auth);

  const { tenants, loading: tenantsLoading } = useTenants();
  const [showTenantDialog,    setShowTenantDialog]    = useState(!selectedTenantId);
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false);
  const [showCredDialog,      setShowCredDialog]      = useState(false);

  // Warehouses from SAP
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [whLoading,  setWhLoading]  = useState(false);

  // SAP credentials form
  const [sapUser,    setSapUser]    = useState('');
  const [sapPass,    setSapPass]    = useState('');
  const [credMsg,    setCredMsg]    = useState<{ text: string; ok: boolean } | null>(null);
  const [credSaving, setCredSaving] = useState(false);

  // Load warehouses when tenant/instance changes
  useEffect(() => {
    if (!selectedTenantId || !accessToken || !selectedInstanceId) return;
    setWhLoading(true);
    fetch(
      `${API_BASE}/sap/query?endpoint=${encodeURIComponent('Warehouses?$select=WarehouseCode,WarehouseName&$orderby=WarehouseCode')}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Tenant-Id':   String(selectedTenantId),
          'X-Instance-Id': String(selectedInstanceId),
        },
      }
    )
      .then(r => (r.ok ? r.json() : null))
      .then(data => setWarehouses(data?.value ?? []))
      .catch(() => {})
      .finally(() => setWhLoading(false));
  }, [selectedTenantId, accessToken, selectedInstanceId]);

  async function saveSapCredentials() {
    if (!sapUser || !sapPass) return;
    setCredSaving(true);
    setCredMsg(null);
    try {
      const res = await fetch(`${API_BASE}/users/me/sap-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sapUsername: sapUser, sapPassword: sapPass }),
      });
      setCredMsg({ text: res.ok ? 'SAP-Zugangsdaten gespeichert.' : 'Fehler beim Speichern.', ok: res.ok });
      if (res.ok) {
        setSapUser('');
        setSapPass('');
        setTimeout(() => { setShowCredDialog(false); setCredMsg(null); }, 1500);
      }
    } catch {
      setCredMsg({ text: 'Verbindungsfehler', ok: false });
    } finally {
      setCredSaving(false);
    }
  }

  return (
    <div>
      {/* ── Header row ────────────────────────���────────────────────────── */}
      <div style={{
        marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <Title level="H2">Launchpad</Title>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {selectedTenantName && (
            <MessageStrip design="Information" hideCloseButton style={{ margin: 0 }}>
              <strong>{selectedTenantName}</strong>
              {selectedWarehouseCode && <> · <strong>{selectedWarehouseCode}</strong></>}
            </MessageStrip>
          )}
          <Button icon="key" onClick={() => setShowCredDialog(true)}>SAP-Login</Button>
          {selectedTenantId && (
            <Button icon="factory" onClick={() => setShowWarehouseDialog(true)}>Lager</Button>
          )}
          <Button icon="settings" onClick={() => setShowTenantDialog(true)}>Mandant</Button>
        </div>
      </div>

      {!selectedTenantId && (
        <MessageStrip design="Warning" style={{ marginBottom: '1rem' }}>
          Bitte wählen Sie einen Mandanten aus, um fortzufahren.
        </MessageStrip>
      )}

      {/* ── Module Grid ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
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

      {/* ── Tenant Selection Dialog ─────────────────────────────────────── */}
      <Dialog
        open={showTenantDialog}
        headerText="Mandant auswählen"
        onAfterClose={() => selectedTenantId && setShowTenantDialog(false)}
        footer={
          <Bar endContent={
            selectedTenantId
              ? <Button onClick={() => setShowTenantDialog(false)}>Schließen</Button>
              : undefined
          } />
        }
      >
        <div style={{ minWidth: 300, padding: '1rem' }}>
          {tenantsLoading ? (
            <BusyIndicator active text="Mandanten werden geladen…" />
          ) : tenants.length === 0 ? (
            <MessageStrip design="Warning">
              Keine Mandanten konfiguriert. Bitte wenden Sie sich an den Administrator.
            </MessageStrip>
          ) : (
            <List
              onItemClick={(e: any) => {
                const item      = e.detail?.item;
                const tenantId  = Number(item?.dataset?.tenantId);
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
                  key={t.id}
                  data-tenant-id={t.id}
                  data-tenant-name={t.name}
                  data-instance-id={t.instanceId}
                  description={t.companyDb}
                  selected={t.id === selectedTenantId}
                >
                  {t.name}
                </StandardListItem>
              ))}
            </List>
          )}
        </div>
      </Dialog>

      {/* ── Warehouse Selection Dialog ──────────────────────────────────── */}
      <Dialog
        open={showWarehouseDialog}
        headerText="Standardlager wählen"
        footer={<Bar endContent={<Button onClick={() => setShowWarehouseDialog(false)}>Schließen</Button>} />}
      >
        <div style={{ minWidth: 300, padding: '1rem' }}>
          {whLoading ? (
            <BusyIndicator active text="Lager werden geladen…" />
          ) : warehouses.length === 0 ? (
            <MessageStrip design="Warning">
              Keine Lager gefunden. SAP-Zugangsdaten prüfen oder Lager im SAP anlegen.
            </MessageStrip>
          ) : (
            <List
              onItemClick={(e: any) => {
                const item = e.detail?.item;
                const code = item?.dataset?.code;
                const name = item?.dataset?.name;
                if (code) {
                  dispatch(selectWarehouse({ code, name: name ?? code }));
                  setShowWarehouseDialog(false);
                }
              }}
            >
              {warehouses.map((w: any) => (
                <StandardListItem
                  key={w.WarehouseCode}
                  data-code={w.WarehouseCode}
                  data-name={w.WarehouseName}
                  selected={w.WarehouseCode === selectedWarehouseCode}
                >
                  {w.WarehouseCode} – {w.WarehouseName}
                </StandardListItem>
              ))}
            </List>
          )}
        </div>
      </Dialog>

      {/* ── SAP Credentials Dialog ──────────────────────────────────────── */}
      <Dialog
        open={showCredDialog}
        headerText="SAP-Zugangsdaten"
        footer={
          <Bar endContent={
            <>
              <Button
                design="Emphasized"
                onClick={saveSapCredentials}
                disabled={credSaving || !sapUser || !sapPass}
              >
                Speichern
              </Button>
              <Button onClick={() => { setShowCredDialog(false); setCredMsg(null); }}>
                Abbrechen
              </Button>
            </>
          } />
        }
      >
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 300 }}>
          <MessageStrip design="Information" hideCloseButton>
            Werden für die automatische SAP-Anmeldung verwendet. Einmalig erforderlich.
          </MessageStrip>
          {credMsg && (
            <MessageStrip
              design={credMsg.ok ? 'Positive' : 'Negative'}
              onClose={() => setCredMsg(null)}
            >
              {credMsg.text}
            </MessageStrip>
          )}
          <Label required>SAP-Benutzername</Label>
          <Input
            value={sapUser}
            onInput={(e: any) => setSapUser(e.target.value)}
            placeholder="manager"
          />
          <Label required>SAP-Passwort</Label>
          <Input
            type="Password"
            value={sapPass}
            onInput={(e: any) => setSapPass(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </Dialog>
    </div>
  );
}
