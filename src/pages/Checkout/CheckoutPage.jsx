import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, MapPin, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { config } from '../../config';
import { useLocationContext } from '../../context/LocationContext';
import { restaurantService } from '../../services/restaurantService';
import { locationService } from '../../services/locationService';
import { getOpenStatus } from '../../utils/getOpenStatus';
import { formatPeso } from '../../utils/formatPeso';
import { Button } from '../../components/ui/Button';
import LocationPicker from '../../components/location/LocationPicker';
import '../Page.css';
import './Checkout.css';

const makeIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `salo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const formatPhone = (value) => value.replace(/[^\d+]/g, '');
const minScheduledAt = (() => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
})();

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeCart, activeRestaurantId, totalPrice, clearRestaurant } = useCart();
  const { user, emailVerified, verifyEmail, updateUser, sendVerificationEmail } = useAuth();
  const { selectedAddress } = useLocationContext();
  const [deliveryMode, setDeliveryMode] = useState(searchParams.get('mode') === 'Pick-up' ? 'Pick-up' : 'Delivery');
  const [deliverySpeed, setDeliverySpeed] = useState('Standard');
  const [payment, setPayment] = useState(searchParams.get('mode') === 'Pick-up' ? 'Pay at pick-up' : 'Cash on delivery');
  const [recipientName, setRecipientName] = useState(user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [riderNote, setRiderNote] = useState(selectedAddress?.rider_note || '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const idempotencyKey = useRef(makeIdempotencyKey());
  const submittingRef = useRef(false);
  const restaurantEntries = activeCart.length && activeRestaurantId ? [[activeRestaurantId, activeCart]] : [];
  const restaurant = useMemo(() => restaurants.find((entry) => entry.id === activeRestaurantId), [restaurants, activeRestaurantId]);
  const quoteMatchesSelection = Boolean(deliveryQuote && restaurant
    && deliveryQuote.restaurantId === restaurant.id
    && deliveryQuote.latitude === selectedAddress?.latitude
    && deliveryQuote.longitude === selectedAddress?.longitude);
  const distance = deliveryMode === 'Delivery' && quoteMatchesSelection ? deliveryQuote.distance : null;
  const deliveryFee = deliveryMode === 'Delivery'
    ? quoteMatchesSelection ? deliveryQuote.fee : restaurant?.deliveryFee || 0
    : 0;
  const quotePending = deliveryMode === 'Delivery' && Boolean(restaurant && selectedAddress?.latitude && !quoteMatchesSelection);
  const subtotal = totalPrice;
  const promo = searchParams.get('promo')?.toUpperCase() || '';
  const serviceFee = subtotal * 0.05;
  const priorityFee = deliveryMode === 'Delivery' && deliverySpeed === 'Priority' ? 60 : 0;
  const discount = promo === 'SALO120' && subtotal >= 500 ? 120 : 0;
  const deliveryCharge = deliveryMode === 'Delivery' && promo !== 'FREEDEL' ? deliveryFee : 0;
  const total = subtotal + deliveryCharge + serviceFee + priorityFee - discount;
  const openStatus = restaurant ? getOpenStatus(restaurant) : null;
  const restaurantClosed = openStatus && !['open', 'closing-soon'].includes(openStatus.status);
  const outsideRange = deliveryMode === 'Delivery' && distance !== null && restaurant && distance > restaurant.delivery_radius_km;
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 13;

  const loadRestaurants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRestaurants(await restaurantService.getAllRestaurants());
    } catch (loadError) {
      console.error('Unable to prepare checkout.', loadError);
      setError('We couldn’t verify your order details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    restaurantService.getAllRestaurants()
      .then((items) => { if (active) setRestaurants(items); })
      .catch((loadError) => {
        console.error('Unable to prepare checkout.', loadError);
        if (active) setError('We couldn’t verify your order details. Please try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!restaurant || deliveryMode !== 'Delivery' || !selectedAddress?.latitude) return undefined;
    let active = true;
    locationService.getDistanceKm(selectedAddress, restaurant)
      .then(async (distanceKm) => {
        const fee = await locationService.estimateDeliveryFee(distanceKm, restaurant);
        if (active) {
          setDeliveryQuote({
            restaurantId: restaurant.id,
            latitude: selectedAddress.latitude,
            longitude: selectedAddress.longitude,
            distance: distanceKm,
            fee,
          });
        }
      })
      .catch((distanceError) => {
        console.error('Unable to calculate checkout delivery fee.', distanceError);
        if (active) setError('We couldn’t verify delivery availability for this address.');
      });
    return () => { active = false; };
  }, [deliveryMode, restaurant, selectedAddress]);

  const handleModeChange = (mode) => {
    setDeliveryMode(mode);
    setPayment(mode === 'Pick-up' ? 'Pay at pick-up' : 'Cash on delivery');
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setVerificationError('');
    try {
      if (!await verifyEmail(verificationCode)) {
        setVerificationError('That code does not match. Please check it and try again.');
        return;
      }
      setVerificationOpen(false);
      setVerificationCode('');
    } catch (verificationFailure) {
      console.error('Unable to verify email at checkout.', verificationFailure);
      setVerificationError('We couldn’t verify your email. Please try again.');
    }
  };

  const requestEmailVerification = async (event) => {
    event.preventDefault();
    setVerificationError('');
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
    } catch (verificationFailure) {
      console.error('Unable to send an email verification link.', verificationFailure);
      setVerificationError('We couldn’t send a verification link. Please try again.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setError('');
    if (!emailVerified) {
      setVerificationOpen(true);
      return;
    }
    if (!restaurantEntries.length) {
      setError('Your cart is empty.');
      return;
    }
    if (!recipientName.trim()) {
      setError('Enter the name for this order.');
      return;
    }
    if (!phoneValid) {
      setError('Enter a valid phone number so the rider can contact you.');
      return;
    }
    if (deliveryMode === 'Delivery' && !selectedAddress) {
      setError('Choose a delivery address before placing your order.');
      return;
    }
    if (restaurantClosed) {
      setError(`${restaurant.name} is closed. ${openStatus.label}.`);
      return;
    }
    if (quotePending) {
      setError('Please wait while we check delivery availability for this address.');
      return;
    }
    if (outsideRange) {
      setError('This address is outside the delivery range. Choose pick-up or another address.');
      return;
    }
    if (deliverySpeed === 'Scheduled' && !scheduledAt) {
      setError('Choose a date and time for your scheduled delivery.');
      setScheduleOpen(true);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await updateUser({ phone: formatPhone(phone), name: recipientName.trim() });
      const order = await restaurantService.createOrder({
        idempotencyKey: idempotencyKey.current,
        restaurant: restaurant.name,
        restaurantId: restaurant.id,
        items: activeCart.map((item) => `${item.name} x${item.quantity}`).join(', '),
        cartItems: activeCart.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          optionLabels: item.optionLabels || [],
          note: item.note || '',
        })),
        total,
        subtotal,
        deliveryFee: deliveryCharge,
        serviceFee,
        priorityFee,
        discount,
        deliveryMode,
        deliverySpeed,
        scheduledAt: deliverySpeed === 'Scheduled' ? scheduledAt : '',
        payment,
        address: deliveryMode === 'Delivery' ? selectedAddress.detail : restaurant.location,
        addressSnapshot: deliveryMode === 'Delivery' ? selectedAddress : null,
        recipientName: recipientName.trim(),
        phone: formatPhone(phone),
        riderNote: riderNote.trim(),
        distanceKm: distance,
      });
      clearRestaurant(restaurant.id);
      navigate(`/orders/${order.id}?placed=true`);
    } catch (submitError) {
      console.error('Unable to place order.', submitError);
      setError('We couldn’t place your order. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) return <div className="section-shell checkout-page"><div className="skeleton skeleton--block checkout-skeleton" /></div>;
  if (error && !restaurant) return <div className="section-shell checkout-page"><div className="empty-state empty-state--error"><h2>Checkout unavailable</h2><p>{error}</p><Button variant="secondary" onClick={loadRestaurants}>Try again</Button></div></div>;
  if (!restaurantEntries.length) return <div className="section-shell checkout-page"><div className="empty-state"><h2>Your cart is empty</h2><p>Add a dish before checkout.</p><Link to="/restaurants" className="btn btn--primary checkout-browse-link">Browse restaurants</Link></div></div>;
  if (!restaurant) return <div className="section-shell checkout-page"><div className="empty-state empty-state--error"><h2>Restaurant unavailable</h2><p>We couldn’t verify this restaurant’s ordering status.</p><Button variant="secondary" onClick={loadRestaurants}>Try again</Button></div></div>;

  return (
    <div className="section-shell checkout-page">
      <div className="page-header"><div><h1>Review payment and address</h1><p>{restaurant?.name} · transparent fees, no surprises.</p></div></div>
      {restaurantClosed || outsideRange ? <div className="checkout-warning" role="status"><strong>{restaurantClosed ? 'Restaurant closed' : 'Outside delivery range'}</strong><span>{restaurantClosed ? `${restaurant.name} is not accepting orders right now. ${openStatus.label}` : `This address is ${distance.toFixed(1)} km away; delivery is limited to ${restaurant.delivery_radius_km} km.`}</span>{outsideRange ? <button type="button" className="text-link" onClick={() => handleModeChange('Pick-up')}>Switch to pick-up</button> : null}</div> : null}
      {error ? <p className="form-error checkout-error" role="alert">{error}</p> : null}

      <div className="checkout-grid checkout-final-layout">
        <form className="info-card checkout-card checkout-form" onSubmit={handleSubmit}>
          <section className="checkout-section">
            <div className="checkout-section__header"><div><h2>Delivery address</h2><p>Choose where your order should go.</p></div><button type="button" className="text-link" onClick={() => setAddressOpen(true)} disabled={deliveryMode === 'Pick-up'}>Change</button></div>
            {deliveryMode === 'Delivery' ? <button type="button" className="checkout-address-card" onClick={() => setAddressOpen(true)}><MapPin size={18} /><span><strong>{selectedAddress?.label || 'Choose address'}</strong><small>{selectedAddress?.detail || 'Select a saved address or search for a place.'}</small></span><span>›</span></button> : <p className="checkout-pickup-note">{restaurant.location} · pay when you pick up.</p>}
            <div className="form-grid">
              <div className="field"><label htmlFor="checkout-recipient">Recipient name</label><input id="checkout-recipient" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} autoComplete="name" required /></div>
              <div className="field"><label htmlFor="checkout-phone">Phone number {user?.phone ? '' : '(needed for this order)'}</label><input id="checkout-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+63 9XX XXX XXXX" aria-describedby="checkout-phone-help" required /></div>
            </div>
            <small id="checkout-phone-help" className="checkout-field-help">{user?.phone ? 'We’ll use this saved number for delivery updates.' : 'We ask for your phone number once at checkout so your rider can reach you.'}</small>
            <div className="field"><label htmlFor="checkout-rider-note">Rider note (optional)</label><textarea id="checkout-rider-note" value={riderNote} onChange={(event) => setRiderNote(event.target.value)} placeholder="Gate code, landmarks, or delivery instructions" /></div>
          </section>

          <section className="checkout-section">
            <h2>Fulfilment</h2>
            <div className="option-list" role="radiogroup" aria-label="Fulfilment method">{['Delivery', 'Pick-up'].map((option) => <button key={option} type="button" role="radio" aria-checked={deliveryMode === option} className={`option-button ${deliveryMode === option ? 'is-selected' : ''}`} onClick={() => handleModeChange(option)}>{option}</button>)}</div>
            {deliveryMode === 'Delivery' ? <div className="checkout-option-group"><h3>Delivery speed</h3><div className="option-list" role="radiogroup" aria-label="Delivery speed">{['Standard', 'Priority', 'Scheduled'].map((option) => <button key={option} type="button" role="radio" aria-checked={deliverySpeed === option} className={`option-button ${deliverySpeed === option ? 'is-selected' : ''}`} onClick={() => { setDeliverySpeed(option); if (option === 'Scheduled') setScheduleOpen(true); }}>{option}{option === 'Priority' ? ' + ₱60' : ''}</button>)}</div>{deliverySpeed === 'Scheduled' ? <button type="button" className="checkout-schedule-choice" onClick={() => setScheduleOpen(true)}><CalendarDays size={16} />{scheduledAt ? new Date(scheduledAt).toLocaleString() : 'Choose delivery date and time'}</button> : null}</div> : null}
          </section>

          <section className="checkout-section">
            <h2>Payment</h2>
            <div className="checkout-payment-options" role="radiogroup" aria-label="Payment method">{(deliveryMode === 'Delivery' ? ['Cash on delivery'] : ['Pay at pick-up']).map((option) => <button key={option} type="button" role="radio" aria-checked={payment === option} className={`checkout-payment-card ${payment === option ? 'is-selected' : ''}`} onClick={() => setPayment(option)}><span className="checkout-payment-card__radio" /><span><strong>{option}</strong><small>{deliveryMode === 'Delivery' ? 'Pay your rider when your order arrives.' : 'Pay at the restaurant counter.'}</small></span></button>)}</div>
          </section>

          <Button variant="primary" size="lg" type="submit" disabled={submitting || restaurantClosed || Boolean(outsideRange) || quotePending || !emailVerified}>{submitting ? 'Placing order…' : `Place order · ${formatPeso(total)}`}</Button>
          {!emailVerified ? <button type="button" className="text-link checkout-verify-link" onClick={() => setVerificationOpen(true)}>Verify email to place your order</button> : null}
        </form>

        <aside className="summary-card checkout-summary">
          <h2>Order summary</h2>
          <p className="checkout-summary__restaurant">{restaurant.name}</p>
          <div className="checkout-summary__items">{activeCart.map((item) => <div key={item.cartKey || item.id}><span>{item.quantity} × {item.name}</span><strong>{formatPeso(item.price * item.quantity)}</strong></div>)}</div>
          <div className="amount-row"><span>Subtotal</span><strong>{formatPeso(subtotal)}</strong></div>
          <div className="amount-row"><span>Delivery fee</span><strong>{formatPeso(deliveryCharge)}</strong></div>
          {priorityFee ? <div className="amount-row"><span>Priority delivery</span><strong>{formatPeso(priorityFee)}</strong></div> : null}
          <div className="amount-row"><span>Service fee (5%)</span><strong>{formatPeso(serviceFee)}</strong></div>
          <div className="amount-row"><span>Discount</span><strong>-{formatPeso(discount)}</strong></div>
          <div className="total-row"><span>Total</span><strong>{formatPeso(total)}</strong></div>
        </aside>
      </div>

      <LocationPicker open={addressOpen} onClose={() => setAddressOpen(false)} selectedAddress={selectedAddress} onSelect={(address) => { setRiderNote(address.rider_note || ''); }} />

      {verificationOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setVerificationOpen(false); }}><section className="modal checkout-verification-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-verify-title"><header className="modal__header"><div><h2 id="checkout-verify-title">Verify your email to order</h2><p>{config.useMock ? `Enter the one-time verification code associated with ${user?.email}.` : `We’ll email a verification link to ${user?.email}.`}</p></div><button type="button" className="icon-button" aria-label="Close verification dialog" onClick={() => setVerificationOpen(false)}><X size={17} /></button></header><form className="modal__body checkout-verification-form" onSubmit={config.useMock ? handleVerify : requestEmailVerification}>{config.useMock ? <div className="field"><label htmlFor="checkout-otp">Verification code</label><input id="checkout-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ''))} required /></div> : null}{verificationSent ? <p className="form-success" role="status">If verification is needed, a link will be sent to your email.</p> : null}{verificationError ? <p className="form-error" role="alert">{verificationError}</p> : null}<Button variant="primary" type="submit">{config.useMock ? 'Verify email' : verificationSent ? 'Resend verification link' : 'Send verification link'}</Button></form></section></div> : null}

      {scheduleOpen ? <div className="modal-backdrop checkout-schedule-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setScheduleOpen(false); }}><section className="modal checkout-schedule-sheet" role="dialog" aria-modal="true" aria-labelledby="schedule-title"><header className="modal__header"><div><h2 id="schedule-title">Schedule delivery</h2><p>Choose a time that works for you.</p></div><button type="button" className="icon-button" aria-label="Close schedule picker" onClick={() => setScheduleOpen(false)}><X size={17} /></button></header><div className="modal__body checkout-schedule-form"><div className="field"><label htmlFor="scheduled-at">Date and time</label><input id="scheduled-at" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} min={minScheduledAt} /></div><Button variant="primary" onClick={() => setScheduleOpen(false)} disabled={!scheduledAt}>Confirm schedule</Button></div></section></div> : null}
    </div>
  );
}
