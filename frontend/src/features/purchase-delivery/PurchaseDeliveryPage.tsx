import { useState, useEffect } from 'react';
import { useNavigate, useParams, Routes, Route } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Title, Table, TableColumn, TableRow, TableCell, Button, Input, Label,
  MessageStrip, BusyIndicator, Toolbar, ToolbarSpacer, Badge, StepInput, Dialog, Bar, Text,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { useSapQuery } from '../../shared/hooks/useSapQuery';
import { useSapMutation } from '../../shared/hooks/useSapMutation';
import { useDocumentLock } from '../../shared/hooks/useDocumentLock';
import { enqueueOfflineAction } from '../../offline/offlineDb';
import { API_BASE } from '../../shared/services/api';

// Generate batch number: ITEMCODE-YYYYMMDD-RAND
function generateBatchNumber(itemCode: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${itemCode.slice(0, 6)}-${date}-${rand}`;
}

/**
 * Upload delivery note image as SAP attachment linked to the GoodsReceiptsPO document.
 * SAP Service Layer: POST /Attachments2 (multipart/form-data)
 */
async function uploadAttachment(
  file: File,
  docEntry: number,
  accessToken: string,
  tenantId: number,
  instanceId: number
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('docEntry', String(docEntry));
  formData.append('objectType', 'GoodsReceiptsPO');

  const res = await fetch(`${API_BASE}/sap/attachment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Tenant-Id': String(tenantId),
      'X-Instance-Id': String(instanceId),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Upload failed');
    throw new Error(err);
  }
}

