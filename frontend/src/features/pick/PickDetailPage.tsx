import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Title, Table, TableColumn, TableRow, TableCell,
  Button, Input, Label, MessageStrip, BusyIndicator,
  Dialog, Bar, Toolbar, ToolbarSpacer, Badge,
  StepInput, Text,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { useSapQuery } from '../../shared/hooks/useSapQuery';
import { useSapMutation } from '../../shared/hooks/useSapMutation';
import { useDocumentLock } from '../../shared/hooks/useDocumentLock';
import { useDocumentCache } from '../../shared/hooks/useDocumentCache';
import { enqueueOfflineAction } from '../../offline/offlineDb';

// Inline base64 beep/error sounds – no dependency on static files
const BEEP_BASE64 = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJiVkHBfUmB7m4V8bltOY3+YjIBuX01cbJSMfnBgTldol4l8cGBMVmuUiXpvYEtTaZOHem9fS1Bolo...';

function playBeep(type: 'beep' | 'error') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = type === 'beep' ? 880 : 220;
    osc.type = type === 'beep' ? 'sine' : 'sawtooth';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // AudioContext not available in some environments – silent fail
  }
}

export function PickDetailPage() {
  const { pickListId } = useParams<{ pickListId: string }>();
  const navigate = useNavigate();
  const { selectedTenantId, selectedInstanceId, selectedWarehouseCode } = useSelector((s: RootState) => s.tenant);
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const isOnline = useSelector((s: RootState) => s.offline.isOnline);

  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'Positive' | 'Negative' | 'Warning' | 'Information' } | null>(null);

  // Serial number dialog state
  const [serialDialog, setSerialDialog] = useState<{
    open: boolean;
    line: any;
    serials: string[];
    scanBuffer: string;
  } | null>(null);
  const serialInputRef = useRef<any>(null);

  const [pickState, setPickState] = useState<any>(null);

  // Load pick list
  const { data: pickList, loading, error } = useSapQuery<any>(
    `PickLists(${pickListId})?$expand=PickListsLines`,
    { enabled: !!pickListId && !!selectedTenantId }
  );

  // Document lock
  const { acquireLock, releaseLock, lockError } = useDocumentLock(
    Number(pickListId), 'Pick', selectedTenantId ?? 0
  );

  // Cache
  const { saveCache, loadCache } = useDocumentCache(
    Number(pickListId), 'Pick', selectedTenantId ?? 0
  );

  // SAP mutation
  const { mutate: patchPickList } = useSapMutation();

  useEffect(() => {
    if (pickList) {
      loadCache().then(cached => {
        setPickState(cached ? JSON.parse(cached.contentJson) : pickList);
      });
    }
  }, [pickList]);

  useEffect(() => {
    if (pickListId && selectedTenantId) {
      acquireLock();
      return () => { releaseLock(); };
    }
  }, [pickListId, selectedTenantId]);

  // Focus serial input when dialog opens
  useEffect(() => {
    if (serialDialog?.open) {
      setTimeout(() => serialInputRef.current?.focus?.(), 100);
    }
  }, [serialDialog?.open]);

  function handleScan(code: string) {
    if (!pickState || !code.trim()) return;
    const lines = pickState.PickListsLines ?? [];

    const line = lines.find((l: any) =>
      l.ItemCode === code ||
      l.Barcode === code ||
      l.ItemDescription?.toLowerCase().includes(code.toLowerCase())
    );

    if (!line) {
      setMessage({ text: `Artikel "${code}" nicht in dieser Pickliste gefunden`, type: 'Negative' });
      playBeep('error');
      return;
    }

    if (line.ManageSerialNumbers === 'tYES') {
      // Open serial number dialog with existing serials pre-filled
      const existingSerials = (line.SerialNumbers ?? []).map((s: any) => s.InternalSerialNumber ?? s.SerialNumber ?? '').filter(Boolean);
      setSerialDialog({ open: true, line, serials: existingSerials, scanBuffer: '' });
      return;
    }

    // Auto-pick one quantity
    const updatedLines = lines.map((l: any) =>
      l.LineNumber === line.LineNumber
        ? { ...l, PickedQuantity: Math.min((l.PickedQuantity ?? 0) + 1, l.ReleasedQuantity) }
        : l
    );

    const newState = { ...pickState, PickListsLines: updatedLines };
    setPickState(newState);
    saveCache(JSON.stringify(newState));

    const remaining = line.ReleasedQuantity - (line.PickedQuantity ?? 0) - 1;
    if (remaining <= 0) {
      setMessage({ text: `✓ ${line.ItemCode} vollständig gepickt`, type: 'Positive' });
      playBeep('beep');
    } else {
      setMessage({ text: `${line.ItemCode}: noch ${remaining} Stück offen`, type: 'Information' });
      playBeep('beep');
    }

    setScanInput('');
  }

  function handleSerialScan(serial: string) {
    if (!serial.trim() || !serialDialog) return;
    const line = serialDialog.line;
    const needed = line.ReleasedQuantity - (line.PickedQuantity ?? 0);
    if (serialDialog.serials.length >= needed) {
      setMessage({ text: `Maximale Anzahl Seriennummern erreicht (${needed})`, type: 'Warning' });
      return;
    }
    if (serialDialog.serials.includes(serial.trim())) {
      setMessage({ text: `Seriennummer "${serial}" bereits gescannt`, type: 'Warning' });
      return;
    }
    setSerialDialog(d => d ? { ...d, serials: [...d.serials, serial.trim()], scanBuffer: '' } : d);
    playBeep('beep');
  }

  function confirmSerials() {
    if (!serialDialog || !pickState) return;
    const line = serialDialog.line;
    const serials = serialDialog.serials;

    const updatedLines = (pickState.PickListsLines ?? []).map((l: any) =>
      l.LineNumber === line.LineNumber
        ? {
            ...l,
            PickedQuantity: serials.length,
            SerialNumbers: serials.map(s => ({ InternalSerialNumber: s })),
          }
        : l
    );

    const newState = { ...pickState, PickListsLines: updatedLines };
    setPickState(newState);
    saveCache(JSON.stringify(newState));
    setSerialDialog(null);
    setMessage({ text: `${serials.length} Seriennummer(n) für ${line.ItemCode} übernommen`, type: 'Positive' });
  }

  async function handleSave() {
    if (!pickState) return;

    if (!isOnline) {
      await enqueueOfflineAction({
        module: 'Pick',
        actionType: 'PATCH',
        sapEndpoint: `PickLists(${pickListId})`,
        payloadJson: JSON.stringify(pickState),
        tenantId: selectedTenantId!,
        instanceId: selectedInstanceId!,
        userId: '',
        createdAt: new Date().toISOString(),
      });
      setMessage({ text: 'Offline gespeichert – wird synchronisiert wenn online', type: 'Warning' });
      return;
    }

    const patchBody = {
      PickListsLines: (pickState.PickListsLines ?? []).map((l: any) => ({
        AbsoluteEntry: l.AbsoluteEntry,
        LineNumber: l.LineNumber,
        PickedQuantity: l.PickedQuantity ?? 0,
        PickStatus: (l.PickedQuantity ?? 0) >= l.ReleasedQuantity ? 'Y' : 'P',
        ...(l.SerialNumbers?.length > 0 && { SerialNumbers: l.SerialNumbers }),
      }))
    };

    const result = await patchPickList(`PickLists(${pickListId})`, patchBody);
    if (result.success) {
      await releaseLock();
      setMessage({ text: 'Pickliste erfolgreich gespeichert', type: 'Positive' });
      setTimeout(() => navigate('/pick'), 1500);
    } else {
      setMessage({ text: `Fehler beim Speichern: ${result.error}`, type: 'Negative' });
    }
  }

  if (loading) return <BusyIndicator active text="Pickliste wird geladen..." style={{ margin: '2rem' }} />;
  if (error) return <MessageStrip design="Negative">{error}</MessageStrip>;
  if (!pickState) return null;

  return (
    <div>
      <Toolbar>
        <Button icon="nav-back" onClick={() => navigate('/pick')} design="Transparent" />
        <Title level="H3">Pickliste #{pickListId}</Title>
        <ToolbarSpacer />
        <Button design="Emphasized" icon="save" onClick={handleSave}>
          Speichern
        </Button>
      </Toolbar>

      {lockError && (
        <MessageStrip design="Warning" style={{ marginBottom: '0.5rem' }}>
          {lockError}
        </MessageStrip>
      )}

      {message && (
        <MessageStrip
          design={message.type}
          onClose={() => setMessage(null)}
          style={{ marginBottom: '0.5rem' }}
        >
          {message.text}
        </MessageStrip>
      )}

      {/* Scan Input */}
      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '1rem',
        padding: '1rem', background: 'var(--sapGroup_TitleBackground)',
        borderRadius: '0.25rem'
      }}>
        <Label>Artikel scannen:</Label>
        <Input
          placeholder="Barcode / Artikelnummer scannen oder eingeben"
          value={scanInput}
          onInput={(e: any) => setScanInput(e.target.value)}
          onKeyPress={(e: any) => {
            if (e.key === 'Enter') {
              handleScan(scanInput);
              setScanInput('');
            }
          }}
          style={{ flex: 1 }}
          autoFocus
        />
        <Button icon="bar-code" onClick={() => { handleScan(scanInput); setScanInput(''); }}>
          Scan
        </Button>
      </div>

      {/* Pick Lines */}
      <Table
        columns={
          <>
            <TableColumn>Artikel</TableColumn>
            <TableColumn>Bezeichnung</TableColumn>
            <TableColumn>Lagerort</TableColumn>
            <TableColumn>Offen</TableColumn>
            <TableColumn>Gepickt</TableColumn>
            <TableColumn>Status</TableColumn>
          </>
        }
      >
        {(pickState.PickListsLines ?? []).map((line: any) => {
          const picked = line.PickedQuantity ?? 0;
          const pct = line.ReleasedQuantity > 0
            ? Math.round((picked / line.ReleasedQuantity) * 100)
            : 0;
          return (
            <TableRow key={line.LineNumber} highlight={pct === 100 ? 'Positive' : pct > 0 ? 'Information' : 'None'}>
              <TableCell>
                <strong>{line.ItemCode}</strong>
                {line.ManageSerialNumbers === 'tYES' && (
                  <Badge colorScheme="6" style={{ marginLeft: '0.25rem', fontSize: '0.65rem' }}>S/N</Badge>
                )}
              </TableCell>
              <TableCell>{line.ItemDescription}</TableCell>
              <TableCell>{line.WarehouseCode ?? selectedWarehouseCode}</TableCell>
              <TableCell>{line.ReleasedQuantity}</TableCell>
              <TableCell>
                {line.ManageSerialNumbers === 'tYES' ? (
                  <Button
                    design="Transparent"
                    onClick={() => setSerialDialog({
                      open: true,
                      line,
                      serials: (line.SerialNumbers ?? []).map((s: any) => s.InternalSerialNumber ?? '').filter(Boolean),
                      scanBuffer: '',
                    })}
                  >
                    {picked}/{line.ReleasedQuantity} S/N
                  </Button>
                ) : (
                  <StepInput
                    min={0}
                    max={line.ReleasedQuantity}
                    value={picked}
                    onChange={(e: any) => {
                      const newVal = Number(e.target.value);
                      setPickState((prev: any) => ({
                        ...prev,
                        PickListsLines: prev.PickListsLines.map((l: any) =>
                          l.LineNumber === line.LineNumber ? { ...l, PickedQuantity: newVal } : l
                        )
                      }));
                    }}
                  />
                )}
              </TableCell>
              <TableCell>
                {pct === 100
                  ? <Badge colorScheme="8">Fertig</Badge>
                  : pct > 0
                    ? <Badge colorScheme="2">{pct}%</Badge>
                    : <Badge colorScheme="6">Offen</Badge>
                }
              </TableCell>
            </TableRow>
          );
        })}
      </Table>

      {/* ── Serial Number Dialog ─────────────────────────────────────────────── */}
      {serialDialog && (
        <Dialog
          open={serialDialog.open}
          headerText={`Seriennummern – ${serialDialog.line.ItemCode}`}
          footer={
            <Bar
              startContent={
                <Text style={{ color: 'var(--sapNeutralColor)', fontSize: '0.875rem' }}>
                  {serialDialog.serials.length} / {serialDialog.line.ReleasedQuantity - (serialDialog.line.PickedQuantity ?? 0)} gescannt
                </Text>
              }
              endContent={
                <>
                  <Button
                    design="Emphasized"
                    onClick={confirmSerials}
                    disabled={serialDialog.serials.length === 0}
                  >
                    {serialDialog.serials.length} Seriennummer(n) übernehmen
                  </Button>
                  <Button onClick={() => setSerialDialog(null)}>Abbrechen</Button>
                </>
              }
            />
          }
        >
          <div style={{ padding: '1rem', minWidth: 400, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Scan input */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Input
                ref={serialInputRef}
                placeholder="Seriennummer eingeben oder scannen"
                value={serialDialog.scanBuffer}
                onInput={(e: any) => setSerialDialog(d => d ? { ...d, scanBuffer: e.target.value } : d)}
                onKeyPress={(e: any) => {
                  if (e.key === 'Enter' && serialDialog.scanBuffer.trim()) {
                    handleSerialScan(serialDialog.scanBuffer.trim());
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button
                icon="bar-code"
                onClick={() => {
                  if (serialDialog.scanBuffer.trim()) {
                    handleSerialScan(serialDialog.scanBuffer.trim());
                  }
                }}
              >
                Scan
              </Button>
            </div>

            {/* Scanned serials list */}
            {serialDialog.serials.length > 0 ? (
              <div style={{
                maxHeight: 300, overflowY: 'auto',
                border: '1px solid var(--sapNeutralBorderColor)',
                borderRadius: '0.25rem',
              }}>
                {serialDialog.serials.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderBottom: i < serialDialog.serials.length - 1 ? '1px solid var(--sapList_BorderColor)' : 'none',
                    background: i % 2 === 0 ? 'var(--sapList_Background)' : 'var(--sapList_AlternatingRowBackground)',
                  }}>
                    <Text style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{s}</Text>
                    <Button
                      icon="delete"
                      design="Transparent"
                      onClick={() => setSerialDialog(d => d ? { ...d, serials: d.serials.filter((_, j) => j !== i) } : d)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Text style={{ color: 'var(--sapNeutralColor)', textAlign: 'center', padding: '1rem' }}>
                Noch keine Seriennummern gescannt
              </Text>
            )}

            {/* Manual add */}
            <Button
              icon="add"
              design="Transparent"
              onClick={() => {
                const sn = prompt('Seriennummer manuell eingeben:');
                if (sn?.trim()) handleSerialScan(sn.trim());
              }}
            >
              Manuell hinzufügen
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
