import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Home, LogOut, MapPin, Menu, Search, ShoppingBag, ShoppingCart, UserCircle2, UtensilsCrossed, Bike, ShieldCheck } from 'lucide-react';
import { useAuth, USER_ROLES } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLocationContext } from '../../context/LocationContext';
import LocationPicker from '../location/LocationPicker';
import MobileDrawer from './MobileDrawer';
import { restaurantService } from '../../services/restaurantService';
import logo from '../../assets/salo_logoo.png';

const marketingLinks = [
  { label: 'Home', to: '/' },
  { label: 'Restaurants', to: '/restaurants' },
  { label: 'Reserve a Table', to: '/reserve' },
  { label: 'How It Works', to: '/#how-it-works' },
];

const viewDetails = {
  [USER_ROLES.CUSTOMER]: { label: 'Customer', to: '/', icon: UserCircle2 },
  [USER_ROLES.RESTAURANT_OWNER]: { label: 'Restaurant Dashboard', to: '/dashboard', icon: UtensilsCrossed },
  [USER_ROLES.RIDER]: { label: 'Rider', to: '/rider', icon: Bike },
  [USER_ROLES.ADMIN]: { label: 'Admin', to: '/admin', icon: ShieldCheck },
};

const customerTabs = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Browse', to: '/restaurants', icon: Search },
  { label: 'Cart', to: '/cart', icon: ShoppingCart },
  { label: 'Orders', to: '/orders', icon: ShoppingBag },
  { label: 'Profile', to: '/profile', icon: UserCircle2 },
];

