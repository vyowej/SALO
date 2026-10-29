import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, X } from 'lucide-react';
import { USER_ROLES } from '../../context/AuthContext';
import { useEffect, useRef } from 'react';
import logo from '../../assets/salo_logoo.png';
import { PUBLIC_NAV_LINKS, SHELL_LABELS } from '../../constants/navigation';

export function MobileDrawer({ open, onClose, user, onLogout, userRole, searchQuery, onSearchQueryChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open || !drawerRef.current) return undefined;
    const focusable = () => [...drawerRef.current.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled)')];
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    };
    focusable()[0]?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const linkIsActive = (to) => {
    if (to === '/#how-it-works') return location.pathname === '/' && location.hash === '#how-it-works';
    if (to === '/') return location.pathname === '/' && !location.hash;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    const target = `/restaurants${params.size ? `?${params}` : ''}`;
    navigate(target, { state: { gateTarget: target } });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <button type="button" className="drawer-backdrop" aria-label="Close navigation menu" onClick={onClose} />
      <aside id="mobile-navigation-drawer" className="mobile-drawer" aria-label="Mobile navigation drawer" aria-modal="true" role="dialog" ref={drawerRef}>
        <div className="mobile-drawer__header">
          <Link to="/" className="mobile-drawer__brand" aria-label={SHELL_LABELS.homeLink} onClick={onClose}><img src={logo} alt={SHELL_LABELS.homeLink} /></Link>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={SHELL_LABELS.closeMenu}>
            <X size={20} />
          </button>
        </div>

        <nav className="mobile-drawer__nav" aria-label={SHELL_LABELS.navigation}>
          {PUBLIC_NAV_LINKS.filter((link) => !user || link.label !== SHELL_LABELS.howItWorks).map((link) => (
            <Link key={link.path} to={link.path} className={['mobile-drawer__link', linkIsActive(link.path) ? 'is-active' : ''].filter(Boolean).join(' ')} onClick={onClose}>
              {link.label}
            </Link>
          ))}
          {userRole === USER_ROLES.RESTAURANT_OWNER ? (
            <NavLink to="/dashboard" className="mobile-drawer__link" onClick={onClose}>{SHELL_LABELS.pages.dashboard}</NavLink>
          ) : null}
          {userRole === USER_ROLES.ADMIN ? (
            <NavLink to="/admin" className="mobile-drawer__link" onClick={onClose}>{SHELL_LABELS.pages.admin}</NavLink>
          ) : null}
          {userRole === USER_ROLES.CUSTOMER ? (
            <>
              <NavLink to="/orders" className="mobile-drawer__link" onClick={onClose}>{SHELL_LABELS.nav.orders}</NavLink>
              <NavLink to="/reservations" className="mobile-drawer__link" onClick={onClose}>{SHELL_LABELS.nav.reservations}</NavLink>
            </>
          ) : null}
        </nav>

        <form className="mobile-drawer__search" onSubmit={submitSearch}>
          <label htmlFor="mobile-restaurant-search">{SHELL_LABELS.mobileSearch}</label>
          <div className="mobile-drawer__search-field">
            <Search size={16} />
            <input id="mobile-restaurant-search" type="search" aria-label={SHELL_LABELS.mobileSearch} value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} />
            <button type="submit">{SHELL_LABELS.submitSearch}</button>
          </div>
        </form>

        <div className="mobile-drawer__actions">
          <Link to="/cart" className="btn btn--ghost btn--full" onClick={onClose}>
            <ShoppingCart size={16} /> {SHELL_LABELS.cart}
          </Link>
          {user ? (
            <button type="button" className="btn btn--primary btn--full" onClick={onLogout}>
              {SHELL_LABELS.logout}
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost btn--full" onClick={onClose}>{SHELL_LABELS.login}</Link>
              <Link to="/register" className="btn btn--primary btn--full" onClick={onClose}>{SHELL_LABELS.signUp}</Link>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export default MobileDrawer;
