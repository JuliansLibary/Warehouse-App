import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import {
  Title, Table, TableColumn, TableRow, TableCell,
  Button, ProgressIndicator, Badge, MessageStrip,
  BusyIndicator, Toolbar, ToolbarSpacer, SearchField,
} from '@ui5/webcomponents-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { useSapQuery } from '../../shared/hooks/useSapQuery';
import { PickDetailPage } from './PickDetailPage';

interface PickList {
  AbsoluteEntry: number;
  PickDate: string;
  OwnerCode: string;
  PickListsLines: PickLine[];
}

interface PickLine {
  AbsoluteEntry: number;
  LineNumber: number;
  ReleasedQuantity: number;
  PickedQuantity: number;
  PickStatus: string;
  BaseObjectType: number;
}

export function PickPage() {
  return (
    <Routes>
      <Route index element={<PickListsView />} />
      <Route path=":pickListId" element={<PickDetailPage />} />
    </Routes>
  );
}

function PickListsView() {
  const [search, setSearch] = useState('');
  const { selectedTenantId } = useSelector((s: RootState) => s.tenant);

  const { data: pickLists, loading, error, refetch } = useSapQuery<{ value: PickList[] }>(
    `PickLists?$filter=PickStatus ne 'cpsC'&$orderby=PickDate desc`,
    { enabled: !!selectedTenantId }
  );

  const filtered = (pickLists?.value ?? []).filter(pl =>
    !search || String(pl.AbsoluteEntry).includes(search) || pl.OwnerCode?.includes(search)
  );

  function getStatusBadge(lines: PickLine[]) {
    const total = lines.reduce((s, l) => s + l.ReleasedQuantity, 0);
    const picked = lines.reduce((s, l) => s + l.PickedQuantity, 0);
    const pct = total > 0 ? Math.round((picked / total) * 100) : 0;
    if (pct === 0) return <Badge colorScheme="6">Offen</Badge>;
    if (pct === 100) return <Badge colorScheme="8">Fertig</Badge>;
    return <Badge colorScheme="2">In Bearbeitung ({pct}%)</Badge>;
  }

  return (
    <div>
      <Toolbar>
        <Title level="H3">Kommissionierung</Title>
        <ToolbarSpacer />
        <SearchField
          placeholder="Suchen..."
          value={search}
          onInput={(e: any) => setSearch(e.target.value)}
          style={{ width: 200 }}
        />
        <Button icon="refresh" onClick={refetch}>Aktualisieren</Button>
      </Toolbar>

      {error && <MessageStrip design="Negative">{error}</MessageStrip>}

      {loading ? (
        <BusyIndicator active text="Picklisten werden geladen..." style={{ marginTop: '2rem' }} />
      ) : (
        <Table
          columns={
            <>
              <TableColumn>Picklisten-Nr.</TableColumn>
              <TableColumn>Datum</TableColumn>
              <TableColumn>Bearbeiter</TableColumn>
              <TableColumn>Fortschritt</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn />
            </>
          }
          noDataText="Keine Picklisten vorhanden"
        >
          {filtered.map(pl => {
            const total = pl.PickListsLines?.reduce((s, l) => s + l.ReleasedQuantity, 0) ?? 0;
            const picked = pl.PickListsLines?.reduce((s, l) => s + l.PickedQuantity, 0) ?? 0;
            const pct = total > 0 ? Math.round((picked / total) * 100) : 0;

            return (
              <TableRow key={pl.AbsoluteEntry}>
                <TableCell><strong>{pl.AbsoluteEntry}</strong></TableCell>
                <TableCell>{pl.PickDate ? new Date(pl.PickDate).toLocaleDateString('de-DE') : '-'}</TableCell>
                <TableCell>{pl.OwnerCode ?? '-'}</TableCell>
                <TableCell>
                  <ProgressIndicator
                    value={pct}
                    valueState={pct === 100 ? 'Positive' : pct > 0 ? 'Information' : 'None'}
                    displayValue={`${pct}%`}
                    style={{ minWidth: 150 }}
                  />
                </TableCell>
                <TableCell>{getStatusBadge(pl.PickListsLines ?? [])}</TableCell>
                <TableCell>
                  <Button
                    design="Transparent"
                    icon="navigation-right-arrow"
                    href={`/pick/${pl.AbsoluteEntry}`}
                  >
                    Öffnen
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </Table>
      )}
    </div>
  );
}
