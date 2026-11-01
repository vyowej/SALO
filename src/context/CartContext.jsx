/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { config } from '../config';
import { customerCartService } from '../services/customerCartService';

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
  const [restaurantCarts, setRestaurantCarts] = useState(() => (config.useMock ? readStoredCarts() : {}));
  const [cartLoading, setCartLoading] = useState(!config.useMock);
  const [cartError, setCartError] = useState('');
  const [activeRestaurantId, setActiveRestaurantId] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const savedId = window.localStorage.getItem(ACTIVE_STORAGE_KEY);
      const carts = config.useMock ? readStoredCarts() : {};
      return (savedId && carts[savedId]?.length ? savedId : '')
        || Object.keys(carts).find((id) => carts[id]?.length)
        || savedId
        || '';
    } catch (error) {
      console.error('Unable to read the active cart.', error);
      return '';
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && config.useMock) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(restaurantCarts));
      if (activeRestaurantId) window.localStorage.setItem(ACTIVE_STORAGE_KEY, activeRestaurantId);
      else window.localStorage.removeItem(ACTIVE_STORAGE_KEY);
    }
  }, [restaurantCarts, activeRestaurantId]);

  const refreshCarts = useCallback(async () => {
    if (config.useMock) return;
    setCartLoading(true);
    setCartError('');
    try {
      const carts = await customerCartService.getCarts();
      const normalized = Object.fromEntries(carts.map((cart) => [cart.restaurantId, cart.items]));
      setRestaurantCarts(normalized);
      setActiveRestaurantId((current) => (
        current && normalized[current]?.length
          ? current
          : Object.keys(normalized).find((restaurantId) => normalized[restaurantId]?.length) || ''
      ));
    } catch (error) {
      console.error('Unable to load saved customer carts.', error);
      setCartError(error.message || 'Your saved carts could not be loaded.');
    } finally {
      setCartLoading(false);
    }
  }, []);

  useEffect(() => {
    if (config.useMock) return undefined;
    let active = true;
    customerCartService.getCarts()
      .then((carts) => {
        if (!active) return;
        const normalized = Object.fromEntries(carts.map((cart) => [cart.restaurantId, cart.items]));
        setRestaurantCarts(normalized);
        setActiveRestaurantId((current) => (
          current && normalized[current]?.length
            ? current
            : Object.keys(normalized).find((restaurantId) => normalized[restaurantId]?.length) || ''
        ));
      })
      .catch((error) => {
        console.error('Unable to load saved customer carts.', error);
        if (active) setCartError(error.message || 'Your saved carts could not be loaded.');
      })
      .finally(() => {
        if (active) setCartLoading(false);
      });
    return () => { active = false; };
  }, []);

  const addItem = useCallback((restaurantId, item, quantity = 1) => {
    if (!config.useMock) {
      return customerCartService.addItem(restaurantId, item, quantity)
        .then(async () => {
          setActiveRestaurantId(String(restaurantId));
          await refreshCarts();
          return true;
        })
        .catch((error) => {
          console.error('Unable to save the menu item to the customer cart.', error);
          setCartError(error.message || 'The item could not be added to your cart.');
          return false;
        });
    }
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
  }, [refreshCarts]);

  const removeItem = useCallback((restaurantId, itemId) => {
    if (!config.useMock) {
      return customerCartService.removeItem(restaurantId, itemId)
        .then(refreshCarts)
        .then(() => true)
        .catch((error) => {
          console.error('Unable to remove the item from the customer cart.', error);
          setCartError(error.message || 'The item could not be removed.');
          return false;
        });
    }
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
  }, [refreshCarts]);

  const updateQuantity = useCallback((restaurantId, itemId, nextQuantity) => {
    if (!config.useMock) {
      return customerCartService.updateItem(restaurantId, itemId, { quantity: nextQuantity })
        .then(refreshCarts)
        .then(() => true)
        .catch((error) => {
          console.error('Unable to update the customer cart quantity.', error);
          setCartError(error.message || 'The cart quantity could not be changed.');
          return false;
        });
    }
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
  }, [removeItem, refreshCarts]);

  const updateNote = useCallback((restaurantId, itemId, note) => {
    if (!config.useMock) {
      return customerCartService.updateItem(restaurantId, itemId, { note })
        .then(refreshCarts)
        .then(() => true)
        .catch((error) => {
          console.error('Unable to update the customer cart item note.', error);
          setCartError(error.message || 'The item note could not be saved.');
          return false;
        });
    }

    setRestaurantCarts((current) => ({
      ...current,
      [restaurantId]: (current[restaurantId] || []).map((entry) => (
        (entry.cartKey || entry.id) === itemId ? { ...entry, note } : entry
      )),
    }));
    return Promise.resolve(true);
  }, [refreshCarts]);

  const restoreItem = useCallback((restaurantId, item) => {
    if (!config.useMock) {
      return customerCartService.addItem(restaurantId, {
        id: item.itemId,
        note: item.note,
        optionLabels: [],
      }, item.quantity)
        .then(refreshCarts)
        .then(() => true)
        .catch((error) => {
          console.error('Unable to restore the customer cart item.', error);
          setCartError(error.message || 'The item could not be restored.');
          return false;
        });
    }
    setRestaurantCarts((current) => ({
      ...current,
      [restaurantId]: [...(current[restaurantId] || []), item],
    }));
  }, [refreshCarts]);

  const clearRestaurant = useCallback((restaurantId) => {
    if (!config.useMock) {
      return customerCartService.clearCart(restaurantId)
        .then(refreshCarts)
        .then(() => true)
        .catch((error) => {
          console.error('Unable to clear the customer cart.', error);
          setCartError(error.message || 'The cart could not be cleared.');
          return false;
        });
    }
    setRestaurantCarts((current) => {
      const nextCart = { ...current };
      delete nextCart[restaurantId];

      if (activeRestaurantId === restaurantId) {
        setActiveRestaurantId(Object.keys(nextCart).find((id) => nextCart[id]?.length) || '');
      }

      return nextCart;
    });
  }, [activeRestaurantId, refreshCarts]);

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
      cartLoading,
      cartError,
      refreshCarts,
      setCartError,
      setActiveRestaurant: setActiveRestaurantId,
      addItem,
      removeItem,
      restoreItem,
      updateQuantity,
      updateNote,
      clearRestaurant,
      totalItems,
      totalPrice,
    }),
    [restaurantCarts, effectiveActiveRestaurantId, activeCart, cartLoading, cartError, refreshCarts, totalItems, totalPrice, addItem, removeItem, restoreItem, updateQuantity, updateNote, clearRestaurant],
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
