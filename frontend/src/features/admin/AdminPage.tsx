import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Title, TabContainer, Tab, Table, TableColumn, TableRow, TableCell,
  Button, Input, Label, Dialog, Bar, MessageStrip, BusyIndicator,
  Toolbar, ToolbarSpacer, Select, Option, TextArea, Badge,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { API_BASE } from '../../shared/services/api';

function useAdminFetch<T>(path: string, deps: unknown[] = []) {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, path, ...deps]);

  return { data, loading, error, setData };
}

// ─── Instances Tab ───────────────────────────────────────────────────────────
function InstancesTab() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { data: instances, loading, error } = useAdminFetch<any[]>('/instances');
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: '', slUrl: '', slPort: 50000, baseUrl: '', clientId: '', clientSecret: '', authMode: 0 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`${API_BASE}/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) { setMsg('Instanz erstellt'); setShowDialog(false); }
    else setMsg('Fehler beim Speichern');
  }

  if (loading) return <BusyIndicator active />;
  if (error) return <MessageStrip design="Negative">{error}</MessageStrip>;

  return (
    <div>
      {msg && <MessageStrip design="Information" onClose={() => setMsg(null)}>{msg}</MessageStrip>}
      <Toolbar>
        <ToolbarSpacer />
        <Button icon="add" onClick={() => setShowDialog(true)}>Neu</Button>
      </Toolbar>
      <Table columns={<><TableColumn>Name</TableColumn><TableColumn>URL</TableColumn><TableColumn>Port</TableColumn><TableColumn>Auth</TableColumn></>}>
        {(instances ?? []).map((inst: any) => (
          <TableRow key={inst.id}>
            <TableCell>{inst.name}</TableCell>
            <TableCell>{inst.slUrl}</TableCell>
            <TableCell>{inst.slPort}</TableCell>
            <TableCell><Badge colorScheme={inst.authMode === 0 ? '8' : '2'}>{inst.authMode === 0 ? 'Cookie' : 'BasicAuth'}</Badge></TableCell>
          </TableRow>
        ))}
      </Table>
      <Dialog open={showDialog} headerText="Instanz erstellen"
        footer={<Bar endContent={<><Button onClick={handleSave} design="Emphasized" disabled={saving}>Speichern</Button><Button onClick={() => setShowDialog(false)}>Abbrechen</Button></>} />}>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 350 }}>
          <Label>Name</Label><Input value={form.name} onInput={(e: any) => setForm(p => ({ ...p, name: e.target.value }))} />
          <Label>SL URL</Label><Input value={form.slUrl} onInput={(e: any) => setForm(p => ({ ...p, slUrl: e.target.value }))} placeholder="https://sap-server" />
          <Label>SL Port</Label><Input type="Number" value={String(form.slPort)} onInput={(e: any) => setForm(p => ({ ...p, slPort: Number(e.target.value) }))} />
          <Label>Base URL</Label><Input value={form.baseUrl} onInput={(e: any) => setForm(p => ({ ...p, baseUrl: e.target.value }))} />
          <Label>Client ID</Label><Input value={form.clientId} onInput={(e: any) => setForm(p => ({ ...p, clientId: e.target.value }))} />
          <Label>Client Secret</Label><Input type="Password" value={form.clientSecret} onInput={(e: any) => setForm(p => ({ ...p, clientSecret: e.target.value }))} />
          <Label>Auth-Modus</Label>
          <Select onChange={(e: any) => setForm(p => ({ ...p, authMode: Number(e.detail.selectedOption.value) }))}>
            <Option value="0" selected={form.authMode === 0}>Cookie (B1SESSION)</Option>
            <Option value="1" selected={form.authMode === 1}>Basic Auth</Option>
          </Select>
        </div>
      </Dialog>
    </div>
  );
}

// ─── Tenants Tab ─────────────────────────────────────────────────────────────
function TenantsTab() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { data: tenants, loading } = useAdminFetch<any[]>('/tenants');
  const { data: instances } = useAdminFetch<any[]>('/instances');
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: '', companyDb: '', instanceId: 0 });
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    const res = await fetch(`${API_BASE}/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(form),
    });
    if (res.ok) { setMsg('Mandant erstellt'); setShowDialog(false); }
    else setMsg('Fehler');
  }

  if (loading) return <BusyIndicator active />;

  return (
    <div>
      {msg && <MessageStrip design="Information" onClose={() => setMsg(null)}>{msg}</MessageStrip>}
      <Toolbar><ToolbarSpacer /><Button icon="add" onClick={() => setShowDialog(true)}>Neu</Button></Toolbar>
      <Table columns={<><TableColumn>Name</TableColumn><TableColumn>Datenbank</TableColumn><TableColumn>Instanz</TableColumn><TableColumn>Status</TableColumn></>}>
        {(tenants ?? []).map((t: any) => (
          <TableRow key={t.id}>
            <TableCell>{t.name}</TableCell>
            <TableCell>{t.companyDb}</TableCell>
            <TableCell>{t.instanceId}</TableCell>
            <TableCell><Badge colorScheme={t.isValidated ? '8' : '6'}>{t.isValidated ? 'Validiert' : 'Ausstehend'}</Badge></TableCell>
          </TableRow>
        ))}
      </Table>
      <Dialog open={showDialog} headerText="Mandant erstellen"
        footer={<Bar endContent={<><Button onClick={handleSave} design="Emphasized">Speichern</Button><Button onClick={() => setShowDialog(false)}>Abbrechen</Button></>} />}>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 300 }}>
          <Label>Name</Label><Input value={form.name} onInput={(e: any) => setForm(p => ({ ...p, name: e.target.value }))} />
          <Label>Datenbank</Label><Input value={form.companyDb} onInput={(e: any) => setForm(p => ({ ...p, companyDb: e.target.value }))} />
          <Label>Instanz</Label>
          <Select onChange={(e: any) => setForm(p => ({ ...p, instanceId: Number(e.detail.selectedOption.value) }))}>
            {(instances ?? []).map((i: any) => <Option key={i.id} value={String(i.id)}>{i.name}</Option>)}
          </Select>
        </div>
      </Dialog>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────
