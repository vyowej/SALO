import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock3, MapPin, RotateCw, Utensils, X } from 'lucide-react';
import { restaurantService } from '../../services/restaurantService';
import RestaurantCard from '../../components/restaurant/RestaurantCard';
import { formatPeso } from '../../utils/formatPeso';
import { getOpenStatus } from '../../utils/getOpenStatus';
import { useAuth } from '../../context/AuthContext';
import { config } from '../../config';
import { getGreeting } from '../../constants/voice';
import './CustomerHome.css';

export default function CustomerHomePage() {
  const { user, emailVerified, verifyEmail, sendVerificationEmail } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [homeContent, setHomeContent] = useState({ filters: [], promotions: [], estimatedArrival: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [serviceMode, setServiceMode] = useState('Delivery');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('Recommended');
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(`salo-verify-banner-dismissed-${user?.id}`) === 'true';
    } catch (error) {
      console.error('Unable to read email verification banner preference.', error);
      return false;
    }
  });
  const firstName = user?.first_name || user?.name?.split(' ')[0] || 'there';

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [restaurantData, orderData, categoryData, contentData] = await Promise.all([
        restaurantService.getAllRestaurants(),
        restaurantService.getOrders(),
        restaurantService.getCategories(),
        restaurantService.getCustomerHomeContent(),
      ]);
      setRestaurants(restaurantData);
      setOrders(orderData);
      setCategories(categoryData);
      setHomeContent(contentData);
    } catch (loadError) {
      console.error('Unable to load customer home data.', loadError);
      setError('We couldn’t load restaurants right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      restaurantService.getAllRestaurants(),
      restaurantService.getOrders(),
      restaurantService.getCategories(),
      restaurantService.getCustomerHomeContent(),
    ])
      .then(([restaurantData, orderData, categoryData, contentData]) => {
        if (!active) return;
        setRestaurants(restaurantData);
        setOrders(orderData);
        setCategories(categoryData);
        setHomeContent(contentData);
      })
      .catch((loadError) => {
        console.error('Unable to load customer home data.', loadError);
        if (active) setError('We couldn’t load restaurants right now.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredRestaurants = useMemo(() => restaurants.filter((restaurant) => {
    const tagText = restaurant.tags.join(' ').toLowerCase();
    const categoryMatches = !category || restaurant.tags.includes(category) || restaurant.cuisine.includes(category);
    const filterMatches = !activeFilter
      || (activeFilter === 'Open now' && ['open', 'closing-soon'].includes(getOpenStatus(restaurant).status))
      || (activeFilter === 'Filipino only' && restaurant.filipinoOnly)
      || (activeFilter === 'Pork-free' && tagText.includes('pork-free'))
      || (activeFilter === 'Halal-certified' && tagText.includes('halal'))
      || (activeFilter === 'Vegetarian' && tagText.includes('vegetarian'))
      || (activeFilter === 'Reservations' && restaurant.acceptsReservations)
      || (activeFilter === 'Free delivery' && restaurant.deliveryFee === 0);
    return categoryMatches && filterMatches;
  }).sort((first, second) => {
    if (sortBy === 'Fastest') return Number.parseInt(first.deliveryTime, 10) - Number.parseInt(second.deliveryTime, 10);
    if (sortBy === 'Rating') return second.rating - first.rating;
    if (sortBy === 'Nearest') return first.distanceKm - second.distanceKm;
    const firstOpen = ['open', 'closing-soon'].includes(getOpenStatus(first).status);
    const secondOpen = ['open', 'closing-soon'].includes(getOpenStatus(second).status);
    return Number(secondOpen) - Number(firstOpen);
  }), [restaurants, category, activeFilter, sortBy]);

  const activeOrder = orders.find((order) => ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'On the way'].includes(order.status));
  const firstClosedIndex = filteredRestaurants.findIndex((restaurant) => !['open', 'closing-soon'].includes(getOpenStatus(restaurant).status));

  const dismissVerifyBanner = () => {
    setVerifyBannerDismissed(true);
    try {
      window.localStorage.setItem(`salo-verify-banner-dismissed-${user?.id}`, 'true');
    } catch (error) {
      console.error('Unable to save email verification banner preference.', error);
    }
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    setVerificationError('');
    try {
      if (!await verifyEmail(verificationCode)) {
        setVerificationError('That code does not match. Please check it and try again.');
        return;
      }
      setVerificationOpen(false);
      setVerificationCode('');
      setVerifyBannerDismissed(true);
    } catch (error) {
      console.error('Unable to verify this email.', error);
      setVerificationError('We couldn’t verify your email. Please try again.');
    }
  };

  const requestEmailVerification = async (event) => {
    event.preventDefault();
    setVerificationError('');
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
    } catch (error) {
      console.error('Unable to send an email verification link.', error);
      setVerificationError('We couldn’t send a verification link. Please try again.');
    }
  };

  return (
    <div className="customer-home section-shell">
      <section className="customer-home__welcome">
        <div>
          <span className="eyebrow">Your SALO</span>
          <h1><span lang="tl">{getGreeting(new Date(), firstName)}</span></h1>
          <p>Good food and good company are closer than you think.</p>
        </div>
        <div className="service-segment" role="group" aria-label="Choose service">
          {['Delivery', 'Pick-up', 'Reserve'].map((mode) => (
            <button key={mode} type="button" className={serviceMode === mode ? 'is-selected' : ''} onClick={() => setServiceMode(mode)}>
              {mode}
            </button>
          ))}
        </div>
      </section>

      {!emailVerified && !verifyBannerDismissed ? (
        <aside className="verify-email-banner" role="status">
          <span><strong>Verify your email to place orders</strong><small>Verify your email to continue to checkout.</small></span>
          <button type="button" className="btn btn--secondary btn--md" onClick={() => setVerificationOpen(true)}>Verify email</button>
          <button type="button" className="verify-email-banner__dismiss" onClick={dismissVerifyBanner} aria-label="Dismiss email verification reminder"><X size={16} /></button>
        </aside>
      ) : null}

      {activeOrder ? (
        <section className="active-order-card">
          <div className="active-order-card__icon"><Clock3 size={18} /></div>
          <div className="active-order-card__body">
            <strong>{activeOrder.restaurant}</strong>
            <span>{activeOrder.status} · Estimated arrival in {homeContent.estimatedArrival}</span>
            <div className="order-progress" aria-label={`Order status: ${activeOrder.status}`}><i /></div>
          </div>
          <Link to={`/orders/${activeOrder.id}`} className="btn btn--secondary btn--md">Track</Link>
        </section>
      ) : null}

      <section className="customer-home__categories" aria-label="Browse food categories">
        <div className="section-title-row"><h2>What are you craving?</h2><Link to="/restaurants">Browse all <ArrowRight size={14} /></Link></div>
        <div className="category-rail">
          {categories.map((item, index) => (
            <button key={item} type="button" className={['category-tile', category === item ? 'is-selected' : ''].filter(Boolean).join(' ')} onClick={() => setCategory(category === item ? '' : item)}>
              <span className={`category-tile__icon category-tile__icon--${index % 4}`}><Utensils size={18} /></span>
              <span>{item}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="promo-rail" aria-label="Promotions">
        {homeContent.promotions.map((promotion) => (
          <article key={promotion.title} className={`promo-card promo-card--${promotion.tone}`}>
            <span className="promo-card__sponsor">{promotion.sponsor}</span>
            <h3>{promotion.title}</h3>
            <p>{promotion.description}</p>
          </article>
        ))}
      </section>

      <section className="customer-home__restaurants">
        <div className="section-title-row"><div><span className="eyebrow">Made for your neighborhood</span><h2>Now open for order</h2><p className="customer-home__section-copy">Open kitchens first, with more neighborhood spots below.</p></div><Link to="/restaurants">See all <ArrowRight size={14} /></Link></div>
        <div className="filter-rail" aria-label="Restaurant filters">
        {homeContent.filters.map((filter) => (
            <button key={filter} type="button" className={['chip', activeFilter === filter ? 'chip--selected' : ''].filter(Boolean).join(' ')} onClick={() => setActiveFilter(activeFilter === filter ? '' : filter)}>{filter}</button>
          ))}
          <select aria-label="Sort restaurants" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option>Recommended</option><option>Fastest</option><option>Rating</option><option>Nearest</option>
          </select>
        </div>
        {error ? (
          <div className="empty-state"><h3>Restaurants unavailable</h3><p>{error}</p><button className="btn btn--secondary" type="button" onClick={loadData}><RotateCw size={15} /> Try again</button></div>
        ) : loading ? (
          <div className="customer-restaurant-grid">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-card customer-card-skeleton" key={index}><div className="skeleton skeleton-card__image" /><div className="skeleton-card__body"><div className="skeleton skeleton--text" /><div className="skeleton skeleton--text skeleton-card__line--short" /></div></div>)}</div>
        ) : filteredRestaurants.length ? (
          <div className="customer-restaurant-grid">{filteredRestaurants.map((restaurant, index) => <Fragment key={restaurant.id}>{index === firstClosedIndex && firstClosedIndex > 0 ? <p className="restaurant-closed-divider">Closed now · opening times are shown on each restaurant</p> : null}<RestaurantCard restaurant={restaurant} /></Fragment>)}</div>
        ) : (
          <div className="empty-state"><h3>No restaurants match those filters</h3><p>Clear a filter to see more nearby options.</p></div>
        )}
      </section>

      <section className="customer-home__rails">
        <div className="home-rail-panel">
          <div className="section-title-row"><h2>Order again</h2><Link to="/orders">Past orders <ArrowRight size={14} /></Link></div>
          {orders.length ? orders.slice(0, 2).map((order) => (
            <div className="repeat-order" key={order.id}>
              <div><strong>{order.restaurant}</strong><span>{order.items}</span></div>
              <Link to="/restaurants" className="btn btn--secondary btn--md"><RotateCw size={14} /> Reorder · {formatPeso(order.total)}</Link>
            </div>
          )) : <p className="muted-copy">Your past orders will appear here.</p>}
        </div>
        <div className="home-rail-panel home-rail-panel--reserve">
          <span className="eyebrow">Make tonight special</span>
          <h2>Reserve a table tonight</h2>
          <p>Pick a time, invite your people, and let the restaurant prepare for your arrival.</p>
          <Link to="/reserve" className="btn btn--primary btn--md"><MapPin size={15} /> Find a table</Link>
        </div>
      </section>

      {verificationOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setVerificationOpen(false); }}>
          <section className="modal verification-modal" role="dialog" aria-modal="true" aria-labelledby="verification-title">
            <header className="modal__header"><div><h2 id="verification-title">Verify your email</h2><p>{config.useMock ? `We sent a one-time code to ${user?.email}.` : `We’ll email a verification link to ${user?.email}.`}</p></div><button type="button" className="icon-button" aria-label="Close verification dialog" onClick={() => setVerificationOpen(false)}><X size={17} /></button></header>
            <form className="modal__body verification-form" onSubmit={config.useMock ? submitVerification : requestEmailVerification}>
              {config.useMock ? <><div className="field"><label htmlFor="verification-code">6-digit code</label><input id="verification-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ''))} required /></div><p className="verification-hint">Enter the one-time verification code.</p></> : null}
              {verificationSent ? <p className="form-success" role="status">If verification is needed, a link will be sent to your email.</p> : null}
              {verificationError ? <p className="form-error" role="alert">{verificationError}</p> : null}
              <button type="submit" className="btn btn--primary btn--full">{config.useMock ? <><Check size={16} /> Verify email</> : verificationSent ? 'Resend verification link' : 'Send verification link'}</button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
