import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatPeso } from '../../utils/formatPeso';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import '../Page.css';
import './Cart.css';

export default function CustomerCartPage() {
  const {
    restaurantCarts,
    cartLoading,
    cartError,
    updateQuantity,
    updateNote,
    removeItem,
    clearRestaurant,
    refreshCarts,
    setCartError,
  } = useCart();
  const [working, setWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const entries = useMemo(
    () => Object.entries(restaurantCarts).filter(([, items]) => items.length),
    [restaurantCarts],
  );
  const subtotal = entries.flatMap(([, items]) => items)
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
  const unavailable = entries.some(([, items]) => items.some((item) => item.available === false || item.soldOut));

  const runMutation = async (operation) => {
    setWorking(true);
    setCartError('');
    try {
      await operation();
    } catch (error) {
      console.error('Unable to update the customer cart.', error);
      setCartError(error.message || 'The cart could not be updated.');
    } finally {
      setWorking(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const { restaurantId, itemId } = pendingAction;
    await runMutation(() => itemId
      ? removeItem(restaurantId, itemId)
      : clearRestaurant(restaurantId));
    setPendingAction(null);
  };

  if (cartLoading) {
    return <div className="section-shell cart-page"><div className="cart-page__skeleton"><div className="skeleton skeleton--block" /><div className="skeleton skeleton--block" /></div></div>;
  }

  if (cartError) {
    return (
      <div className="section-shell cart-page">
        <div className="empty-state empty-state--error" role="alert">
          <h1>Your carts are unavailable</h1>
          <p>{cartError}</p>
          <Button variant="secondary" onClick={refreshCarts}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="section-shell cart-page">
        <div className="page-header"><div><h1>Your cart</h1><p>Your restaurant carts stay separate until you check out together.</p></div></div>
        <div className="empty-state">
          <h2>Your cart is empty</h2>
          <p>Add a dish to get started. Your cart will keep the current menu prices as display hints.</p>
          <Link to="/restaurants" className="btn btn--primary cart-empty-action">Browse restaurants</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="section-shell cart-page">
      <div className="page-header">
        <div>
          <h1>Your cart</h1>
          <p>{entries.length} restaurant {entries.length === 1 ? 'order' : 'orders'} can be checked out together.</p>
        </div>
      </div>

      {cartError ? <p className="form-error" role="alert">{cartError}</p> : null}
      <div className="customer-cart-groups">
        {entries.map(([restaurantId, items]) => {
          const restaurant = items[0]?.restaurant || {};
          const groupSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          return (
            <section className="info-card customer-cart-group" key={restaurantId} aria-labelledby={`cart-restaurant-${restaurantId}`}>
              <header className="customer-cart-group__header">
                <div>
                  <h2 id={`cart-restaurant-${restaurantId}`}>{restaurant.name || items[0]?.restaurantName}</h2>
                  <p>{restaurant.formatted_address || 'Restaurant location will be shown at checkout.'}</p>
                </div>
                <Button variant="secondary" disabled={working} onClick={() => setPendingAction({ restaurantId })}>
                  Clear cart
                </Button>
              </header>
              <div className="cart-page__line-items">
                {items.map((item) => {
                  const itemKey = item.cartKey || item.id;
                  return (
                    <article className="cart-line" key={itemKey}>
                      <div className="cart-line__description">
                        <strong>{item.name}</strong>
                        <span>{formatPeso(item.price)} each · current price</span>
                        {item.available === false || item.soldOut ? <span className="form-error" role="status">No longer available; remove this item to continue.</span> : null}
                        <div className="field customer-cart-note">
                          <label htmlFor={`cart-note-${itemKey}`}>Item note</label>
                          <textarea
                            id={`cart-note-${itemKey}`}
                            defaultValue={item.note || ''}
                            maxLength={255}
                            onBlur={(event) => {
                              if (event.target.value !== (item.note || '')) {
                                runMutation(() => updateNote(restaurantId, itemKey, event.target.value));
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div className="cart-line__actions">
                        <div className="qty-control">
                          <button type="button" aria-label={`Decrease ${item.name}`} disabled={working} onClick={() => runMutation(() => updateQuantity(restaurantId, itemKey, item.quantity - 1))}><Minus size={14} /></button>
                          <span>{item.quantity}</span>
                          <button type="button" aria-label={`Increase ${item.name}`} disabled={working || item.quantity >= 99} onClick={() => runMutation(() => updateQuantity(restaurantId, itemKey, item.quantity + 1))}><Plus size={14} /></button>
                        </div>
                        <strong>{formatPeso(item.price * item.quantity)}</strong>
                        <button type="button" className="icon-button" aria-label={`Remove ${item.name}`} disabled={working} onClick={() => setPendingAction({ restaurantId, itemId: itemKey, itemName: item.name })}><Trash2 size={15} /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="amount-row customer-cart-group__subtotal"><span>Current item subtotal</span><strong>{formatPeso(groupSubtotal)}</strong></div>
            </section>
          );
        })}
      </div>

      <aside className="summary-card customer-cart-summary">
        <h2>Order summary</h2>
        <div className="amount-row"><span>Current item subtotal</span><strong>{formatPeso(subtotal)}</strong></div>
        <p>Prices, availability, delivery fees, discounts, and totals are rechecked by the server at checkout.</p>
        {unavailable ? <p className="form-error" role="alert">Remove unavailable items before continuing.</p> : null}
        <Link
          to="/checkout"
          className={`btn btn--primary btn--full cart-review-button${unavailable ? ' is-disabled' : ''}`}
          aria-disabled={unavailable}
          onClick={(event) => { if (unavailable) event.preventDefault(); }}
        >
          Review orders and checkout
        </Link>
      </aside>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.itemId ? 'Remove this item?' : 'Clear this restaurant cart?'}
        message={pendingAction?.itemId
          ? `Remove ${pendingAction.itemName} from your cart?`
          : 'All items in this restaurant cart will be removed.'}
        confirmLabel={pendingAction?.itemId ? 'Remove item' : 'Clear cart'}
        busy={working}
        onCancel={() => { if (!working) setPendingAction(null); }}
        onConfirm={confirmPendingAction}
      />
    </div>
  );
}