function UsersTab() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { data: users, loading, setData } = useAdminFetch<any[]>('/users');
  const [editUser, setEditUser] = useState<any>(null);
  const [newRole, setNewRole] = useState<number>(2);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleRoleSave() {
    if (!editUser) return;
    setSaving(true);
    const res = await fetch(`${API_BASE}/users/${editUser.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(newRole),
    });
    setSaving(false);
    if (res.ok) {
      setMsg('Rolle aktualisiert');
      setData((prev: any) => (prev ?? []).map((u: any) => u.id === editUser.id ? { ...u, role: newRole } : u));
      setEditUser(null);
    } else {
      setMsg('Fehler beim Speichern');
    }
  }

  const roleLabels = ['Admin', 'Supervisor', 'Lager', 'ReadOnly'];
  const roleColors = ['1', '2', '8', '6'];

  if (loading) return <BusyIndicator active />;
  return (
    <div>
      {msg && <MessageStrip design="Information" onClose={() => setMsg(null)}>{msg}</MessageStrip>}
      <Table columns={<><TableColumn>Identity</TableColumn><TableColumn>SAP-User</TableColumn><TableColumn>Rolle</TableColumn><TableColumn>Sprache</TableColumn><TableColumn>Lager</TableColumn><TableColumn /></>}>
        {(users ?? []).map((u: any) => (
          <TableRow key={u.id}>
            <TableCell>{u.identityId}</TableCell>
            <TableCell>{u.sapUsername ?? <em style={{ color: 'var(--sapNeutralColor)' }}>nicht gesetzt</em>}</TableCell>
            <TableCell>
              <Badge colorScheme={roleColors[u.role] ?? '6'}>{roleLabels[u.role] ?? u.role}</Badge>
            </TableCell>
            <TableCell>{u.language}</TableCell>
            <TableCell>{u.chosenWarehouseCode ?? '-'}</TableCell>
            <TableCell>
              <Button design="Transparent" icon="edit" onClick={() => { setEditUser(u); setNewRole(u.role); }}>
                Rolle
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </Table>

      <Dialog open={!!editUser} headerText={`Rolle ändern – ${editUser?.identityId}`}
        footer={<Bar endContent={<><Button design="Emphasized" onClick={handleRoleSave} disabled={saving}>Speichern</Button><Button onClick={() => setEditUser(null)}>Abbrechen</Button></>} />}>
        <div style={{ padding: '1rem' }}>
          <Label>Neue Rolle</Label>
          <Select onChange={(e: any) => setNewRole(Number(e.detail.selectedOption.value))} style={{ width: '100%', marginTop: '0.25rem' }}>
            {roleLabels.map((label, idx) => (
              <Option key={idx} value={String(idx)} selected={idx === newRole}>{label}</Option>
            ))}
          </Select>
        </div>
      </Dialog>
    </div>
  );
}

// ─── Printers Tab ────────────────────────────────────────────────────────────
function PrintersTab() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedTenantId } = useSelector((s: RootState) => s.tenant);
  const { data: printers, loading } = useAdminFetch<any[]>(`/printers?tenantId=${selectedTenantId}`);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', tenantId: selectedTenantId });

  async function handleSave() {
    await fetch(`${API_BASE}/printers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...form, tenantId: selectedTenantId }),
    });
    setShowDialog(false);
  }

  if (loading) return <BusyIndicator active />;
  return (
    <div>
      <Toolbar><ToolbarSpacer /><Button icon="add" onClick={() => setShowDialog(true)}>Neu</Button></Toolbar>
      <Table columns={<><TableColumn>Name</TableColumn><TableColumn>URL</TableColumn><TableColumn>Standard</TableColumn></>}>
        {(printers ?? []).map((p: any) => (
          <TableRow key={p.id}>
            <TableCell>{p.name}</TableCell>
            <TableCell>{p.url}</TableCell>
            <TableCell>{p.isDefault ? <Badge colorScheme="8">Standard</Badge> : ''}</TableCell>
          </TableRow>
        ))}
      </Table>
      <Dialog open={showDialog} headerText="Drucker erstellen"
        footer={<Bar endContent={<><Button onClick={handleSave} design="Emphasized">Speichern</Button><Button onClick={() => setShowDialog(false)}>Abbrechen</Button></>} />}>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Label>Name</Label><Input value={form.name} onInput={(e: any) => setForm(p => ({ ...p, name: e.target.value }))} />
          <Label>URL (ZPL/IPP)</Label><Input value={form.url} onInput={(e: any) => setForm(p => ({ ...p, url: e.target.value }))} placeholder="http://printer:631/ipp" />
        </div>
      </Dialog>
    </div>
  );
}

