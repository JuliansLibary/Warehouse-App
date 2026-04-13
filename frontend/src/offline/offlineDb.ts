import Dexie, { Table } from 'dexie';

export interface OfflineAction {
  id?: number;
  module: string;
  actionType: string;
  sapEndpoint: string;
  payloadJson: string;
  tenantId: number;
  instanceId: number;
  userId: string;
  createdAt: string;
  status: 'pending' | 'syncing' | 'done' | 'failed';
  errorMessage?: string;
  retryCount: number;
}

export interface DraftDocument {
  id?: number;
  documentNumber: number;
  module: string;
  tenantId: number;
  contentJson: string;
  updatedAt: string;
}

class WarehouseOfflineDb extends Dexie {
  offlineActions!: Table<OfflineAction>;
  draftDocuments!: Table<DraftDocument>;

  constructor() {
    super('WarehouseAppOfflineDb');
    this.version(1).stores({
      offlineActions: '++id, module, status, tenantId, createdAt',
      draftDocuments: '++id, documentNumber, module, tenantId, updatedAt',
    });
  }
}

export const offlineDb = new WarehouseOfflineDb();

// Helper functions
export async function enqueueOfflineAction(action: Omit<OfflineAction, 'id' | 'status' | 'retryCount'>) {
  return offlineDb.offlineActions.add({
    ...action,
    status: 'pending',
    retryCount: 0,
  });
}

export async function getPendingActions(tenantId: number): Promise<OfflineAction[]> {
  return offlineDb.offlineActions
    .where('status').equals('pending')
    .and(a => a.tenantId === tenantId)
    .sortBy('createdAt');
}

export async function saveDraft(doc: Omit<DraftDocument, 'id'>) {
  const existing = await offlineDb.draftDocuments
    .where({ documentNumber: doc.documentNumber, module: doc.module, tenantId: doc.tenantId })
    .first();

  if (existing?.id) {
    await offlineDb.draftDocuments.update(existing.id, { contentJson: doc.contentJson, updatedAt: doc.updatedAt });
    return existing.id;
  }
  return offlineDb.draftDocuments.add(doc);
}

export async function getDraft(documentNumber: number, module: string, tenantId: number) {
  return offlineDb.draftDocuments
    .where({ documentNumber, module, tenantId })
    .first();
}
