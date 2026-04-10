import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Title, Toolbar, ToolbarSpacer, Button, Label, Input,
  MessageStrip, BusyIndicator, Card, CardHeader, Table, TableColumn, TableRow, TableCell,
  Badge, Text, FlexBox, FlexBoxDirection,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { useSapQuery } from '../../shared/hooks/useSapQuery';

export function InfoPointPage() {
  const { selectedTenantId, selectedWarehouseCode } = useSelector((s: RootState) => s.tenant);

  const [searchCode, setSearchCode] = useState('');
  const [activeCode, setActiveCode] = useState('');
  const [mode, setMode] = useState<'item' | 'bin'>('item');

  const isItem = mode === 'item';

  const { data: itemData, loading: itemLoading, error: itemError } = useSapQuery<any>(
    `Items('${activeCode}')?$select=ItemCode,ItemName,ManageSerialNumbers,ManageBatchNumbers,QuantityOnStock,Frozen,DefaultWarehouse`,
    { enabled: !!activeCode && !!selectedTenantId && isItem }
  );

  const { data: stockData, loading: stockLoading } = useSapQuery<{ value: any[] }>(
    `Items('${activeCode}')/ItemWarehouseInfoCollection?$filter=InStock gt 0`,
    { enabled: !!activeCode && !!selectedTenantId && isItem }
  );

  const { data: binData, loading: binLoading, error: binError } = useSapQuery<any>(
    `BinLocations?$filter=BinCode eq '${activeCode}'&$expand=BinLocationAttributes`,
    { enabled: !!activeCode && !!selectedTenantId && !isItem }
  );

  const { data: serialData } = useSapQuery<{ value: any[] }>(
    `SerialNumbers?$filter=ItemCode eq '${activeCode}' and Status eq 'srInWarehouse'&$top=50`,
    { enabled: !!activeCode && !!selectedTenantId && isItem && itemData?.ManageSerialNumbers === 'tYES' }
  );

  function handleSearch() {
    if (searchCode.trim()) setActiveCode(searchCode.trim());
  }

  const loading = itemLoading || stockLoading || binLoading;

  return (
    <div>
      <Toolbar>
        <Title level="H3">InfoPoint</Title>
        <ToolbarSpacer />
        <Button
          design={mode === 'item' ? 'Emphasized' : 'Default'}
          onClick={() => { setMode('item'); setActiveCode(''); setSearchCode(''); }}
        >
          Artikel
        </Button>
        <Button
          design={mode === 'bin' ? 'Emphasized' : 'Default'}
          onClick={() => { setMode('bin'); setActiveCode(''); setSearchCode(''); }}
        >
          Lagerplatz
        </Button>
      </Toolbar>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', background: 'var(--sapGroup_TitleBackground)', borderRadius: '0.25rem', margin: '1rem 0' }}>
        <Label>{mode === 'item' ? 'Artikelnummer:' : 'Lagerplatz-Code:'}</Label>
        <Input
          placeholder={mode === 'item' ? 'Artikelnummer oder Barcode scannen' : 'Lagerplatz-Code scannen'}
          value={searchCode}
          onInput={(e: any) => setSearchCode(e.target.value)}
          onKeyPress={(e: any) => { if (e.key === 'Enter') handleSearch(); }}
          style={{ flex: 1 }}
          autoFocus
        />
        <Button icon="search" design="Emphasized" onClick={handleSearch}>Suchen</Button>
      </div>

      {loading && <BusyIndicator active text="Daten werden geladen..." style={{ margin: '2rem' }} />}

      {/* Item Info */}
      {isItem && itemData && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Item Card */}
          <Card header={<CardHeader titleText={itemData.ItemCode} subtitleText={itemData.ItemName} />}>
            <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <Label>Gesamtbestand</Label>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: itemData.QuantityOnStock > 0 ? 'var(--sapPositiveColor)' : 'var(--sapNegativeColor)' }}>
                  {itemData.QuantityOnStock ?? 0}
                </div>
              </div>
              <div>
                <Label>Seriennummern</Label>
                <Badge colorScheme={itemData.ManageSerialNumbers === 'tYES' ? '8' : '6'}>
                  {itemData.ManageSerialNumbers === 'tYES' ? 'Ja' : 'Nein'}
                </Badge>
              </div>
              <div>
                <Label>Chargen</Label>
                <Badge colorScheme={itemData.ManageBatchNumbers === 'tYES' ? '8' : '6'}>
                  {itemData.ManageBatchNumbers === 'tYES' ? 'Ja' : 'Nein'}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Stock by Warehouse */}
          {stockData?.value && stockData.value.length > 0 && (
            <Card header={<CardHeader titleText="Bestand nach Lager" />}>
              <Table columns={<><TableColumn>Lager</TableColumn><TableColumn>Bestand</TableColumn><TableColumn>Bestellt</TableColumn><TableColumn>Reserviert</TableColumn></>}>
                {stockData.value.map((w: any) => (
                  <TableRow key={w.WarehouseCode}>
                    <TableCell><strong>{w.WarehouseCode}</strong></TableCell>
                    <TableCell>{w.InStock}</TableCell>
                    <TableCell>{w.OnOrder ?? 0}</TableCell>
                    <TableCell>{w.IsCommited ?? 0}</TableCell>
                  </TableRow>
                ))}
              </Table>
            </Card>
          )}

          {/* Serial Numbers */}
          {serialData?.value && serialData.value.length > 0 && (
            <Card header={<CardHeader titleText="Seriennummern im Lager" />}>
              <Table columns={<><TableColumn>Seriennummer</TableColumn><TableColumn>Lager</TableColumn><TableColumn>Eingang</TableColumn></>}>
                {serialData.value.map((s: any) => (
                  <TableRow key={s.InternalSerialNumber}>
                    <TableCell>{s.InternalSerialNumber}</TableCell>
                    <TableCell>{s.WarehouseCode}</TableCell>
                    <TableCell>{s.MfrDate ? new Date(s.MfrDate).toLocaleDateString('de-DE') : '-'}</TableCell>
                  </TableRow>
                ))}
              </Table>
            </Card>
          )}
        </div>
      )}

      {isItem && itemError && !loading && (
        <MessageStrip design="Negative">Artikel nicht gefunden: {activeCode}</MessageStrip>
      )}

      {/* Bin Location Info */}
      {!isItem && binData && !loading && (
        <Card header={<CardHeader titleText={`Lagerplatz: ${activeCode}`} />}>
          <div style={{ padding: '1rem' }}>
            <Text>Lagerplatz-Details aus SAP werden angezeigt.</Text>
            <pre style={{ marginTop: '1rem', fontSize: '0.8rem', background: 'var(--sapBackgroundColor)', padding: '0.5rem', borderRadius: '0.25rem' }}>
              {JSON.stringify(binData, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {!isItem && binError && !loading && (
        <MessageStrip design="Negative">Lagerplatz nicht gefunden: {activeCode}</MessageStrip>
      )}

      {!activeCode && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--sapNeutralColor)' }}>
          <Text>Bitte {mode === 'item' ? 'Artikelnummer scannen oder eingeben' : 'Lagerplatz-Code scannen oder eingeben'}</Text>
        </div>
      )}
    </div>
  );
}
