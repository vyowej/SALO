import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Minus, Plus, Tag, Trash2, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useLocationContext } from '../../context/LocationContext';
import { formatPeso } from '../../utils/formatPeso';
import { restaurantService } from '../../services/restaurantService';
import { locationService } from '../../services/locationService';
import { getOpenStatus } from '../../utils/getOpenStatus';
import { Button } from '../../components/ui/Button';
import '../Page.css';
import './Cart.css';

export default function CartPage() {
  const [searchParams] = useSearchParams();
  const {
    restaurantCarts,
    activeRestaurantId,
    activeCart,
    setActiveRestaurant,
    updateQuantity,
    removeItem,
    restoreItem,
    totalPrice,
  } = useCart();
  const { selectedAddress } = useLocationContext();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deliveryMode, setDeliveryMode] = useState(searchParams.get('mode') === 'Pick-up' ? 'Pick-up' : 'Delivery');
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucher, setVoucher] = useState('');
  const [voucherMessage, setVoucherMessage] = useState('');
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [undoItem, setUndoItem] = useState(null);
  const [toast, setToast] = useState('');
  const [sheetError, setSheetError] = useState('');
  const sheetRef = useRef(null);
  const toastTimer = useRef(null);
  const touchStartY = useRef(0);
  const subtotal = totalPrice;
  const serviceFee = subtotal * 0.05;
  const discount = voucher === 'SALO120' && subtotal >= 500 ? 120 : 0;
  const activeRestaurant = useMemo(() => restaurants.find((restaurant) => restaurant.id === activeRestaurantId), [restaurants, activeRestaurantId]);
  const quoteMatchesSelection = Boolean(
    deliveryQuote && activeRestaurant
    && deliveryQuote.restaurantId === activeRestaurant.id
    && deliveryQuote.latitude === selectedAddress?.latitude
    && deliveryQuote.longitude === selectedAddress?.longitude,
  );
  const distance = deliveryMode === 'Delivery' && quoteMatchesSelection ? deliveryQuote.distance : null;
  const deliveryFee = deliveryMode === 'Delivery'
    ? quoteMatchesSelection ? deliveryQuote.fee : activeRestaurant?.deliveryFee || 0
    : 0;
  const grandTotal = subtotal + (deliveryMode === 'Delivery' ? deliveryFee : 0) + serviceFee - discount;
  const quotePending = deliveryMode === 'Delivery' && Boolean(activeRestaurant && selectedAddress?.latitude && !quoteMatchesSelection);
  const savedRestaurants = Object.keys(restaurantCarts).filter((restaurantId) => restaurantId !== activeRestaurantId && restaurantCarts[restaurantId]?.length);
  const openStatus = activeRestaurant ? getOpenStatus(activeRestaurant) : null;
  const restaurantClosed = openStatus && !['open', 'closing-soon'].includes(openStatus.status);
  const outsideRange = deliveryMode === 'Delivery' && distance !== null && activeRestaurant && distance > activeRestaurant.delivery_radius_km;
  const canCheckout = !restaurantClosed && (deliveryMode === 'Pick-up' || (!outsideRange && !quotePending));

  const loadRestaurants = async () => {
    setLoading(true);
    setError('');
    try {
      setRestaurants(await restaurantService.getAllRestaurants());
    } catch (loadError) {
      console.error('Unable to load restaurant details for the cart.', loadError);
      setError('We couldn’t load your cart details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    restaurantService.getAllRestaurants()
      .then((items) => { if (active) setRestaurants(items); })
      .catch((loadError) => {
        console.error('Unable to load restaurant details for the cart.', loadError);
        if (active) setError('We couldn’t load your cart details.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (deliveryMode !== 'Delivery' || !activeRestaurant || !selectedAddress?.latitude) return undefined;
    let active = true;
    locationService.getDistanceKm(selectedAddress, activeRestaurant).then((distanceKm) => locationService.estimateDeliveryFee(distanceKm, activeRestaurant).then((fee) => [distanceKm, fee])).then(([distanceKm, fee]) => {
      if (!active) return;
      setDeliveryQuote({
        restaurantId: activeRestaurant.id,
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
        distance: distanceKm,
        fee,
      });
    }).catch((feeError) => console.error('Unable to calculate cart delivery fee.', feeError));
    return () => { active = false; };
  }, [deliveryMode, activeRestaurant, selectedAddress]);

  useEffect(() => {
    if (!undoItem) return undefined;
    const timer = window.setTimeout(() => setUndoItem(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undoItem]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!voucherOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setVoucherOpen(false);
      if (event.key === 'Tab' && sheetRef.current) {
        const focusable = [...sheetRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
        if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault();
          focusable[focusable.length - 1]?.focus();
        } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
          event.preventDefault();
          focusable[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [voucherOpen]);

  const applyVoucher = (event) => {
    event.preventDefault();
    const code = voucherCode.trim().toUpperCase();
    setSheetError('');
    if (code === 'SALO120') {
      if (subtotal < 500) {
        setSheetError(`Add ${formatPeso(500 - subtotal)} more to use this ₱120 voucher.`);
        return;
      }
      setVoucher(code);
      setVoucherMessage('₱120 discount applied.');
    } else if (code === 'FREEDEL') {
      if (deliveryMode !== 'Delivery') {
        setSheetError('Free delivery vouchers apply to delivery orders only.');
        return;
      }
      setVoucher(code);
      setVoucherMessage('Free delivery applied.');
    } else {
      setSheetError('That voucher code isn’t valid. Try SALO120 or FREEDEL.');
      return;
    }
    setToast('Voucher applied to your order.');
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
    setVoucherOpen(false);
  };

  const removeCartItem = (item) => {
    setUndoItem({ restaurantId: activeRestaurantId, item });
    removeItem(activeRestaurantId, item.cartKey || item.id);
  };

  const undoRemove = () => {
    if (!undoItem) return;
    restoreItem(undoItem.restaurantId, undoItem.item);
    setUndoItem(null);
  };

  if (loading) {
    return <div className="section-shell cart-page"><div className="cart-page__skeleton"><div className="skeleton skeleton--block" /><div className="skeleton skeleton--block" /></div></div>;
  }

  if (error) {
    return <div className="section-shell cart-page"><div className="empty-state empty-state--error"><h2>Cart unavailable</h2><p>{error}</p><Button variant="secondary" onClick={loadRestaurants}>Try again</Button></div></div>;
  }

  if (!activeCart.length || !activeRestaurantId) {
    return (
      <div className="section-shell cart-page">
        <div className="page-header"><div><h1>Your cart</h1><p>Your saved restaurant carts stay separate.</p></div></div>
        {savedRestaurants.length ? <div className="saved-carts-list">{savedRestaurants.map((restaurantId) => <button key={restaurantId} type="button" onClick={() => setActiveRestaurant(restaurantId)}><span><strong>{restaurantCarts[restaurantId][0]?.restaurantName || 'Restaurant order'}</strong><small>{restaurantCarts[restaurantId].reduce((sum, item) => sum + item.quantity, 0)} items · {formatPeso(restaurantCarts[restaurantId].reduce((sum, item) => sum + item.price * item.quantity, 0))}</small></span><span>Open cart →</span></button>)}</div> : null}
        {!savedRestaurants.length ? <div className="empty-state"><h2>Your cart is empty</h2><p>Add a few favorites to start your next gathering.</p><Link to="/restaurants" className="btn btn--primary cart-empty-action">Browse restaurants</Link></div> : null}
      </div>
    );
  }

  return (
    <div className="section-shell cart-page">
      <div className="page-header"><div><h1>Your cart</h1><p>{activeRestaurant.name} · one restaurant per checkout</p></div></div>
      {savedRestaurants.length ? <section className="saved-carts-strip" aria-label="Other saved carts"><strong>Other saved carts</strong>{savedRestaurants.map((restaurantId) => <button key={restaurantId} type="button" onClick={() => setActiveRestaurant(restaurantId)}>{restaurantCarts[restaurantId][0]?.restaurantName || 'Restaurant'} · {restaurantCarts[restaurantId].length} items</button>)}</section> : null}

      <div className="cart-page__layout">
        <section className="info-card cart-page__items">
          {restaurantClosed ? <div className="checkout-warning"><strong>Restaurant closed</strong><span>{activeRestaurant.name} is not accepting orders right now. {openStatus.label}.</span></div> : null}
          <div className="cart-fulfilment">
            <strong>How would you like your order?</strong>
            <div className="option-list">{['Delivery', 'Pick-up'].map((mode) => <button key={mode} type="button" className={`option-button ${deliveryMode === mode ? 'is-selected' : ''}`} onClick={() => setDeliveryMode(mode)}>{mode}</button>)}</div>
          </div>
          {outsideRange ? <div className="range-warning" role="status"><strong>Outside delivery range</strong><span>This address is {distance.toFixed(1)} km away; delivery is limited to {activeRestaurant.delivery_radius_km} km.</span><button type="button" className="text-link" onClick={() => setDeliveryMode('Pick-up')}>Choose pick-up instead</button></div> : null}
          <div className="cart-page__line-items">
            {activeCart.map((item) => (
              <article key={item.cartKey || item.id} className="cart-line">
                <div className="cart-line__description"><strong>{item.name}</strong>{item.optionLabels?.length ? <small>{item.optionLabels.join(', ')}</small> : null}{item.note ? <small>Note: {item.note}</small> : null}<span>{formatPeso(item.price)} each</span></div>
                <div className="cart-line__actions"><div className="qty-control"><button type="button" aria-label={`Decrease ${item.name}`} onClick={() => item.quantity <= 1 ? removeCartItem(item) : updateQuantity(activeRestaurantId, item.cartKey || item.id, item.quantity - 1)}><Minus size={14} /></button><span>{item.quantity}</span><button type="button" aria-label={`Increase ${item.name}`} onClick={() => updateQuantity(activeRestaurantId, item.cartKey || item.id, item.quantity + 1)}><Plus size={14} /></button></div><strong>{formatPeso(item.price * item.quantity)}</strong><button type="button" className="icon-button" aria-label={`Remove ${item.name}`} onClick={() => removeCartItem(item)}><Trash2 size={15} /></button></div>
              </article>
            ))}
          </div>
          <button type="button" className="cart-voucher-trigger" onClick={() => { setSheetError(''); setVoucherOpen(true); }}><Tag size={17} /><span><strong>{voucher ? voucher : 'Apply voucher'}</strong><small>{voucherMessage || 'Add a promo code to your order'}</small></span><span>›</span></button>
        </section>

        <aside className="summary-card cart-summary">
          <h2>Order summary</h2>
          <div className="amount-row"><span>Subtotal</span><strong>{formatPeso(subtotal)}</strong></div>
          <div className="amount-row"><span>{deliveryMode === 'Delivery' ? `Delivery fee${distance !== null ? ` · ${distance.toFixed(1)} km` : ''}` : 'Pick-up'}</span><strong>{deliveryMode === 'Delivery' && voucher !== 'FREEDEL' ? formatPeso(deliveryFee) : formatPeso(0)}</strong></div>
          <div className="amount-row"><span>Service fee (5%)</span><strong>{formatPeso(serviceFee)}</strong></div>
          <div className="amount-row"><span>Discount</span><strong>-{formatPeso(discount)}</strong></div>
          <div className="total-row"><span>Total</span><strong>{formatPeso(grandTotal)}</strong></div>
          {!canCheckout ? <p className="cart-blocked-message">{restaurantClosed ? 'This restaurant is closed. Please come back during opening hours.' : quotePending ? 'Checking delivery availability for this address…' : 'Choose pick-up to continue with this address.'}</p> : null}
          {canCheckout ? <Link to={`/checkout?promo=${voucher}&mode=${encodeURIComponent(deliveryMode)}`} className="btn btn--primary btn--full cart-review-button">Review payment and address</Link> : <span className="btn btn--primary btn--full is-disabled" aria-disabled="true">Checkout unavailable</span>}
        </aside>
      </div>

      {undoItem || toast ? <div className="toast cart-toast" role="status">{undoItem ? <><span>Item removed from cart.</span><button type="button" onClick={undoRemove}>Undo</button></> : toast}</div> : null}

      {voucherOpen ? <div className="modal-backdrop cart-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setVoucherOpen(false); }}><section className="modal cart-voucher-sheet" role="dialog" aria-modal="true" aria-labelledby="voucher-title" ref={sheetRef} onTouchStart={(event) => { touchStartY.current = event.touches[0].clientY; }} onTouchEnd={(event) => { if (event.changedTouches[0].clientY - touchStartY.current > 90) setVoucherOpen(false); }}><div className="item-sheet__handle" /><header className="modal__header"><div><h2 id="voucher-title">Apply a voucher</h2><p>Enter a valid code for this cart.</p></div><button type="button" className="icon-button" aria-label="Close voucher sheet" onClick={() => setVoucherOpen(false)}><X size={17} /></button></header><form className="modal__body cart-voucher-form" onSubmit={applyVoucher}><div className="field"><label htmlFor="voucher-code">Voucher code</label><input id="voucher-code" autoComplete="off" value={voucherCode} onChange={(event) => setVoucherCode(event.target.value)} placeholder="e.g. SALO120" required /></div><p className="voucher-hints">Try SALO120 (₱120 off ₱500+) or FREEDEL.</p>{sheetError ? <p className="form-error" role="alert">{sheetError}</p> : null}<Button variant="primary" type="submit">Apply voucher</Button></form></section></div> : null}
    </div>
  );
}
