import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth, USER_ROLES } from '../../context/AuthContext';
import { useCan } from '../../hooks/useCan';
import { businessService } from '../../services/businessService';
import BusinessSetupSection from './BusinessSetupSection';
import BusinessTeamPage from './BusinessTeamPage';
import BusinessAuditPage from './BusinessAuditPage';
import BusinessMenuPage from './BusinessMenuPage';
import BusinessOrdersPage from './BusinessOrdersPage';
import BusinessReservationsPage from './BusinessReservationsPage';
import {
  BusinessOverviewPage,
  BusinessPublicPage,
  BusinessReportsPage,
} from './BusinessWorkspacePages';
import '../Page.css';
import './BusinessPage.css';

const SECTIONS = [
  { label: 'Overview', to: '/business' },
  { label: 'Business', to: '/business/profile', permission: 'restaurant.view' },
  { label: 'Orders', to: '/business/orders', permission: 'orders.view' },
  { label: 'Reservations', to: '/business/reservations', permission: 'reservations.view' },
  { label: 'Menu', to: '/business/menu', permission: 'restaurant.view' },
  { label: 'Team', to: '/business/team', permission: 'team.view' },
  { label: 'Reports', to: '/business/reports', permission: 'reports.sales_reservations.view' },
  { label: 'Audit history', to: '/business/history', permission: 'audit.view' },
];

const BUSINESS_TOOLS = [
  { label: 'Edit profile', to: '/business/profile/edit', permission: 'restaurant.page.edit' },
  { label: 'Photos', to: '/business/photos', permission: 'restaurant.photos.manage' },
  { label: 'Hours', to: '/business/hours', permission: 'restaurant.hours.manage' },
  { label: 'Publish checklist', to: '/business/publish', permission: 'restaurant.publish' },
];

const TITLES = Object.fromEntries([...SECTIONS, ...BUSINESS_TOOLS].map(({ label, to }) => [to, label]));

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
  const canViewRestaurant = useCan('restaurant.view', selectedRestaurantId);
  const canViewOrders = useCan('orders.view', selectedRestaurantId);
  const canViewReservations = useCan('reservations.view', selectedRestaurantId);
  const canViewSalesReports = useCan('reports.sales_reservations.view', selectedRestaurantId);
  const canViewReservationReports = useCan('reports.reservations.view', selectedRestaurantId);
  const canViewReports = canViewSalesReports || canViewReservationReports;
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
  const normalizedPath = location.pathname === '/business/tables' ? '/business/reservations' : location.pathname;
  const currentPath = [...SECTIONS, ...BUSINESS_TOOLS].some((section) => section.to === normalizedPath)
    ? normalizedPath
    : '/business';
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

  const section = [...SECTIONS, ...BUSINESS_TOOLS].find((item) => item.to === currentPath);
  const permissionAccess = {
    'restaurant.publish': canPublish,
    'team.view': canViewTeam,
    'audit.view': canViewAudit,
    'restaurant.page.edit': canEditPage,
    'restaurant.photos.manage': canManagePhotos,
    'restaurant.hours.manage': canManageHours,
    'restaurant.menu.manage': canManageMenu,
    'restaurant.view': canViewRestaurant,
    'orders.view': canViewOrders,
    'reservations.view': canViewReservations,
    'reports.sales_reservations.view': canViewReports,
    'reports.reservations.view': canViewReports,
  };
  return (
    <div className="section-shell business-shell">
      <header className="business-header">
        <div>
          <p className="business-eyebrow">Business workspace</p>
          <h1>{workspace?.restaurant?.name || memberships.find((item) => item.restaurant_id === String(selectedRestaurantId))?.restaurant_name || 'Restaurant'}</h1>
          <p>Manage your restaurant’s operations and customer-facing profile.</p>
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

      {workspace?.restaurant?.is_read_only ? (
        <div className="business-readonly" role="status">
          This restaurant is suspended. All restaurant actions are read-only; contact an administrator for help.
        </div>
      ) : null}
      {error ? <p className="business-error" role="alert">{error}</p> : null}
      {loading || switching ? <div className="business-loading" role="status">Loading workspace…</div> : null}

      {!loading && !error && currentPath === '/business' ? (
        <BusinessOverviewPage
          key={`overview-${selectedRestaurantId}`}
          restaurantId={selectedRestaurantId}
          user={user}
          workspace={workspace}
          canViewOrders={canViewOrders}
          canViewReservations={canViewReservations}
          permissions={selectedMembership?.permissions || []}
        />
      ) : null}

      {!loading && !error && currentPath !== '/business' && section?.permission && !permissionAccess[section.permission] ? (
        <p className="business-error" role="alert">Your current position does not have permission to view this section.</p>
      ) : null}
      {!loading && !error && currentPath !== '/business' && (!section?.permission || permissionAccess[section.permission]) ? (
        currentPath === '/business/profile' ? (
          <BusinessPublicPage
            key={`public-${selectedRestaurantId}`}
            restaurantId={selectedRestaurantId}
            user={user}
            canEdit={canEditPage}
            canManagePhotos={canManagePhotos}
            canManageHours={canManageHours}
          />
        ) : ['/business/profile/edit', '/business/photos', '/business/hours', '/business/publish'].includes(currentPath) ? (
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
        ) : currentPath === '/business/menu' ? (
          <BusinessMenuPage
            key={`menu-${selectedRestaurantId}`}
            restaurantId={selectedRestaurantId}
            user={user}
            readOnly={Boolean(workspace?.restaurant?.is_read_only)}
            onWorkspaceUpdated={async () => setWorkspace(await businessService.getWorkspace(selectedRestaurantId, user))}
            onAccessDenied={handleAccessDenied}
          />
        ) : currentPath === '/business/orders' ? (
          <BusinessOrdersPage
            key={`orders-${selectedRestaurantId}`}
            restaurantId={selectedRestaurantId}
            restaurantName={workspace?.restaurant?.name || 'your restaurant'}
            user={user}
            readOnly={Boolean(workspace?.restaurant?.is_read_only)}
            onAccessDenied={handleAccessDenied}
          />
        ) : currentPath === '/business/reservations' ? (
          <BusinessReservationsPage
            key={`reservations-${selectedRestaurantId}`}
            restaurantId={selectedRestaurantId}
            user={user}
            readOnly={Boolean(workspace?.restaurant?.is_read_only)}
          />
        ) : currentPath === '/business/reports' ? (
          <BusinessReportsPage
            key={`reports-${selectedRestaurantId}`}
            restaurantId={selectedRestaurantId}
            user={user}
            canViewSales={canViewSalesReports}
            canViewReservations={canViewReservationReports}
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
