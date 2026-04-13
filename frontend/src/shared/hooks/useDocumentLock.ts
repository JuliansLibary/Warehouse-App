import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { API_BASE } from '../services/api';

export function useDocumentLock(documentNumber: number, module: string, tenantId: number) {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedInstanceId } = useSelector((s: RootState) => s.tenant);
  const [lockError, setLockError] = useState<string | null>(null);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'X-Tenant-Id': String(tenantId),
    'X-Instance-Id': String(selectedInstanceId ?? ''),
  };

  const acquireLock = useCallback(async () => {
    if (!accessToken || !documentNumber) return;
    try {
      const res = await fetch(`${API_BASE}/document-lock/acquire`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ documentNumber, module, tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLockError(data.message ?? 'Dokument ist gesperrt');
      } else {
        setLockError(null);
      }
    } catch {
      setLockError('Verbindungsfehler beim Sperren');
    }
  }, [accessToken, documentNumber, module, tenantId]);

  const releaseLock = useCallback(async () => {
    if (!accessToken || !documentNumber) return;
    try {
      await fetch(`${API_BASE}/document-lock/release`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ documentNumber, module, tenantId }),
      });
    } catch {
      // ignore release errors
    }
  }, [accessToken, documentNumber, module, tenantId]);

  const refreshLock = useCallback(async () => {
    if (!accessToken || !documentNumber) return;
    try {
      await fetch(`${API_BASE}/document-lock/refresh`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ documentNumber, module, tenantId }),
      });
    } catch {
      // ignore
    }
  }, [accessToken, documentNumber, module, tenantId]);

  return { acquireLock, releaseLock, refreshLock, lockError };
}
