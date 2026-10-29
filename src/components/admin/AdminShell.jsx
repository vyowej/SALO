import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bike,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  History,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Store,
  Sun,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '../brand/BrandLogo';
import AdminHelpDialog from './AdminHelpDialog';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ADMIN_COPY, ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS } from '../../constants/admin';

const icons = {
  layout: LayoutDashboard,
  users: Users,
  store: Store,
  clipboard: ClipboardList,
  bike: Bike,
  orders: Utensils,
  calendar: CalendarDays,
  chart: ChartNoAxesCombined,
  history: History,
  settings: Settings,
};

function routeKey(pathname) {
  if (pathname === '/admin') return 'dashboard';
  return ADMIN_NAV_ITEMS.find((item) => item.path !== '/admin' && pathname.startsWith(item.path))?.key || 'dashboard';
}

export function AdminShell({ children }) {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const key = routeKey(location.pathname);
  const pageItems = useMemo(() => ADMIN_NAV_ITEMS.filter((item) => (
    `${ADMIN_COPY.pageLabels[item.key]} ${ADMIN_COPY.pageDescriptions[item.key]}`.toLowerCase().includes(search.toLowerCase())
  )), [search]);
  const groupedItems = Object.entries(ADMIN_NAV_GROUPS)
    .map(([group, label]) => ({ group, label, items: pageItems.filter((item) => item.group === group) }))
    .filter((group) => group.items.length);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Unable to log out of the admin workspace.', error);
      setLogoutError(ADMIN_COPY.logoutError);
    }
  };

  return (
    <div className={`admin-workspace${collapsed ? ' admin-workspace--collapsed' : ''}${mobileOpen ? ' admin-workspace--mobile-open' : ''}`}>
      {mobileOpen ? <button className="admin-mobile-scrim" type="button" aria-label={ADMIN_COPY.closeSidebar} onClick={() => setMobileOpen(false)} /> : null}
      <aside className="admin-sidebar" aria-label={ADMIN_COPY.navigation}>
        <div className="admin-sidebar__brand">
          <BrandLogo to="/admin" variant={collapsed ? 'icon' : 'full'} className="admin-brand-logo" />
          <button type="button" className="admin-icon-button admin-sidebar__close" onClick={() => setMobileOpen(false)} aria-label={ADMIN_COPY.closeSidebar}>
            <X aria-hidden="true" />
          </button>
          <button
            type="button"
            className="admin-icon-button admin-sidebar__collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? ADMIN_COPY.expand : ADMIN_COPY.collapse}
            title={collapsed ? ADMIN_COPY.expand : ADMIN_COPY.collapse}
          >
            <Menu aria-hidden="true" />
          </button>
        </div>

        <label className="admin-sidebar-search">
          <Search aria-hidden="true" size={17} />
          <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ADMIN_COPY.navigationSearch} />
          {!collapsed ? <kbd>{ADMIN_COPY.shortcut}</kbd> : null}
        </label>

        <nav className="admin-nav">
          {groupedItems.map((group) => (
            <section className="admin-nav__group" key={group.group} aria-label={group.label}>
              <span className="admin-nav__label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = icons[item.icon];
                const label = ADMIN_COPY.pageLabels[item.key];
                return (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    end={item.key === 'dashboard'}
                    className={({ isActive }) => `admin-nav__link${isActive ? ' is-active' : ''}`}
                    title={collapsed ? label : undefined}
                    aria-label={label}
                    onClick={() => { setMobileOpen(false); setAccountOpen(false); }}
                  >
                    <Icon aria-hidden="true" size={19} />
                    <span>{label}</span>
                  </NavLink>
                );
              })}
            </section>
          ))}
          {!pageItems.length ? <p className="admin-nav__empty">{ADMIN_COPY.noPages}</p> : null}
        </nav>

        <div className="admin-sidebar__footer">
          <button
            type="button"
            className={`admin-account-card${accountOpen ? ' is-open' : ''}`}
            onClick={() => setAccountOpen((value) => !value)}
            aria-expanded={accountOpen}
            aria-label={ADMIN_COPY.openMenu}
          >
            <span className="admin-avatar" aria-hidden="true">{(user?.name || user?.email || 'A').slice(0, 1).toUpperCase()}</span>
            <span className="admin-account-card__identity"><strong>{user?.name || user?.email || ADMIN_COPY.adminName}</strong><small>{ADMIN_COPY.adminRole}</small></span>
            <ChevronDown aria-hidden="true" size={17} />
          </button>
          {accountOpen ? (
            <div className="admin-account-menu" role="menu" aria-label={ADMIN_COPY.accountMenu}>
              <Link to="/admin/settings" role="menuitem" onClick={() => setAccountOpen(false)}><Settings aria-hidden="true" size={17} />{ADMIN_COPY.settings}</Link>
              <button type="button" role="menuitem" onClick={() => { setAccountOpen(false); setHelpOpen(true); }}><CircleHelp aria-hidden="true" size={17} />{ADMIN_COPY.help}</button>
              <button type="button" role="menuitem" onClick={toggleTheme}>{isDarkMode ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}{ADMIN_COPY.darkMode}</button>
              <button type="button" role="menuitem" onClick={handleLogout}><LogOut aria-hidden="true" size={17} />{ADMIN_COPY.logout}</button>
              {logoutError ? <p role="alert">{logoutError}</p> : null}
            </div>
          ) : null}
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="admin-icon-button admin-topbar__menu" onClick={() => setMobileOpen(true)} aria-label={ADMIN_COPY.menu}>
            <Menu aria-hidden="true" />
          </button>
          <div className="admin-topbar__titles">
            <nav aria-label={ADMIN_COPY.breadcrumbs}><Link to="/admin">{ADMIN_COPY.title}</Link><span aria-hidden="true">/</span><strong>{ADMIN_COPY.pageLabels[key]}</strong></nav>
            <h1>{ADMIN_COPY.pageLabels[key]}</h1>
          </div>
          <div className="admin-topbar__search">
            <Search aria-hidden="true" size={17} />
            <input
              aria-label={ADMIN_COPY.navigationSearch}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={ADMIN_COPY.search}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && pageItems[0]) navigate(pageItems[0].path);
                if (event.key === 'Escape') setSearch('');
              }}
            />
            <kbd>{ADMIN_COPY.shortcut}</kbd>
          </div>
        </header>
        <main className="admin-content">
          <div className="admin-page-heading">
            <div>
              <p className="admin-page-description">{ADMIN_COPY.pageDescriptions[key]}</p>
            </div>
            <span className="admin-page-heading__mark" aria-hidden="true"><Utensils size={21} /></span>
          </div>
          {children}
        </main>
      </div>
      {helpOpen ? <AdminHelpDialog onClose={closeHelp} /> : null}
    </div>
  );
}

export default AdminShell;
