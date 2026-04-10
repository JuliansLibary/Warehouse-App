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

interface TransferLine {
  itemCode: string;
  itemDescription: string;
  quantity: number;
  fromWarehouse: string;
  toWarehouse: string;
  binCode?: string;
}

export function InventoryTransferPage() {
  const { selectedTenantId, selectedInstanceId, selectedWarehouseCode } = useSelector((s: RootState) => s.tenant);
  const isOnline = useSelector((s: RootState) => s.offline.isOnline);

  const [fromWarehouse, setFromWarehouse] = useState(selectedWarehouseCode ?? '');
  const [toWarehouse, setToWarehouse] = useState('');
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'Positive' | 'Negative' | 'Information' | 'Warning' } | null>(null);

  const { data: warehouses, loading: warehousesLoading } = useSapQuery<{ value: any[] }>(
    'Warehouses?$select=WarehouseCode,WarehouseName',
    { enabled: !!selectedTenantId }
  );

  const { data: items } = useSapQuery<{ value: any[] }>(
    'Items?$select=ItemCode,ItemName,ManageSerialNumbers,ManageBatchNumbers&$filter=Frozen eq tNO',
    { enabled: !!selectedTenantId }
  );

  const { mutate } = useSapMutation();

  function handleScan(code: string) {
    if (!fromWarehouse || !toWarehouse) {
      setMessage({ text: 'Bitte Quell- und Ziellager wählen', type: 'Warning' });
      return;
    }

    const itemList = items?.value ?? [];
    const item = itemList.find((i: any) => i.ItemCode === code);

    if (!item) {
      setMessage({ text: `Artikel "${code}" nicht gefunden`, type: 'Negative' });
      return;
    }

    setLines(prev => {
      const existing = prev.find(l => l.itemCode === code);
      if (existing) {
        return prev.map(l => l.itemCode === code ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { itemCode: item.ItemCode, itemDescription: item.ItemName, quantity: 1, fromWarehouse, toWarehouse }];
    });

    setScanInput('');
    setMessage({ text: `${item.ItemCode} hinzugefügt`, type: 'Information' });
  }

  function removeLine(itemCode: string) {
    setLines(prev => prev.filter(l => l.itemCode !== itemCode));
  }

  async function handlePost() {
    if (lines.length === 0 || !fromWarehouse || !toWarehouse) {
      setMessage({ text: 'Bitte Lager und Artikel auswählen', type: 'Warning' });
      return;
    }

    const body = {
      FromWarehouse: fromWarehouse,
      ToWarehouse: toWarehouse,
      StockTransferLines: lines.map((l, idx) => ({
        LineNum: idx,
        ItemCode: l.itemCode,
        Quantity: l.quantity,
        FromWarehouseCode: l.fromWarehouse,
        WarehouseCode: l.toWarehouse,
      })),
    };

    if (!isOnline) {
      await enqueueOfflineAction({
        module: 'InventoryTransfer',
        actionType: 'POST',
        sapEndpoint: 'InventoryTransferRequests',
        payloadJson: JSON.stringify(body),
        tenantId: selectedTenantId!,
        instanceId: selectedInstanceId!,
        userId: '',
        createdAt: new Date().toISOString(),
      });
      setMessage({ text: 'Offline gespeichert – wird synchronisiert wenn online', type: 'Warning' });
      return;
    }

    const result = await mutate('InventoryTransferRequests', body, 'POST');
    if (result.success) {
      setMessage({ text: 'Umlagerungsanfrage erstellt', type: 'Positive' });
      setLines([]);
    } else {
      setMessage({ text: `Fehler: ${result.error}`, type: 'Negative' });
    }
  }

  if (warehousesLoading) return <BusyIndicator active text="Lager werden geladen..." style={{ margin: '2rem' }} />;

  const warehouseList = warehouses?.value ?? [];

  return (
    <div>
      <Toolbar>
        <Title level="H3">Bestandsumlagerung</Title>
        <ToolbarSpacer />
        <Button design="Emphasized" icon="save" onClick={handlePost} disabled={lines.length === 0}>
          Anfrage erstellen
        </Button>
      </Toolbar>

      {message && <MessageStrip design={message.type} onClose={() => setMessage(null)} style={{ marginBottom: '0.5rem' }}>{message.text}</MessageStrip>}

      {/* Warehouse Selection */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: 'var(--sapGroup_TitleBackground)', borderRadius: '0.25rem', marginBottom: '1rem' }}>
        <div>
          <Label required>Quelllager</Label>
          <Select onChange={(e: any) => setFromWarehouse(e.detail.selectedOption.value)} style={{ width: '100%' }}>
            <Option value="">-- Quelllager wählen --</Option>
            {warehouseList.map((w: any) => (
              <Option key={w.WarehouseCode} value={w.WarehouseCode} selected={w.WarehouseCode === fromWarehouse}>
                {w.WarehouseCode} – {w.WarehouseName}
              </Option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>Ziellager</Label>
          <Select onChange={(e: any) => setToWarehouse(e.detail.selectedOption.value)} style={{ width: '100%' }}>
            <Option value="">-- Ziellager wählen --</Option>
            {warehouseList.filter((w: any) => w.WarehouseCode !== fromWarehouse).map((w: any) => (
              <Option key={w.WarehouseCode} value={w.WarehouseCode} selected={w.WarehouseCode === toWarehouse}>
                {w.WarehouseCode} – {w.WarehouseName}
              </Option>
            ))}
          </Select>
        </div>
      </div>

      {/* Scan Input */}
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

      {/* Lines Table */}
      <Table
        noDataText="Keine Artikel – bitte scannen"
        columns={<><TableColumn>Artikel</TableColumn><TableColumn>Bezeichnung</TableColumn><TableColumn>Menge</TableColumn><TableColumn>Von</TableColumn><TableColumn>Nach</TableColumn><TableColumn /></>}
      >
        {lines.map(line => (
          <TableRow key={line.itemCode}>
            <TableCell><strong>{line.itemCode}</strong></TableCell>
            <TableCell>{line.itemDescription}</TableCell>
            <TableCell>
              <StepInput
                min={1}
                value={line.quantity}
                onChange={(e: any) => setLines(prev => prev.map(l => l.itemCode === line.itemCode ? { ...l, quantity: Number(e.target.value) } : l))}
              />
            </TableCell>
            <TableCell>{line.fromWarehouse}</TableCell>
            <TableCell>{line.toWarehouse}</TableCell>
            <TableCell>
              <Button design="Negative" icon="delete" onClick={() => removeLine(line.itemCode)} />
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}
