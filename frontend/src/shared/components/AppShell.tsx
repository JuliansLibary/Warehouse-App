import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  ShellBar,
  ShellBarItem,
  SideNavigation,
  SideNavigationItem,
  Popover,
  List,
  ListItemStandard,
} from '@ui5/webcomponents-react';
import { RootState } from '../../app/store';
import { logout } from '../../features/launchpad/authSlice';
import { clearTenant } from '../../features/launchpad/tenantSlice';

const LANGUAGES = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'cs', label: 'Čeština', flag: '🇨🇿' },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langPopoverOpen, setLangPopoverOpen] = useState(false);
  const langButtonRef = useState<HTMLElement | null>(null);

  const { user } = useSelector((s: RootState) => s.auth);
  const { selectedTenantName, selectedWarehouseCode, selectedWarehouseName } = useSelector(
    (s: RootState) => s.tenant
  );
  const pendingCount = useSelector((s: RootState) => s.offline.pendingCount);

  const modules = [
    { path: '/launchpad',               icon: 'home',             text: t('nav.launchpad') },
    { path: '/pick',                    icon: 'checklist',        text: t('nav.pick') },
    { path: '/pack',                    icon: 'product',          text: t('nav.pack') },
    { path: '/inventory-count',         icon: 'activity-2',       text: t('nav.inventoryCount') },
    { path: '/inventory-transfer',      icon: 'journey-change',   text: t('nav.inventoryTransfer') },
    { path: '/stock-transfer',          icon: 'transfer',         text: t('nav.stockTransfer') },
    { path: '/purchase-delivery',       icon: 'cart-approval',    text: t('nav.purchaseDelivery') },
    { path: '/purchase-delivery-adhoc', icon: 'add-product',      text: t('nav.purchaseDeliveryAdhoc') },
    { path: '/sales-delivery',          icon: 'shipping-status',  text: t('nav.salesDelivery') },
    { path: '/label-generator',         icon: 'bar-code',         text: t('nav.labelGenerator') },
    { path: '/info-point',              icon: 'hint',             text: t('nav.infoPoint') },
    { path: '/admin',                   icon: 'settings',         text: t('nav.admin') },
  ];

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

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

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
        {/* Language switcher */}
        <ShellBarItem
          id="lang-switcher-btn"
          icon="globe"
          text={currentLang.code.toUpperCase()}
          onClick={() => setLangPopoverOpen(o => !o)}
        />
        {pendingCount > 0 && (
          <ShellBarItem
            icon="synchronize"
            text={`Sync (${pendingCount})`}
            count={String(pendingCount)}
          />
        )}
      </ShellBar>

      {/* Language Popover */}
      <Popover
        opener="lang-switcher-btn"
        open={langPopoverOpen}
        onClose={() => setLangPopoverOpen(false)}
        placementType="Bottom"
      >
        <List onItemClick={(e: any) => {
          const code = e.detail?.item?.dataset?.lang;
          if (code) {
            i18n.changeLanguage(code);
            localStorage.setItem('wh-language', code);
          }
          setLangPopoverOpen(false);
        }}>
          {LANGUAGES.map(lang => (
            <ListItemStandard
              key={lang.code}
              data-lang={lang.code}
              icon={i18n.language === lang.code ? 'accept' : ''}
              style={{ fontWeight: i18n.language === lang.code ? 'bold' : 'normal' }}
            >
              {lang.flag} {lang.label}
            </ListItemStandard>
          ))}
        </List>
      </Popover>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ── Overlay for mobile sidebar ──────────────────────────────────── */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
              zIndex: 999,
            }}
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
            background: 'var(--sapBaseColor)',
            zIndex: sidebarOpen ? 1000 : 'auto',
          }}
        >
          <SideNavigation
            onSelectionChange={(e: any) => {
              const path = e.detail?.item?.dataset?.path;
              if (path) {
                navigate(path);
                setSidebarOpen(false);
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
