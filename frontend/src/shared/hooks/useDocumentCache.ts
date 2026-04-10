import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { API_BASE } from '../services/api';

interface CacheEntry {
  Id: number;
  DocumentNumber: number;
  Module: string;
  ContentJson: string;
  UpdatedAt: string;
}

export function useDocumentCache(documentNumber: number, module: string, tenantId: number) {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedInstanceId } = useSelector((s: RootState) => s.tenant);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'X-Tenant-Id': String(tenantId),
    'X-Instance-Id': String(selectedInstanceId ?? ''),
  };

  const loadCache = useCallback(async (): Promise<CacheEntry | null> => {
    if (!accessToken || !documentNumber) return null;
    try {
      const res = await fetch(
        `${API_BASE}/cache/check/${documentNumber}/${module}/${tenantId}`,
        { headers }
      );
      // 209 = not found (legacy compatibility)
      if (res.status === 209 || !res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, [accessToken, documentNumber, module, tenantId]);

  const saveCache = useCallback(async (contentJson: string): Promise<void> => {
    if (!accessToken || !documentNumber) return;
    try {
      await fetch(`${API_BASE}/cache/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ documentNumber, module, tenantId, contentJson }),
      });
    } catch {
      // ignore save errors – non-critical
    }
  }, [accessToken, documentNumber, module, tenantId]);

  const deleteCache = useCallback(async (cacheId: number): Promise<void> => {
    if (!accessToken) return;
    try {
      await fetch(`${API_BASE}/cache/${cacheId}`, {
        method: 'DELETE',
        headers,
      });
    } catch {
      // ignore
    }
  }, [accessToken]);

  return { loadCache, saveCache, deleteCache };
}