// ─── Offline-Sync Tab ────────────────────────────────────────────────────────
function SyncTab() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedTenantId } = useSelector((s: RootState) => s.tenant);
  const { data: entries, loading } = useAdminFetch<any[]>(`/offline-sync/pending?tenantId=${selectedTenantId}`);
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function processAll() {
    setProcessing(true);
    const res = await fetch(`${API_BASE}/offline-sync/process`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: selectedTenantId }),
    });
    setProcessing(false);
    setMsg(res.ok ? 'Synchronisation abgeschlossen' : 'Fehler bei der Synchronisation');
  }

  if (loading) return <BusyIndicator active />;
  return (
    <div>
      {msg && <MessageStrip design="Information" onClose={() => setMsg(null)}>{msg}</MessageStrip>}
      <Toolbar>
        <Title level="H5">{(entries ?? []).length} ausstehende Einträge</Title>
        <ToolbarSpacer />
        <Button icon="synchronize" onClick={processAll} disabled={processing} design="Emphasized">
          Jetzt synchronisieren
        </Button>
      </Toolbar>
      <Table columns={<><TableColumn>Modul</TableColumn><TableColumn>Aktion</TableColumn><TableColumn>Endpunkt</TableColumn><TableColumn>Status</TableColumn><TableColumn>Versuche</TableColumn></>}>
        {(entries ?? []).map((e: any) => (
          <TableRow key={e.id}>
            <TableCell>{e.module}</TableCell>
            <TableCell>{e.actionType}</TableCell>
            <TableCell style={{ fontSize: '0.75rem' }}>{e.sapEndpoint}</TableCell>
            <TableCell><Badge colorScheme={e.status === 'Failed' ? '1' : e.status === 'Done' ? '8' : '2'}>{e.status}</Badge></TableCell>
            <TableCell>{e.retryCount}</TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}

// ─── SQL Tool Tab ─────────────────────────────────────────────────────────────
function SqlTab() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedTenantId, selectedInstanceId } = useSelector((s: RootState) => s.tenant);
  const [queryName, setQueryName] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runQuery() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ endpoint: `SQLQueries('${queryName}')/List` });
      const res = await fetch(`${API_BASE}/sap/query?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Tenant-Id': String(selectedTenantId),
          'X-Instance-Id': String(selectedInstanceId ?? ''),
        },
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Label>SAP SQL Query Name</Label>
          <Input value={queryName} onInput={(e: any) => setQueryName(e.target.value)} placeholder="z.B. MyQuery" style={{ width: '100%' }} />
        </div>
        <Button icon="begin" onClick={runQuery} disabled={loading || !queryName} design="Emphasized">Ausführen</Button>
      </div>
      {error && <MessageStrip design="Negative">{error}</MessageStrip>}
      {result && (
        <TextArea
          value={JSON.stringify(result, null, 2)}
          rows={20}
          style={{ width: '100%', fontFamily: 'monospace' }}
          readonly
        />
      )}
    </div>
  );
}

// ─── Label Templates Tab ─────────────────────────────────────────────────────
const TEMPLATE_TYPES = ['NVE', 'QR', 'Standard', 'Warehouse'];

function LabelTemplatesTab() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedTenantId } = useSelector((s: RootState) => s.tenant);
  const { data: templates, loading, setData } = useAdminFetch<any[]>(`/label-templates?tenantId=${selectedTenantId}`, [selectedTenantId]);
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', templateType: 'Standard', htmlContent: '', isDefault: false });
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditItem(null);
    setForm({ name: '', templateType: 'Standard', htmlContent: '', isDefault: false });
    setShowDialog(true);
  }

  function openEdit(t: any) {
    setEditItem(t);
    // Load full template (with HtmlContent)
    fetch(`${API_BASE}/label-templates/${t.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => { setForm({ name: d.name, templateType: d.templateType, htmlContent: d.htmlContent, isDefault: d.isDefault }); setShowDialog(true); });
  }

  async function handleSave() {
    setSaving(true);
    const url = editItem ? `${API_BASE}/label-templates/${editItem.id}` : `${API_BASE}/label-templates`;
    const method = editItem ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...form, tenantId: selectedTenantId }),
    });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      if (editItem) {
        setData((prev: any) => (prev ?? []).map((t: any) => t.id === editItem.id ? saved : t));
      } else {
        setData((prev: any) => [...(prev ?? []), saved]);
      }
      setMsg(editItem ? 'Vorlage aktualisiert' : 'Vorlage erstellt');
      setShowDialog(false);
    } else {
      setMsg('Fehler beim Speichern');
    }
  }

  async function handleSetDefault(t: any) {
    const res = await fetch(`${API_BASE}/label-templates/${t.id}/set-default`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      setData((prev: any) => (prev ?? []).map((x: any) =>
        ({ ...x, isDefault: x.id === t.id ? true : (x.templateType === t.templateType ? false : x.isDefault) })
      ));
      setMsg('Standard gesetzt');
    }
  }

  async function handleDelete(t: any) {
    const res = await fetch(`${API_BASE}/label-templates/${t.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      setData((prev: any) => (prev ?? []).filter((x: any) => x.id !== t.id));
      setMsg('Vorlage gelöscht');
    }
  }

  if (loading) return <BusyIndicator active />;
  return (
    <div>
      {msg && <MessageStrip design="Information" onClose={() => setMsg(null)}>{msg}</MessageStrip>}
      <Toolbar><ToolbarSpacer /><Button icon="add" onClick={openNew}>Neu</Button></Toolbar>
      <Table columns={<><TableColumn>Name</TableColumn><TableColumn>Typ</TableColumn><TableColumn>Standard</TableColumn><TableColumn /></>}>
        {(templates ?? []).map((t: any) => (
          <TableRow key={t.id}>
            <TableCell>{t.name}</TableCell>
            <TableCell><Badge colorScheme="2">{t.templateType}</Badge></TableCell>
            <TableCell>{t.isDefault ? <Badge colorScheme="8">Standard</Badge> : ''}</TableCell>
            <TableCell>
              <Button design="Transparent" icon="edit" onClick={() => openEdit(t)} />
              <Button design="Transparent" icon="accept" onClick={() => handleSetDefault(t)} title="Als Standard setzen" />
              <Button design="Transparent" icon="delete" onClick={() => handleDelete(t)} />
            </TableCell>
          </TableRow>
        ))}
      </Table>
      <Dialog open={showDialog} headerText={editItem ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
        footer={<Bar endContent={<><Button design="Emphasized" onClick={handleSave} disabled={saving}>Speichern</Button><Button onClick={() => setShowDialog(false)}>Abbrechen</Button></>} />}>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 400 }}>
          <Label>Name</Label>
          <Input value={form.name} onInput={(e: any) => setForm(p => ({ ...p, name: e.target.value }))} />
          <Label>Typ</Label>
          <Select onChange={(e: any) => setForm(p => ({ ...p, templateType: e.detail.selectedOption.value }))}>
            {TEMPLATE_TYPES.map(t => <Option key={t} value={t} selected={form.templateType === t}>{t}</Option>)}
          </Select>
          <Label>HTML-Inhalt</Label>
          <TextArea value={form.htmlContent} onInput={(e: any) => setForm(p => ({ ...p, htmlContent: e.target.value }))}
            rows={12} style={{ width: '100%', fontFamily: 'monospace' }} />
        </div>
      </Dialog>
    </div>
  );
}

// ─── Module Config Tab ────────────────────────────────────────────────────────
const MODULE_LIST = [
  { name: 'Pick',                   route: '/pick',                     label: 'Kommissionierung' },
  { name: 'Pack',                   route: '/pack',                     label: 'Verpackung / NVE' },
  { name: 'InventoryCount',         route: '/inventory-count',          label: 'Inventur' },
  { name: 'InventoryTransfer',      route: '/inventory-transfer',       label: 'Umbuchung' },
  { name: 'StockTransfer',          route: '/stock-transfer',           label: 'Umlagerung' },
  { name: 'PurchaseDelivery',       route: '/purchase-delivery',        label: 'Wareneingang (ref.)' },
  { name: 'PurchaseDeliveryAdhoc',  route: '/purchase-delivery-adhoc',  label: 'Wareneingang (Adhoc)' },
  { name: 'SalesDelivery',          route: '/sales-delivery',           label: 'Warenausgang' },
  { name: 'LabelGenerator',         route: '/labels',                   label: 'Etikettendruck' },
  { name: 'InfoPoint',              route: '/info-point',               label: 'InfoPoint' },
];

function ModuleConfigTab() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedTenantId } = useSelector((s: RootState) => s.tenant);
  const { data: configs, loading } = useAdminFetch<any[]>(`/configurations?tenantId=${selectedTenantId}`, [selectedTenantId]);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function isActive(moduleName: string) {
    const cfg = (configs ?? []).find((c: any) => c.module === moduleName);
    return cfg ? cfg.isActive : true; // default active if no config entry
  }

  async function toggle(mod: { name: string; route: string; label: string }) {
    const current = isActive(mod.name);
    setSaving(mod.name);
    const res = await fetch(`${API_BASE}/configurations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        module: mod.name,
        configJson: '{}',
        type: 'module',
        route: mod.route,
        isConfigurable: true,
        isActive: !current,
        icon: null,
        tenantId: selectedTenantId,
      }),
    });
    setSaving(null);
    if (res.ok) setMsg(`${mod.label} ${!current ? 'aktiviert' : 'deaktiviert'}`);
    else setMsg('Fehler beim Speichern');
  }

  if (loading) return <BusyIndicator active />;
  return (
    <div>
      {msg && <MessageStrip design="Information" onClose={() => setMsg(null)}>{msg}</MessageStrip>}
      <Table columns={<><TableColumn>Modul</TableColumn><TableColumn>Route</TableColumn><TableColumn>Status</TableColumn><TableColumn /></>}>
        {MODULE_LIST.map(mod => (
          <TableRow key={mod.name}>
            <TableCell>{mod.label}</TableCell>
            <TableCell style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{mod.route}</TableCell>
            <TableCell>
              <Badge colorScheme={isActive(mod.name) ? '8' : '6'}>
                {isActive(mod.name) ? 'Aktiv' : 'Deaktiviert'}
              </Badge>
            </TableCell>
            <TableCell>
              <Button design="Transparent" icon={isActive(mod.name) ? 'decline' : 'accept'}
                disabled={saving === mod.name}
                onClick={() => toggle(mod)}>
                {isActive(mod.name) ? 'Deaktivieren' : 'Aktivieren'}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────
function LogsTab() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState(200);

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/logs?lines=${lineCount}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLines(data.lines ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLogs(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem' }}>
      <Toolbar>
        <Label>Letzte Zeilen:</Label>
        <Select style={{ marginLeft: '0.5rem', marginRight: '1rem' }}
          onChange={(e: any) => setLineCount(Number(e.detail.selectedOption.value))}>
          {[100, 200, 500, 1000].map(n => <Option key={n} value={String(n)} selected={n === lineCount}>{n}</Option>)}
        </Select>
        <ToolbarSpacer />
        <Button icon="refresh" onClick={fetchLogs} disabled={loading}>Aktualisieren</Button>
      </Toolbar>
      {error && <MessageStrip design="Negative">{error}</MessageStrip>}
      {loading ? <BusyIndicator active /> : (
        <TextArea
          value={lines.join('\n')}
          rows={30}
          readonly
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.78rem' }}
        />
      )}
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────────────────────────
export function AdminPage() {
  return (
    <div>
      <Title level="H3" style={{ marginBottom: '1rem' }}>Administration</Title>
      <TabContainer>
        <Tab text="Instanzen" icon="it-system" selected><InstancesTab /></Tab>
        <Tab text="Mandanten" icon="business-objects-experience"><TenantsTab /></Tab>
        <Tab text="Benutzer" icon="employee"><UsersTab /></Tab>
        <Tab text="Drucker" icon="print"><PrintersTab /></Tab>
        <Tab text="Module" icon="grid"><ModuleConfigTab /></Tab>
        <Tab text="Label-Vorlagen" icon="print-2"><LabelTemplatesTab /></Tab>
        <Tab text="Offline-Sync" icon="synchronize"><SyncTab /></Tab>
        <Tab text="SQL-Tool" icon="database"><SqlTab /></Tab>
        <Tab text="Logs" icon="document-text"><LogsTab /></Tab>
      </TabContainer>
    </div>
  );
}
