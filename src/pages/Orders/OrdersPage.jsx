import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, Truck } from 'lucide-react';
import { restaurantService } from '../../services/restaurantService';
import { formatPeso } from '../../utils/formatPeso';
import { Button } from '../../components/ui/Button';
import { useCart } from '../../context/CartContext';
import '../Page.css';
import './Orders.css';

const isCompleted = (order) => ['Completed', 'Delivered', 'Cancelled'].includes(order.status);

export default function OrdersPage() {
  const { addItem, setActiveRestaurant } = useCart();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('Ongoing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reorderMessage, setReorderMessage] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await restaurantService.getOrders());
    } catch (loadError) {
      console.error('Unable to load orders.', loadError);
      setError('We couldn’t load your orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    restaurantService.getOrders()
      .then((items) => { if (active) setOrders(items); })
      .catch((loadError) => {
        console.error('Unable to load orders.', loadError);
        if (active) setError('We couldn’t load your orders.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredOrders = useMemo(() => orders.filter((order) => (tab === 'Completed' ? isCompleted(order) : !isCompleted(order))), [orders, tab]);

  const reorder = (order) => {
    if (!order.restaurantId || !order.cartItems?.length) {
      setReorderMessage('This older order has no saved item details. Browse the restaurant menu to order again.');
      return;
    }
    setActiveRestaurant(order.restaurantId);
    order.cartItems.forEach((item) => addItem(order.restaurantId, {
      id: item.id,
      name: item.name,
      price: item.unitPrice,
      optionLabels: item.optionLabels || [],
      cartKey: `${item.id}:${(item.optionLabels || []).join('|')}`,
      restaurantId: order.restaurantId,
      restaurantName: order.restaurant,
    }, item.quantity));
    setReorderMessage('Items added to your cart.');
  };

  return (
    <div className="section-shell order-shell orders-page">
      <div className="page-header"><div><h1>Orders</h1><p>Follow your meal from the kitchen to your door.</p></div></div>
      <div className="orders-tabs" role="tablist" aria-label="Order history">
        {['Ongoing', 'Completed'].map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? 'is-selected' : ''} onClick={() => setTab(name)}>{name}</button>)}
      </div>
      {reorderMessage ? <p className="orders-message" role="status">{reorderMessage}</p> : null}
      {loading ? <div className="order-list"><div className="skeleton skeleton--block orders-skeleton" /><div className="skeleton skeleton--block orders-skeleton" /></div> : null}
      {!loading && error ? <div className="empty-state empty-state--error"><h2>Orders unavailable</h2><p>{error}</p><Button variant="secondary" onClick={loadOrders}>Try again</Button></div> : null}
      {!loading && !error && !filteredOrders.length ? <div className="empty-state"><Truck size={26} /><h2>{tab === 'Ongoing' ? 'No ongoing orders' : 'No completed orders yet'}</h2><p>{tab === 'Ongoing' ? 'Your active order updates will appear here.' : 'Completed orders will be saved here for receipts and reviews.'}</p>{tab === 'Ongoing' ? <Link to="/restaurants" className="btn btn--primary orders-browse-link">Browse restaurants</Link> : null}</div> : null}
      {!loading && !error && filteredOrders.length ? <div className="order-list">
        {filteredOrders.map((order) => (
          <article key={order.id} className="order-card orders-card">
            <div className="orders-card__header"><div><strong>{order.restaurant}</strong><small>{order.id} · {order.date}</small></div><span className={`status-badge ${isCompleted(order) ? 'status-badge--success' : 'status-badge--pending'}`}>{order.status === 'Delivered' ? 'Completed' : order.status}</span></div>
            <p className="orders-card__items">{order.items}</p>
            {order.status !== 'Completed' && order.status !== 'Delivered' && order.status !== 'Cancelled' ? <p className="orders-card__eta">Estimated arrival {order.eta || '25–35 min'}</p> : null}
            <div className="orders-card__footer"><strong>{formatPeso(order.total)}</strong><div>{isCompleted(order) ? <button type="button" className="btn btn--ghost btn--md" onClick={() => reorder(order)}><RotateCw size={14} /> Reorder</button> : null}<Link to={`/orders/${order.id}`} className="btn btn--primary btn--md">{isCompleted(order) ? 'View receipt' : 'Track my order'}</Link></div></div>
          </article>
        ))}
      </div> : null}
    </div>
  );
}
