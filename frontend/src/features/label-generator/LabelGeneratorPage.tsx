import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Title, Toolbar, ToolbarSpacer, Button, Label, Input, Select, Option,
  MessageStrip, TabContainer, Tab, Text,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { API_BASE } from '../../shared/services/api';

type LabelType = 'NVE' | 'QR' | 'Standard' | 'Warehouse';

interface LabelData {
  nve?: string;
  itemCode?: string;
  itemDescription?: string;
  quantity?: string;
  warehouseCode?: string;
  binCode?: string;
  batchNumber?: string;
  serialNumber?: string;
  custom?: string;
}

function generateNveLabel(nve: string): string {
  return `
    <div style="font-family: monospace; padding: 20px; border: 2px solid black; width: 400px;">
      <div style="text-align: center; font-size: 12px; margin-bottom: 8px;">NVE / SSCC-18</div>
      <div style="text-align: center; font-size: 8px; letter-spacing: 4px; font-family: 'Libre Barcode 128', monospace; font-size: 48px;">${nve}</div>
      <div style="text-align: center; font-size: 14px; margin-top: 8px; letter-spacing: 2px;">(00) ${nve.replace(/(\d{2})(\d{7})(\d{7})(\d{1})/, '$1 $2 $3 $4')}</div>
    </div>`;
}

function generateItemLabel(data: LabelData): string {
  return `
    <div style="font-family: Arial, sans-serif; padding: 16px; border: 1px solid black; width: 350px;">
      <div style="font-size: 18px; font-weight: bold;">${data.itemCode ?? ''}</div>
      <div style="font-size: 14px; margin: 4px 0;">${data.itemDescription ?? ''}</div>
      <div style="font-size: 12px; color: #666;">
        ${data.quantity ? `Menge: ${data.quantity}` : ''}
        ${data.batchNumber ? ` | Charge: ${data.batchNumber}` : ''}
        ${data.serialNumber ? ` | S/N: ${data.serialNumber}` : ''}
      </div>
      ${data.warehouseCode ? `<div style="font-size: 11px; margin-top: 4px;">Lager: ${data.warehouseCode}${data.binCode ? ' / ' + data.binCode : ''}</div>` : ''}
    </div>`;
}

