import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3, MapPin, Star, UtensilsCrossed } from 'lucide-react';
import config from '../../config';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { businessService } from '../../services/businessService';
import { formatPeso } from '../../utils/formatPeso';
import { HoursSection, PhotosSection, ProfileSection } from './BusinessSetupSection';
import './BusinessWorkspacePages.css';

function manilaDate(value) {
  return value
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(value))
    : '';
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
}

function formatClock(value) {
  if (!value) return '';
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function orderTotal(order) {
  return Number(order.totals?.total || 0);
}

function metricOrders(orders) {
  const today = manilaDate(new Date().toISOString());
  const todayOrders = orders.filter((order) => manilaDate(order.placed_at) === today);
  const finished = todayOrders.filter((order) => ['completed', 'delivered'].includes(order.status));
  return [
    { label: 'Orders today', value: todayOrders.length, detail: 'Orders received today' },
    { label: 'Needs attention', value: orders.filter((order) => ['placed', 'confirmed'].includes(order.status)).length, detail: 'Placed or awaiting preparation' },
    { label: 'Being prepared', value: orders.filter((order) => order.status === 'preparing').length, detail: 'Currently in the kitchen' },
    { label: 'Completed today', value: finished.length, detail: formatPeso(finished.reduce((sum, order) => sum + orderTotal(order), 0)) },
  ];
}

export function BusinessOverviewPage({ restaurantId, user, workspace, canViewOrders, canViewReservations, permissions = [] }) {
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const restaurant = workspace?.restaurant || {};

  useEffect(() => {
    let active = true;
    Promise.all([
      canViewOrders
        ? businessService.getBusinessOrders(restaurantId, { page: 1, per_page: 100 }, user)
        : Promise.resolve({ data: [] }),
      canViewReservations
        ? businessService.getBusinessReservations(restaurantId, user).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([orderResult, reservationResult]) => {
        if (!active) return;
        setOrders(orderResult.data || []);
        setReservations(reservationResult?.reservations || null);
      })
      .catch((loadError) => { if (active) setError(loadError.message || 'Restaurant activity could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canViewOrders, canViewReservations, restaurantId, user]);

  const metrics = useMemo(() => {
    const orderMetrics = canViewOrders ? metricOrders(orders) : [];
    if (!canViewReservations || !reservations) return orderMetrics;
    const today = manilaDate(new Date().toISOString());
    const todayReservations = reservations.filter((reservation) => manilaDate(reservation.reserved_for) === today);
    return [
      ...orderMetrics,
      { label: 'Reservations today', value: todayReservations.length, detail: 'Guests expected today' },
      { label: 'Pending reservations', value: reservations.filter((reservation) => reservation.status === 'pending').length, detail: 'Awaiting a decision' },
    ];
  }, [canViewOrders, canViewReservations, orders, reservations]);
  const pendingReservations = reservations?.filter((reservation) => reservation.status === 'pending').length;
  const checklist = workspace?.setup_checklist || [];
  const toolPermissions = {
    profile: 'restaurant.page.edit',
    hours: 'restaurant.hours.manage',
    menu: 'restaurant.menu.manage',
    tables: 'tables.manage',
    publish: 'restaurant.publish',
  };
  const incomplete = checklist.filter((item) => (
    !item.complete && (!toolPermissions[item.key] || permissions.includes(toolPermissions[item.key]))
  ));
  const recentOrders = [...orders].sort((a, b) => new Date(b.placed_at) - new Date(a.placed_at)).slice(0, 5);

  return (
    <div className="business-workspace-page">
      <header className="business-page-heading">
        <div>
          <p className="business-eyebrow">Restaurant overview</p>
          <h2>Today at {restaurant.name || 'your restaurant'}</h2>
          <p>A quick view of incoming work and restaurant readiness.</p>
        </div>
        <span className={`business-status business-status--${restaurant.status || 'unknown'}`}>
          {String(restaurant.status || 'Unknown').replaceAll('_', ' ')}
        </span>
      </header>

      {restaurant.is_read_only ? <p className="business-readonly" role="status">This restaurant is suspended. All restaurant actions are read-only.</p> : null}
      {error ? <p className="business-error" role="alert">{error}</p> : null}
      {loading ? <p className="business-loading" role="status">Loading today’s restaurant activity…</p> : null}

      {!loading && !error ? (
        <>
          {metrics.length ? <section className="business-metrics" aria-label="Restaurant order summary">
            {metrics.map((metric) => (
              <article className="business-metric-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </section> : null}

          <section className="business-dashboard-panels">
            <article className="business-panel">
              <div className="business-panel-heading">
                <div><h3>Recent customer orders</h3><p>Orders placed at your restaurant</p></div>
                {canViewOrders ? <Link to="/business/orders">View all <ArrowUpRight size={15} /></Link> : null}
              </div>
              {!canViewOrders ? <p className="business-empty-state">Order details are not available for your position.</p> : recentOrders.length ? (
                <ul className="business-recent-orders">
                  {recentOrders.map((order) => (
                    <li key={order.id}>
                      <span><strong>{order.reference_code}</strong><small>{order.recipient?.name || 'Customer'} · {formatTime(order.placed_at)}</small></span>
                      <span className={`business-order-status business-order-status--${order.status}`}>{String(order.status).replaceAll('_', ' ')}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="business-empty-state">No restaurant orders yet.</p>}
            </article>

            <article className="business-panel business-alert-panel">
              <div className="business-panel-heading"><div><h3>Restaurant readiness</h3><p>Keep important setup items on track.</p></div></div>
              <div className="business-alert-summary">
                <strong>{incomplete.length}</strong><span>setup item(s) need attention</span>
              </div>
              {incomplete.length ? (
                <ul>{incomplete.slice(0, 4).map((item) => <li key={item.key}><Link to={item.href}>{item.label}</Link></li>)}</ul>
              ) : <p className="business-success" role="status">Your setup checklist is complete.</p>}
              <div className="business-overview-quick-links">
                {canViewReservations ? <Link to="/business/reservations">
                  <strong>{reservations ? reservations.length : '—'}</strong>
                  <span>Reservations</span>
                  {pendingReservations !== undefined ? <small>{pendingReservations} pending</small> : <small>{config.useMock ? 'No pending demo requests' : 'Reservation API unavailable'}</small>}
                </Link> : null}
                <Link to="/business/menu"><UtensilsCrossed size={18} /><span>Manage menu</span></Link>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}

export function BusinessPublicPage({ restaurantId, user, canEdit, canManagePhotos, canManageHours, readOnly }) {
  const [preview, setPreview] = useState(null);
  const [menu, setMenu] = useState(null);
  const [profile, setProfile] = useState({});
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [photosEditorOpen, setPhotosEditorOpen] = useState(false);
  const [hoursEditorOpen, setHoursEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfileData = useCallback(() => Promise.all([
      businessService.getPreview(restaurantId, user),
      businessService.getMenu(restaurantId, {}, user),
      businessService.getProfile(restaurantId, user),
  ]), [restaurantId, user]);
  const applyProfileData = useCallback(([previewResult, menuResult, profileResult]) => {
    setPreview(previewResult);
    setMenu(menuResult);
    setProfile(profileResult.restaurant || {});
  }, []);
  const refreshProfile = useCallback(async () => {
    applyProfileData(await loadProfileData());
  }, [applyProfileData, loadProfileData]);

  useEffect(() => {
    let active = true;
    loadProfileData()
      .then((result) => {
        if (active) {
          applyProfileData(result);
          setError('');
        }
      })
      .catch((loadError) => { if (active) setError(loadError.message || 'Restaurant preview could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyProfileData, loadProfileData]);

  const restaurant = preview?.restaurant;
  const profileRestaurant = profile;
  const hours = preview?.hours?.hours || {};
  const hasConfiguredHours = Boolean(preview?.hours?.is_24_7)
    || Object.values(hours).some((shifts) => Array.isArray(shifts) && shifts.length > 0);
  const menuItems = (menu?.items || []).filter((item) => item.lifecycle_status === 'published');
  const photos = restaurant?.photos || [];

  if (loading) return <p className="business-loading" role="status">Loading your customer-facing restaurant preview…</p>;
  if (error) return <p className="business-error" role="alert">{error}</p>;

  return (
    <div className="business-workspace-page business-public-page">
      <header className="business-page-heading">
        <div>
          <p className="business-eyebrow">Customer-facing page</p>
          <h2>How customers see your restaurant</h2>
          <p>This preview uses your approved live profile and published menu.</p>
        </div>
        <span className={`business-status business-status--${restaurant?.is_published ? 'approved' : 'unknown'}`}>
          {restaurant?.is_published ? 'Published' : 'Not published'}
        </span>
      </header>

      <article className="business-public-card">
        <div className="business-public-hero" style={restaurant?.cover_url ? { backgroundImage: `linear-gradient(90deg, rgba(28, 20, 14, .78), rgba(28, 20, 14, .08)), url("${restaurant.cover_url}")` } : undefined}>
          <div className="business-public-identity">
            {restaurant?.logo_url ? <img src={restaurant.logo_url} alt={`${restaurant.name} logo`} /> : <span className="business-public-logo-fallback"><UtensilsCrossed size={28} /></span>}
            <div>
              <p>{[restaurant?.category, restaurant?.cuisine].filter(Boolean).join(' · ') || 'Restaurant'}</p>
              <h3>{restaurant?.name || 'Your restaurant'}</h3>
              <span className="business-public-open-status"><i />{restaurant?.status === 'closed' ? 'Temporarily closed' : restaurant?.open_now ? 'Open now' : hasConfiguredHours ? 'Closed now' : 'Hours not set'}</span>
              {profileRestaurant.street ? <span className="business-public-location"><MapPin size={15} />{profileRestaurant.street}</span> : null}
            </div>
          </div>
        </div>

        <div className="business-public-content">
          <div className="business-public-actions" aria-label="Restaurant profile actions">
            {canEdit && !readOnly ? <Button onClick={() => setProfileEditorOpen(true)}>Edit Business</Button> : null}
            {restaurant?.is_published ? <Link className="btn btn--secondary btn--md" to={`/restaurants/${restaurant.id}`}>View customer page</Link> : null}
            {canManagePhotos && !readOnly ? <Button variant="secondary" onClick={() => setPhotosEditorOpen(true)}>Edit photos</Button> : null}
            <Link className="business-public-map-link" to="/business/publish"><MapPin size={16} /> Publish checklist</Link>
          </div>
          <nav className="business-profile-nav" aria-label="Restaurant profile sections">
            <a href="#about">About</a>
            <a href="#hours">Hours</a>
            <a href="#menu">Menu</a>
            <a href="#branches">Branches</a>
            <a href="#reviews">Ratings &amp; Reviews</a>
            <a href="#photos">Photos</a>
          </nav>
          <section className="business-public-section business-public-about" id="about">
            <div className="business-panel-heading">
              <div><h3>About</h3><p>Restaurant information visible to customers</p></div>
              {canEdit && !readOnly ? <Button variant="secondary" size="sm" onClick={() => setProfileEditorOpen(true)}>Edit</Button> : null}
            </div>
            <p>{restaurant?.description || 'Add a description to introduce your restaurant to customers.'}</p>
            <div className="business-public-info">
              {restaurant?.category ? <p><strong>Category</strong><br />{restaurant.category}</p> : null}
              {restaurant?.cuisine ? <p><strong>Cuisine</strong><br />{restaurant.cuisine}</p> : null}
              {restaurant?.contact_number ? <p><strong>Contact</strong><br />{restaurant.contact_number}</p> : null}
              {profileRestaurant.street ? <p><strong>Location</strong><br /><MapPin size={15} /> {profileRestaurant.street}</p> : null}
              {profileRestaurant.delivery_radius_km ? <p><strong>Delivery radius</strong><br />Within {profileRestaurant.delivery_radius_km} km</p> : null}
              {profileRestaurant.prep_minutes ? <p><strong>Preparation time</strong><br />About {profileRestaurant.prep_minutes} minutes</p> : null}
            </div>
          </section>
          <section className="business-public-section" id="hours">
            <div className="business-panel-heading"><div><h3>Opening hours</h3><p><Clock3 size={15} /> Weekly schedule</p></div>{canManageHours && !readOnly ? <Button variant="secondary" size="sm" onClick={() => setHoursEditorOpen(true)}>Edit hours</Button> : null}</div>
            {preview?.hours?.is_24_7 ? <p>Open 24/7</p> : (
              <ul className="business-public-hours">{Object.entries(hours).map(([day, shifts]) => (
                <li key={day}><strong>{day}</strong><span>{shifts?.length ? shifts.map((shift) => `${formatClock(shift.open_time)}–${formatClock(shift.close_time)}${shift.crosses_midnight ? ' (next day)' : ''}`).join(', ') : 'Closed'}</span></li>
              ))}</ul>
            )}
          </section>
          <section className="business-public-section" id="menu">
            <div className="business-panel-heading"><div><h3>Menu</h3><p>Published items and current availability</p></div><Link to="/business/menu">Manage menu</Link></div>
            {menuItems.length ? (
              <div className="business-public-menu-grid">{menuItems.slice(0, 6).map((item) => {
                const category = menu?.categories?.find((entry) => String(entry.id) === String(item.category_id));
                const isOrderable = item.is_orderable ?? item.is_available;
                return (
                  <article className="business-public-menu-card" key={item.id}>
                    {item.image_url || item.photo_url
                      ? <img src={item.image_url || item.photo_url} alt={item.name} />
                      : <span className="business-public-item-icon"><UtensilsCrossed size={22} /></span>}
                    <div className="business-public-menu-card__body">
                      <div><h4>{item.name}</h4><strong>{formatPeso(item.price)}</strong></div>
                      <p>{item.description || ' '}</p>
                      <div className="business-public-menu-card__meta">
                        <span>{category?.name || 'Menu item'}</span>
                        <span>{isOrderable ? 'Available' : 'Sold out'}</span>
                      </div>
                    </div>
                  </article>
                );
              })}</div>
            ) : <p className="business-empty-state">No published menu items are available to preview yet.</p>}
          </section>
          <section className="business-public-section" id="branches">
            <div className="business-panel-heading"><div><h3>Branches</h3><p>Restaurant locations</p></div></div>
            <p>Branch management is not available for this restaurant yet.</p>
          </section>
          <section className="business-public-section" id="reviews">
            <div className="business-panel-heading"><div><h3>Ratings &amp; Reviews</h3><p>Customer feedback</p></div></div>
            <div className="business-review-unavailable">
              <Star size={20} aria-hidden="true" />
              <p>Ratings and customer reviews are not available yet.</p>
            </div>
          </section>
          <section className="business-public-section" id="photos">
            <div className="business-panel-heading">
              <div><h3>Photos</h3><p>Restaurant gallery</p></div>
              {canManagePhotos && !readOnly ? <Button variant="secondary" size="sm" onClick={() => setPhotosEditorOpen(true)}>Manage photos</Button> : null}
            </div>
            {photos.length ? (
              <div className="business-public-gallery">{photos.map((photo) => <img key={photo.id || photo.url} src={photo.url} alt={photo.alt_text || restaurant.name} />)}</div>
            ) : <p className="business-empty-state">No gallery photos yet.</p>}
          </section>
        </div>
      </article>
      <Modal open={profileEditorOpen} title="Edit restaurant profile" onClose={() => setProfileEditorOpen(false)}>
        <ProfileSection restaurantId={restaurantId} user={user} readOnly={readOnly} onSaved={refreshProfile} />
      </Modal>
      <Modal open={photosEditorOpen} title="Manage restaurant photos" onClose={() => setPhotosEditorOpen(false)}>
        <PhotosSection restaurantId={restaurantId} user={user} readOnly={readOnly} onSaved={refreshProfile} />
      </Modal>
      <Modal open={hoursEditorOpen} title="Edit opening hours" onClose={() => setHoursEditorOpen(false)}>
        <HoursSection restaurantId={restaurantId} user={user} readOnly={readOnly} onSaved={refreshProfile} />
      </Modal>
    </div>
  );
}

export function BusinessReportsPage({ restaurantId, user, canViewSales, canViewReservations }) {
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      canViewSales
        ? businessService.getBusinessOrders(restaurantId, { page: 1, per_page: 100 }, user)
        : Promise.resolve({ data: [] }),
      canViewReservations
        ? businessService.getBusinessReservations(restaurantId, user).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([orderResult, reservationResult]) => {
        if (!active) return;
        setOrders(orderResult.data || []);
        setReservations(reservationResult?.reservations || null);
      })
      .catch((loadError) => { if (active) setError(loadError.message || 'Reports could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canViewReservations, canViewSales, restaurantId, user]);

  const completed = orders.filter((order) => ['completed', 'delivered'].includes(order.status));
  const cancelled = orders.filter((order) => ['cancelled', 'rejected', 'delivery_failed'].includes(order.status));
  const revenue = completed.reduce((sum, order) => sum + orderTotal(order), 0);
  const popularItems = useMemo(() => {
    const counts = new Map();
    orders.forEach((order) => order.items.forEach((item) => counts.set(item.name, (counts.get(item.name) || 0) + Number(item.quantity || 0))));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);
  const maxItemCount = Math.max(1, ...popularItems.map(([, count]) => count));

  return (
    <div className="business-workspace-page">
      <header className="business-page-heading">
        <div><p className="business-eyebrow">Restaurant analytics</p><h2>Reports</h2><p>Operational summaries from restaurant orders and reservations.</p></div>
        {config.useMock ? <span className="business-demo-badge">Demo data</span> : null}
      </header>
      <p className="business-data-note" role="note">
        {config.useMock
          ? 'These sample figures are demo data stored for this restaurant workspace.'
          : 'Order metrics summarize up to the latest 100 orders. Full historical reports are not yet available.'}
      </p>
      {error ? <p className="business-error" role="alert">{error}</p> : null}
      {loading ? <p className="business-loading" role="status">Loading restaurant reports…</p> : null}
      {!loading && !error ? (
        <>
          <section className="business-metrics" aria-label="Order and revenue metrics">
            {[
              ...(canViewSales ? [
                ['Orders received', orders.length],
                ['Completed', completed.length],
                ['Cancelled / rejected', cancelled.length],
                ['Completed order value', formatPeso(revenue)],
              ] : []),
              ...(canViewReservations ? [['Reservations', reservations?.length ?? '—']] : []),
            ].map(([label, value]) => <article className="business-metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>Latest available records</small></article>)}
          </section>
          <section className="business-panel business-popular-items">
            <div className="business-panel-heading"><div><h3>Popular ordered items</h3><p>Based on quantities in the loaded order records</p></div></div>
            {popularItems.length ? <ul>{popularItems.map(([name, count]) => (
              <li key={name}><span><strong>{name}</strong><small>{count} ordered</small></span><i style={{ width: `${Math.max(8, (count / maxItemCount) * 100)}%` }} /></li>
            ))}</ul> : <p className="business-empty-state">Order item statistics will appear when orders are available.</p>}
          </section>
        </>
      ) : null}
    </div>
  );
}
