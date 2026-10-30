import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bike,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Sun,
  Tag,
  UserCircle2,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useAuth, USER_ROLES } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { CUSTOMER_BOTTOM_NAV, getShellRole, NAVIGATION_GROUPS, ROLE_LABELS, ROLE_PATHS, SHELL_LABELS } from '../../constants/navigation';
import BrandLogo from '../brand/BrandLogo';

const ICONS = {
  home: Home,
  store: Store,
  calendar: CalendarDays,
  orders: ShoppingBag,
  cart: ShoppingCart,
  account: UserCircle2,
  settings: Settings,
  rider: Bike,
  admin: ShieldCheck,
  dashboard: LayoutDashboard,
  business: Store,
  menu: UtensilsCrossed,
  team: Users,
  reports: BarChart3,
  discounts: Tag,
  history: History,
};

export function DashboardShell({ children }) {
  const { user, userRole, capabilities, switchView, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [modeError, setModeError] = useState('');
  const [navQuery, setNavQuery] = useState('');
  const accountRef = useRef(null);
  const drawerRef = useRef(null);
  const activeRole = getShellRole(location.pathname, userRole, capabilities);
  const permissions = user?.memberships?.find(
    (membership) => String(membership.restaurant_id) === String(user?.selected_restaurant_id),
  )?.permissions || [];
  const groups = (NAVIGATION_GROUPS[activeRole] || NAVIGATION_GROUPS[USER_ROLES.CUSTOMER])
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (
        (!item.permission || permissions.includes(item.permission))
        && (!item.permissions || item.permissions.some((permission) => permissions.includes(permission)))
      )),
    }))
    .filter((group) => group.items.length > 0);
  const normalizedQuery = navQuery.trim().toLocaleLowerCase();
  const visibleGroups = useMemo(() => groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLocaleLowerCase().includes(normalizedQuery)),
    }))
    .filter((group) => group.items.length > 0), [groups, normalizedQuery]);
  const displayName = user?.name || user?.email || SHELL_LABELS.customer;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1100px)');
    const updateViewport = (event) => setIsMobile(event.matches);
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousFocus = document.activeElement;
    const sidebar = drawerRef.current;
    const getFocusableItems = () => [...sidebar.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusableItems();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    };

    sidebar.querySelector('.dashboard-sidebar__mobile-close')?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await logout();
      setAccountMenuOpen(false);
      setDrawerOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Unable to sign out.', error);
      setLogoutError('We couldn’t sign you out. Please try again.');
      setAccountMenuOpen(true);
    }
  };

  const handleModeChange = async (event) => {
    const nextMode = event.target.value;
    setModeError('');
    try {
      if (!await switchView(nextMode)) return;
      navigate(ROLE_PATHS[nextMode]);
      setDrawerOpen(false);
    } catch (error) {
      console.error('Unable to switch account mode.', error);
      setModeError('We couldn’t switch modes. Please try again.');
    }
  };

  const renderNavigation = () => (
    <>
      <label className="dashboard-nav-search">
        <Search aria-hidden="true" size={17} />
        <input
          type="search"
          value={navQuery}
          onChange={(event) => setNavQuery(event.target.value)}
          placeholder={SHELL_LABELS.navigationSearch}
          aria-label={SHELL_LABELS.navigationSearch}
        />
      </label>
      {visibleGroups.length ? visibleGroups.map((group) => (
        <section className="dashboard-nav-group" key={group.label}>
          <h2 className="dashboard-nav-group__label">{group.label}</h2>
          <div className="dashboard-nav-group__items">
            {group.items.map(({ label, path, icon }) => {
              const Icon = ICONS[icon];
              const profileToolPaths = ['/business/profile/edit', '/business/photos', '/business/hours', '/business/publish'];
              const businessProfileActive = path === '/business/profile' && profileToolPaths.includes(location.pathname);
              return (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/' || path === '/business'}
                  title={collapsed ? label : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={({ isActive }) => ['dashboard-nav-link', isActive || businessProfileActive ? 'is-active' : ''].filter(Boolean).join(' ')}
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon aria-hidden="true" size={19} />
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </div>
        </section>
      )) : <p className="dashboard-nav-empty">{SHELL_LABELS.noNavigationResults}</p>}
    </>
  );

  const renderAccountMenu = () => accountMenuOpen ? (
    <div className="dashboard-account-menu glass-data" role="menu" aria-label={SHELL_LABELS.accountMenu}>
      {logoutError ? <p className="dashboard-account-menu__error" role="alert">{logoutError}</p> : null}
      <NavLink to="/settings" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
        <Settings aria-hidden="true" size={16} /><span>{SHELL_LABELS.settings}</span>
      </NavLink>
      <NavLink to="/profile" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
        <CircleHelp aria-hidden="true" size={16} /><span>{SHELL_LABELS.help}</span>
      </NavLink>
      <button type="button" role="menuitemcheckbox" aria-checked={isDarkMode} onClick={toggleTheme}>
        {isDarkMode ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
        <span>{SHELL_LABELS.darkMode}</span>
        <span className={['dashboard-theme-toggle', isDarkMode ? 'is-on' : ''].filter(Boolean).join('')} aria-hidden="true"><i /></span>
      </button>
      <button type="button" role="menuitem" className="is-logout" onClick={handleLogout}>
        <LogOut aria-hidden="true" size={16} /><span>{SHELL_LABELS.logout}</span>
      </button>
    </div>
  ) : null;

  return (
    <div className={['dashboard-layout', collapsed ? 'is-collapsed' : '', drawerOpen ? 'is-drawer-open' : ''].filter(Boolean).join(' ')}>
      {drawerOpen ? (
        <button
          type="button"
          className="dashboard-sidebar-backdrop"
          aria-label={SHELL_LABELS.closeSidebarDrawer}
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}
      <aside
        id="dashboard-sidebar"
        className="dashboard-sidebar"
        aria-label={SHELL_LABELS.navigation}
        aria-hidden={isMobile && !drawerOpen ? true : undefined}
        inert={isMobile && !drawerOpen}
        ref={drawerRef}
      >
        <div className="dashboard-sidebar__brand-row">
          <BrandLogo className="dashboard-sidebar__brand" to={ROLE_PATHS[activeRole] || '/'} variant="responsive" />
          <button
            type="button"
            className="dashboard-sidebar__collapse"
            aria-label={collapsed ? SHELL_LABELS.expandSidebar : SHELL_LABELS.closeSidebar}
            title={collapsed ? SHELL_LABELS.expandSidebar : SHELL_LABELS.closeSidebar}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            type="button"
            className="dashboard-sidebar__mobile-close"
            aria-label={SHELL_LABELS.closeSidebarDrawer}
            onClick={() => setDrawerOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        {capabilities.length > 1 ? (
          <label className="dashboard-mode-select">
            <span>{SHELL_LABELS.switchMode}</span>
            <select value={activeRole} onChange={handleModeChange} aria-label={SHELL_LABELS.switchMode}>
              {capabilities.filter((mode) => ROLE_LABELS[mode]).map((mode) => <option value={mode} key={mode}>{ROLE_LABELS[mode]}</option>)}
            </select>
            <ChevronDown aria-hidden="true" size={15} />
          </label>
        ) : null}
        {modeError ? <p className="dashboard-account-menu__error" role="alert">{modeError}</p> : null}

        <nav className="dashboard-sidebar__nav" aria-label={SHELL_LABELS.navigation}>
          {renderNavigation()}
        </nav>

        <div className="dashboard-sidebar__account" ref={accountRef}>
          {renderAccountMenu()}
          <button
            type="button"
            className="dashboard-user-card"
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            <span className="dashboard-user-card__avatar">{user?.avatar || displayName.slice(0, 1).toLocaleUpperCase()}</span>
            <span className="dashboard-user-card__details">
              <strong>{displayName}</strong>
              <small>{ROLE_LABELS[activeRole]}</small>
            </span>
            <ChevronDown aria-hidden="true" size={16} />
          </button>
        </div>
      </aside>

      <div className="dashboard-workspace">
        {typeof children === 'function' ? children({
          toggleSidebar: () => setDrawerOpen((open) => !open),
          closeSidebar: () => setDrawerOpen(false),
          sidebarOpen: drawerOpen,
        }) : children}
      </div>

      {activeRole === USER_ROLES.CUSTOMER ? (
        <nav className="customer-bottom-tabs" aria-label={SHELL_LABELS.customer}>
          {CUSTOMER_BOTTOM_NAV.map(({ label, path, icon }) => {
            const Icon = ICONS[icon];
            return (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) => ['customer-bottom-tabs__item', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
              >
                <span className="customer-bottom-tabs__icon"><Icon aria-hidden="true" size={19} /></span>
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

export default DashboardShell;
