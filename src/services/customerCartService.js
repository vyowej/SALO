import { apiRequest } from './apiClient';
import { config } from '../config';

const normalizeCart = (cart) => ({
  ...cart,
  restaurantId: String(cart.restaurant_id),
  restaurant: {
    ...cart.restaurant,
    id: String(cart.restaurant?.id || cart.restaurant_id),
    deliveryFee: null,
    delivery_radius_km: null,
    location: cart.restaurant?.formatted_address || '',
  },
  items: (cart.items || []).map((item) => ({
    ...item,
    id: String(item.id),
    itemId: String(item.item_id),
    cartKey: String(item.id),
    price: Number(item.unit_price),
    restaurantId: String(cart.restaurant_id),
    restaurantName: cart.restaurant?.name || 'Restaurant',
    restaurant: cart.restaurant,
    cartExpiresAt: cart.expires_at,
    available: Boolean(item.is_orderable),
  })),
});

const ensureApiMode = () => {
  if (config.useMock) throw new Error('Customer cart API calls are unavailable in mock mode.');
};

export const customerCartService = {
  async getCarts() {
    ensureApiMode();
    const result = await apiRequest('/customer/carts');
    if (!Array.isArray(result)) throw new Error('The saved carts response is invalid.');
    return result.map(normalizeCart);
  },

  async addItem(restaurantId, item, quantity = 1) {
    ensureApiMode();
    if (item.optionLabels?.length) {
      throw new Error('Menu options are not supported for saved orders yet. Remove the options and try again.');
    }
    const result = await apiRequest(`/customer/carts/${encodeURIComponent(restaurantId)}/items`, {
      method: 'POST',
      body: {
        item_id: item.itemId || item.id,
        quantity,
        note: item.note || null,
      },
    });
    return normalizeCart(result);
  },

  async updateItem(restaurantId, cartItemId, updates) {
    ensureApiMode();
    const result = await apiRequest(
      `/customer/carts/${encodeURIComponent(restaurantId)}/items/${encodeURIComponent(cartItemId)}`,
      { method: 'PATCH', body: updates },
    );
    return normalizeCart(result);
  },

  async removeItem(restaurantId, cartItemId) {
    ensureApiMode();
    const result = await apiRequest(
      `/customer/carts/${encodeURIComponent(restaurantId)}/items/${encodeURIComponent(cartItemId)}`,
      { method: 'DELETE' },
    );
    return normalizeCart(result);
  },

  async clearCart(restaurantId) {
    ensureApiMode();
    await apiRequest(`/customer/carts/${encodeURIComponent(restaurantId)}`, { method: 'DELETE' });
  },

  async quote(orders) {
    ensureApiMode();
    return apiRequest('/customer/checkout/quote', {
      method: 'POST',
      body: { orders },
    });
  },

  async validateDiscount(data) {
    ensureApiMode();
    return apiRequest('/customer/discounts/validate', {
      method: 'POST',
      body: data,
    });
  },

  async checkout(orders, idempotencyKey) {
    ensureApiMode();
    return apiRequest('/customer/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: { orders },
    });
  },
};

export default customerCartService;
