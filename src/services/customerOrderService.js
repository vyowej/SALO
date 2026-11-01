import { apiRequest } from './apiClient';
import { config } from '../config';
import { restaurantService } from './restaurantService';

const STATUS_LABELS = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const normalizeStatus = (status) => STATUS_LABELS[status] || status;

const normalizeOrder = (order) => {
  const items = (order.items || []).map((item) => ({
    id: String(item.item_id || item.id),
    name: item.name,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unit_price),
    note: item.note || '',
    optionLabels: [],
  }));
  const placedAt = order.placed_at || order.created_at;
  const payment = order.payments?.[0];

  return {
    ...order,
    id: String(order.id),
    restaurantId: String(order.restaurant?.id || ''),
    restaurant: order.restaurant?.name || 'Restaurant',
    status: normalizeStatus(order.status),
    date: placedAt ? new Date(placedAt).toLocaleDateString() : '',
    createdAt: placedAt,
    items: items.map((item) => `${item.quantity} × ${item.name}`).join(', '),
    cartItems: items,
    total: Number(order.total_amount || 0),
    subtotal: Number(order.subtotal || 0),
    deliveryFee: Number(order.delivery_fee || 0),
    serviceFee: Number(order.service_fee || 0),
    discount: Number(order.discount_amount || 0),
    deliveryMode: order.order_type === 'delivery' ? 'Delivery' : 'Pick-up',
    address: order.delivery_address_text || '',
    delivery_country_code: 'PH',
    payment: payment?.method || 'Cash on delivery',
    cancelReason: order.cancel_reason || '',
    eta: null,
    rider: null,
    restaurantReview: order.restaurant_review || null,
  };
};

const ensureApiMode = () => {
  if (config.useMock) throw new Error('Customer order API calls are unavailable in mock mode.');
};

export const customerOrderService = {
  async getOrders() {
    if (config.useMock) return restaurantService.getOrders();
    const result = await apiRequest('/customer/orders');
    if (!Array.isArray(result)) throw new Error('The customer orders response is invalid.');
    return result.map(normalizeOrder);
  },

  async getOrderById(id) {
    if (config.useMock) return restaurantService.getOrderById(id);
    const order = await apiRequest(`/customer/orders/${encodeURIComponent(id)}`);
    return order ? normalizeOrder(order) : null;
  },

  async getTracking(id) {
    ensureApiMode();
    const tracking = await apiRequest(`/customer/orders/${encodeURIComponent(id)}/tracking`);
    return {
      ...tracking,
      status: normalizeStatus(tracking.status),
      timeline: (tracking.timeline || []).map((entry) => ({
        ...entry,
        status: normalizeStatus(entry.status),
      })),
    };
  },

  async advanceMockOrder(id) {
    if (!config.useMock) throw new Error('Mock order tracking is unavailable in API mode.');
    return restaurantService.advanceOrder(id);
  },

  async cancelOrder(id, reason = '') {
    if (config.useMock) return restaurantService.cancelOrder(id, reason);
    const order = await apiRequest(`/customer/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: { reason },
    });
    return normalizeOrder(order);
  },

  async confirmReceipt(id) {
    if (config.useMock) return restaurantService.confirmReceipt(id);
    const order = await apiRequest(`/customer/orders/${encodeURIComponent(id)}/receipt-confirmation`, {
      method: 'POST',
      body: { received: true },
    });
    return normalizeOrder(order);
  },

  async reviewRestaurant(id, review) {
    if (config.useMock) return restaurantService.reviewRestaurant(id, review);
    const order = await apiRequest(`/customer/orders/${encodeURIComponent(id)}/reviews/restaurant`, {
      method: 'POST',
      body: review,
    });
    return normalizeOrder(order);
  },

  async getNotifications() {
    if (config.useMock) return [];
    const result = await apiRequest('/customer/notifications');
    if (!Array.isArray(result)) throw new Error('The customer notifications response is invalid.');
    return result;
  },

  async markNotificationRead(id) {
    ensureApiMode();
    return apiRequest(`/customer/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
      body: {},
    });
  },
};

export default customerOrderService;
