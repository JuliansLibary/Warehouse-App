import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../app/store';
import { API_BASE } from '../../../shared/services/api';

interface Tenant {
  Id: number;
  Name: string;
  CompanyDb: string;
  IsValidated: boolean;
  InstanceId: number;
  InstanceName: string;
}

export function useTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    async function load() {
      if (!accessToken) return;
      try {
        const res = await fetch(`${API_BASE}/tenants`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error('Fehler beim Laden der Mandanten');
        const data = await res.json();
        setTenants(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [accessToken]);

  return { tenants, loading, error };
}
