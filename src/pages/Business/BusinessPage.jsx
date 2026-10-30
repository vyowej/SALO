import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth, USER_ROLES } from '../../context/AuthContext';
import { useCan } from '../../hooks/useCan';
import { businessService } from '../../services/businessService';
import '../Page.css';
import './BusinessPage.css';

const SECTIONS = [
  { label: 'Overview', to: '/business' },
  { label: 'Profile', to: '/business/profile' },
  { label: 'Hours', to: '/business/hours' },
  { label: 'Menu', to: '/business/menu' },
  { label: 'Tables', to: '/business/tables' },
  { label: 'Publish', to: '/business/publish', permission: 'restaurant.publish' },
];

const TITLES = Object.fromEntries(SECTIONS.map(({ label, to }) => [to, label]));

export default function BusinessPage() {
  const { user, capabilities, activeView, switchView, switchRestaurant } = useAuth();
  const location = useLocation();
  const memberships = useMemo(
    () => (user?.memberships || []).filter((membership) => membership.status === 'active'),
    [user?.memberships],
  );
  const selectedRestaurantId = user?.selected_restaurant_id
    || memberships[0]?.restaurant_id
    || user?.restaurantId
    || '';
  const canPublish = useCan('restaurant.publish', selectedRestaurantId);
  const [workspace, setWorkspace] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');
  const loading = switching || (
    activeView === USER_ROLES.RESTAURANT_OWNER
    && Boolean(selectedRestaurantId)
    && workspace?.restaurant?.id !== String(selectedRestaurantId)
    && !error
  );
  const currentPath = SECTIONS.some((section) => section.to === location.pathname) ? location.pathname : '/business';
  const currentTitle = TITLES[currentPath] || 'Overview';

  useEffect(() => {
    if (activeView !== USER_ROLES.RESTAURANT_OWNER || !selectedRestaurantId) return;
    if (String(user?.selected_restaurant_id || '') !== String(selectedRestaurantId)) {
      switchRestaurant(selectedRestaurantId)
        .catch((switchError) => setError(switchError.message || 'Unable to select this restaurant.'))
    }
  }, [activeView, selectedRestaurantId, switchRestaurant, user?.selected_restaurant_id]);

  useEffect(() => {
    if (activeView !== USER_ROLES.RESTAURANT_OWNER
      || !selectedRestaurantId
      || String(user?.selected_restaurant_id || '') !== String(selectedRestaurantId)) return undefined;
    let active = true;
    businessService.getWorkspace(selectedRestaurantId, user)
      .then((result) => {
        if (active) {
          setWorkspace(result);
          setError('');
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load the Business workspace.');
      });
    return () => { active = false; };
  }, [activeView, selectedRestaurantId, user]);

  const selectRestaurant = async (restaurantId) => {
    setSwitching(true);
    setError('');
    try {
      await switchRestaurant(restaurantId);
    } catch (switchError) {
      setError(switchError.message || 'Unable to select this restaurant.');
    } finally {
      setSwitching(false);
    }
  };

  if (!capabilities.includes(USER_ROLES.RESTAURANT_OWNER)) {
    return (
      <div className="section-shell">
        <section className="business-empty">
          <h1>Business workspace</h1>
          <p>Your account does not have an active restaurant membership yet.</p>
          <Link className="btn btn--primary btn--md" to="/partner/apply">Apply as a restaurant partner</Link>
        </section>
      </div>
    );
  }

  if (activeView !== USER_ROLES.RESTAURANT_OWNER) {
    return (
      <div className="section-shell">
        <section className="business-empty">
          <h1>Business workspace</h1>
          <p>Switch to Business mode to view restaurant operations.</p>
          <Button variant="primary" onClick={() => switchView(USER_ROLES.RESTAURANT_OWNER).catch((switchError) => setError(switchError.message))}>
            Switch to Business mode
          </Button>
          {error ? <p className="business-error" role="alert">{error}</p> : null}
        </section>
      </div>
    );
  }

  if (!selectedRestaurantId) {
    return (
      <div className="section-shell">
        <section className="business-empty">
          <h1>Business workspace</h1>
          <p>No active restaurant membership is available for this account.</p>
          <Link className="btn btn--secondary btn--md" to="/partner/apply">Start a restaurant application</Link>
        </section>
      </div>
    );
  }

  const checklist = workspace?.setup_checklist || [];
  const incomplete = checklist.find((item) => !item.complete);
  const section = SECTIONS.find((item) => item.to === currentPath);
  const shownSections = SECTIONS.filter((item) => !item.permission || item.permission !== 'restaurant.publish' || canPublish);

  return (
    <div className="section-shell business-shell">
      <header className="business-header">
        <div>
          <p className="business-eyebrow">Business workspace</p>
          <h1>{workspace?.restaurant?.name || memberships.find((item) => item.restaurant_id === String(selectedRestaurantId))?.restaurant_name || 'Restaurant'}</h1>
          <p>Complete setup before publishing your restaurant.</p>
        </div>
        {memberships.length > 1 ? (
          <label className="business-restaurant-select">
            <span>Restaurant</span>
            <select value={selectedRestaurantId} disabled={switching} onChange={(event) => selectRestaurant(event.target.value)}>
              {memberships.map((membership) => (
                <option key={membership.restaurant_id} value={membership.restaurant_id}>
                  {membership.restaurant_name || `Restaurant ${membership.restaurant_id}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <nav className="business-nav" aria-label="Business workspace">
        {shownSections.map((item) => (
          <Link key={item.to} to={item.to} className={item.to === currentPath ? 'is-active' : ''}>
            {item.label}
          </Link>
        ))}
      </nav>

      {workspace?.restaurant?.is_read_only ? (
        <div className="business-readonly" role="status">
          This restaurant is suspended. All restaurant actions are read-only; contact an administrator for help.
        </div>
      ) : null}
      {error ? <p className="business-error" role="alert">{error}</p> : null}
      {loading || switching ? <div className="business-loading" role="status">Loading workspace…</div> : null}

      {!loading && !error && currentPath === '/business' ? (
        <div className="business-dashboard">
          <section className="business-setup-card">
            <div className="business-card-heading">
              <div>
                <h2>Restaurant setup</h2>
                <p>{checklist.filter((item) => item.complete).length} of {checklist.length} setup steps complete</p>
              </div>
              <span className={`business-status business-status--${workspace?.restaurant?.status || 'unknown'}`}>
                {workspace?.restaurant?.status || 'Loading'}
              </span>
            </div>
            <ol className="business-checklist">
              {checklist.map((item) => (
                <li key={item.key} className={item.complete ? 'is-complete' : ''}>
                  <span aria-hidden="true">{item.complete ? '✓' : '○'}</span>
                  <Link to={item.href}>{item.label}</Link>
                  <small>{item.complete ? 'Complete' : 'To do'}</small>
                </li>
              ))}
            </ol>
            {incomplete ? <Link className="btn btn--primary btn--md" to={incomplete.href}>Continue setup</Link> : null}
          </section>

          <section className="business-operations-card">
            <div>
              <h2>Today’s operations</h2>
              <p>Live orders and reservations will appear here as those Business features become available.</p>
            </div>
            <div className="business-empty-state">
              <strong>No live operations yet</strong>
              <span>Finish setup to prepare this workspace.</span>
            </div>
          </section>
        </div>
      ) : null}

      {!loading && !error && currentPath !== '/business' ? (
        <section className="business-placeholder">
          <p className="business-eyebrow">{currentTitle}</p>
          <h2>{section?.label || currentTitle}</h2>
          <p>This setup area is linked from the B1 workspace shell and will be completed in its approved Business phase.</p>
          <Link to="/business">Return to overview</Link>
        </section>
      ) : null}
    </div>
  );
}
