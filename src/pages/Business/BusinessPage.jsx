import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { businessService } from '../../services/businessService';
import '../Page.css';

const BUSINESS_PATHS = {
  '/business': 'Dashboard',
  '/business/orders': 'Orders',
  '/business/menu': 'Menu',
  '/business/reservations': 'Reservations',
  '/business/tables': 'Tables',
  '/business/calendar': 'Calendar',
  '/business/profile': 'Profile',
  '/business/hours': 'Hours',
  '/business/staff': 'Staff',
  '/business/reports': 'Reports',
  '/business/history': 'History',
};

const sections = [
  { label: 'Dashboard', to: '/business' },
  { label: 'Orders', to: '/business/orders' },
  { label: 'Menu', to: '/business/menu' },
  { label: 'Reservations', to: '/business/reservations' },
  { label: 'Tables', to: '/business/tables' },
  { label: 'Calendar', to: '/business/calendar' },
  { label: 'Profile', to: '/business/profile' },
  { label: 'Hours', to: '/business/hours' },
  { label: 'Staff', to: '/business/staff' },
  { label: 'Reports', to: '/business/reports' },
  { label: 'History', to: '/business/history' },
];

export default function BusinessPage() {
  const location = useLocation();
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      businessService.getDashboard(),
      businessService.getOrders(),
      businessService.getProfile(),
    ]).then(([nextDashboard, nextOrders, nextProfile]) => {
      if (!active) return;
      setDashboard(nextDashboard);
      setOrders(nextOrders);
      setProfile(nextProfile);
    }).catch((error) => console.error('Unable to load business workspace.', error));

    return () => { active = false; };
  }, []);

  const currentView = useMemo(() => {
    const exactMatch = BUSINESS_PATHS[location.pathname];
    if (exactMatch) return exactMatch;
    return 'Dashboard';
  }, [location.pathname]);

  return (
    <div className="section-shell admin-shell">
      <div className="page-header">
        <div>
          <h1>Business workspace</h1>
          <p>Operations, reservations, staff, and menu management for your restaurant.</p>
        </div>
      </div>

      <nav className="tabs" aria-label="Business sections">
        {sections.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className={section.label === currentView ? 'tab is-active' : 'tab'}
          >
            {section.label}
          </Link>
        ))}
      </nav>

      {currentView === 'Dashboard' && (
        <>
          <div className="dashboard-grid stat-grid">
            <div className="stat-card">
              <span>Orders</span>
              <strong>{dashboard?.totals?.orders ?? 0}</strong>
              <small>Live kitchen queue</small>
            </div>
            <div className="stat-card">
              <span>Revenue</span>
              <strong>₱{dashboard?.totals?.revenue?.toLocaleString?.() ?? '0'}</strong>
              <small>Gross sales</small>
            </div>
            <div className="stat-card">
              <span>Reservations</span>
              <strong>{dashboard?.totals?.reservations ?? 0}</strong>
              <small>Upcoming bookings</small>
            </div>
            <div className="stat-card">
              <span>Items sold</span>
              <strong>{dashboard?.totals?.itemsSold ?? 0}</strong>
              <small>Last 30 days</small>
            </div>
          </div>

          <div className="dashboard-grid dashboard-columns">
            <div className="info-card dashboard-card">
              <div className="card-header-row">
                <h3>Pending orders</h3>
              </div>
              <div className="activity-list">
                {(dashboard?.pendingOrders || []).map((order) => (
                  <div key={order.id} className="activity-row">
                    <div>
                      <strong>{order.id}</strong>
                      <div>{order.status}</div>
                    </div>
                    <span>₱{order.total}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="summary-card dashboard-card">
              <div className="card-header-row">
                <h3>Upcoming reservations</h3>
              </div>
              <div className="activity-list">
                {(dashboard?.upcomingReservations || []).map((reservation) => (
                  <div key={reservation.id} className="activity-row">
                    <div>
                      <strong>{reservation.tableLabel}</strong>
                      <div>{reservation.guestCount} guests</div>
                    </div>
                    <span>{new Date(reservation.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {currentView === 'Orders' && (
        <div className="info-card dashboard-card">
          <div className="card-header-row">
            <h3>Current order queue</h3>
          </div>
          <div className="activity-list">
            {orders.map((order) => (
              <div key={order.id} className="activity-row">
                <div>
                  <strong>{order.id}</strong>
                  <div>{order.customerName}</div>
                </div>
                <span>{order.status}</span>
                <span>₱{order.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentView === 'Profile' && (
        <div className="info-card dashboard-card">
          <div className="card-header-row">
            <h3>Restaurant profile</h3>
          </div>
          <div className="activity-list">
            <div className="activity-row"><div><strong>Name</strong></div><span>{profile?.name || 'SALO Kitchen'}</span></div>
            <div className="activity-row"><div><strong>Overview</strong></div><span>{profile?.description || 'Filipino comfort food and sharing plates.'}</span></div>
            <div className="activity-row"><div><strong>Cuisines</strong></div><span>{(profile?.cuisines || ['Filipino', 'Street food']).join(', ')}</span></div>
            <div className="activity-row"><div><strong>Status</strong></div><span>{profile?.status || 'active'}</span></div>
          </div>
        </div>
      )}

      {currentView !== 'Dashboard' && currentView !== 'Orders' && currentView !== 'Profile' && (
        <div className="info-card dashboard-card">
          <div className="card-header-row">
            <h3>{currentView}</h3>
          </div>
          <p className="muted-label">This workspace area is scaffolded for the business flow. Connect the mock adapter or backend contract once the full service layer is in place.</p>
        </div>
      )}
    </div>
  );
}
