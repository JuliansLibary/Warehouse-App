import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { API_BASE } from '../services/api';

interface MutationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

type HttpMethod = 'POST' | 'PATCH' | 'DELETE';

export function useSapMutation() {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedTenantId, selectedInstanceId } = useSelector((s: RootState) => s.tenant);

  const mutate = useCallback(
    async <T = unknown>(
      endpoint: string,
      body: object,
      method: HttpMethod = 'PATCH'
    ): Promise<MutationResult<T>> => {
      if (!accessToken || !selectedTenantId) {
        return { success: false, error: 'Nicht authentifiziert' };
      }

      const sapRoute = method === 'PATCH' ? 'patch' : method === 'POST' ? 'post' : 'delete';

      try {
        const res = await fetch(`${API_BASE}/sap/${sapRoute}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'X-Tenant-Id': String(selectedTenantId),
            'X-Instance-Id': String(selectedInstanceId ?? ''),
          },
          body: JSON.stringify({ endpoint, body }),
        });

        if (!res.ok) {
          const text = await res.text();
          return { success: false, error: text };
        }

        const data = res.status === 204 ? undefined : await res.json();
        return { success: true, data };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
      }
    },
    [accessToken, selectedTenantId, selectedInstanceId]
  );

  return { mutate };
}
