import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { API_BASE } from '../services/api';

interface UseSapQueryOptions {
  enabled?: boolean;
}

interface UseSapQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSapQuery<T>(
  endpoint: string,
  options: UseSapQueryOptions = {}
): UseSapQueryResult<T> {
  const { enabled = true } = options;
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedTenantId, selectedInstanceId } = useSelector((s: RootState) => s.tenant);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger(t => t + 1), []);

  useEffect(() => {
    if (!enabled || !accessToken || !selectedTenantId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ endpoint });
    fetch(`${API_BASE}/sap/query?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Tenant-Id': String(selectedTenantId),
        'X-Instance-Id': String(selectedInstanceId ?? ''),
      },
    })
      .then(res => {
        if (!res.ok) return res.text().then(t => Promise.reject(t));
        return res.json();
      })
      .then(json => {
        if (!cancelled) setData(json);
      })
      .catch(err => {
        if (!cancelled) setError(typeof err === 'string' ? err : 'SAP-Anfrage fehlgeschlagen');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [endpoint, enabled, accessToken, selectedTenantId, selectedInstanceId, trigger]);

  return { data, loading, error, refetch };
}