export function Navbar() {
  const { user, userRole, capabilities, switchView, logout, isLoggedIn } = useAuth();
  const { totalItems } = useCart();
  const { selectedAddress, selectAddress } = useLocationContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  const closeAddressPicker = useCallback(() => setAddressOpen(false), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const menuRef = useRef(null);
  const appMode = isLoggedIn;
  const customerMode = appMode && userRole === USER_ROLES.CUSTOMER;

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  useEffect(() => {
    let active = true;
    if (!query.trim()) return () => { active = false; };

    restaurantService.searchRestaurants(query).then((items) => {
      if (active) setResults(items.slice(0, 5));
    }).catch((error) => {
      console.error('Unable to load restaurant search suggestions.', error);
    });

    return () => { active = false; };
  }, [query]);

  useEffect(() => {
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const availableViews = useMemo(() => capabilities.map((capability) => viewDetails[capability]).filter(Boolean), [capabilities]);
  const navClass = ['site-header', appMode ? 'site-header--app' : '', scrolled ? 'is-scrolled' : ''].filter(Boolean).join(' ');
  const isMarketingLinkActive = (to) => {
    if (to === '/#how-it-works') return location.pathname === '/' && location.hash === '#how-it-works';
    if (to === '/') return location.pathname === '/' && !location.hash;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const selectView = (view) => {
    if (!switchView(view)) return;
    setMenuOpen(false);
    navigate(viewDetails[view].to);
  };

  const handleLogout = () => {
    setMobileMenuOpen(false);
    setMenuOpen(false);
    logout();
    navigate('/');
  };

  return (
    <>
      <header className={navClass}>
        <nav className="navbar section-shell" aria-label="Main navigation">
          <Link to="/" className="navbar__brand" aria-label="SALO - Order. Reserve. Gather.">
            <img src={logo} alt="SALO - Order. Reserve. Gather." className="navbar__logo" />
          </Link>

          {!appMode ? (
            <div className="navbar__center" aria-label="Primary links">
              {marketingLinks.map((item) => <Link key={item.to} to={item.to} className={['nav-link', isMarketingLinkActive(item.to) ? 'is-active' : ''].filter(Boolean).join(' ')}>{item.label}</Link>)}
            </div>
          ) : null}

          {customerMode ? (
            <button type="button" className="address-selector" onClick={() => setAddressOpen(true)}>
              <MapPin size={16} /><span><small>Deliver to</small><strong>{selectedAddress?.detail || selectedAddress?.label || 'Choose address'}</strong></span><ChevronDown size={15} />
            </button>
          ) : null}

          <div className={`navbar__search ${appMode ? 'navbar__search--app' : ''}`}>
            <Search size={16} />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search restaurants or dishes" aria-label="Search restaurants or dishes" onFocus={() => { if (!query) setResults([]); }} />
            {results.length ? (
              <ul className="search-panel__results">
                {results.map((restaurant) => <li key={restaurant.id}><Link to={`/restaurants/${restaurant.id}`} onClick={() => setQuery('')}>{restaurant.name}<small>{restaurant.cuisine}</small></Link></li>)}
              </ul>
            ) : null}
          </div>

          <div className="navbar__actions">
            <button type="button" className="navbar__menu-button" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation-drawer" onClick={() => setMobileMenuOpen((open) => !open)}>
              <Menu size={20} />
            </button>
            <Link to="/cart" className="icon-button cart-button" aria-label={`Shopping cart, ${totalItems} items`}>
              <ShoppingCart size={18} />{totalItems > 0 ? <span className="cart-count">{totalItems}</span> : null}
            </Link>
            {isLoggedIn ? (
              <div className="user-menu" ref={menuRef}>
                <button type="button" className="user-pill" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-haspopup="menu">
                  <span className="user-pill__avatar">{user?.avatar || 'U'}</span><span className="user-pill__name">{user?.name || 'User'}</span><ChevronDown size={15} />
                </button>
                {menuOpen ? (
                  <div className="user-menu__dropdown" role="menu">
                    <span className="menu-group-label">Account</span>
                    <Link to="/profile" className="user-menu__item" role="menuitem" onClick={() => setMenuOpen(false)}>Profile</Link>
                    <Link to="/settings" className="user-menu__item" role="menuitem" onClick={() => setMenuOpen(false)}>Settings</Link>
                    {capabilities.length > 1 ? (
                      <>
                        <span className="menu-group-label">Switch view</span>
                        {availableViews.map(({ label, to, icon: Icon }, index) => {
                          const capability = capabilities[index];
                          return <button type="button" key={to} className={`user-menu__item view-switch ${userRole === capability ? 'is-current' : ''}`} onClick={() => selectView(capability)}><Icon size={15} />{label}{userRole === capability ? <span>Current</span> : null}</button>;
                        })}
                      </>
                    ) : userRole === USER_ROLES.CUSTOMER ? (
                      <>
                        <span className="menu-group-label">More with SALO</span>
                        <Link to="/partner/apply" className="user-menu__item" role="menuitem" onClick={() => setMenuOpen(false)}>Add Your Restaurant</Link>
                        <Link to="/rider/apply" className="user-menu__item" role="menuitem" onClick={() => setMenuOpen(false)}>Become a Rider</Link>
                      </>
                    ) : null}
                    <button type="button" className="user-menu__item user-menu__item--logout" onClick={handleLogout}><LogOut size={14} /> Logout</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="auth-actions"><Link to="/login" className="btn btn--ghost">Login</Link><Link to="/register" className="btn btn--primary">Sign Up</Link></div>
            )}
          </div>
        </nav>
      </header>

      <MobileDrawer
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        user={user}
        userRole={userRole}
        onLogout={handleLogout}
        searchQuery={query}
        onSearchQueryChange={setQuery}
      />
      {customerMode ? (
        <nav className="customer-bottom-tabs" aria-label="Customer navigation">
          {customerTabs.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => ['customer-bottom-tabs__item', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}><span className="customer-bottom-tabs__icon"><Icon size={19} />{label === 'Cart' && totalItems > 0 ? <i>{totalItems}</i> : null}</span><span>{label}</span></NavLink>)}
      </nav>
      ) : null}

      <LocationPicker open={addressOpen} onClose={closeAddressPicker} selectedAddress={selectedAddress} onSelect={selectAddress} />
    </>
  );
}

export default Navbar;
