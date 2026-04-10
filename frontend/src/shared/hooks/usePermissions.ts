import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { API_BASE } from '../services/api';

interface PermissionResult {
  canView: boolean;
  canEdit: boolean;
  canBook: boolean;
}

const DEFAULT_PERMISSIONS: PermissionResult = { canView: true, canEdit: true, canBook: true };
const cache = new Map<string, PermissionResult>();

/**
 * Hook to check if the current user has specific permissions for a module.
 * Permissions are aggregated from the user's role + any group memberships.
 * Results are cached per module to avoid redundant network calls.
 *
 * Usage:
 * ```tsx
 * const { canBook, canEdit } = usePermissions('Pick');
 * <Button disabled={!canBook} onClick={handleSave}>Buchen</Button>
 * ```
 */
export function usePermissions(module: string): PermissionResult & { loading: boolean } {
  const { accessToken } = useSelector((s: RootState) => s.auth);
  const { selectedTenantId, selectedInstanceId } = useSelector((s: RootState) => s.tenant);

  const cacheKey = `${selectedTenantId}:${module}`;
  const [perms, setPerms] = useState<PermissionResult>(cache.get(cacheKey) ?? DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(!cache.has(cacheKey));

  useEffect(() => {
    if (!accessToken || !selectedTenantId) return;

    const cached = cache.get(cacheKey);
    if (cached) {
      setPerms(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`${API_BASE}/groups/my-permissions/${encodeURIComponent(module)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Tenant-Id': String(selectedTenantId),
        'X-Instance-Id': String(selectedInstanceId ?? ''),
      },
    })
      .then(r => r.ok ? r.json() : DEFAULT_PERMISSIONS)
      .then((data: PermissionResult) => {
        cache.set(cacheKey, data);
        setPerms(data);
      })
      .catch(() => setPerms(DEFAULT_PERMISSIONS))
      .finally(() => setLoading(false));
  }, [accessToken, selectedTenantId, module]);

  return { ...perms, loading };
}

/** Clear cached permissions (e.g. after group membership changes). */
export function clearPermissionCache() {
  cache.clear();
}