function generateWarehouseLabel(data: LabelData): string {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 3px solid black; width: 300px; text-align: center;">
      <div style="font-size: 48px; font-weight: bold;">${data.warehouseCode ?? ''}</div>
      ${data.binCode ? `<div style="font-size: 24px; margin-top: 8px;">${data.binCode}</div>` : ''}
    </div>`;
}

function generateQrLabel(data: LabelData): string {
  const content = encodeURIComponent(data.custom ?? data.itemCode ?? '');
  return `
    <div style="font-family: Arial, sans-serif; padding: 16px; text-align: center; border: 1px solid black; width: 250px;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${content}" width="150" height="150" alt="QR" />
      <div style="font-size: 12px; margin-top: 8px;">${data.itemCode ?? data.custom ?? ''}</div>
    </div>`;
}

export function LabelGeneratorPage() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedTenantId } = useSelector((s: RootState) => s.tenant);

  const [labelType, setLabelType] = useState<LabelType>('Standard');
  const [labelData, setLabelData] = useState<LabelData>({});
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printers, setPrinters] = useState<any[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'Positive' | 'Negative' | 'Information' } | null>(null);
  const [copies, setCopies] = useState(1);

  // Load printers
  useState(() => {
    if (!accessToken || !selectedTenantId) return;
    fetch(`${API_BASE}/printers?tenantId=${selectedTenantId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(r => r.json()).then(data => {
      setPrinters(data ?? []);
      const def = data?.find((p: any) => p.isDefault);
      if (def) setSelectedPrinter(def.url);
    }).catch(() => {});
  });

  function getLabelHtml(): string {
    switch (labelType) {
      case 'NVE': return generateNveLabel(labelData.nve ?? '');
      case 'QR': return generateQrLabel(labelData);
      case 'Warehouse': return generateWarehouseLabel(labelData);
      default: return generateItemLabel(labelData);
    }
  }

  async function handlePrint() {
    if (!selectedPrinter) {
      setMessage({ text: 'Bitte Drucker auswählen', type: 'Negative' });
      return;
    }
    const html = getLabelHtml();
    try {
      for (let i = 0; i < copies; i++) {
        await fetch(selectedPrinter, {
          method: 'POST',
          headers: { 'Content-Type': 'text/html' },
          body: html,
        });
      }
      setMessage({ text: `${copies} Etikett(en) gedruckt`, type: 'Positive' });
    } catch {
      setMessage({ text: 'Druckfehler – Verbindung zum Drucker prüfen', type: 'Negative' });
    }
  }

  function handleBrowserPrint() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><body>${getLabelHtml()}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  const field = (label: string, key: keyof LabelData, placeholder?: string) => (
    <div style={{ marginBottom: '0.5rem' }}>
      <Label>{label}</Label>
      <Input
        value={(labelData[key] as string) ?? ''}
        onInput={(e: any) => setLabelData(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: '100%' }}
      />
    </div>
  );

  return (
    <div>
      <Toolbar>
        <Title level="H3">Etiketten-Generator</Title>
        <ToolbarSpacer />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Label>Kopien:</Label>
          <Input type="Number" value={String(copies)} onInput={(e: any) => setCopies(Math.max(1, Number(e.target.value)))} style={{ width: 60 }} />
          <Button icon="print" onClick={handleBrowserPrint}>Browser-Druck</Button>
          <Button design="Emphasized" icon="print" onClick={handlePrint} disabled={!selectedPrinter}>Drucker</Button>
        </div>
      </Toolbar>

      {message && <MessageStrip design={message.type} onClose={() => setMessage(null)} style={{ marginBottom: '0.5rem' }}>{message.text}</MessageStrip>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', padding: '0.5rem 0' }}>
        {/* Left: Form */}
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <Label>Etiketten-Typ</Label>
            <Select onChange={(e: any) => setLabelType(e.detail.selectedOption.value as LabelType)} style={{ width: '100%' }}>
              <Option value="Standard" selected={labelType === 'Standard'}>Standard-Artikel</Option>
              <Option value="NVE" selected={labelType === 'NVE'}>NVE / SSCC-18</Option>
              <Option value="QR" selected={labelType === 'QR'}>QR-Code</Option>
              <Option value="Warehouse" selected={labelType === 'Warehouse'}>Lagerort</Option>
            </Select>
          </div>

          {(labelType === 'Standard' || labelType === 'QR') && (
            <>
              {field('Artikelnummer', 'itemCode', 'z.B. A00001')}
              {field('Bezeichnung', 'itemDescription')}
              {field('Menge', 'quantity', 'z.B. 10 ST')}
              {field('Chargennummer', 'batchNumber')}
              {field('Seriennummer', 'serialNumber')}
            </>
          )}
          {labelType === 'NVE' && field('NVE (18-stellig)', 'nve', '00 1234567 0000001 5')}
          {labelType === 'Warehouse' && (
            <>
              {field('Lagercode', 'warehouseCode', 'z.B. WH01')}
              {field('Lagerplatz (Bin)', 'binCode', 'z.B. R01-S01-E01')}
            </>
          )}
          {labelType === 'QR' && field('Benutzerdefinierter Inhalt', 'custom')}

          {/* Printer selection */}
          <div style={{ marginTop: '1rem' }}>
            <Label>Drucker</Label>
            {printers.length > 0 ? (
              <Select onChange={(e: any) => setSelectedPrinter(e.detail.selectedOption.value)} style={{ width: '100%' }}>
                <Option value="">-- Drucker wählen --</Option>
                {printers.map((p: any) => <Option key={p.id} value={p.url}>{p.name}</Option>)}
              </Select>
            ) : (
              <Text style={{ color: 'var(--sapNeutralColor)' }}>Keine Drucker konfiguriert – Browser-Druck verfügbar</Text>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div>
          <Label>Vorschau</Label>
          <div
            style={{ marginTop: '0.25rem', padding: '1rem', border: '1px solid var(--sapNeutralBorderColor)', borderRadius: '0.25rem', minHeight: 200, background: '#fff' }}
            dangerouslySetInnerHTML={{ __html: getLabelHtml() }}
          />
        </div>
      </div>
    </div>
  );
}
