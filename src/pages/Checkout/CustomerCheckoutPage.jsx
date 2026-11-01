import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLocationContext } from '../../context/LocationContext';
import { addressService } from '../../services/addressService';
import { customerCartService } from '../../services/customerCartService';
import { restaurantService } from '../../services/restaurantService';
import { locationService } from '../../services/locationService';
import { config } from '../../config';
import { getOpenStatus } from '../../utils/getOpenStatus';
import { defaultMockAddress } from '../../mock/locationData';
import { Button } from '../../components/ui/Button';
import { formatPeso } from '../../utils/formatPeso';
import '../Page.css';
import './Checkout.css';

const makeIdempotencyKey = () => globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID()
  : `salo-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const minimumSchedule = () => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const fullName = (user) => user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ');

export default function CustomerCheckoutPage() {
  const {
    restaurantCarts,
    cartLoading,
    cartError,
    refreshCarts,
    setCartError,
    clearRestaurant,
  } = useCart();
  const { user, emailVerified, verifyEmail, sendVerificationEmail } = useAuth();
  const { selectedAddress } = useLocationContext();
  const [addresses, setAddresses] = useState([]);
  const [mockRestaurants, setMockRestaurants] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressesError, setAddressesError] = useState('');
  const [sections, setSections] = useState({});
  const [recipientName, setRecipientName] = useState(fullName(user));
  const [recipientPhone, setRecipientPhone] = useState(user?.phone || user?.mobile || '');
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [discountMessages, setDiscountMessages] = useState({});
  const [discountLoading, setDiscountLoading] = useState({});
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [completedGroup, setCompletedGroup] = useState(null);
  const requestId = useRef(0);
  const idempotencyKey = useRef(makeIdempotencyKey());

  const entries = useMemo(
    () => Object.entries(restaurantCarts).filter(([, items]) => items.length),
    [restaurantCarts],
  );
  const restaurantIds = entries.map(([restaurantId]) => restaurantId).join(',');
  const defaultAddress = selectedAddress
    || addresses.find((address) => address.is_default || address.is_main)
    || addresses[0]
    || null;

  useEffect(() => {
    let active = true;
    addressService.getSavedAddresses()
      .then((saved) => {
        if (active) setAddresses(saved);
      })
      .catch((error) => {
        console.error('Unable to load saved checkout addresses.', error);
        if (active) setAddressesError(error.message || 'Saved addresses are unavailable.');
      })
      .finally(() => {
        if (active) setAddressesLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!config.useMock) return undefined;
    let active = true;
    restaurantService.getAllRestaurants()
      .then((restaurants) => { if (active) setMockRestaurants(restaurants); })
      .catch((error) => {
        console.error('Unable to load restaurant details for mock checkout.', error);
        if (active) setQuoteError('Restaurant details are unavailable. Try again.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!restaurantIds) return;
    const activeRestaurantIds = restaurantIds.split(',');
    setSections((current) => {
      const next = { ...current };
      activeRestaurantIds.forEach((restaurantId) => {
        if (!next[restaurantId]) {
          next[restaurantId] = {
            order_type: 'delivery',
            address_id: defaultAddress?.id ? String(defaultAddress.id) : '',
            payment_method: 'cod',
            discount_code: '',
            scheduled_for: '',
          };
        } else if (!next[restaurantId].address_id && defaultAddress?.id) {
          next[restaurantId] = { ...next[restaurantId], address_id: String(defaultAddress.id) };
        }
      });
      return Object.fromEntries(Object.entries(next).filter(([id]) => activeRestaurantIds.includes(id)));
    });
  }, [restaurantIds, defaultAddress?.id]);

  const makeOrders = useCallback(() => entries.map(([restaurantId]) => {
    const section = sections[restaurantId] || {};
    return {
      restaurant_id: config.useMock ? restaurantId : Number(restaurantId),
      order_type: section.order_type || 'delivery',
      address_id: section.order_type === 'pickup'
        ? null
        : (config.useMock ? section.address_id || null : Number(section.address_id) || null),
      payment_method: section.order_type === 'pickup' ? 'pay_at_pickup' : 'cod',
      discount_code: section.discount_code?.trim() || null,
      scheduled_for: section.scheduled_for || null,
      recipient_name: recipientName.trim(),
      recipient_phone: recipientPhone.trim(),
    };
  }), [entries, sections, recipientName, recipientPhone]);

  const orderPayload = useMemo(() => makeOrders(), [makeOrders]);
  const needsAddress = orderPayload.some((order) => order.order_type === 'delivery' && !order.address_id);
  const hasCoordinatesMissing = orderPayload.some((order) => {
    if (order.order_type !== 'delivery' || !order.address_id) return false;
    const address = addresses.find((entry) => String(entry.id) === String(order.address_id));
    return !config.useMock && (!address || address.latitude === null || address.latitude === undefined
      || address.longitude === null || address.longitude === undefined);
  });
  const quoteValid = Boolean(quote?.valid) && quote.orders?.length === entries.length;
  const validRecipient = recipientName.trim().length > 0
    && recipientPhone.replace(/\D/g, '').length >= 10;

  const buildMockQuote = useCallback(async () => {
    const previousOrders = await restaurantService.getOrders();
    const hasPriorOrder = previousOrders.some((previousOrder) => (
      previousOrder.customerId === user?.id
      && !['cancelled', 'rejected'].includes(String(previousOrder.status).toLocaleLowerCase())
    ));
    const orders = await Promise.all(orderPayload.map(async (order) => {
      const cartItems = restaurantCarts[String(order.restaurant_id)] || [];
      const restaurant = mockRestaurants.find((item) => String(item.id) === String(order.restaurant_id));
      const errors = {};
      if (!restaurant) errors.restaurant_id = ['Restaurant details could not be loaded.'];
      if (!cartItems.length) errors.items = ['Add an item before checking out.'];
      if (cartItems.some((item) => item.soldOut || item.available === false)) {
        errors.items = ['Remove unavailable items before checking out.'];
      }
      const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
      let distanceKm = null;
      let deliveryFee = 0;
      if (order.order_type === 'delivery') {
        const address = addresses.find((item) => String(item.id) === String(order.address_id));
        if (!address) {
          errors.address_id = ['Choose a saved address with a delivery pin.'];
        } else if (restaurant) {
          const destination = Number.isFinite(address.latitude) && Number.isFinite(address.longitude)
            ? address
            : defaultMockAddress;
          distanceKm = await locationService.getDistanceKm(destination, restaurant);
          if (restaurant.delivery_radius_km && distanceKm > Number(restaurant.delivery_radius_km)) {
            errors.address_id = ['This address is outside the restaurant delivery radius.'];
          } else {
            deliveryFee = await locationService.estimateDeliveryFee(distanceKm, restaurant);
          }
        }
      }
      if (restaurant && !order.scheduled_for) {
        const open = getOpenStatus(restaurant);
        if (!['open', 'closing-soon'].includes(open.status)) {
          errors.restaurant_id = [`${restaurant.name} is not accepting orders right now.`];
        }
      }

      const serviceFee = Math.round(subtotal * 5) / 100;
      let discountAmount = 0;
      let discountValid = true;
      let discountMessage = null;
      const discountCode = (order.discount_code || '').trim().toUpperCase();
      if (discountCode === 'SALO120') {
        if (subtotal >= 500) discountAmount = 120;
        else {
          discountValid = false;
          discountMessage = `Add ${formatPeso(500 - subtotal)} more to use this code.`;
        }
      } else if (discountCode === 'FREEDEL' && order.order_type === 'delivery') {
        discountAmount = deliveryFee;
      } else if (discountCode === 'FIRST75') {
        if (hasPriorOrder) {
          discountValid = false;
          discountMessage = 'This code is for first orders only.';
        } else {
          discountAmount = Math.min(subtotal, 75);
        }
      } else if (discountCode) {
        discountValid = false;
        discountMessage = 'This code is not valid for this order.';
      }
      if (!discountValid) errors.discount_code = [discountMessage];
      const total = Math.max(0, subtotal + deliveryFee + serviceFee - discountAmount);
      const now = new Date();
      const minutes = Number.parseInt(String(restaurant?.deliveryTime || '').match(/\d+/)?.[0] || '30', 10);
      const minAt = new Date(now.getTime() + minutes * 60 * 1000);
      const maxAt = new Date(now.getTime() + (minutes + 10) * 60 * 1000);

      return {
        restaurant_id: config.useMock ? order.restaurant_id : Number(order.restaurant_id),
        restaurant_name: restaurant?.name || 'Restaurant',
        order_type: order.order_type,
        valid: Object.keys(errors).length === 0,
        errors,
        subtotal,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        discount: {
          code: discountCode || null,
          valid: discountValid,
          amount: discountAmount,
          message: discountMessage,
          scope: null,
        },
        total,
        distance_km: distanceKm,
        distance_source: distanceKm === null ? null : 'straight_line_estimate',
        eta: {
          min_minutes: minutes,
          max_minutes: minutes + 10,
          min_at: minAt.toISOString(),
          max_at: maxAt.toISOString(),
        },
      };
    }));

    return {
      orders,
      grand_total: orders.reduce((sum, order) => sum + order.total, 0),
      valid: orders.every((order) => order.valid),
    };
  }, [orderPayload, restaurantCarts, mockRestaurants, addresses, user?.id]);

  useEffect(() => {
    if (!entries.length || addressesLoading || (needsAddress && !config.useMock) || hasCoordinatesMissing || !validRecipient) {
      setQuote(null);
      setQuoteLoading(false);
      return undefined;
    }

    const currentRequestId = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError('');
      try {
        const result = config.useMock
          ? await buildMockQuote()
          : await customerCartService.quote(orderPayload);
        if (currentRequestId === requestId.current) setQuote(result);
      } catch (error) {
        console.error('Unable to quote customer checkout.', error);
        if (currentRequestId === requestId.current) {
          setQuote(null);
          setQuoteError(error.message || 'We could not calculate your checkout. Try again.');
        }
      } finally {
        if (currentRequestId === requestId.current) setQuoteLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [entries.length, addressesLoading, needsAddress, hasCoordinatesMissing, validRecipient, orderPayload, buildMockQuote]);

  const updateSection = (restaurantId, updates) => {
    setSections((current) => ({
      ...current,
      [restaurantId]: { ...current[restaurantId], ...updates },
    }));
    setQuote(null);
  };

  const applyDiscount = async (restaurantId) => {
    const section = sections[restaurantId] || {};
    const code = section.discount_code?.trim();
    if (!code) {
      setDiscountMessages((current) => ({ ...current, [restaurantId]: 'Enter a code first.' }));
      return;
    }
    setDiscountLoading((current) => ({ ...current, [restaurantId]: true }));
    setDiscountMessages((current) => ({ ...current, [restaurantId]: '' }));
    try {
      const result = config.useMock
        ? (await buildMockQuote()).orders.find((order) => String(order.restaurant_id) === String(restaurantId))?.discount
        : await customerCartService.validateDiscount({
          restaurant_id: Number(restaurantId),
          code,
          order_type: section.order_type || 'delivery',
          address_id: section.order_type === 'pickup' ? null : Number(section.address_id) || null,
          payment_method: section.order_type === 'pickup' ? 'pay_at_pickup' : 'cod',
        });
      setDiscountMessages((current) => ({
        ...current,
        [restaurantId]: result?.valid ? 'Discount applied to this order.' : result?.message || 'This code is not valid for this order.',
      }));
    } catch (error) {
      console.error('Unable to validate the checkout discount.', error);
      setDiscountMessages((current) => ({ ...current, [restaurantId]: error.message || 'The code could not be validated.' }));
    } finally {
      setDiscountLoading((current) => ({ ...current, [restaurantId]: false }));
    }
  };

  const requestVerification = async () => {
    setSendingVerification(true);
    setVerificationError('');
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
    } catch (error) {
      console.error('Unable to request checkout email verification.', error);
      setVerificationError(error.message || 'We could not send the verification code.');
    } finally {
      setSendingVerification(false);
    }
  };

  const confirmVerification = async (event) => {
    event.preventDefault();
    setVerifyingEmail(true);
    setVerificationError('');
    try {
      const verified = await verifyEmail(verificationCode);
      if (!verified) {
        setVerificationError('That code does not match. Check it and try again.');
        return;
      }
      setVerificationCode('');
    } catch (error) {
      console.error('Unable to verify checkout email.', error);
      setVerificationError(error.message || 'We could not verify your email.');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    setCheckoutError('');
    if (!emailVerified) {
      setCheckoutError('Verify your email before placing your orders.');
      return;
    }
    if (!validRecipient) {
      setCheckoutError('Enter a recipient name and a valid phone number.');
      return;
    }
    if (needsAddress || hasCoordinatesMissing) {
      setCheckoutError('Choose a saved address with a delivery pin for every delivery order.');
      return;
    }
    if (!quoteValid) {
      setCheckoutError('Wait for a valid server quote before placing your orders.');
      return;
    }

    setSubmitting(true);
    try {
      const group = config.useMock
        ? await restaurantService.createCheckoutGroup({
          idempotencyKey: idempotencyKey.current,
          orders: orderPayload.map((order) => {
            const restaurantId = String(order.restaurant_id);
            const items = restaurantCarts[restaurantId] || [];
            const restaurant = mockRestaurants.find((item) => String(item.id) === restaurantId);
            const quoteRow = quote.orders.find((row) => String(row.restaurant_id) === restaurantId);
            const address = addresses.find((entry) => String(entry.id) === String(order.address_id));
            return {
              restaurant: restaurant?.name || items[0]?.restaurantName || 'Restaurant',
              restaurantId,
              items: items.map((item) => `${item.name} x${item.quantity}`).join(', '),
              cartItems: items.map((item) => ({
                id: item.itemId || item.id,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                optionLabels: item.optionLabels || [],
                note: item.note || '',
              })),
              total: quoteRow.total,
              subtotal: quoteRow.subtotal,
              deliveryFee: quoteRow.delivery_fee,
              serviceFee: quoteRow.service_fee,
              discount: quoteRow.discount.amount,
              deliveryMode: order.order_type === 'pickup' ? 'Pick-up' : 'Delivery',
              payment: order.payment_method === 'pay_at_pickup' ? 'Pay at pick-up' : 'Cash on delivery',
              scheduledAt: order.scheduled_for || '',
              address: address?.detail || restaurant?.location || '',
              addressSnapshot: address,
              recipientName: order.recipient_name,
              phone: order.recipient_phone,
              customerId: user?.id,
              distanceKm: quoteRow.distance_km,
            };
          }),
        })
        : await customerCartService.checkout(orderPayload, idempotencyKey.current);
      setCompletedGroup(group);
      idempotencyKey.current = makeIdempotencyKey();
      if (config.useMock) {
        await Promise.all(entries.map(([restaurantId]) => clearRestaurant(restaurantId)));
      }
      await refreshCarts();
    } catch (error) {
      console.error('Unable to place customer checkout.', error);
      setCheckoutError(error.message || 'We could not place the order. Your cart has been kept.');
      await refreshCarts();
    } finally {
      setSubmitting(false);
    }
  };

  if (cartLoading || addressesLoading) {
    return <div className="section-shell checkout-page"><div className="skeleton skeleton--block checkout-skeleton" /></div>;
  }

  if (cartError || addressesError) {
    return (
      <div className="section-shell checkout-page">
        <div className="empty-state empty-state--error" role="alert">
          <h1>Checkout unavailable</h1>
          <p>{cartError || addressesError}</p>
          <Button variant="secondary" onClick={() => { setCartError(''); refreshCarts(); window.location.reload(); }}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!entries.length && !completedGroup) {
    return (
      <div className="section-shell checkout-page">
        <div className="empty-state">
          <h1>Your cart is empty</h1>
          <p>Add a dish before checking out.</p>
          <Link to="/restaurants" className="btn btn--primary">Browse restaurants</Link>
        </div>
      </div>
    );
  }

  if (completedGroup) {
    return (
      <div className="section-shell checkout-page">
        <section className="info-card checkout-confirmation" role="status">
          <p className="checkout-confirmation__eyebrow">Orders placed</p>
          <h1>Thanks for your order!</h1>
          <p>Checkout reference <strong>{completedGroup.reference_code}</strong></p>
          <div className="checkout-confirmation__orders">
            {(completedGroup.orders || []).map((order) => (
              <article key={order.reference_code || order.id}>
                <strong>{order.restaurant_name || order.restaurant}</strong>
                <span>Order {order.reference_code || order.id}</span>
                <span>{formatPeso(order.total_amount ?? order.total)}</span>
              </article>
            ))}
          </div>
          <p>Group total: <strong>{formatPeso(completedGroup.grand_total)}</strong></p>
          <Link to="/restaurants" className="btn btn--primary">Continue browsing</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="section-shell checkout-page">
      <div className="page-header">
        <div><h1>Review your orders</h1><p>Each restaurant has its own fulfilment, address, discount, and total.</p></div>
      </div>
      {checkoutError ? <p className="form-error checkout-error" role="alert">{checkoutError}</p> : null}
      {quoteError ? <p className="form-error checkout-error" role="alert">{quoteError}</p> : null}
      {needsAddress ? <p className="checkout-warning" role="status">Set your delivery location to see the fee and place delivery orders.</p> : null}
      {hasCoordinatesMissing ? <p className="checkout-warning" role="status">The selected saved address needs a delivery pin before it can be used.</p> : null}

      <form className="customer-checkout-form" onSubmit={placeOrder}>
        <section className="info-card checkout-section customer-checkout-contact">
          <h2>Recipient</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="customer-checkout-name">Recipient name</label>
              <input id="customer-checkout-name" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} autoComplete="name" required maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="customer-checkout-phone">Phone number</label>
              <input id="customer-checkout-phone" type="tel" inputMode="tel" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} autoComplete="tel" required maxLength={20} />
            </div>
          </div>
        </section>

        {!emailVerified ? (
          <section className="info-card checkout-section" aria-labelledby="checkout-verification-title">
            <h2 id="checkout-verification-title">Verify your email to place orders</h2>
            <p>A verified email helps us send order updates.</p>
            {!verificationSent ? (
              <Button type="button" variant="secondary" disabled={sendingVerification} onClick={requestVerification}>
                {sendingVerification ? 'Sending…' : 'Send verification code'}
              </Button>
            ) : (
              <div className="customer-checkout-verification">
                <div className="field">
                  <label htmlFor="checkout-email-code">Verification code</label>
                  <input id="checkout-email-code" inputMode="numeric" autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required />
                </div>
                <Button type="button" disabled={verifyingEmail} onClick={confirmVerification}>{verifyingEmail ? 'Verifying…' : 'Verify email'}</Button>
              </div>
            )}
            {verificationError ? <p className="form-error" role="alert">{verificationError}</p> : null}
          </section>
        ) : null}

        {entries.map(([restaurantId, items]) => {
          const section = sections[restaurantId] || {};
          const restaurant = items[0]?.restaurant
            || mockRestaurants.find((item) => String(item.id) === String(restaurantId))
            || {};
          const quoteRow = quote?.orders?.find((row) => String(row.restaurant_id) === String(restaurantId));
          const selectedAddressForOrder = addresses.find((address) => String(address.id) === String(section.address_id));
          return (
            <section className="info-card checkout-section customer-checkout-order" key={restaurantId}>
              <div className="checkout-section__header">
                <div><h2>{restaurant.name || items[0]?.restaurantName}</h2><p>{items.length} menu {items.length === 1 ? 'item' : 'items'}</p></div>
              </div>
              <div className="checkout-section__items">
                {items.map((item) => (
                  <div key={item.id}>
                    <span>{item.quantity} × {item.name}</span>
                    <strong>{formatPeso(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>

              <fieldset className="customer-checkout-fulfilment">
                <legend>Fulfilment</legend>
                <div className="option-list" role="radiogroup" aria-label={`${restaurant.name || 'Restaurant'} fulfilment`}>
                  {[['delivery', 'Delivery'], ['pickup', 'Pick-up']].map(([value, label]) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={section.order_type === value}
                      className={`option-button${section.order_type === value ? ' is-selected' : ''}`}
                      key={value}
                      onClick={() => updateSection(restaurantId, {
                        order_type: value,
                        payment_method: value === 'pickup' ? 'pay_at_pickup' : 'cod',
                      })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {section.order_type === 'delivery' ? (
                <div className="field">
                  <label htmlFor={`checkout-address-${restaurantId}`}>Delivery address</label>
                  <select
                    id={`checkout-address-${restaurantId}`}
                    value={section.address_id || ''}
                    onChange={(event) => updateSection(restaurantId, { address_id: event.target.value })}
                    required
                  >
                    <option value="">Choose a saved address</option>
                    {addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label || 'Address'} · {address.detail}
                      </option>
                    ))}
                  </select>
                  {selectedAddressForOrder ? (
                    <p className="checkout-address-card__detail"><MapPin size={16} />{selectedAddressForOrder.detail}</p>
                  ) : null}
                  {!addresses.length ? <Link to="/profile">Add a saved delivery address</Link> : null}
                </div>
              ) : (
                <div className="checkout-pickup-note">
                  Pick up at {restaurant.formatted_address || 'the restaurant location'}.
                  {restaurant.latitude && restaurant.longitude
                    ? <a href={`geo:${restaurant.latitude},${restaurant.longitude}`} aria-label="Get directions to restaurant"> Get directions</a>
                    : null}
                </div>
              )}

              <div className="field">
                <label htmlFor={`checkout-scheduled-${restaurantId}`}>Schedule (optional)</label>
                <input
                  id={`checkout-scheduled-${restaurantId}`}
                  type="datetime-local"
                  min={minimumSchedule()}
                  value={section.scheduled_for || ''}
                  onChange={(event) => updateSection(restaurantId, { scheduled_for: event.target.value })}
                />
              </div>

              <div className="field customer-checkout-discount">
                <label htmlFor={`checkout-discount-${restaurantId}`}>Discount code</label>
                <div>
                  <input
                    id={`checkout-discount-${restaurantId}`}
                    autoComplete="off"
                    value={section.discount_code || ''}
                    onChange={(event) => {
                      updateSection(restaurantId, { discount_code: event.target.value });
                      setDiscountMessages((current) => ({ ...current, [restaurantId]: '' }));
                    }}
                  />
                  <Button type="button" variant="secondary" disabled={discountLoading[restaurantId]} onClick={() => applyDiscount(restaurantId)}>
                    {discountLoading[restaurantId] ? 'Checking…' : 'Apply'}
                  </Button>
                </div>
                {discountMessages[restaurantId] ? <p role="status">{discountMessages[restaurantId]}</p> : null}
                {quoteRow?.discount?.message ? <p role="status">{quoteRow.discount.message}</p> : null}
              </div>

              <p className="customer-checkout-payment">
                Payment: <strong>{section.order_type === 'pickup' ? 'Pay at pick-up' : 'Cash on delivery'}</strong>
                <span>Online banks and e-wallets are coming soon.</span>
              </p>

              {quoteLoading ? <p role="status">Rechecking prices and availability…</p> : null}
              {quoteRow && !quoteRow.valid ? (
                <ul className="form-error" role="alert">
                  {Object.values(quoteRow.errors || {}).flat().map((message) => <li key={message}>{message}</li>)}
                </ul>
              ) : null}
              {quoteRow?.valid ? (
                <>
                  <div className="amount-row"><span>Subtotal</span><strong>{formatPeso(quoteRow.subtotal)}</strong></div>
                  {section.order_type === 'delivery' ? <div className="amount-row"><span>Delivery fee · {quoteRow.distance_km?.toFixed(1)} km</span><strong>{formatPeso(quoteRow.delivery_fee)}</strong></div> : null}
                  <div className="amount-row"><span>Service fee</span><strong>{formatPeso(quoteRow.service_fee)}</strong></div>
                  <div className="amount-row"><span>Discount</span><strong>-{formatPeso(quoteRow.discount?.amount || 0)}</strong></div>
                  <div className="total-row"><span>Order total</span><strong>{formatPeso(quoteRow.total)}</strong></div>
                  {quoteRow.eta ? (
                    <p className="customer-checkout-eta">
                      Estimated arrival {new Date(quoteRow.eta.min_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {'–'}{new Date(quoteRow.eta.max_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {quoteRow.distance_source === 'straight_line_estimate' ? ' · straight-line estimate' : ''}
                    </p>
                  ) : null}
                </>
              ) : null}
            </section>
          );
        })}

        <aside className="summary-card customer-checkout-summary">
          <h2>Checkout summary</h2>
          {quote?.orders?.map((row) => (
            <div className="amount-row" key={row.restaurant_id}>
              <span>{row.restaurant_name}</span>
              <strong>{row.valid ? formatPeso(row.total) : 'Review details'}</strong>
            </div>
          ))}
          <div className="total-row"><span>Grand total</span><strong>{quoteValid ? formatPeso(quote.grand_total) : '—'}</strong></div>
          <p>Totals and availability are calculated by SALO and checked again when orders are placed.</p>
          <Button type="submit" disabled={submitting || quoteLoading || !quoteValid || !emailVerified}>
            {submitting ? 'Placing orders…' : 'Place orders'}
          </Button>
          <Link to="/cart" className="btn btn--secondary customer-checkout-back">Back to cart</Link>
        </aside>
      </form>
    </div>
  );
}