function PurchaseOrderList() {
  const navigate = useNavigate();
  const { selectedTenantId } = useSelector((s: RootState) => s.tenant);

  const { data, loading, error, refetch } = useSapQuery<{ value: any[] }>(
    `PurchaseOrders?$filter=DocumentStatus eq 'bost_Open'&$orderby=DocDate desc&$expand=DocumentLines`,
    { enabled: !!selectedTenantId }
  );

  if (loading) return <BusyIndicator active text="Bestellungen werden geladen..." style={{ margin: '2rem' }} />;
  if (error) return <MessageStrip design="Negative">{error}</MessageStrip>;

  return (
    <div>
      <Toolbar>
        <Title level="H3">Wareneingang</Title>
        <ToolbarSpacer />
        <Button icon="refresh" onClick={refetch}>Aktualisieren</Button>
      </Toolbar>
      <Table
        noDataText="Keine offenen Bestellungen"
        columns={
          <>
            <TableColumn>Bestell-Nr.</TableColumn>
            <TableColumn>Datum</TableColumn>
            <TableColumn>Lieferant</TableColumn>
            <TableColumn>Positionen</TableColumn>
            <TableColumn />
          </>
        }
      >
        {(data?.value ?? []).map((po: any) => (
          <TableRow key={po.DocEntry}>
            <TableCell><strong>{po.DocNum}</strong></TableCell>
            <TableCell>{po.DocDate ? new Date(po.DocDate).toLocaleDateString('de-DE') : '-'}</TableCell>
            <TableCell>{po.CardName}</TableCell>
            <TableCell>{po.DocumentLines?.length ?? 0}</TableCell>
            <TableCell>
              <Button design="Emphasized" onClick={() => navigate(String(po.DocEntry))}>
                Wareneingang buchen
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}

function PurchaseDeliveryDetail() {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const { selectedTenantId, selectedInstanceId, selectedWarehouseCode } = useSelector((s: RootState) => s.tenant);
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const isOnline = useSelector((s: RootState) => s.offline.isOnline);

  const [grState, setGrState] = useState<any[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'Positive' | 'Negative' | 'Information' | 'Warning' } | null>(null);
  const [batchDialog, setBatchDialog] = useState<{ open: boolean; line: any; batches: Array<{ batchNum: string; qty: number }> } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: po, loading } = useSapQuery<any>(
    `PurchaseOrders(${poId})?$expand=DocumentLines`,
    { enabled: !!poId && !!selectedTenantId }
  );

  const { acquireLock, releaseLock, lockError } = useDocumentLock(
    Number(poId), 'PurchaseDelivery', selectedTenantId ?? 0
  );

  const { mutate } = useSapMutation();

  useEffect(() => {
    if (po?.DocumentLines) {
      setGrState(po.DocumentLines.map((l: any) => ({
        ...l,
        ReceivedQuantity: l.Quantity,
        BatchNumbers: l.ManageBatchNumbers === 'tYES'
          ? [{ BatchNumber: generateBatchNumber(l.ItemCode), Quantity: l.Quantity }]
          : [],
      })));
    }
  }, [po]);

  useEffect(() => {
    if (poId && selectedTenantId) {
      acquireLock();
      return () => { releaseLock(); };
    }
  }, [poId, selectedTenantId]);

  function handleScan(code: string) {
    const line = grState.find(l => l.ItemCode === code);
    if (!line) {
      setMessage({ text: `Artikel "${code}" nicht in dieser Bestellung`, type: 'Negative' });
      return;
    }

    if (line.ManageBatchNumbers === 'tYES') {
      setBatchDialog({ open: true, line, batches: line.BatchNumbers });
      return;
    }

    setScanInput('');
    setMessage({ text: `${line.ItemCode} – Menge: ${line.ReceivedQuantity}`, type: 'Information' });
  }

  async function handleBook() {
    if (!po || grState.length === 0) return;

    const grBody = {
      CardCode: po.CardCode,
      DocDate: new Date().toISOString().slice(0, 10),
      DocumentLines: grState.map(l => ({
        BaseType: 22,
        BaseEntry: Number(poId),
        BaseLine: l.LineNum,
        ItemCode: l.ItemCode,
        Quantity: l.ReceivedQuantity,
        WarehouseCode: l.WarehouseCode ?? selectedWarehouseCode,
        ...(l.BatchNumbers?.length > 0 && {
          BatchNumbers: l.BatchNumbers.map((b: any) => ({
            BatchNumber: b.batchNum ?? b.BatchNumber,
            Quantity: b.qty ?? b.Quantity,
          }))
        }),
      })),
    };

    if (!isOnline) {
      await enqueueOfflineAction({
        module: 'PurchaseDelivery',
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
    if (!result.success) {
      setMessage({ text: `Fehler: ${result.error}`, type: 'Negative' });
      return;
    }

    // Upload image attachment if provided
    if (imageFile && result.data?.DocEntry) {
      setUploadingImage(true);
      try {
        await uploadAttachment(imageFile, result.data.DocEntry, accessToken!, selectedTenantId!, selectedInstanceId!);
        setMessage({ text: 'Wareneingang gebucht und Bild hochgeladen', type: 'Positive' });
      } catch (err) {
        // Booking succeeded; image upload failed – non-blocking
        setMessage({ text: `Wareneingang gebucht – Bild konnte nicht hochgeladen werden: ${err instanceof Error ? err.message : String(err)}`, type: 'Warning' });
      } finally {
        setUploadingImage(false);
      }
    } else {
      setMessage({ text: 'Wareneingang erfolgreich gebucht', type: 'Positive' });
    }

    await releaseLock();
    setTimeout(() => navigate('/purchase-delivery'), 1500);
  }

  if (loading) return <BusyIndicator active text="Bestellung wird geladen..." style={{ margin: '2rem' }} />;
  if (!po) return null;

  return (
    <div>
      <Toolbar>
        <Button icon="nav-back" design="Transparent" onClick={() => navigate('/purchase-delivery')} />
        <Title level="H3">Wareneingang – Bestellung #{po.DocNum}</Title>
        <ToolbarSpacer />
        <Button design="Emphasized" icon="save" onClick={handleBook} disabled={uploadingImage}>
          {uploadingImage ? 'Bild wird hochgeladen...' : 'Buchen'}
        </Button>
      </Toolbar>

      {lockError && <MessageStrip design="Critical" style={{ marginBottom: '0.5rem' }}>{lockError}</MessageStrip>}
      {message && <MessageStrip design={message.type} onClose={() => setMessage(null)} style={{ marginBottom: '0.5rem' }}>{message.text}</MessageStrip>}

      {/* Scan bar */}
      <div style={{
        display: 'flex', gap: '0.5rem', padding: '1rem',
        background: 'var(--sapGroup_TitleBackground)', borderRadius: '0.25rem', marginBottom: '1rem',
      }}>
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

      {/* Document image upload */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem 1rem', marginBottom: '1rem',
        border: '1px dashed var(--sapNeutralBorderColor)', borderRadius: '0.25rem',
      }}>
        <Label>Lieferschein-Bild:</Label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
        />
        {imageFile && (
          <Badge colorScheme="8">✓ {imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)</Badge>
        )}
      </div>

      <Table
        columns={
          <>
            <TableColumn>Artikel</TableColumn>
            <TableColumn>Bezeichnung</TableColumn>
            <TableColumn>Bestellt</TableColumn>
            <TableColumn>Empfangen</TableColumn>
            <TableColumn>Charge</TableColumn>
          </>
        }
      >
        {grState.map(line => (
          <TableRow key={line.LineNum}>
            <TableCell><strong>{line.ItemCode}</strong></TableCell>
            <TableCell>{line.ItemDescription}</TableCell>
            <TableCell>{line.Quantity}</TableCell>
            <TableCell>
              <StepInput
                min={0}
                max={line.Quantity}
                value={line.ReceivedQuantity}
                onChange={(e: any) => setGrState(prev =>
                  prev.map(l => l.LineNum === line.LineNum ? { ...l, ReceivedQuantity: Number(e.target.value) } : l)
                )}
              />
            </TableCell>
            <TableCell>
              {line.ManageBatchNumbers === 'tYES' ? (
                <Button design="Transparent" onClick={() => setBatchDialog({ open: true, line, batches: line.BatchNumbers })}>
                  {line.BatchNumbers?.length ?? 0} Charge(n)
                </Button>
              ) : '-'}
            </TableCell>
          </TableRow>
        ))}
      </Table>

      {/* Batch Dialog */}
      {batchDialog && (
        <Dialog
          open={batchDialog.open}
          headerText={`Chargen – ${batchDialog.line.ItemCode}`}
          footer={
            <Bar endContent={
              <>
                <Button design="Emphasized" onClick={() => {
                  setGrState(prev => prev.map(l =>
                    l.LineNum === batchDialog.line.LineNum ? { ...l, BatchNumbers: batchDialog.batches } : l
                  ));
                  setBatchDialog(null);
                }}>Übernehmen</Button>
                <Button onClick={() => setBatchDialog(null)}>Abbrechen</Button>
              </>
            } />
          }
        >
          <div style={{ padding: '1rem', minWidth: 380 }}>
            {batchDialog.batches.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                <Input
                  value={b.batchNum}
                  onInput={(e: any) => {
                    const updated = [...batchDialog.batches];
                    updated[i] = { ...updated[i], batchNum: e.target.value };
                    setBatchDialog(p => p ? { ...p, batches: updated } : p);
                  }}
                  style={{ flex: 2 }}
                  placeholder="Chargennummer"
                />
                <StepInput
                  min={0}
                  value={b.qty}
                  onChange={(e: any) => {
                    const updated = [...batchDialog.batches];
                    updated[i] = { ...updated[i], qty: Number(e.target.value) };
                    setBatchDialog(p => p ? { ...p, batches: updated } : p);
                  }}
                  style={{ flex: 1 }}
                />
                <Button icon="delete" design="Negative"
                  onClick={() => setBatchDialog(p => p ? { ...p, batches: p.batches.filter((_, j) => j !== i) } : p)}
                />
              </div>
            ))}
            <Button icon="add" onClick={() =>
              setBatchDialog(p => p ? {
                ...p, batches: [...p.batches, { batchNum: generateBatchNumber(batchDialog.line.ItemCode), qty: 1 }]
              } : p)
            }>
              Charge hinzufügen
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export function PurchaseDeliveryPage() {
  return (
    <Routes>
      <Route index element={<PurchaseOrderList />} />
      <Route path=":poId" element={<PurchaseDeliveryDetail />} />
    </Routes>
  );
}
