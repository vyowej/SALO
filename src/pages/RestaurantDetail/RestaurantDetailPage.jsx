import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MapPin, Search, ShoppingBag, Star, UtensilsCrossed, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCart } from '../../context/CartContext';
import { useLocationContext } from '../../context/LocationContext';
import { formatPeso } from '../../utils/formatPeso';
import { restaurantService } from '../../services/restaurantService';
import { locationService } from '../../services/locationService';
import { getOpenStatus } from '../../utils/getOpenStatus';
import '../Page.css';
import './RestaurantDetail.css';

const isVisibleItem = (item) => !['draft', 'archived'].includes(String(item.status || '').toLowerCase()) && !item.archived;

export default function RestaurantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    addItem,
    cart,
    activeRestaurantId,
    setActiveRestaurant,
    totalItems,
  } = useCart();
  const { selectedAddress } = useLocationContext();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [itemNote, setItemNote] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [pendingCartItem, setPendingCartItem] = useState(null);
  const [favorite, setFavorite] = useState(false);
  const [serviceMode, setServiceMode] = useState('Delivery');
  const [distanceResult, setDistanceResult] = useState(null);
  const [toast, setToast] = useState('');
  const groupRefs = useRef({});
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const touchStartY = useRef(0);
  const toastTimer = useRef(null);

  const menuGroups = useMemo(() => (restaurant?.menu || [])
    .map((group) => ({ ...group, items: group.items.filter(isVisibleItem) }))
    .filter((group) => group.items.length), [restaurant]);
  const openStatus = restaurant ? getOpenStatus(restaurant) : null;
  const canOrder = openStatus?.status === 'open' || openStatus?.status === 'closing-soon';
  const distanceMatchesSelection = Boolean(distanceResult && restaurant
    && distanceResult.restaurantId === restaurant.id
    && distanceResult.latitude === selectedAddress?.latitude
    && distanceResult.longitude === selectedAddress?.longitude);
  const distance = distanceMatchesSelection ? distanceResult.distance : null;
  const outsideRange = distanceMatchesSelection && distance > restaurant.delivery_radius_km;
  const checkingRange = Boolean(restaurant && selectedAddress?.latitude && !distanceMatchesSelection);
  const deliveryBlocked = outsideRange && serviceMode === 'Delivery';
  const restaurantCart = restaurant ? cart[restaurant.id] || [] : [];
  const otherRestaurantCarts = restaurant ? Object.keys(cart).filter((cartId) => cartId !== restaurant.id && cart[cartId]?.length) : [];
  const cartTotal = restaurantCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const optionTotal = selectedOptions.reduce((sum, option) => sum + option.price, 0);
  const itemUnitPrice = Number(selectedItem?.price || 0) + optionTotal;
  const itemTotal = itemUnitPrice * quantity;

  const loadRestaurant = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const item = await restaurantService.getRestaurantById(id);
      if (!item) {
        setRestaurant(null);
        setError('We couldn’t find this restaurant.');
        return;
      }
      setRestaurant(item);
      setSelectedCategory(item.menu?.find((group) => group.items.some(isVisibleItem))?.category || '');
    } catch (loadError) {
      console.error('Unable to load restaurant details.', loadError);
      setError('We couldn’t load this restaurant.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    restaurantService.getRestaurantById(id)
      .then((item) => {
        if (!active) return;
        if (!item) {
          setRestaurant(null);
          setError('We couldn’t find this restaurant.');
          return;
        }
        setRestaurant(item);
        setSelectedCategory(item.menu?.find((group) => group.items.some(isVisibleItem))?.category || '');
      })
      .catch((loadError) => {
        console.error('Unable to load restaurant details.', loadError);
        if (active) setError('We couldn’t load this restaurant.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!restaurant || !selectedAddress?.latitude) return undefined;
    let active = true;
    locationService.getDistanceKm(selectedAddress, restaurant).then((value) => {
      if (!active) return;
      setDistanceResult({
        restaurantId: restaurant.id,
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
        distance: value,
      });
    }).catch((distanceError) => console.error('Unable to calculate delivery range.', distanceError));
    return () => { active = false; };
  }, [restaurant, selectedAddress]);

  useEffect(() => {
    if (!menuGroups.length || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setSelectedCategory(visible.target.dataset.menuCategory);
    }, { rootMargin: '-150px 0px -65% 0px', threshold: [0, 0.2, 0.6] });
    menuGroups.forEach((group) => {
      const node = groupRefs.current[group.category];
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [menuGroups]);

  useEffect(() => {
    if (!selectedItem) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedItem(null);
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItem]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  };

  const showAddItem = (item) => {
    if (!canOrder || deliveryBlocked || checkingRange || item.soldOut) return;
    setSelectedItem(item);
    setQuantity(1);
    setItemNote('');
    setSelectedOptions([]);
  };

  const buildCartItem = () => {
    const optionIds = selectedOptions.map((option) => option.id).sort();
    return {
      ...selectedItem,
      price: itemUnitPrice,
      cartKey: `${selectedItem.id}:${optionIds.join('|')}`,
      optionLabels: selectedOptions.map((option) => option.name),
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantDeliveryFee: restaurant.deliveryFee,
      note: itemNote.trim(),
    };
  };

  const confirmAddItem = () => {
    if (!restaurant || !selectedItem || !canOrder || deliveryBlocked || checkingRange) return;
    const item = buildCartItem();
    if (activeRestaurantId && activeRestaurantId !== restaurant.id && otherRestaurantCarts.length) {
      setPendingCartItem({ item, quantity });
      setSelectedItem(null);
      return;
    }
    addItem(restaurant.id, item, quantity);
    setSelectedItem(null);
    showToast(`${quantity} × ${selectedItem.name} added to cart`);
  };

  const startNewCart = () => {
    if (!restaurant || !pendingCartItem) return;
    setActiveRestaurant(restaurant.id);
    addItem(restaurant.id, pendingCartItem.item, pendingCartItem.quantity);
    setPendingCartItem(null);
    showToast('New restaurant cart started. Your other cart is saved.');
  };

  const toggleOption = (option) => {
    setSelectedOptions((current) => current.some((selected) => selected.id === option.id)
      ? current.filter((selected) => selected.id !== option.id)
      : [...current, option]);
  };

  const scrollToGroup = (category) => {
    setSelectedCategory(category);
    groupRefs.current[category]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return <div className="section-shell data-page"><div className="skeleton-card"><div className="skeleton skeleton-card__image" /><div className="skeleton-card__body"><div className="skeleton skeleton--text skeleton-card__line--long" /><div className="skeleton skeleton--text" /></div></div></div>;
  }
  if (error || !restaurant) {
    return <div className="section-shell data-page"><div className="empty-state empty-state--error"><h2>Restaurant unavailable</h2><p>{error || 'We couldn’t find this restaurant.'}</p><Button variant="secondary" onClick={loadRestaurant}>Try again</Button></div></div>;
  }

  return (
    <div className="section-shell restaurant-detail-page">
      <aside className="restaurant-sidebar" aria-label="Restaurant navigation">
        <Link to="/" className="restaurant-sidebar__link">Home</Link>
        <Link to="/restaurants" className="restaurant-sidebar__link">Browse restaurants</Link>
        <Link to="/orders" className="restaurant-sidebar__link">My orders</Link>
        <hr />
        <strong>Menu categories</strong>
        {menuGroups.map((group) => <button key={group.category} type="button" className={selectedCategory === group.category ? 'is-selected' : ''} onClick={() => scrollToGroup(group.category)}>{group.category}</button>)}
      </aside>

      <main className="restaurant-detail-main">
        <div className="detail-hero restaurant-cover">
          <img src={restaurant.image} alt="" />
          <div className="restaurant-cover__actions">
            <Link to="/restaurants" className="restaurant-cover__icon" aria-label="Back to restaurants"><ArrowLeft size={18} /></Link>
            <button type="button" className={`restaurant-cover__icon ${favorite ? 'is-favorite' : ''}`} aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={() => setFavorite((current) => !current)}><Heart size={18} fill={favorite ? 'currentColor' : 'none'} /></button>
          </div>
          <div className="detail-hero__overlay">
            <div className="tag-row"><span className={`detail-status detail-status--${openStatus.status}`}><i />{openStatus.label}</span>{restaurant.acceptsReservations ? <span>Reserve available</span> : null}</div>
            <h1>{restaurant.name}</h1>
            <div className="detail-hero__meta">
              <span><Star size={15} /> {restaurant.rating}</span>
              <span><MapPin size={15} /> {distance === null ? restaurant.location : `${distance.toFixed(1)} km away`}</span>
              <span>{restaurant.deliveryTime}</span>
              <span>{outsideRange ? 'Outside delivery range' : `${formatPeso(restaurant.deliveryFee)} delivery`}</span>
            </div>
          </div>
        </div>

        {checkingRange ? <p className="restaurant-range-check" role="status">Checking delivery availability for this address…</p> : null}
        {deliveryBlocked ? <div className="range-warning" role="status"><strong>Outside delivery range</strong><span>Delivery is available within {restaurant.delivery_radius_km} km. Pick-up is still available for this restaurant.</span><button type="button" className="text-link" onClick={() => setServiceMode('Pick-up')}>Choose pick-up</button></div> : null}
        <div className="restaurant-intro"><div><p>{restaurant.cuisine} · {restaurant.description}</p><div className="detail-summary__tags">{restaurant.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="restaurant-intro__search"><Search size={16} /><input type="search" placeholder="Search menu" aria-label="Search menu" onChange={(event) => { const query = event.target.value.toLowerCase(); setSelectedCategory(query ? menuGroups.find((group) => group.items.some((item) => item.name.toLowerCase().includes(query)))?.category || '' : menuGroups[0]?.category || ''); }} /></div></div>

        <nav className="menu-category-tabs" aria-label="Menu categories">{menuGroups.map((group) => <button key={group.category} type="button" className={selectedCategory === group.category ? 'is-selected' : ''} onClick={() => scrollToGroup(group.category)}>{group.category}</button>)}</nav>
        <div className="restaurant-menu-groups">
          {menuGroups.map((group) => (
            <section key={group.category} className="menu-group restaurant-menu-group" id={`menu-${group.category.replace(/\s+/g, '-').toLowerCase()}`} data-menu-category={group.category} ref={(node) => { groupRefs.current[group.category] = node; }}>
              <h2>{group.category}</h2>
              <div className="menu-items">
                {group.items.map((item) => (
                  <article key={item.id} className={`menu-item restaurant-menu-item ${item.soldOut ? 'is-sold-out' : ''}`}>
                    <img src={item.image || restaurant.image} alt="" loading="lazy" />
                    <div className="menu-item__content">
                      <div className="menu-item__header"><span className="menu-item__title">{item.name}</span><span className="menu-item__price">{formatPeso(item.price)}</span></div>
                      <p className="menu-item__meta">{item.description}</p>
                      <div className="menu-item__dietary">{item.dietaryTags?.map((tag) => <span key={tag}>{tag}</span>)}{item.soldOut ? <span className="sold-out-tag">Sold out</span> : null}</div>
                    </div>
                    <button type="button" className="restaurant-add-button" aria-label={item.soldOut ? `${item.name} sold out` : `Customize and add ${item.name}`} disabled={item.soldOut || !canOrder || deliveryBlocked || checkingRange} onClick={() => showAddItem(item)}>{item.soldOut ? '—' : '+'}</button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <aside className="detail-summary restaurant-cart-panel">
        <span className="eyebrow">Your order</span>
        <h2>{restaurant.name}</h2>
        <div className="service-segment restaurant-cart-mode" role="group" aria-label="Choose delivery or pick-up">{['Delivery', 'Pick-up'].map((mode) => <button key={mode} type="button" className={serviceMode === mode ? 'is-selected' : ''} onClick={() => setServiceMode(mode)}>{mode}</button>)}</div>
        {restaurantCart.length ? (
          <>
            <div className="restaurant-cart-lines">{restaurantCart.map((item) => <div key={item.cartKey || item.id} className="detail-cart-row"><span>{item.quantity} × {item.name}{item.optionLabels?.length ? <small>{item.optionLabels.join(', ')}</small> : null}</span><strong>{formatPeso(item.price * item.quantity)}</strong></div>)}</div>
            <div className="amount-row"><span>Items</span><strong>{formatPeso(cartTotal)}</strong></div>
            <div className="amount-row"><span>Discount</span><strong>Apply voucher in cart</strong></div>
            <div className="total-row"><span>Subtotal</span><strong>{formatPeso(cartTotal)}</strong></div>
            <Link to={`/cart?mode=${encodeURIComponent(serviceMode)}`} className="btn btn--primary btn--full">Place order · {formatPeso(cartTotal)}</Link>
          </>
        ) : <div className="empty-state restaurant-cart-empty"><ShoppingBag size={22} /><p>Your cart is empty. Add a dish to get started.</p></div>}
        {otherRestaurantCarts.length ? <div className="cart-notice">Your other restaurant carts stay saved while you order here.</div> : null}
        <div className="restaurant-dining-note"><h3><UtensilsCrossed size={16} /> Dining details</h3><p>{restaurant.acceptsReservations ? 'Table reservations are available for this restaurant.' : 'This restaurant currently does not accept reservations online.'}</p><Link to="/reserve">Reserve a table</Link></div>
      </aside>

      {restaurantCart.length ? <button type="button" className="restaurant-sticky-cart" onClick={() => navigate(`/cart?mode=${encodeURIComponent(serviceMode)}`)}><span><strong>{totalItems} items in cart</strong><small>View cart</small></span><strong>{formatPeso(cartTotal)}</strong></button> : null}

      {selectedItem ? (
        <div className="modal-backdrop item-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedItem(null); }}>
          <section className="modal item-sheet" role="dialog" aria-modal="true" aria-labelledby="item-modal-title" ref={modalRef} onTouchStart={(event) => { touchStartY.current = event.touches[0].clientY; }} onTouchEnd={(event) => { if (event.changedTouches[0].clientY - touchStartY.current > 90) setSelectedItem(null); }}>
            <div className="item-sheet__handle" aria-hidden="true" />
            <img className="item-sheet__image" src={selectedItem.image || restaurant.image} alt="" />
            <header className="modal__header"><div><h2 id="item-modal-title">{selectedItem.name}</h2><p>{formatPeso(selectedItem.price)} each</p></div><button ref={closeButtonRef} type="button" className="icon-button" aria-label="Close item options" onClick={() => setSelectedItem(null)}><X size={18} /></button></header>
            <div className="modal__body item-sheet__body">
              <p>{selectedItem.description}</p>
              {selectedItem.options?.length ? <fieldset className="item-options"><legend>Choose add-ons</legend>{selectedItem.options.map((option) => <label key={option.id}><span><strong>{option.name}</strong><small>+ {formatPeso(option.price)}</small></span><input type="checkbox" checked={selectedOptions.some((selected) => selected.id === option.id)} onChange={() => toggleOption(option)} /></label>)}</fieldset> : null}
              <label className="field item-note-field" htmlFor="item-note">Note for the kitchen<textarea id="item-note" value={itemNote} onChange={(event) => setItemNote(event.target.value)} placeholder="Any special requests?" /></label>
              <div className="item-sheet__footer"><div className="qty-control"><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>−</button><span>{quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => current + 1)}>+</button></div><Button variant="primary" onClick={confirmAddItem}>Add to cart · {formatPeso(itemTotal)}</Button></div>
            </div>
          </section>
        </div>
      ) : null}

      {pendingCartItem ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal start-cart-modal" role="dialog" aria-modal="true" aria-labelledby="start-cart-title">
            <div className="modal__body"><h2 id="start-cart-title">Start a new cart?</h2><p>Your {restaurant.name} order will be separate. Your other restaurant cart will stay saved.</p><div className="start-cart-modal__actions"><Button variant="ghost" onClick={() => setPendingCartItem(null)}>Keep browsing</Button><Button variant="primary" onClick={startNewCart}>Start new cart</Button></div></div>
          </section>
        </div>
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
