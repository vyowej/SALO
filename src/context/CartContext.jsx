/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'salo-cart-v1';
const ACTIVE_STORAGE_KEY = 'salo-active-cart-v1';

const readStoredCarts = () => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Unable to read the saved cart.', error);
    return {};
  }
};

export function CartProvider({ children }) {
  const [restaurantCarts, setRestaurantCarts] = useState(readStoredCarts);
  const [activeRestaurantId, setActiveRestaurantId] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const savedId = window.localStorage.getItem(ACTIVE_STORAGE_KEY);
      const carts = readStoredCarts();
      return (savedId && carts[savedId]?.length ? savedId : '')
        || Object.keys(carts).find((id) => carts[id]?.length)
        || '';
    } catch (error) {
      console.error('Unable to read the active cart.', error);
      return '';
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(restaurantCarts));
      if (activeRestaurantId) window.localStorage.setItem(ACTIVE_STORAGE_KEY, activeRestaurantId);
      else window.localStorage.removeItem(ACTIVE_STORAGE_KEY);
    }
  }, [restaurantCarts, activeRestaurantId]);

  const addItem = useCallback((restaurantId, item, quantity = 1) => {
    setActiveRestaurantId(restaurantId);
    setRestaurantCarts((current) => {
      const existing = current[restaurantId] || [];
      const itemKey = item.cartKey || item.id;
      const matchedItem = existing.find((entry) => (entry.cartKey || entry.id) === itemKey);

      if (matchedItem) {
        return {
          ...current,
          [restaurantId]: existing.map((entry) =>
            (entry.cartKey || entry.id) === itemKey ? { ...entry, quantity: entry.quantity + quantity, note: item.note || entry.note } : entry,
          ),
        };
      }

      return {
        ...current,
        [restaurantId]: [...existing, { ...item, cartKey: itemKey, quantity }],
      };
    });
  }, []);

  const removeItem = useCallback((restaurantId, itemId) => {
    let removedItem = null;
    setRestaurantCarts((current) => {
      const nextItems = (current[restaurantId] || []).filter((entry) => {
        if ((entry.cartKey || entry.id) === itemId) {
          removedItem = entry;
          return false;
        }
        return true;
      });
      const nextCart = { ...current };

      if (nextItems.length) {
        nextCart[restaurantId] = nextItems;
      } else {
        delete nextCart[restaurantId];
      }

      return nextCart;
    });
    return removedItem;
  }, []);

  const updateQuantity = useCallback((restaurantId, itemId, nextQuantity) => {
    if (nextQuantity <= 0) {
      removeItem(restaurantId, itemId);
      return;
    }

    setRestaurantCarts((current) => ({
      ...current,
      [restaurantId]: (current[restaurantId] || []).map((entry) =>
        (entry.cartKey || entry.id) === itemId ? { ...entry, quantity: nextQuantity } : entry,
      ),
    }));
  }, [removeItem]);

  const restoreItem = useCallback((restaurantId, item) => {
    setRestaurantCarts((current) => ({
      ...current,
      [restaurantId]: [...(current[restaurantId] || []), item],
    }));
  }, []);

  const clearRestaurant = useCallback((restaurantId) => {
    setRestaurantCarts((current) => {
      const nextCart = { ...current };
      delete nextCart[restaurantId];
      return nextCart;
    });
    if (activeRestaurantId === restaurantId) {
      setActiveRestaurantId(Object.keys(restaurantCarts).find((id) => id !== restaurantId && restaurantCarts[id]?.length) || '');
    }
  }, [activeRestaurantId, restaurantCarts]);

  const effectiveActiveRestaurantId = useMemo(() => restaurantCarts[activeRestaurantId]?.length
    ? activeRestaurantId
    : Object.keys(restaurantCarts).find((id) => restaurantCarts[id]?.length) || '', [restaurantCarts, activeRestaurantId]);
  const activeCart = useMemo(() => restaurantCarts[effectiveActiveRestaurantId] || [], [restaurantCarts, effectiveActiveRestaurantId]);
  const totalItems = useMemo(() => activeCart.reduce((sum, item) => sum + (item.quantity || 0), 0), [activeCart]);

  const totalPrice = useMemo(() => activeCart.reduce((sum, item) => sum + Number(item.price || 0) * (item.quantity || 0), 0), [activeCart]);

  const value = useMemo(
    () => ({
      cart: restaurantCarts,
      restaurantCarts,
      activeRestaurantId: effectiveActiveRestaurantId,
      activeCart,
      setActiveRestaurant: setActiveRestaurantId,
      addItem,
      removeItem,
      restoreItem,
      updateQuantity,
      clearRestaurant,
      totalItems,
      totalPrice,
    }),
    [restaurantCarts, effectiveActiveRestaurantId, activeCart, totalItems, totalPrice, addItem, removeItem, restoreItem, updateQuantity, clearRestaurant],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }

  return context;
}
