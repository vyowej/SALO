import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Bike, Clock3, MapPin, X } from 'lucide-react';
import { restaurantService } from '../../services/restaurantService';
import { formatPeso } from '../../utils/formatPeso';
import { Stepper } from '../../components/ui/Stepper';
import { Button } from '../../components/ui/Button';
import '../Page.css';
import './OrderDetail.css';

const orderSteps = ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Completed'];
const currentStep = (status) => {
  const normalized = status === 'Delivered' ? 'Completed' : status === 'On the way' ? 'Out for Delivery' : status;
  return orderSteps.indexOf(normalized);
};
const cancelReasons = ['I placed this order by mistake', 'The delivery address is incorrect', 'I need to change my order', 'Other'];

export default function OrderDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [reviewSent, setReviewSent] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [placedToastVisible, setPlacedToastVisible] = useState(searchParams.get('placed') === 'true');
  const cancelDialogRef = useRef(null);

  const loadOrder = useCallback(async () => {
    setError('');
    try {
      const loadedOrder = await restaurantService.getOrderById(id);
      setOrder(loadedOrder);
      if (!loadedOrder) setError('We couldn’t find this order.');
    } catch (loadError) {
      console.error('Unable to load order details.', loadError);
      setError('We couldn’t load this order.');
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    restaurantService.getOrderById(id)
      .then((loadedOrder) => {
        if (!active) return;
        setOrder(loadedOrder);
        if (!loadedOrder) setError('We couldn’t find this order.');
      })
      .catch((loadError) => {
        console.error('Unable to load order details.', loadError);
        if (active) setError('We couldn’t load this order.');
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!placedToastVisible) return undefined;
    const timer = window.setTimeout(() => setPlacedToastVisible(false), 3500);
    return () => window.clearTimeout(timer);
  }, [placedToastVisible]);

  const orderStatus = order?.status;
  useEffect(() => {
    if (!orderStatus || ['Completed', 'Delivered', 'Cancelled'].includes(orderStatus)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const updated = await restaurantService.advanceOrder(id);
        if (updated) setOrder(updated);
      } catch (progressError) {
        console.error('Unable to update mock order tracking.', progressError);
      }
    }, 3500);
    return () => window.clearInterval(timer);
  }, [id, orderStatus]);

  useEffect(() => {
    if (!cancelOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setCancelOpen(false);
      if (event.key === 'Tab' && cancelDialogRef.current) {
        const focusable = [...cancelDialogRef.current.querySelectorAll('button:not(:disabled), select:not(:disabled)')];
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
  }, [cancelOpen]);

  const confirmCancel = async () => {
    if (!cancelReason) {
      setCancelError('Choose a reason for cancelling this order.');
      return;
    }
    setCancelBusy(true);
    setCancelError('');
    try {
      const updated = await restaurantService.cancelOrder(order.id, cancelReason);
      if (!updated) {
        setCancelError('This order can no longer be cancelled.');
        return;
      }
      setOrder(updated);
      setCancelOpen(false);
    } catch (cancelFailure) {
      console.error('Unable to cancel order.', cancelFailure);
      setCancelError('We couldn’t cancel this order. Please try again.');
    } finally {
      setCancelBusy(false);
    }
  };

  if (!order) {
    if (error) return <div className="section-shell data-page"><div className="empty-state empty-state--error"><h2>Order unavailable</h2><p>{error}</p><Button variant="secondary" onClick={loadOrder}>Try again</Button></div></div>;
    return <div className="section-shell data-page"><div className="skeleton skeleton--block order-detail-skeleton" /></div>;
  }

  const completed = ['Completed', 'Delivered'].includes(order.status);

  return (
    <div className="section-shell order-shell order-detail-page">
      {searchParams.get('placed') === 'true' ? <div className="order-placed-banner" role="status"><span>Order placed</span><strong>Mabuhay! Your order is on its way to the kitchen.</strong></div> : null}
      {placedToastVisible ? <div className="toast order-placed-toast" role="status">Order placed successfully.</div> : null}
      <div className="page-header"><div><span className="eyebrow">{order.id}</span><h1>{order.restaurant}</h1><p>Placed {order.date}</p></div><span className={`status-badge ${completed ? 'status-badge--success' : order.status === 'Cancelled' ? 'status-badge--danger' : 'status-badge--pending'}`}>{order.status === 'Delivered' ? 'Completed' : order.status}</span></div>

      <div className="checkout-grid order-detail-grid">
        <section className="info-card order-tracking-card">
          <div className="order-eta-card"><Clock3 size={20} /><span><strong>{completed ? 'Order completed' : order.status === 'Cancelled' ? 'Order cancelled' : order.eta ? `Arriving in ${order.eta}` : 'Delivery estimate unavailable'}</strong><small>{order.status === 'Out for Delivery' ? 'Your rider is on the way.' : completed ? 'Thanks for ordering with SALO.' : 'We’ll update this status automatically in the preview.'}</small></span></div>
          <h2>Track your order</h2>
          <Stepper steps={orderSteps} currentStep={currentStep(order.status)} />
          {order.status === 'Cancelled' ? <p className="order-cancelled-copy">This order was cancelled{order.cancelReason ? `: ${order.cancelReason}` : '.'}</p> : null}
          {order.rider ? <article className="order-rider-card"><div className="order-rider-card__avatar"><Bike size={21} /></div><div><strong>{order.rider.name}</strong><small>{order.rider.vehicle}</small></div>{order.rider.phone ? <a href={`tel:${order.rider.phone}`} className="text-link">Call rider</a> : null}</article> : null}
          <div className="order-delivery-detail"><MapPin size={16} /><span>{order.deliveryMode || 'Delivery'}{order.address ? ` · ${order.address}` : ''}{order.riderNote ? ` · ${order.riderNote}` : ''}</span></div>
          <section className="order-items-summary"><h2>Items</h2>{order.cartItems?.length ? order.cartItems.map((item, index) => <div key={`${item.id}-${index}`}><span>{item.quantity} × {item.name}{item.optionLabels?.length ? <small>{item.optionLabels.join(', ')}</small> : null}</span><strong>{formatPeso(item.unitPrice * item.quantity)}</strong></div>) : <p>{order.items}</p>}</section>
          {order.status === 'Placed' ? <Button variant="ghost" onClick={() => setCancelOpen(true)}>Cancel order</Button> : null}
          {completed ? <div className="review-prompt"><h2>How was your order?</h2>{reviewSent ? <p>Thanks for sharing your feedback.</p> : <><div className="rating-choice" aria-label="Rate your order">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" aria-label={`${rating} stars`} onClick={() => setReviewSent(true)}>★</button>)}</div><p>Leave a quick rating for {order.restaurant}.</p></>}</div> : null}
        </section>

        <aside className="summary-card order-receipt-card">
          <h2>Receipt</h2>
          <div className="receipt-meta"><span>Reference code</span><strong>{order.id}</strong></div>
          <div className="receipt-meta"><span>Payment</span><strong>{order.payment || 'Cash on delivery'}</strong></div>
          <div className="amount-row"><span>Subtotal</span><strong>{formatPeso(order.subtotal ?? order.total)}</strong></div>
          <div className="amount-row"><span>Delivery</span><strong>{formatPeso(order.deliveryFee || 0)}</strong></div>
          {order.priorityFee ? <div className="amount-row"><span>Priority delivery</span><strong>{formatPeso(order.priorityFee)}</strong></div> : null}
          <div className="amount-row"><span>Service fee</span><strong>{formatPeso(order.serviceFee || 0)}</strong></div>
          <div className="amount-row"><span>Discount</span><strong>-{formatPeso(order.discount || 0)}</strong></div>
          <div className="total-row"><span>Total</span><strong>{formatPeso(order.total)}</strong></div>
          <Link to="/orders" className="btn btn--secondary btn--full">All orders</Link>
          {order.status === 'Cancelled' ? <Link to="/restaurants" className="btn btn--primary btn--full">Order again</Link> : null}
        </aside>
      </div>

      {cancelOpen ? <div className="modal-backdrop order-cancel-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCancelOpen(false); }}><section className="modal order-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title" ref={cancelDialogRef}><header className="modal__header"><div><h2 id="cancel-order-title">Cancel this order?</h2><p>This is only available while the order is Placed.</p></div><button type="button" className="icon-button" aria-label="Close cancel dialog" onClick={() => setCancelOpen(false)}><X size={17} /></button></header><div className="modal__body order-cancel-form"><div className="field"><label htmlFor="cancel-reason">Reason for cancelling</label><select id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}><option value="">Choose a reason</option>{cancelReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></div>{cancelError ? <p className="form-error" role="alert">{cancelError}</p> : null}<div className="order-cancel-actions"><Button variant="ghost" onClick={() => setCancelOpen(false)}>Keep order</Button><Button variant="primary" onClick={confirmCancel} disabled={cancelBusy}>{cancelBusy ? 'Cancelling…' : 'Confirm cancellation'}</Button></div></div></section></div> : null}
    </div>
  );
}
