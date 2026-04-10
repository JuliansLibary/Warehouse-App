import { useEffect } from 'react';
import { MessageStrip } from '@ui5/webcomponents-react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { setOnlineStatus, setSyncInProgress, setSyncComplete } from '../../offline/offlineSlice';
import { getPendingActions, offlineDb } from '../../offline/offlineDb';
import { API_BASE } from '../services/api';

export function OfflineBanner() {
  const dispatch = useDispatch();
  const { isOnline, pendingCount, syncInProgress, syncErrors } = useSelector((s: RootState) => s.offline);
  const { selectedTenantId, selectedInstanceId } = useSelector((s: RootState) => s.tenant);
  const { accessToken } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    const handleOnline = () => {
      dispatch(setOnlineStatus(true));
      triggerSync();
    };
    const handleOffline = () => dispatch(setOnlineStatus(false));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen to service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'TRIGGER_SYNC') triggerSync();
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedTenantId, selectedInstanceId, accessToken]);

  async function triggerSync() {
    if (!selectedTenantId || !selectedInstanceId || !accessToken) return;

    const pending = await getPendingActions(selectedTenantId);
    if (pending.length === 0) return;

    dispatch(setSyncInProgress(true));
    const errors: string[] = [];

    for (const action of pending) {
      try {
        await offlineDb.offlineActions.update(action.id!, { status: 'syncing' });

        const response = await fetch(`${API_BASE}/offline-sync/enqueue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Tenant-Id': String(selectedTenantId),
            'X-Instance-Id': String(selectedInstanceId),
          },
          body: JSON.stringify({
            Module: action.module,
            ActionType: action.actionType,
            SapEndpoint: action.sapEndpoint,
            PayloadJson: action.payloadJson,
          }),
        });

        if (response.ok) {
          await offlineDb.offlineActions.update(action.id!, { status: 'done' });
        } else {
          const err = await response.text();
          errors.push(`${action.module}: ${err}`);
          await offlineDb.offlineActions.update(action.id!, {
            status: 'failed', errorMessage: err, retryCount: (action.retryCount || 0) + 1
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${action.module}: ${msg}`);
        await offlineDb.offlineActions.update(action.id!, { status: 'failed', errorMessage: msg });
      }
    }

    dispatch(setSyncComplete({ errors }));
  }

  if (isOnline && pendingCount === 0 && !syncInProgress) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
      {!isOnline && (
        <MessageStrip
          design="Warning"
          hideCloseButton
          style={{ borderRadius: 0 }}
        >
          Sie sind offline. Ihre Eingaben werden gespeichert und automatisch synchronisiert, sobald Sie wieder online sind.
        </MessageStrip>
      )}
      {isOnline && syncInProgress && (
        <MessageStrip design="Information" hideCloseButton style={{ borderRadius: 0 }}>
          Synchronisierung läuft... ({pendingCount} Aktionen ausstehend)
        </MessageStrip>
      )}
      {isOnline && !syncInProgress && syncErrors.length > 0 && (
        <MessageStrip design="Negative" style={{ borderRadius: 0 }}>
          {syncErrors.length} Aktion(en) konnten nicht synchronisiert werden. Bitte prüfen Sie die Details.
        </MessageStrip>
      )}
    </div>
  );
}
