import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ShellBar,
  ShellBarItem,
  SideNavigation,
  SideNavigationItem,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { logout } from '../../features/launchpad/authSlice';
import { clearTenant } from '../../features/launchpad/tenantSlice';

const modules = [
  { path: '/launchpad',               icon: 'home',             text: 'Launchpad' },
  { path: '/pick',                    icon: 'checklist',        text: 'Kommissionierung' },
  { path: '/pack',                    icon: 'product',          text: 'Verpackung' },
  { path: '/inventory-count',         icon: 'activity-2',       text: 'Inventur' },
  { path: '/inventory-transfer',      icon: 'journey-change',   text: 'Bestandsumlagerung' },
  { path: '/stock-transfer',          icon: 'transfer',         text: 'Umlagerungsanfrage' },
  { path: '/purchase-delivery',       icon: 'cart-approval',    text: 'Wareneingang' },
  { path: '/purchase-delivery-adhoc', icon: 'add-product',      text: 'WE Adhoc' },
  { path: '/sales-delivery',          icon: 'shipping-status',  text: 'Warenausgang' },
  { path: '/label-generator',         icon: 'bar-code',         text: 'Etiketten' },
  { path: '/info-point',              icon: 'hint',             text: 'InfoPoint' },
  { path: '/admin',                   icon: 'settings',         text: 'Admin' },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { user } = useSelector((s: RootState) => s.auth);
  const { selectedTenantName, selectedWarehouseCode, selectedWarehouseName } = useSelector(
    (s: RootState) => s.tenant
  );
  const pendingCount = useSelector((s: RootState) => s.offline.pendingCount);

  function handleLogout() {
    dispatch(logout());
    dispatch(clearTenant());
    navigate('/login');
  }

  const initials = (user?.displayName ?? user?.username ?? 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const secondaryTitle = [selectedTenantName, selectedWarehouseCode ?? selectedWarehouseName]
    .filter(Boolean)
    .join(' · ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* ── Top Shell Bar ───────────────────────────────────────────────────── */}
      <ShellBar
        primaryTitle="Warehouse App"
        secondaryTitle={secondaryTitle}
        logo={
          <span style={{
            fontWeight: 700, fontSize: '1rem', color: 'var(--sapButton_Emphasized_TextColor)',
            letterSpacing: '0.05em', padding: '0 0.25rem',
          }}>
            WH
          </span>
        }
        profile={
          <ui5-avatar
            initials={initials}
            color-scheme="Accent6"
            style={{ cursor: 'pointer' }}
          />
        }
        onProfileClick={handleLogout}
        startButton={
          <ShellBarItem
            icon="menu2"
            text="Menu"
            onClick={() => setSidebarOpen(o => !o)}
          />
        }
      >
        {pendingCount > 0 && (
          <ShellBarItem
            icon="synchronize"
            text={`Sync (${pendingCount})`}
            count={String(pendingCount)}
          />
        )}
      </ShellBar>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ── Overlay for mobile sidebar ──────────────────────────────────── */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
              zIndex: 999, display: 'none',
            }}
            className="mobile-overlay"
          />
        )}

        {/* ── Side Navigation ─────────────────────────────────────────────── */}
        <div
          className={`wh-sidebar${sidebarOpen ? ' open' : ''}`}
          style={{
            width: 240,
            height: '100%',
            borderRight: '1px solid var(--sapList_BorderColor)',
            overflow: 'auto',
            flexShrink: 0,
          }}
        >
          <SideNavigation
            onSelectionChange={(e: any) => {
              const path = e.detail?.item?.dataset?.path;
              if (path) {
                navigate(path);
                setSidebarOpen(false); // auto-close on mobile
              }
            }}
          >
            {modules.map(m => (
              <SideNavigationItem
                key={m.path}
                icon={m.icon}
                text={m.text}
                data-path={m.path}
                selected={location.pathname.startsWith(m.path)}
              />
            ))}
          </SideNavigation>
        </div>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main
          className="wh-main-content"
          style={{ flex: 1, overflow: 'auto', padding: '1rem' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
