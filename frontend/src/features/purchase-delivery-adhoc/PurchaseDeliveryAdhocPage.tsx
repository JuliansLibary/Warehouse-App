import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Title, Table, TableColumn, TableRow, TableCell, Button, Input, Label,
  MessageStrip, BusyIndicator, Toolbar, ToolbarSpacer, Select, Option, StepInput,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { useSapQuery } from '../../shared/hooks/useSapQuery';
import { useSapMutation } from '../../shared/hooks/useSapMutation';
import { enqueueOfflineAction } from '../../offline/offlineDb';

interface GrLine {
  itemCode: string;
  itemDescription: string;
  quantity: number;
  warehouseCode: string;
  unitPrice: number;
}

export function PurchaseDeliveryAdhocPage() {
  const { selectedTenantId, selectedInstanceId, selectedWarehouseCode } = useSelector((s: RootState) => s.tenant);
  const isOnline = useSelector((s: RootState) => s.offline.isOnline);

  const [cardCode, setCardCode] = useState('');
  const [lines, setLines] = useState<GrLine[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'Positive' | 'Negative' | 'Information' | 'Warning' } | null>(null);

  const { data: partners, loading: partnersLoading } = useSapQuery<{ value: any[] }>(
    `BusinessPartners?$select=CardCode,CardName&$filter=CardType eq 'cSupplier'&$orderby=CardName`,
    { enabled: !!selectedTenantId }
  );

  const { data: items } = useSapQuery<{ value: any[] }>(
    'Items?$select=ItemCode,ItemName,PurchaseUnit&$filter=Frozen eq tNO',
    { enabled: !!selectedTenantId }
  );

  const { mutate } = useSapMutation();

  function handleScan(code: string) {
    const item = (items?.value ?? []).find((i: any) => i.ItemCode === code);
    if (!item) {
      setMessage({ text: `Artikel "${code}" nicht gefunden`, type: 'Negative' });
      return;
    }
    setLines(prev => {
      const existing = prev.find(l => l.itemCode === code);
      if (existing) return prev.map(l => l.itemCode === code ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { itemCode: item.ItemCode, itemDescription: item.ItemName, quantity: 1, warehouseCode: selectedWarehouseCode ?? '', unitPrice: 0 }];
    });
    setScanInput('');
    setMessage({ text: `${item.ItemCode} hinzugefügt`, type: 'Information' });
  }

  async function handlePost() {
    if (!cardCode) { setMessage({ text: 'Bitte Lieferant auswählen', type: 'Warning' }); return; }
    if (lines.length === 0) { setMessage({ text: 'Keine Artikel vorhanden', type: 'Warning' }); return; }

    const body = {
      CardCode: cardCode,
      DocDate: new Date().toISOString().slice(0, 10),
      DocumentLines: lines.map((l, idx) => ({
        LineNum: idx,
        ItemCode: l.itemCode,
        Quantity: l.quantity,
        WarehouseCode: l.warehouseCode || selectedWarehouseCode,
        UnitPrice: l.unitPrice,
      })),
    };

    if (!isOnline) {
      await enqueueOfflineAction({
        module: 'PurchaseDeliveryAdhoc',
        actionType: 'POST',
        sapEndpoint: 'GoodsReceiptsPO',
        payloadJson: JSON.stringify(body),
        tenantId: selectedTenantId!,
        instanceId: selectedInstanceId!,
        userId: '',
        createdAt: new Date().toISOString(),
      });
      setMessage({ text: 'Offline gespeichert', type: 'Warning' });
      return;
    }

    const result = await mutate('GoodsReceiptsPO', body, 'POST');
    if (result.success) {
      setMessage({ text: 'Wareneingang (Adhoc) erfolgreich gebucht', type: 'Positive' });
      setLines([]);
      setCardCode('');
    } else {
      setMessage({ text: `Fehler: ${result.error}`, type: 'Negative' });
    }
  }

  if (partnersLoading) return <BusyIndicator active text="Lieferanten werden geladen..." style={{ margin: '2rem' }} />;

  return (
    <div>
      <Toolbar>
        <Title level="H3">Wareneingang Adhoc</Title>
        <ToolbarSpacer />
        <Button design="Emphasized" icon="save" onClick={handlePost} disabled={lines.length === 0 || !cardCode}>Buchen</Button>
      </Toolbar>

      {message && <MessageStrip design={message.type} onClose={() => setMessage(null)} style={{ marginBottom: '0.5rem' }}>{message.text}</MessageStrip>}

      {/* Supplier */}
      <div style={{ padding: '1rem', background: 'var(--sapGroup_TitleBackground)', borderRadius: '0.25rem', marginBottom: '1rem' }}>
        <Label required>Lieferant</Label>
        <Select onChange={(e: any) => setCardCode(e.detail.selectedOption.value)} style={{ width: '100%', marginTop: '0.25rem' }}>
          <Option value="">-- Lieferant auswählen --</Option>
          {(partners?.value ?? []).map((p: any) => (
            <Option key={p.CardCode} value={p.CardCode}>{p.CardCode} – {p.CardName}</Option>
          ))}
        </Select>
      </div>

      {/* Scan */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', background: 'var(--sapGroup_TitleBackground)', borderRadius: '0.25rem', marginBottom: '1rem' }}>
        <Label>Artikel scannen:</Label>
        <Input
          placeholder="Barcode / Artikelnummer"
          value={scanInput}
          onInput={(e: any) => setScanInput(e.target.value)}
          onKeyPress={(e: any) => { if (e.key === 'Enter') { handleScan(scanInput); setScanInput(''); } }}
          style={{ flex: 1 }}
          autoFocus
          disabled={!cardCode}
        />
        <Button icon="bar-code" onClick={() => { handleScan(scanInput); setScanInput(''); }} disabled={!cardCode}>Scan</Button>
      </div>

      <Table
        noDataText="Keine Artikel – bitte Lieferant wählen und scannen"
        columns={<><TableColumn>Artikel</TableColumn><TableColumn>Bezeichnung</TableColumn><TableColumn>Menge</TableColumn><TableColumn>Lager</TableColumn><TableColumn>Preis</TableColumn><TableColumn /></>}
      >
        {lines.map(line => (
          <TableRow key={line.itemCode}>
            <TableCell><strong>{line.itemCode}</strong></TableCell>
            <TableCell>{line.itemDescription}</TableCell>
            <TableCell>
              <StepInput min={1} value={line.quantity} onChange={(e: any) => setLines(prev => prev.map(l => l.itemCode === line.itemCode ? { ...l, quantity: Number(e.target.value) } : l))} />
            </TableCell>
            <TableCell>
              <Input value={line.warehouseCode} onInput={(e: any) => setLines(prev => prev.map(l => l.itemCode === line.itemCode ? { ...l, warehouseCode: e.target.value } : l))} style={{ width: 80 }} />
            </TableCell>
            <TableCell>
              <Input type="Number" value={String(line.unitPrice)} onInput={(e: any) => setLines(prev => prev.map(l => l.itemCode === line.itemCode ? { ...l, unitPrice: Number(e.target.value) } : l))} style={{ width: 100 }} />
            </TableCell>
            <TableCell>
              <Button design="Negative" icon="delete" onClick={() => setLines(p => p.filter(l => l.itemCode !== line.itemCode))} />
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}
