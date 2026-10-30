import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth, USER_ROLES } from '../../context/AuthContext';
import { useCan } from '../../hooks/useCan';
import { businessService } from '../../services/businessService';
import BusinessSetupSection from './BusinessSetupSection';
import BusinessTeamPage from './BusinessTeamPage';
import BusinessAuditPage from './BusinessAuditPage';
import '../Page.css';
import './BusinessPage.css';

const SECTIONS = [
  { label: 'Overview', to: '/business' },
  { label: 'Profile', to: '/business/profile', permission: 'restaurant.page.edit' },
  { label: 'Photos', to: '/business/photos', permission: 'restaurant.photos.manage' },
  { label: 'Hours', to: '/business/hours', permission: 'restaurant.hours.manage' },
  { label: 'Menu', to: '/business/menu', permission: 'restaurant.menu.manage' },
  { label: 'Tables', to: '/business/tables', permission: 'tables.manage' },
  { label: 'Publish', to: '/business/publish', permission: 'restaurant.publish' },
  { label: 'Team', to: '/business/team', permission: 'team.view' },
  { label: 'Audit history', to: '/business/history', permission: 'audit.view' },
];

const TITLES = Object.fromEntries(SECTIONS.map(({ label, to }) => [to, label]));

export default function BusinessPage() {
  const { user, capabilities, activeView, switchView, switchRestaurant, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const memberships = useMemo(
    () => (user?.memberships || []).filter((membership) => membership.status === 'active'),
    [user?.memberships],
  );
  const selectedRestaurantId = user?.selected_restaurant_id
    || memberships[0]?.restaurant_id
    || user?.restaurantId
    || '';
  const canPublish = useCan('restaurant.publish', selectedRestaurantId);
  const canViewTeam = useCan('team.view', selectedRestaurantId);
  const canViewAudit = useCan('audit.view', selectedRestaurantId);
  const canEditPage = useCan('restaurant.page.edit', selectedRestaurantId);
  const canManagePhotos = useCan('restaurant.photos.manage', selectedRestaurantId);
  const canManageHours = useCan('restaurant.hours.manage', selectedRestaurantId);
  const canManageMenu = useCan('restaurant.menu.manage', selectedRestaurantId);
  const canManageTables = useCan('tables.manage', selectedRestaurantId);
  const selectedMembership = memberships.find((membership) => String(membership.restaurant_id) === String(selectedRestaurantId));
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

  const handleAccessDenied = useCallback(async (requestError) => {
    if (![403, 404].includes(requestError?.status)) return false;
    try {
      const refreshedUser = await refreshUser();
      const membership = refreshedUser?.memberships?.find((item) => String(item.restaurant_id) === String(selectedRestaurantId));
      if (membership?.status === 'active') return false;
      window.sessionStorage.setItem('salo.business.accessChanged', 'true');
      await switchView(USER_ROLES.CUSTOMER);
      navigate('/', { replace: true, state: { businessAccessChanged: true } });
      return true;
    } catch (refreshError) {
      console.error('Unable to verify restaurant access after a denied request.', refreshError);
      return false;
    }
  }, [navigate, refreshUser, selectedRestaurantId, switchView]);

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
      .catch(async (loadError) => {
        if (!active) return;
        if (await handleAccessDenied(loadError)) return;
        setError(loadError.message || 'Unable to load the Business workspace.');
      });
    return () => { active = false; };
  }, [activeView, handleAccessDenied, selectedRestaurantId, user]);

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
  const permissionAccess = {
    'restaurant.publish': canPublish,
    'team.view': canViewTeam,
    'audit.view': canViewAudit,
    'restaurant.page.edit': canEditPage,
    'restaurant.photos.manage': canManagePhotos,
    'restaurant.hours.manage': canManageHours,
    'restaurant.menu.manage': canManageMenu,
    'tables.manage': canManageTables,
  };
  const shownSections = SECTIONS.filter((item) => (
    !item.permission
    || permissionAccess[item.permission]
  ));

  return (
    <div className="section-shell business-shell">
      <header className="business-header">
        <div>
          <p className="business-eyebrow">Business workspace</p>
          <h1>{workspace?.restaurant?.name || memberships.find((item) => item.restaurant_id === String(selectedRestaurantId))?.restaurant_name || 'Restaurant'}</h1>
          <p>Restaurant operations and access for your current position.</p>
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
      {selectedMembership ? (
        <p className="business-role-banner" role="status">Your position: {selectedMembership.role.replaceAll('_', ' ')}</p>
      ) : null}

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

      {!loading && !error && currentPath !== '/business' && section?.permission && !permissionAccess[section.permission] ? (
        <p className="business-error" role="alert">Your current position does not have permission to view this section.</p>
      ) : null}
      {!loading && !error && currentPath !== '/business' && (!section?.permission || permissionAccess[section.permission]) ? (
        ['/business/profile', '/business/photos', '/business/hours', '/business/publish'].includes(currentPath) ? (
          <BusinessSetupSection
            key={selectedRestaurantId}
            path={currentPath}
            restaurantId={selectedRestaurantId}
            user={user}
            workspace={workspace}
            readOnly={Boolean(workspace?.restaurant?.is_read_only)}
            onWorkspaceUpdated={async () => setWorkspace(await businessService.getWorkspace(selectedRestaurantId, user))}
          />
        ) : currentPath === '/business/team' ? (
          <BusinessTeamPage
            key={`team-${selectedRestaurantId}`}
            restaurantId={selectedRestaurantId}
            user={user}
            readOnly={Boolean(workspace?.restaurant?.is_read_only)}
            onAccessDenied={handleAccessDenied}
          />
        ) : currentPath === '/business/history' ? (
          <BusinessAuditPage
            key={`audit-${selectedRestaurantId}`}
            restaurantId={selectedRestaurantId}
            onAccessDenied={handleAccessDenied}
          />
        ) : (
          <section className="business-placeholder">
            <p className="business-eyebrow">{currentTitle}</p>
            <h2>{section?.label || currentTitle}</h2>
            <p>This setup area will be completed in its approved Business phase.</p>
            <Link to="/business">Return to overview</Link>
          </section>
        )
      ) : null}
    </div>
  );
}
