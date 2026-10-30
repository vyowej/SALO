import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Bike, ChevronDown, LogOut, MapPin, Menu, Moon, Search, ShieldCheck, ShoppingCart, Sun, UserCircle2, UtensilsCrossed } from 'lucide-react';
import { useAuth, USER_ROLES } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLocationContext } from '../../context/LocationContext';
import { useTheme } from '../../context/ThemeContext';
import LocationPicker from '../location/LocationPicker';
import MobileDrawer from './MobileDrawer';
import BrandLogo from '../brand/BrandLogo';
import { restaurantService } from '../../services/restaurantService';
import { getPageTitle, getShellRole, PUBLIC_NAV_LINKS, ROLE_LABELS, SHELL_LABELS } from '../../constants/navigation';

const viewDetails = {
  [USER_ROLES.CUSTOMER]: { label: ROLE_LABELS[USER_ROLES.CUSTOMER], to: '/', icon: UserCircle2 },
  [USER_ROLES.RESTAURANT_OWNER]: { label: ROLE_LABELS[USER_ROLES.RESTAURANT_OWNER], to: '/dashboard', icon: UtensilsCrossed },
  [USER_ROLES.RIDER]: { label: ROLE_LABELS[USER_ROLES.RIDER], to: '/rider', icon: Bike },
  [USER_ROLES.ADMIN]: { label: ROLE_LABELS[USER_ROLES.ADMIN], to: '/admin', icon: ShieldCheck },
};

