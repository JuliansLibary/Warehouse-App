import { useState, useEffect, useCallback } from 'react';
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

export function PickDetailPage() {
  const { pickListId } = useParams<{ pickListId: string }>();
  const navigate = useNavigate();
  const { selectedTenantId, selectedInstanceId, selectedWarehouseCode } = useSelector((s: RootState) => s.tenant);
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const isOnline = useSelector((s: RootState) => s.offline.isOnline);

  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'Positive' | 'Negative' | 'Warning' | 'Information' } | null>(null);
  const [showSerialDialog, setShowSerialDialog] = useState(false);
  const [currentLine, setCurrentLine] = useState<any>(null);
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
      // Try to restore from cache first
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

  function handleScan(code: string) {
    if (!pickState) return;
    const lines = pickState.PickListsLines ?? [];

    // Find matching line by item code or barcode
    const line = lines.find((l: any) =>
      l.ItemCode === code ||
      l.Barcode === code ||
      l.ItemDescription?.toLowerCase().includes(code.toLowerCase())
    );

    if (!line) {
      setMessage({ text: `Artikel "${code}" nicht in dieser Pickliste gefunden`, type: 'Negative' });
      playSound('error');
      return;
    }

    if (line.ManageSerialNumbers === 'tYES') {
      setCurrentLine(line);
      setShowSerialDialog(true);
      return;
    }

    // Auto-pick one quantity
    const updatedLines = lines.map((l: any) =>
      l.LineNumber === line.LineNumber
        ? { ...l, PickedQuantity: Math.min(l.PickedQuantity + 1, l.ReleasedQuantity) }
        : l
    );

    const newState = { ...pickState, PickListsLines: updatedLines };
    setPickState(newState);
    saveCache(JSON.stringify(newState));

    const remaining = line.ReleasedQuantity - line.PickedQuantity - 1;
    if (remaining <= 0) {
      setMessage({ text: `✓ ${line.ItemCode} vollständig gepickt`, type: 'Positive' });
      playSound('beep');
    } else {
      setMessage({ text: `${line.ItemCode}: noch ${remaining} Stück offen`, type: 'Information' });
    }

    setScanInput('');
  }

  async function handleSave() {
    if (!pickState || !isOnline) {
      // Save to offline queue
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
      PickListsLines: pickState.PickListsLines.map((l: any) => ({
        AbsoluteEntry: l.AbsoluteEntry,
        LineNumber: l.LineNumber,
        PickedQuantity: l.PickedQuantity,
        PickStatus: l.PickedQuantity >= l.ReleasedQuantity ? 'Y' : 'P',
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

  function playSound(type: 'beep' | 'error') {
    const audio = new Audio(type === 'beep' ? '/sounds/beep.wav' : '/sounds/error.wav');
    audio.play().catch(() => {});
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
          const pct = line.ReleasedQuantity > 0
            ? Math.round((line.PickedQuantity / line.ReleasedQuantity) * 100)
            : 0;
          return (
            <TableRow key={line.LineNumber} highlight={pct === 100 ? 'Positive' : pct > 0 ? 'Information' : 'None'}>
              <TableCell><strong>{line.ItemCode}</strong></TableCell>
              <TableCell>{line.ItemDescription}</TableCell>
              <TableCell>{line.WarehouseCode ?? selectedWarehouseCode}</TableCell>
              <TableCell>{line.ReleasedQuantity}</TableCell>
              <TableCell>
                <StepInput
                  min={0}
                  max={line.ReleasedQuantity}
                  value={line.PickedQuantity}
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
    </div>
  );
}
