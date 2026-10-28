import { ownerDashboardSeed } from '../mock/dashboardData';
import { config } from '../config';

const wait = () => new Promise((resolve) => setTimeout(resolve, config.mockDelay));
const rangeMultiplier = { Today: 1, '7 days': 7, '30 days': 26 };

export const ownerService = {
  async getOverview(range = 'Today') {
    await wait();
    const multiplier = rangeMultiplier[range] || 1;
    return {
      acceptingOrders: ownerDashboardSeed.acceptingOrders,
      metrics: [
        { label: 'Sales', value: 12842 * multiplier, delta: '+12.4%', format: 'currency' },
        { label: 'Orders', value: 342 * multiplier, delta: '+18%', format: 'number' },
        { label: 'Pending orders', value: 12, delta: '3 need attention', format: 'number' },
        { label: 'Reservations', value: 58 * multiplier, delta: '+9%', format: 'number' },
        { label: 'Average rating', value: 4.8, delta: '+0.2', format: 'rating' },
        { label: 'Completion rate', value: 96, delta: '+2.1%', format: 'percent' },
      ],
      sales: Array.from({ length: range === '30 days' ? 12 : 7 }, (_, index) => ({ label: range === '30 days' ? `W${index + 1}` : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index], value: Math.round((5000 + ((index * 791) % 5400)) * multiplier / (range === 'Today' ? 1 : range === '7 days' ? 4 : 12)) })),
      topItems: [{ label: 'Adobo bowl', value: 84 }, { label: 'Halo-Halo', value: 61 }, { label: 'Tinola', value: 46 }, { label: 'Biko', value: 29 }],
      orderStatuses: [{ label: 'Preparing', value: 12 }, { label: 'Completed', value: 42 }, { label: 'Cancelled', value: 3 }],
      incomingOrders: ownerDashboardSeed.incomingOrders,
      reservations: ownerDashboardSeed.reservations,
      menuItems: ownerDashboardSeed.menuItems,
    };
  },

  async setAcceptingOrders(value) {
    await wait();
    ownerDashboardSeed.acceptingOrders = value;
    return value;
  },

  async updateOrder(id, action, reason = '') {
    await wait();
    if (action === 'Reject' && !reason.trim()) return { error: 'A rejection reason is required.' };
    const order = ownerDashboardSeed.incomingOrders.find((item) => item.id === id);
    if (!order) return { error: 'Order not found.' };
    order.status = action === 'Accept' ? 'Confirmed' : 'Rejected';
    order.reason = reason;
    return { order };
  },

  async updateReservation(id, status) {
    await wait();
    const reservation = ownerDashboardSeed.reservations.find((item) => item.id === id);
    if (!reservation) return { error: 'Reservation not found.' };
    reservation.status = status;
    return { reservation };
  },

  async updateMenuAvailability(id, available) {
    await wait();
    const item = ownerDashboardSeed.menuItems.find((entry) => entry.id === id);
    if (!item) return { error: 'Menu item not found.' };
    item.available = available && item.quantity !== 0;
    if (item.quantity === 0) item.status = 'Sold out';
    return { item };
  },

  async publishMenuItem(id) {
    await wait();
    const item = ownerDashboardSeed.menuItems.find((entry) => entry.id === id);
    if (!item) return { error: 'Menu item not found.' };
    item.status = 'Published';
    return { item };
  },
};

export default ownerService;
