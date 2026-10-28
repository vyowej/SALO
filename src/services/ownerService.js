import { ownerDashboardSeed } from '../mock/dashboardData';
import { config } from '../config';

const wait = () => new Promise((resolve) => setTimeout(resolve, config.mockDelay));

export const ownerService = {
  async getOverview(range = 'Today') {
    await wait();
    const seed = ownerDashboardSeed.overview;
    const multiplier = seed.rangeMultipliers[range] || seed.rangeMultipliers.Today;
    const metricValues = seed.metricValues;
    return {
      acceptingOrders: ownerDashboardSeed.acceptingOrders,
      metrics: [
        { label: 'Sales', value: metricValues.sales * multiplier, delta: seed.metricDeltas[0], format: 'currency' },
        { label: 'Orders', value: metricValues.orders * multiplier, delta: seed.metricDeltas[1], format: 'number' },
        { label: 'Pending orders', value: metricValues.pendingOrders, delta: seed.metricDeltas[2], format: 'number' },
        { label: 'Reservations', value: metricValues.reservations * multiplier, delta: seed.metricDeltas[3], format: 'number' },
        { label: 'Average rating', value: metricValues.averageRating, delta: seed.metricDeltas[4], format: 'rating' },
        { label: 'Completion rate', value: metricValues.completionRate, delta: seed.metricDeltas[5], format: 'percent' },
      ],
      sales: seed.chartValues.slice(0, range === '30 days' ? 12 : 7).map((value, index) => ({
        label: range === '30 days' ? `W${index + 1}` : seed.chartDayLabels[index],
        value: Math.round(value * multiplier / (range === 'Today' ? 1 : range === '7 days' ? 4 : 12)),
      })),
      topItems: seed.topItems,
      orderStatuses: seed.orderStatuses,
      highlights: seed.highlights,
      activityQueue: ownerDashboardSeed.incomingOrders,
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
