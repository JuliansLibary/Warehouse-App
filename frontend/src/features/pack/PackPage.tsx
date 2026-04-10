import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Title, Table, TableColumn, TableRow, TableCell, Button, Input, Label,
  MessageStrip, BusyIndicator, Toolbar, ToolbarSpacer, Badge, Dialog, Bar,
  StepInput, Text,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { useSapQuery } from '../../shared/hooks/useSapQuery';
import { useSapMutation } from '../../shared/hooks/useSapMutation';
import { enqueueOfflineAction } from '../../offline/offlineDb';

// GS1-128 NVE: SSCC-18 check digit using modulo 10
function generateNve(companyPrefix: string): string {
  const base = `00${companyPrefix}${Date.now().toString().slice(-6)}`;
  const padded = base.padEnd(17, '0').slice(0, 17);
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(padded[i]) * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return padded + check;
}

interface Package {
  id: string;
  nve: string;
  lines: Array<{ lineNumber: number; itemCode: string; itemDescription: string; quantity: number }>;
  sealed: boolean;
}

export function PackPage() {
  const { selectedTenantId, selectedInstanceId } = useSelector((s: RootState) => s.tenant);
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const isOnline = useSelector((s: RootState) => s.offline.isOnline);

  const [selectedPickList, setSelectedPickList] = useState<any>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [currentPkg, setCurrentPkg] = useState<Package | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'Positive' | 'Negative' | 'Information' | 'Warning' } | null>(null);
  const [showNewPkgDialog, setShowNewPkgDialog] = useState(false);

  const { data: pickLists, loading } = useSapQuery<{ value: any[] }>(
    `PickLists?$filter=PickStatus ne 'cpsC'&$orderby=PickDate desc`,
    { enabled: !!selectedTenantId && !selectedPickList }
  );

  const { mutate } = useSapMutation();

  function createPackage() {
    const nve = generateNve('4012345'); // company prefix from config ideally
    const pkg: Package = { id: crypto.randomUUID(), nve, lines: [], sealed: false };
    setPackages(p => [...p, pkg]);
    setCurrentPkg(pkg);
    setShowNewPkgDialog(false);
    setMessage({ text: `Paket erstellt: NVE ${nve}`, type: 'Information' });
  }

  function handleScan(code: string) {
    if (!selectedPickList || !currentPkg) {
      setMessage({ text: 'Bitte zuerst Pickliste und Paket auswählen', type: 'Warning' });
      return;
    }

    const lines = selectedPickList.PickListsLines ?? [];
    const line = lines.find((l: any) => l.ItemCode === code || l.Barcode === code);

    if (!line) {
      setMessage({ text: `Artikel "${code}" nicht in dieser Pickliste`, type: 'Negative' });
      return;
    }

    setPackages(prev => prev.map(pkg => {
      if (pkg.id !== currentPkg.id) return pkg;
      const existing = pkg.lines.find(l => l.lineNumber === line.LineNumber);
      if (existing) {
        return { ...pkg, lines: pkg.lines.map(l => l.lineNumber === line.LineNumber ? { ...l, quantity: l.quantity + 1 } : l) };
      }
      return { ...pkg, lines: [...pkg.lines, { lineNumber: line.LineNumber, itemCode: line.ItemCode, itemDescription: line.ItemDescription, quantity: 1 }] };
    }));

    setCurrentPkg(prev => prev ? { ...prev, lines: prev.lines.some(l => l.lineNumber === line.LineNumber)
      ? prev.lines.map(l => l.lineNumber === line.LineNumber ? { ...l, quantity: l.quantity + 1 } : l)
      : [...prev.lines, { lineNumber: line.LineNumber, itemCode: line.ItemCode, itemDescription: line.ItemDescription, quantity: 1 }]
    } : prev);

    setScanInput('');
    setMessage({ text: `${line.ItemCode} zu Paket ${currentPkg.nve.slice(-6)} hinzugefügt`, type: 'Positive' });
  }

  async function handleBook() {
    if (!selectedPickList || packages.length === 0) return;

    const grBody = {
      CardCode: selectedPickList.CardCode ?? 'C00001',
      DocDate: new Date().toISOString().slice(0, 10),
      DocumentLines: packages.flatMap(pkg =>
        pkg.lines.map(l => ({
          ItemCode: l.itemCode,
          Quantity: l.quantity,
          WarehouseCode: selectedPickList.PickListsLines?.find((pl: any) => pl.LineNumber === l.lineNumber)?.WarehouseCode,
          UoMCode: 'ST',
        }))
      ),
    };

    if (!isOnline) {
      await enqueueOfflineAction({
        module: 'Pack',
        actionType: 'POST',
        sapEndpoint: 'GoodsReceiptsPO',
        payloadJson: JSON.stringify(grBody),
        tenantId: selectedTenantId!,
        instanceId: selectedInstanceId!,
        userId: '',
        createdAt: new Date().toISOString(),
      });
      setMessage({ text: 'Offline gespeichert – wird synchronisiert wenn online', type: 'Warning' });
      return;
    }

    const result = await mutate('GoodsReceiptsPO', grBody, 'POST');
    if (result.success) {
      setMessage({ text: 'Wareneingang erfolgreich gebucht', type: 'Positive' });
      setSelectedPickList(null);
      setPackages([]);
      setCurrentPkg(null);
    } else {
      setMessage({ text: `Fehler: ${result.error}`, type: 'Negative' });
    }
  }

  if (loading) return <BusyIndicator active text="Picklisten werden geladen..." style={{ margin: '2rem' }} />;

  if (!selectedPickList) {
    return (
      <div>
        <Title level="H3" style={{ marginBottom: '1rem' }}>Verpackung – Pickliste auswählen</Title>
        {message && <MessageStrip design={message.type} onClose={() => setMessage(null)}>{message.text}</MessageStrip>}
        <Table columns={<><TableColumn>Nr.</TableColumn><TableColumn>Datum</TableColumn><TableColumn>Bearbeiter</TableColumn><TableColumn /></>}>
          {(pickLists?.value ?? []).map(pl => (
            <TableRow key={pl.AbsoluteEntry}>
              <TableCell><strong>{pl.AbsoluteEntry}</strong></TableCell>
              <TableCell>{pl.PickDate ? new Date(pl.PickDate).toLocaleDateString('de-DE') : '-'}</TableCell>
              <TableCell>{pl.OwnerCode ?? '-'}</TableCell>
              <TableCell>
                <Button design="Emphasized" onClick={() => setSelectedPickList(pl)}>Auswählen</Button>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </div>
    );
  }

  return (
    <div>
      <Toolbar>
        <Button icon="nav-back" design="Transparent" onClick={() => { setSelectedPickList(null); setPackages([]); setCurrentPkg(null); }} />
        <Title level="H3">Verpackung – Pickliste #{selectedPickList.AbsoluteEntry}</Title>
        <ToolbarSpacer />
        <Button icon="add" onClick={() => setShowNewPkgDialog(true)}>Neues Paket</Button>
        <Button icon="save" design="Emphasized" onClick={handleBook} disabled={packages.length === 0}>Buchen</Button>
      </Toolbar>

      {message && <MessageStrip design={message.type} onClose={() => setMessage(null)} style={{ marginBottom: '0.5rem' }}>{message.text}</MessageStrip>}

      {/* Scan Input */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', background: 'var(--sapGroup_TitleBackground)', borderRadius: '0.25rem', marginBottom: '1rem' }}>
        <Label>Artikel scannen:</Label>
        <Input
          placeholder="Barcode scannen"
          value={scanInput}
          onInput={(e: any) => setScanInput(e.target.value)}
          onKeyPress={(e: any) => { if (e.key === 'Enter') { handleScan(scanInput); setScanInput(''); } }}
          style={{ flex: 1 }}
          autoFocus
          disabled={!currentPkg}
        />
        <Button icon="bar-code" onClick={() => { handleScan(scanInput); setScanInput(''); }} disabled={!currentPkg}>Scan</Button>
      </div>

      {/* Packages */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {packages.map(pkg => (
          <div key={pkg.id} style={{
            border: `2px solid ${currentPkg?.id === pkg.id ? 'var(--sapBrandColor)' : 'var(--sapNeutralBorderColor)'}`,
            borderRadius: '0.5rem', padding: '1rem', background: 'var(--sapBackgroundColor)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <strong>NVE: {pkg.nve}</strong>
              <Button design="Transparent" onClick={() => setCurrentPkg(pkg)} disabled={pkg.sealed}>
                {currentPkg?.id === pkg.id ? 'Aktiv' : 'Auswählen'}
              </Button>
            </div>
            <Table columns={<><TableColumn>Artikel</TableColumn><TableColumn>Menge</TableColumn></>}>
              {pkg.lines.map(l => (
                <TableRow key={l.lineNumber}>
                  <TableCell>{l.itemCode}</TableCell>
                  <TableCell>{l.quantity}</TableCell>
                </TableRow>
              ))}
            </Table>
            {pkg.lines.length === 0 && <Text>Noch keine Artikel gescannt</Text>}
          </div>
        ))}
      </div>

      <Dialog open={showNewPkgDialog} headerText="Neues Paket erstellen"
        footer={<Bar endContent={<><Button design="Emphasized" onClick={createPackage}>Erstellen</Button><Button onClick={() => setShowNewPkgDialog(false)}>Abbrechen</Button></>} />}>
        <div style={{ padding: '1rem' }}>
          <Text>Eine neue NVE-Nummer wird automatisch generiert.</Text>
        </div>
      </Dialog>
    </div>
  );
}
