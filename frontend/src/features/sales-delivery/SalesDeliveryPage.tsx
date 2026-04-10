import { useState, useEffect, useRef } from 'react';
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

function SalesOrderList() {
  const navigate = useNavigate();
  const { selectedTenantId } = useSelector((s: RootState) => s.tenant);

  const { data, loading, error, refetch } = useSapQuery<{ value: any[] }>(
    `Orders?$filter=DocumentStatus eq 'bost_Open'&$orderby=DocDate desc`,
    { enabled: !!selectedTenantId }
  );

  if (loading) return <BusyIndicator active text="Aufträge werden geladen..." style={{ margin: '2rem' }} />;
  if (error) return <MessageStrip design="Negative">{error}</MessageStrip>;

  return (
    <div>
      <Toolbar>
        <Title level="H3">Warenausgang</Title>
        <ToolbarSpacer />
        <Button icon="refresh" onClick={refetch}>Aktualisieren</Button>
      </Toolbar>
      <Table
        noDataText="Keine offenen Aufträge"
        columns={<><TableColumn>Auftrags-Nr.</TableColumn><TableColumn>Datum</TableColumn><TableColumn>Kunde</TableColumn><TableColumn>Status</TableColumn><TableColumn /></>}
      >
        {(data?.value ?? []).map((order: any) => (
          <TableRow key={order.DocEntry}>
            <TableCell><strong>{order.DocNum}</strong></TableCell>
            <TableCell>{order.DocDate ? new Date(order.DocDate).toLocaleDateString('de-DE') : '-'}</TableCell>
            <TableCell>{order.CardName}</TableCell>
            <TableCell><Badge colorScheme="2">Offen</Badge></TableCell>
            <TableCell>
              <Button design="Emphasized" onClick={() => navigate(String(order.DocEntry))}>Lieferung erstellen</Button>
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}

function SalesDeliveryDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { selectedTenantId, selectedInstanceId, selectedWarehouseCode } = useSelector((s: RootState) => s.tenant);
  const isOnline = useSelector((s: RootState) => s.offline.isOnline);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [showSigDialog, setShowSigDialog] = useState(false);
  const [deliveryLines, setDeliveryLines] = useState<any[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'Positive' | 'Negative' | 'Information' | 'Warning' } | null>(null);

  const { data: order, loading } = useSapQuery<any>(
    `Orders(${orderId})?$expand=DocumentLines`,
    { enabled: !!orderId && !!selectedTenantId }
  );

  const { acquireLock, releaseLock, lockError } = useDocumentLock(
    Number(orderId), 'SalesDelivery', selectedTenantId ?? 0
  );

  const { mutate } = useSapMutation();

  useEffect(() => {
    if (order?.DocumentLines) {
      setDeliveryLines(order.DocumentLines.map((l: any) => ({ ...l, DeliveryQuantity: l.Quantity })));
    }
  }, [order]);

  useEffect(() => {
    if (orderId && selectedTenantId) {
      acquireLock();
      return () => { releaseLock(); };
    }
  }, [orderId, selectedTenantId]);

  // Canvas signature helpers
  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSig(true);
  }

  function clearSig() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  async function handleBook() {
    const body = {
      CardCode: order.CardCode,
      DocDate: new Date().toISOString().slice(0, 10),
      DocumentLines: deliveryLines.map((l: any) => ({
        BaseType: 17,
        BaseEntry: Number(orderId),
        BaseLine: l.LineNum,
        ItemCode: l.ItemCode,
        Quantity: l.DeliveryQuantity,
        WarehouseCode: l.WarehouseCode ?? selectedWarehouseCode,
      })),
    };

    if (!isOnline) {
      await enqueueOfflineAction({
        module: 'SalesDelivery',
        actionType: 'POST',
        sapEndpoint: 'DeliveryNotes',
        payloadJson: JSON.stringify(body),
        tenantId: selectedTenantId!,
        instanceId: selectedInstanceId!,
        userId: '',
        createdAt: new Date().toISOString(),
      });
      setMessage({ text: 'Offline gespeichert', type: 'Warning' });
      return;
    }

    const result = await mutate('DeliveryNotes', body, 'POST');
    if (result.success) {
      await releaseLock();
      setMessage({ text: 'Lieferung erfolgreich erstellt', type: 'Positive' });
      setTimeout(() => navigate('/sales-delivery'), 1500);
    } else {
      setMessage({ text: `Fehler: ${result.error}`, type: 'Negative' });
    }
  }

  if (loading) return <BusyIndicator active text="Auftrag wird geladen..." style={{ margin: '2rem' }} />;
  if (!order) return null;

  return (
    <div>
      <Toolbar>
        <Button icon="nav-back" design="Transparent" onClick={() => navigate('/sales-delivery')} />
        <Title level="H3">Lieferung – Auftrag #{order.DocNum}</Title>
        <ToolbarSpacer />
        <Button icon="pen-pad" onClick={() => setShowSigDialog(true)}>Unterschrift</Button>
        <Button design="Emphasized" icon="save" onClick={handleBook}>Buchen</Button>
      </Toolbar>

      {lockError && <MessageStrip design="Warning" style={{ marginBottom: '0.5rem' }}>{lockError}</MessageStrip>}
      {message && <MessageStrip design={message.type} onClose={() => setMessage(null)} style={{ marginBottom: '0.5rem' }}>{message.text}</MessageStrip>}

      <div style={{ padding: '0.5rem 0 1rem', color: 'var(--sapTextColor)' }}>
        <strong>Kunde:</strong> {order.CardName} &nbsp;|&nbsp; <strong>Datum:</strong> {new Date(order.DocDate).toLocaleDateString('de-DE')}
      </div>

      <Table columns={<><TableColumn>Artikel</TableColumn><TableColumn>Bezeichnung</TableColumn><TableColumn>Bestellt</TableColumn><TableColumn>Zu liefern</TableColumn><TableColumn>Lager</TableColumn></>}>
        {deliveryLines.map(line => (
          <TableRow key={line.LineNum}>
            <TableCell><strong>{line.ItemCode}</strong></TableCell>
            <TableCell>{line.ItemDescription}</TableCell>
            <TableCell>{line.Quantity}</TableCell>
            <TableCell>
              <StepInput
                min={0}
                max={line.Quantity}
                value={line.DeliveryQuantity}
                onChange={(e: any) => setDeliveryLines(prev => prev.map(l => l.LineNum === line.LineNum ? { ...l, DeliveryQuantity: Number(e.target.value) } : l))}
              />
            </TableCell>
            <TableCell>{line.WarehouseCode ?? selectedWarehouseCode}</TableCell>
          </TableRow>
        ))}
      </Table>

      {/* Signature Dialog */}
      <Dialog
        open={showSigDialog}
        headerText="Unterschrift (POD)"
        footer={
          <Bar
            startContent={<Button design="Negative" onClick={clearSig}>Löschen</Button>}
            endContent={<><Button design="Emphasized" disabled={!hasSig} onClick={() => setShowSigDialog(false)}>Bestätigen</Button><Button onClick={() => setShowSigDialog(false)}>Schließen</Button></>}
          />
        }
      >
        <div style={{ padding: '1rem' }}>
          <Text>Bitte hier unterschreiben:</Text>
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            style={{ border: '1px solid var(--sapNeutralBorderColor)', borderRadius: '0.25rem', touchAction: 'none', display: 'block', marginTop: '0.5rem', background: '#fff' }}
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={() => setIsDrawing(false)}
          />
        </div>
      </Dialog>
    </div>
  );
}

export function SalesDeliveryPage() {
  return (
    <Routes>
      <Route index element={<SalesOrderList />} />
      <Route path=":orderId" element={<SalesDeliveryDetail />} />
    </Routes>
  );
}