export function Navbar({ onToggleSidebar = () => {}, sidebarOpen = false }) {
  const { user, userRole, capabilities, switchView, logout, isLoggedIn } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { totalItems } = useCart();
  const { selectedAddress, selectAddress } = useLocationContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [modeError, setModeError] = useState('');
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  const closeAddressPicker = useCallback(() => setAddressOpen(false), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);
  const searchRef = useRef(null);
  const appMode = isLoggedIn;
  const activeRole = getShellRole(location.pathname, userRole, capabilities);
  const customerMode = appMode && activeRole === USER_ROLES.CUSTOMER;

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  useEffect(() => {
    let active = true;
    if (!isLoggedIn || !query.trim()) return undefined;

    restaurantService.searchRestaurants(query).then((items) => {
      if (active) setResults(items.slice(0, 5));
    }).catch((error) => {
      console.error('Unable to load restaurant search suggestions.', error);
    });

    return () => { active = false; };
  }, [isLoggedIn, query]);

  useEffect(() => {
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', focusSearch);
    return () => document.removeEventListener('keydown', focusSearch);
  }, []);

  const availableViews = useMemo(() => capabilities
    .map((capability) => ({ capability, ...viewDetails[capability] }))
    .filter(({ to }) => Boolean(to)), [capabilities]);
  const navClass = ['site-header', appMode ? 'site-header--app' : '', scrolled ? 'is-scrolled' : ''].filter(Boolean).join(' ');
  const isMarketingLinkActive = (to) => {
    if (to === '/#how-it-works') return location.pathname === '/' && location.hash === '#how-it-works';
    if (to === '/') return location.pathname === '/' && !location.hash;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const selectView = async (view) => {
    setModeError('');
    try {
      if (!await switchView(view)) return;
      setMenuOpen(false);
      navigate(viewDetails[view].to);
    } catch (error) {
      console.error('Unable to switch account mode.', error);
      setModeError('We couldn’t switch modes. Please try again.');
    }
  };

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await logout();
      setMobileMenuOpen(false);
      setMenuOpen(false);
      setQuery('');
      setResults([]);
      navigate('/');
    } catch (error) {
      console.error('Unable to sign out.', error);
      setLogoutError(SHELL_LABELS.signOutError);
      setMenuOpen(true);
    }
  };

  const toggleNavigation = () => {
    if (appMode) {
      onToggleSidebar();
      return;
    }
    setMobileMenuOpen((open) => !open);
  };

  return (
    <>
      <header className={navClass}>
        <nav className="navbar section-shell" aria-label={SHELL_LABELS.navigation}>
          <BrandLogo className="navbar__brand" />

          {!appMode ? (
            <div className="navbar__center" aria-label={SHELL_LABELS.marketingLinks}>
              {PUBLIC_NAV_LINKS.map((item) => (
                <Link key={item.path} to={item.path} className={['nav-link', isMarketingLinkActive(item.path) ? 'is-active' : ''].filter(Boolean).join(' ')}>{item.label}</Link>
              ))}
            </div>
          ) : null}

          {appMode ? (
            <div className="app-topbar__heading">
              <div className="app-topbar__breadcrumbs" aria-label={SHELL_LABELS.breadcrumbNav}>
                <Link to={activeRole === USER_ROLES.CUSTOMER ? '/' : viewDetails[activeRole]?.to || '/'}>{ROLE_LABELS[activeRole] || SHELL_LABELS.customer}</Link>
                <span aria-hidden="true">/</span>
                <span>{getPageTitle(location.pathname)}</span>
              </div>
              <h1>{getPageTitle(location.pathname)}</h1>
            </div>
          ) : null}

          {customerMode ? (
            <button type="button" className="address-selector" onClick={() => setAddressOpen(true)}>
              <MapPin size={16} /><span><small>{SHELL_LABELS.deliverTo}</small><strong>{selectedAddress?.detail || selectedAddress?.label || SHELL_LABELS.chooseAddress}</strong></span><ChevronDown size={15} />
            </button>
          ) : null}

          <div className={`navbar__search ${appMode ? 'navbar__search--app' : ''}`}>
            <Search size={16} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              readOnly={!isLoggedIn}
              onChange={(event) => setQuery(event.target.value)}
              onClick={() => {
                if (!isLoggedIn) navigate('/restaurants');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !isLoggedIn) navigate(`/restaurants${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
              }}
              placeholder={SHELL_LABELS.searchSuggestions}
              aria-label={SHELL_LABELS.searchSuggestions}
              aria-keyshortcuts="Control+K Meta+K"
              onFocus={() => { if (!query) setResults([]); }}
            />
            {appMode ? <kbd className="navbar__search-shortcut">{SHELL_LABELS.searchShortcut}</kbd> : null}
            {appMode && results.length ? (
              <ul className="search-panel__results">
                {results.map((restaurant) => <li key={restaurant.id}><Link to={`/restaurants/${restaurant.id}`} onClick={() => setQuery('')}>{restaurant.name}<small>{restaurant.cuisine}</small></Link></li>)}
              </ul>
            ) : null}
          </div>

          <div className="navbar__actions">
            <button type="button" className="navbar__menu-button" aria-label={appMode ? sidebarOpen ? SHELL_LABELS.closeSidebarDrawer : SHELL_LABELS.openSidebar : mobileMenuOpen ? SHELL_LABELS.closeSidebarDrawer : SHELL_LABELS.openSidebar} aria-expanded={appMode ? sidebarOpen : mobileMenuOpen} aria-controls={appMode ? 'dashboard-sidebar' : 'mobile-navigation-drawer'} onClick={toggleNavigation}>
              <Menu size={20} />
            </button>
            {customerMode ? (
              <Link to="/cart" className="icon-button cart-button" aria-label={`${SHELL_LABELS.shoppingCart}, ${totalItems} ${SHELL_LABELS.items}`}>
                <ShoppingCart size={18} />{totalItems > 0 ? <span className="cart-count">{totalItems}</span> : null}
              </Link>
            ) : null}
            {appMode ? (
              <div className="navbar__notifications" ref={notificationsRef}>
                <button type="button" className="icon-button" aria-label={SHELL_LABELS.notifications} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>
                  <Bell aria-hidden="true" size={18} />
                </button>
                {notificationsOpen ? (
                  <section className="navbar__notification-panel glass-data" aria-label={SHELL_LABELS.notifications}>
                    <strong>{SHELL_LABELS.notifications}</strong>
                    <p>{SHELL_LABELS.noNotifications}</p>
                  </section>
                ) : null}
              </div>
            ) : null}
            {isLoggedIn ? (
              <div className="user-menu" ref={menuRef}>
                <button type="button" className="user-pill" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-haspopup="menu">
                  <span className="user-pill__avatar">{user?.avatar || SHELL_LABELS.customer.slice(0, 1)}</span><span className="user-pill__name">{user?.name || SHELL_LABELS.customer}</span><ChevronDown size={15} />
                </button>
                {menuOpen ? (
                  <div className="user-menu__dropdown" role="menu">
                    <span className="menu-group-label">{SHELL_LABELS.groups.account}</span>
                    <Link to="/profile" className="user-menu__item" role="menuitem" onClick={() => setMenuOpen(false)}>{SHELL_LABELS.profile}</Link>
                    <Link to="/settings" className="user-menu__item" role="menuitem" onClick={() => setMenuOpen(false)}>{SHELL_LABELS.settings}</Link>
                    <Link to="/profile" className="user-menu__item" role="menuitem" onClick={() => setMenuOpen(false)}>{SHELL_LABELS.help}</Link>
                    <button type="button" className="user-menu__item user-menu__theme" role="menuitemcheckbox" aria-checked={isDarkMode} onClick={toggleTheme}>
                      {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                      {SHELL_LABELS.darkMode}
                      <span aria-hidden="true">{isDarkMode ? SHELL_LABELS.themeOn : SHELL_LABELS.themeOff}</span>
                    </button>
                    {capabilities.length > 1 ? (
                      <>
                        <span className="menu-group-label">{SHELL_LABELS.switchView}</span>
                        {availableViews.map(({ capability, label, to, icon: Icon }) => {
                          return <button type="button" key={to} className={`user-menu__item view-switch ${activeRole === capability ? 'is-current' : ''}`} onClick={() => selectView(capability)}><Icon size={15} />{label}{activeRole === capability ? <span>{SHELL_LABELS.current}</span> : null}</button>;
                        })}
                      </>
                    ) : userRole === USER_ROLES.CUSTOMER ? (
                      <>
                        <span className="menu-group-label">{SHELL_LABELS.moreWithSalo}</span>
                        <Link to="/partner/apply" className="user-menu__item" role="menuitem" onClick={() => setMenuOpen(false)}>{SHELL_LABELS.addRestaurant}</Link>
                        <Link to="/rider/apply" className="user-menu__item" role="menuitem" onClick={() => setMenuOpen(false)}>{SHELL_LABELS.becomeRider}</Link>
                      </>
                    ) : null}
                    {logoutError ? <p className="user-menu__error" role="alert">{logoutError}</p> : null}
                    {modeError ? <p className="user-menu__error" role="alert">{modeError}</p> : null}
                    <button type="button" className="user-menu__item user-menu__item--logout" role="menuitem" onClick={handleLogout}><LogOut size={14} /> {SHELL_LABELS.logout}</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="auth-actions"><Link to="/login" className="btn btn--ghost">{SHELL_LABELS.login}</Link><Link to="/signup" className="btn btn--primary">{SHELL_LABELS.signUp}</Link></div>
            )}
          </div>
        </nav>
      </header>

      {!appMode ? (
        <MobileDrawer
          open={mobileMenuOpen}
          onClose={closeMobileMenu}
          user={user}
          userRole={userRole}
          onLogout={handleLogout}
          searchQuery={query}
          onSearchQueryChange={setQuery}
        />
      ) : null}

      <LocationPicker open={addressOpen} onClose={closeAddressPicker} selectedAddress={selectedAddress} onSelect={selectAddress} />
    </>
  );
}

export default Navbar;
