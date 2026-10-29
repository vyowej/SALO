import { config } from '../config';

const wait = () => new Promise((resolve) => setTimeout(resolve, config.mockDelay));

const mockDashboard = {
  totals: {
    orders: 64,
    revenue: 18800.5,
    reservations: 12,
    itemsSold: 184,
  },
  ordersPerDay: [
    { date: '2026-10-20', orders: 8, revenue: 540 },
    { date: '2026-10-21', orders: 10, revenue: 620 },
    { date: '2026-10-22', orders: 9, revenue: 610 },
  ],
  ordersByStatus: [
    { status: 'pending', count: 12 },
    { status: 'preparing', count: 9 },
    { status: 'ready', count: 6 },
    { status: 'completed', count: 37 },
  ],
  topItems: [
    { id: 'menu_1', name: 'Adobo Bowl', orders: 18, revenue: 2200 },
    { id: 'menu_2', name: 'Sisig Rice', orders: 14, revenue: 1800 },
  ],
  pendingOrders: [
    { id: 'ord_1001', status: 'pending', total: 540 },
    { id: 'ord_1002', status: 'pending', total: 420 },
  ],
  upcomingReservations: [
    { id: 'res_901', tableLabel: 'Table 04', guestCount: 4, startsAt: '2026-10-29T18:30:00+08:00' },
    { id: 'res_902', tableLabel: 'Table 11', guestCount: 6, startsAt: '2026-10-29T19:00:00+08:00' },
  ],
};

const mockOrders = [
  { id: 'ord_1001', status: 'pending', customerName: 'Maria Dela Cruz', total: 540 },
  { id: 'ord_1002', status: 'accept', customerName: 'John Santos', total: 420 },
  { id: 'ord_1003', status: 'ready', customerName: 'Ava Lim', total: 280 },
];

export const businessService = {
  async getDashboard() {
    await wait();
    return mockDashboard;
  },

  async getOrders() {
    await wait();
    return mockOrders;
  },

  async getProfile() {
    await wait();
    return {
      name: 'SALO Kitchen',
      description: 'Filipino comfort food and sharing plates.',
      cuisines: ['Filipino', 'Street food'],
      status: 'active',
    };
  },
}

export default businessService;
