import { useState, useEffect } from 'react';
import { useNavigate, useParams, Routes, Route } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Title, Table, TableColumn, TableRow, TableCell, Button, Input, Label,
  MessageStrip, BusyIndicator, Toolbar, ToolbarSpacer, Badge, Dialog, Bar,
  StepInput,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { useSapQuery } from '../../shared/hooks/useSapQuery';
import { useSapMutation } from '../../shared/hooks/useSapMutation';
import { useDocumentLock } from '../../shared/hooks/useDocumentLock';
import { enqueueOfflineAction } from '../../offline/offlineDb';

function InventoryCountList() {
  const navigate = useNavigate();
  const { selectedTenantId } = useSelector((s: RootState) => s.tenant);

  const { data, loading, error, refetch } = useSapQuery<{ value: any[] }>(
    `InventoryCountings?$filter=DocumentStatus eq 'bost_Open'&$orderby=DocumentDate desc`,
    { enabled: !!selectedTenantId }
  );

  if (loading) return <BusyIndicator active text="Inventuren werden geladen..." style={{ margin: '2rem' }} />;
  if (error) return <MessageStrip design="Negative">{error}</MessageStrip>;

  return (
    <div>
      <Toolbar>
        <Title level="H3">Inventur</Title>
        <ToolbarSpacer />
        <Button icon="refresh" onClick={refetch}>Aktualisieren</Button>
      </Toolbar>
      <Table
        noDataText="Keine offenen Inventuren"
        columns={<><TableColumn>Dok.-Nr.</TableColumn><TableColumn>Datum</TableColumn><TableColumn>Bemerkung</TableColumn><TableColumn>Status</TableColumn><TableColumn /></>}
      >
        {(data?.value ?? []).map((ic: any) => (
          <TableRow key={ic.DocumentEntry}>
            <TableCell><strong>{ic.DocumentEntry}</strong></TableCell>
            <TableCell>{ic.DocumentDate ? new Date(ic.DocumentDate).toLocaleDateString('de-DE') : '-'}</TableCell>
            <TableCell>{ic.Remarks ?? '-'}</TableCell>
            <TableCell><Badge colorScheme="2">Offen</Badge></TableCell>
            <TableCell>
              <Button design="Transparent" icon="navigation-right-arrow" onClick={() => navigate(String(ic.DocumentEntry))}>
                Öffnen
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}

function InventoryCountDetail() {
  const { countId } = useParams<{ countId: string }>();
  const navigate = useNavigate();
  const { selectedTenantId, selectedInstanceId } = useSelector((s: RootState) => s.tenant);
  const isOnline = useSelector((s: RootState) => s.offline.isOnline);

  const [countState, setCountState] = useState<any>(null);
  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'Positive' | 'Negative' | 'Information' | 'Warning' } | null>(null);
  const [serialDialog, setSerialDialog] = useState<{ open: boolean; line: any; serials: string[]; input: string }>({
    open: false, line: null, serials: [], input: '',
  });

  const { data: countDoc, loading } = useSapQuery<any>(
    `InventoryCountings(${countId})`,
    { enabled: !!countId && !!selectedTenantId }
  );

  const { acquireLock, releaseLock, lockError } = useDocumentLock(
    Number(countId), 'InventoryCount', selectedTenantId ?? 0
  );

  const { mutate } = useSapMutation();

  useEffect(() => {
    if (countDoc) setCountState(countDoc);
  }, [countDoc]);

  useEffect(() => {
    if (countId && selectedTenantId) {
      acquireLock();
      return () => { releaseLock(); };
    }
  }, [countId, selectedTenantId]);

  function handleScan(code: string) {
    if (!countState) return;
    const lines = countState.InventoryCountingLines ?? [];
    const line = lines.find((l: any) => l.ItemCode === code || l.Barcode === code);

    if (!line) {
      setMessage({ text: `Artikel "${code}" nicht in dieser Inventur`, type: 'Negative' });
      return;
    }

    if (line.ManageSerialNumbers === 'tYES') {
      setSerialDialog({ open: true, line, serials: [], input: '' });
      return;
    }

    const updated = lines.map((l: any) =>
      l.LineNumber === line.LineNumber ? { ...l, CountedQuantity: (l.CountedQuantity ?? 0) + 1 } : l
    );
    setCountState((p: any) => ({ ...p, InventoryCountingLines: updated }));
    setMessage({ text: `${line.ItemCode} gezählt: ${(line.CountedQuantity ?? 0) + 1}`, type: 'Information' });
    setScanInput('');
  }

  function addSerial() {
    if (!serialDialog.input) return;
    setSerialDialog(p => ({ ...p, serials: [...p.serials, p.input], input: '' }));
  }

  function confirmSerials() {
    const { line, serials } = serialDialog;
    const lines = countState.InventoryCountingLines ?? [];
    const updated = lines.map((l: any) =>
      l.LineNumber === line.LineNumber
        ? { ...l, CountedQuantity: serials.length, SerialNumbers: serials.map(s => ({ InternalSerialNumber: s })) }
        : l
    );
    setCountState((p: any) => ({ ...p, InventoryCountingLines: updated }));
    setSerialDialog({ open: false, line: null, serials: [], input: '' });
    setMessage({ text: `${serials.length} Seriennummern für ${line.ItemCode} erfasst`, type: 'Positive' });
  }

  async function handleSave() {
    if (!countState) return;
    const patchBody = {
      InventoryCountingLines: countState.InventoryCountingLines.map((l: any) => ({
        LineNumber: l.LineNumber,
        CountedQuantity: l.CountedQuantity ?? 0,
        ...(l.SerialNumbers && { SerialNumbers: l.SerialNumbers }),
      })),
    };

    if (!isOnline) {
      await enqueueOfflineAction({
        module: 'InventoryCount',
        actionType: 'PATCH',
        sapEndpoint: `InventoryCountings(${countId})`,
        payloadJson: JSON.stringify(patchBody),
        tenantId: selectedTenantId!,
        instanceId: selectedInstanceId!,
        userId: '',
        createdAt: new Date().toISOString(),
      });
      setMessage({ text: 'Offline gespeichert', type: 'Warning' });
      return;
    }

    const result = await mutate(`InventoryCountings(${countId})`, patchBody, 'PATCH');
    if (result.success) {
      await releaseLock();
      setMessage({ text: 'Inventur gespeichert', type: 'Positive' });
      setTimeout(() => navigate('/inventory-count'), 1500);
    } else {
      setMessage({ text: `Fehler: ${result.error}`, type: 'Negative' });
    }
  }

  if (loading) return <BusyIndicator active text="Inventur wird geladen..." style={{ margin: '2rem' }} />;
  if (!countState) return null;

  return (
    <div>
      <Toolbar>
        <Button icon="nav-back" design="Transparent" onClick={() => navigate('/inventory-count')} />
        <Title level="H3">Inventur #{countId}</Title>
        <ToolbarSpacer />
        <Button design="Emphasized" icon="save" onClick={handleSave}>Speichern</Button>
      </Toolbar>

      {lockError && <MessageStrip design="Warning" style={{ marginBottom: '0.5rem' }}>{lockError}</MessageStrip>}
      {message && <MessageStrip design={message.type} onClose={() => setMessage(null)} style={{ marginBottom: '0.5rem' }}>{message.text}</MessageStrip>}

      <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', background: 'var(--sapGroup_TitleBackground)', borderRadius: '0.25rem', marginBottom: '1rem' }}>
        <Label>Artikel scannen:</Label>
        <Input
          placeholder="Barcode / Artikelnummer"
          value={scanInput}
          onInput={(e: any) => setScanInput(e.target.value)}
          onKeyPress={(e: any) => { if (e.key === 'Enter') { handleScan(scanInput); setScanInput(''); } }}
          style={{ flex: 1 }}
          autoFocus
        />
        <Button icon="bar-code" onClick={() => { handleScan(scanInput); setScanInput(''); }}>Scan</Button>
      </div>

      <Table columns={<><TableColumn>Artikel</TableColumn><TableColumn>Bezeichnung</TableColumn><TableColumn>Lagerort</TableColumn><TableColumn>Gezählt</TableColumn><TableColumn>Status</TableColumn></>}>
        {(countState.InventoryCountingLines ?? []).map((line: any) => {
          const counted = line.CountedQuantity ?? 0;
          return (
            <TableRow key={line.LineNumber} highlight={counted > 0 ? 'Positive' : 'None'}>
              <TableCell><strong>{line.ItemCode}</strong></TableCell>
              <TableCell>{line.ItemDescription}</TableCell>
              <TableCell>{line.WarehouseCode}</TableCell>
              <TableCell>
                <StepInput
                  min={0}
                  value={counted}
                  onChange={(e: any) => {
                    setCountState((p: any) => ({
                      ...p,
                      InventoryCountingLines: p.InventoryCountingLines.map((l: any) =>
                        l.LineNumber === line.LineNumber ? { ...l, CountedQuantity: Number(e.target.value) } : l
                      ),
                    }));
                  }}
                />
              </TableCell>
              <TableCell>
                {counted > 0 ? <Badge colorScheme="8">Gezählt</Badge> : <Badge colorScheme="6">Offen</Badge>}
              </TableCell>
            </TableRow>
          );
        })}
      </Table>

      {/* Serial Number Dialog */}
      <Dialog open={serialDialog.open} headerText={`Seriennummern – ${serialDialog.line?.ItemCode}`}
        footer={<Bar endContent={<><Button design="Emphasized" onClick={confirmSerials}>Bestätigen ({serialDialog.serials.length})</Button><Button onClick={() => setSerialDialog(p => ({ ...p, open: false }))}>Abbrechen</Button></>} />}>
        <div style={{ padding: '1rem', minWidth: 300 }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <Input
              placeholder="Seriennummer scannen"
              value={serialDialog.input}
              onInput={(e: any) => setSerialDialog(p => ({ ...p, input: e.target.value }))}
              onKeyPress={(e: any) => { if (e.key === 'Enter') addSerial(); }}
              style={{ flex: 1 }}
              autoFocus
            />
            <Button onClick={addSerial}>Hinzufügen</Button>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {serialDialog.serials.map((s, i) => (
              <div key={i} style={{ padding: '0.25rem 0', borderBottom: '1px solid var(--sapNeutralBorderColor)' }}>
                {i + 1}. {s}
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export function InventoryCountPage() {
  return (
    <Routes>
      <Route index element={<InventoryCountList />} />
      <Route path=":countId" element={<InventoryCountDetail />} />
    </Routes>
  );
}
