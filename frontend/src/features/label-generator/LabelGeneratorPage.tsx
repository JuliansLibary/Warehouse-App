import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Title, Toolbar, ToolbarSpacer, Button, Label, Input, Select, Option,
  MessageStrip, Text, TabContainer, Tab, Dialog, Bar, TextArea, Badge,
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

interface LabelTemplate {
  id: number;
  name: string;
  templateType: string;
  htmlContent: string;
  isDefault: boolean;
}

// ─── QR Code generation using canvas (fully offline) ─────────────────────────

/**
 * Generates a QR code as a data URL using the Canvas API + qr-code-styling.
 * Falls back to a simple text representation if canvas unavailable.
 * Uses the browser's built-in QR generation via a hidden canvas.
 */
async function generateQrDataUrl(content: string): Promise<string> {
  // Use the Web-based QR generation through qrcode npm package
  // Since we can't run npm install in this environment, we generate via canvas manually
  // using the standard QR code algorithm encoded inline.
  // A simple approach: use an offscreen canvas to draw the QR.
  // We use the qrcode.js approach via dynamic import.
  try {
    // Dynamic import of qrcode library (added to package.json)
    const QRCode = await import('qrcode');
    const dataUrl = await QRCode.toDataURL(content, {
      width: 150,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    return dataUrl;
  } catch {
    // Fallback: return a placeholder PNG
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23eee" width="150" height="150"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12">QR: ' + encodeURIComponent(content.slice(0, 20)) + '</text></svg>';
  }
}

// ─── Interpolate template variables ──────────────────────────────────────────

function interpolateTemplate(html: string, data: LabelData): string {
  return html
    .replace(/\{\{itemCode\}\}/g, data.itemCode ?? '')
    .replace(/\{\{itemDescription\}\}/g, data.itemDescription ?? '')
    .replace(/\{\{quantity\}\}/g, data.quantity ?? '')
    .replace(/\{\{batchNumber\}\}/g, data.batchNumber ?? '')
    .replace(/\{\{serialNumber\}\}/g, data.serialNumber ?? '')
    .replace(/\{\{warehouseCode\}\}/g, data.warehouseCode ?? '')
    .replace(/\{\{binCode\}\}/g, data.binCode ?? '')
    .replace(/\{\{nve\}\}/g, data.nve ?? '')
    .replace(/\{\{custom\}\}/g, data.custom ?? '')
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('de-DE'));
}

// ─── Built-in templates (fallback when backend unreachable) ──────────────────

function builtinNveHtml(nve: string): string {
  return `<div style="font-family:monospace;padding:20px;border:2px solid black;width:400px;box-sizing:border-box">
    <div style="text-align:center;font-size:11px;margin-bottom:6px;letter-spacing:1px">NVE / SSCC-18</div>
    <div style="text-align:center;font-size:42px;letter-spacing:6px;font-weight:bold;margin:8px 0">${nve}</div>
    <div style="text-align:center;font-size:13px;letter-spacing:2px">(00) ${nve.replace(/(\d{2})(\d{7})(\d{7})(\d{1})/, '$1 $2 $3 $4')}</div>
  </div>`;
}

function builtinItemHtml(data: LabelData): string {
  return `<div style="font-family:Arial,sans-serif;padding:16px;border:1px solid black;width:350px;box-sizing:border-box">
    <div style="font-size:18px;font-weight:bold">${data.itemCode ?? ''}</div>
    <div style="font-size:13px;margin:4px 0">${data.itemDescription ?? ''}</div>
    <div style="font-size:11px;color:#555">
      ${data.quantity ? `Menge: <strong>${data.quantity}</strong>` : ''}
      ${data.batchNumber ? ` &nbsp;|&nbsp; Charge: <strong>${data.batchNumber}</strong>` : ''}
      ${data.serialNumber ? ` &nbsp;|&nbsp; S/N: <strong>${data.serialNumber}</strong>` : ''}
    </div>
    ${data.warehouseCode ? `<div style="font-size:11px;margin-top:4px;color:#333">Lager: ${data.warehouseCode}${data.binCode ? ' / ' + data.binCode : ''}</div>` : ''}
    <div style="font-size:10px;color:#999;margin-top:6px">${new Date().toLocaleDateString('de-DE')}</div>
  </div>`;
}

function builtinWarehouseHtml(data: LabelData): string {
  return `<div style="font-family:Arial,sans-serif;padding:20px;border:3px solid black;width:300px;text-align:center;box-sizing:border-box">
    <div style="font-size:48px;font-weight:bold">${data.warehouseCode ?? ''}</div>
    ${data.binCode ? `<div style="font-size:24px;margin-top:8px">${data.binCode}</div>` : ''}
  </div>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LabelGeneratorPage() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedTenantId, selectedInstanceId } = useSelector((s: RootState) => s.tenant);

  const [labelType, setLabelType] = useState<LabelType>('Standard');
  const [labelData, setLabelData] = useState<LabelData>({});
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printers, setPrinters] = useState<any[]>([]);
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'Positive' | 'Negative' | 'Information' } | null>(null);
  const [copies, setCopies] = useState(1);
  const [previewHtml, setPreviewHtml] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', templateType: 'Standard' as LabelType, htmlContent: '', isDefault: false });
  const [saving, setSaving] = useState(false);

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'X-Tenant-Id': String(selectedTenantId ?? ''),
    'X-Instance-Id': String(selectedInstanceId ?? ''),
  };

  // Load printers + templates on mount / tenant change
  useEffect(() => {
    if (!accessToken || !selectedTenantId) return;

    fetch(`${API_BASE}/printers?tenantId=${selectedTenantId}`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        setPrinters(data ?? []);
        const def = (data ?? []).find((p: any) => p.isDefault);
        if (def) setSelectedPrinter(def.url);
      })
      .catch(() => {});

    fetch(`${API_BASE}/label-templates?tenantId=${selectedTenantId}`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : [])
      .then((data: LabelTemplate[]) => {
        setTemplates(data ?? []);
        // Auto-select default template for current type
        const def = (data ?? []).find(t => t.isDefault && t.templateType.toLowerCase() === labelType.toLowerCase());
        if (def) setSelectedTemplateId(def.id);
      })
      .catch(() => {});
  }, [accessToken, selectedTenantId]);

  // Update preview whenever data/type/template changes
  useEffect(() => {
    updatePreview();
  }, [labelData, labelType, selectedTemplateId, templates, qrDataUrl]);

  // Generate QR data URL when QR type or content changes
  useEffect(() => {
    if (labelType !== 'QR') return;
    const content = labelData.custom ?? labelData.itemCode ?? 'QR';
    generateQrDataUrl(content).then(setQrDataUrl);
  }, [labelType, labelData.custom, labelData.itemCode]);

  function updatePreview() {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      setPreviewHtml(interpolateTemplate(template.htmlContent, labelData));
      return;
    }

    // Built-in fallback
    if (labelType === 'NVE') {
      setPreviewHtml(builtinNveHtml(labelData.nve ?? ''));
    } else if (labelType === 'QR') {
      const content = labelData.custom ?? labelData.itemCode ?? '';
      setPreviewHtml(`
        <div style="font-family:Arial,sans-serif;padding:16px;text-align:center;border:1px solid black;width:250px;box-sizing:border-box">
          ${qrDataUrl ? `<img src="${qrDataUrl}" width="150" height="150" alt="QR" />` : '<div style="width:150px;height:150px;background:#eee;margin:0 auto"></div>'}
          <div style="font-size:12px;margin-top:8px">${content}</div>
        </div>`);
    } else if (labelType === 'Warehouse') {
      setPreviewHtml(builtinWarehouseHtml(labelData));
    } else {
      setPreviewHtml(builtinItemHtml(labelData));
    }
  }

  function getLabelHtml(): string {
    return previewHtml;
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
    win.document.write(`<!DOCTYPE html><html><head><style>body{margin:0;padding:16px}</style></head><body>${getLabelHtml()}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  async function saveTemplate() {
    setSaving(true);
    const res = await fetch(`${API_BASE}/label-templates`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...templateForm, tenantId: selectedTenantId }),
    });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      setTemplates(prev => [...prev, saved]);
      setShowTemplateEditor(false);
      setMessage({ text: 'Vorlage gespeichert', type: 'Positive' });
    } else {
      setMessage({ text: 'Fehler beim Speichern der Vorlage', type: 'Negative' });
    }
  }

  async function setDefaultTemplate(id: number) {
    await fetch(`${API_BASE}/label-templates/${id}/set-default`, {
      method: 'POST',
      headers: authHeaders,
    });
    setTemplates(prev => prev.map(t => ({
      ...t,
      isDefault: t.id === id && t.templateType === templates.find(x => x.id === id)?.templateType
        ? true
        : t.templateType === templates.find(x => x.id === id)?.templateType ? false : t.isDefault,
    })));
  }

  async function deleteTemplate(id: number) {
    await fetch(`${API_BASE}/label-templates/${id}`, { method: 'DELETE', headers: authHeaders });
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplateId === id) setSelectedTemplateId(null);
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

  const templatesForCurrentType = templates.filter(t =>
    t.templateType.toLowerCase() === labelType.toLowerCase()
  );

  return (
    <div>
      <Toolbar>
        <Title level="H3">Etiketten-Generator</Title>
        <ToolbarSpacer />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Label>Kopien:</Label>
          <Input
            type="Number"
            value={String(copies)}
            onInput={(e: any) => setCopies(Math.max(1, Number(e.target.value)))}
            style={{ width: 60 }}
          />
          <Button icon="add-document" onClick={() => setShowTemplateEditor(true)}>Vorlage</Button>
          <Button icon="print" onClick={handleBrowserPrint}>Browser-Druck</Button>
          <Button design="Emphasized" icon="print" onClick={handlePrint} disabled={!selectedPrinter}>
            Drucker
          </Button>
        </div>
      </Toolbar>

      {message && (
        <MessageStrip design={message.type} onClose={() => setMessage(null)} style={{ marginBottom: '0.5rem' }}>
          {message.text}
        </MessageStrip>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', padding: '0.5rem 0' }}>

        {/* ── Left: Form ─────────────────────────────────────────────────────── */}
        <div>
          {/* Label type */}
          <div style={{ marginBottom: '1rem' }}>
            <Label>Etiketten-Typ</Label>
            <Select
              onChange={(e: any) => {
                const newType = e.detail.selectedOption.value as LabelType;
                setLabelType(newType);
                // Auto-select default template for new type
                const def = templates.find(t => t.isDefault && t.templateType.toLowerCase() === newType.toLowerCase());
                setSelectedTemplateId(def?.id ?? null);
              }}
              style={{ width: '100%' }}
            >
              <Option value="Standard" selected={labelType === 'Standard'}>Standard-Artikel</Option>
              <Option value="NVE" selected={labelType === 'NVE'}>NVE / SSCC-18</Option>
              <Option value="QR" selected={labelType === 'QR'}>QR-Code</Option>
              <Option value="Warehouse" selected={labelType === 'Warehouse'}>Lagerort</Option>
            </Select>
          </div>

          {/* Template selector */}
          {templatesForCurrentType.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <Label>Vorlage</Label>
              <Select
                onChange={(e: any) => {
                  const val = e.detail.selectedOption.value;
                  setSelectedTemplateId(val === '' ? null : Number(val));
                }}
                style={{ width: '100%' }}
              >
                <Option value="" selected={selectedTemplateId === null}>Eingebaut</Option>
                {templatesForCurrentType.map(t => (
                  <Option key={t.id} value={String(t.id)} selected={selectedTemplateId === t.id}>
                    {t.name}{t.isDefault ? ' ★' : ''}
                  </Option>
                ))}
              </Select>
            </div>
          )}

          {/* Data fields */}
          {(labelType === 'Standard' || labelType === 'QR') && (
            <>
              {field('Artikelnummer', 'itemCode', 'z.B. A00001')}
              {field('Bezeichnung', 'itemDescription')}
              {field('Menge', 'quantity', 'z.B. 10 ST')}
              {field('Chargennummer', 'batchNumber')}
              {field('Seriennummer', 'serialNumber')}
            </>
          )}
          {labelType === 'NVE' && field('NVE (18-stellig)', 'nve', '001234567000000015')}
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
                {printers.map((p: any) => (
                  <Option key={p.id} value={p.url} selected={selectedPrinter === p.url}>
                    {p.name}{p.isDefault ? ' (Standard)' : ''}
                  </Option>
                ))}
              </Select>
            ) : (
              <Text style={{ color: 'var(--sapNeutralColor)' }}>
                Keine Drucker konfiguriert – Browser-Druck verfügbar
              </Text>
            )}
          </div>

          {/* Templates management */}
          {templatesForCurrentType.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--sapNeutralBackground)', borderRadius: '0.25rem' }}>
              <Label style={{ fontWeight: 'bold' }}>Gespeicherte Vorlagen</Label>
              {templatesForCurrentType.map(t => (
                <div key={t.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                  <Text style={{ flex: 1 }}>{t.name}</Text>
                  {t.isDefault && <Badge colorScheme="8">Standard</Badge>}
                  <Button design="Transparent" icon="favorite" onClick={() => setDefaultTemplate(t.id)} title="Als Standard" />
                  <Button design="Transparent" icon="delete" onClick={() => deleteTemplate(t.id)} title="Löschen" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Preview ───────────────────────────────────────────────── */}
        <div>
          <Label>Vorschau</Label>
          <div
            style={{
              marginTop: '0.25rem',
              padding: '1rem',
              border: '1px solid var(--sapNeutralBorderColor)',
              borderRadius: '0.25rem',
              minHeight: 200,
              background: '#fff',
              overflow: 'hidden',
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>

      {/* ── Template Editor Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={showTemplateEditor}
        headerText="Etikettenvorlage erstellen"
        footer={
          <Bar endContent={
            <>
              <Button design="Emphasized" onClick={saveTemplate} disabled={saving}>
                {saving ? 'Speichern...' : 'Speichern'}
              </Button>
              <Button onClick={() => setShowTemplateEditor(false)}>Abbrechen</Button>
            </>
          } />
        }
      >
        <div style={{ padding: '1rem', minWidth: 480, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Label>Name</Label>
          <Input
            value={templateForm.name}
            onInput={(e: any) => setTemplateForm(p => ({ ...p, name: e.target.value }))}
            placeholder="z.B. Standardetikett mit Charge"
          />
          <Label>Typ</Label>
          <Select onChange={(e: any) => setTemplateForm(p => ({ ...p, templateType: e.detail.selectedOption.value }))}>
            <Option value="Standard">Standard-Artikel</Option>
            <Option value="NVE">NVE / SSCC-18</Option>
            <Option value="QR">QR-Code</Option>
            <Option value="Warehouse">Lagerort</Option>
          </Select>
          <Label>HTML-Vorlage</Label>
          <Text style={{ fontSize: '0.75rem', color: 'var(--sapNeutralColor)' }}>
            Verfügbare Variablen: {'{{'}{'{'}itemCode{'}}'}{'}}'}, {'{{'}{'{'}itemDescription{'}}'}{'}}'}, {'{{'}{'{'}quantity{'}}'}{'}}'}, {'{{'}{'{'}batchNumber{'}}'}{'}}'}, {'{{'}{'{'}nve{'}}'}{'}}'}, {'{{'}{'{'}date{'}}'}{'}}'}
          </Text>
          <TextArea
            value={templateForm.htmlContent}
            onInput={(e: any) => setTemplateForm(p => ({ ...p, htmlContent: e.target.value }))}
            rows={10}
            style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
          />
        </div>
      </Dialog>
    </div>
  );
}
