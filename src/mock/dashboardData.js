export const ownerDashboardSeed = {
  acceptingOrders: true,
  incomingOrders: [
    { id: 'ORD-1049', customer: 'Nina L.', items: 'Family Hapag Platter ×1', total: 640, placedMinutesAgo: 2, mode: 'Delivery', status: 'Placed' },
    { id: 'ORD-1050', customer: 'Jojo T.', items: 'Chicken Adobo Bowl ×2', total: 440, placedMinutesAgo: 5, mode: 'Pick-up', status: 'Placed' },
    { id: 'ORD-1051', customer: 'Lena R.', items: 'Halo-Halo ×2, Biko Slice ×1', total: 410, placedMinutesAgo: 8, mode: 'Delivery', status: 'Preparing' },
  ],
  reservations: [
    { id: 'RES-211', guest: 'Ana Villanueva', time: '6:30 PM', guests: 4, status: 'Pending' },
    { id: 'RES-212', guest: 'Paolo Lim', time: '7:15 PM', guests: 2, status: 'Confirmed' },
  ],
  menuItems: [
    { id: 'adobo-rice-bowl', name: 'Chicken Adobo Rice Bowl', category: 'Rice Meals', price: 220, quantity: 18, available: true, status: 'Published', tags: ['Pork-free'] },
    { id: 'crispy-pata', name: 'Crispy Pata Bowl', category: 'Rice Meals', price: 310, quantity: 0, available: false, status: 'Published', tags: [] },
    { id: 'halo-halo', name: 'Classic Halo-Halo', category: 'Desserts', price: 150, quantity: 12, available: true, status: 'Published', tags: ['Vegetarian'] },
    { id: 'biko', name: 'Biko Slice', category: 'Desserts', price: 110, quantity: 8, available: true, status: 'Draft', tags: ['Vegetarian'] },
  ],
};

export const adminDashboardSeed = {
  applications: [
    { id: 'APP-510', name: 'Kubo Kusina', type: 'Restaurant', submitted: 'Today, 9:20 AM', status: 'Pending', documents: ['Business permit', 'Owner ID'] },
    { id: 'APP-508', name: 'Rey Cruz', type: 'Rider', submitted: 'Yesterday', status: 'Needs Revision', documents: ['Driver license', 'Vehicle registration'] },
    { id: 'APP-502', name: 'Sarap Seoul', type: 'Restaurant', submitted: 'Oct 26', status: 'Pending', documents: ['Business permit', 'Menu'] },
  ],
  supportTickets: [
    { id: 'TKT-204', topic: 'Refund request', customer: 'M. Garcia', status: 'Open' },
    { id: 'TKT-201', topic: 'Missing item', customer: 'J. Lee', status: 'Open' },
  ],
};

export const riderDashboardSeed = {
  online: true,
  offers: [
    { id: 'OFR-103', pickup: 'Mang Toma’s Kitchen', dropoff: 'Sampaguita St., Quezon City', payout: 185, distance: '3.2 km', expiresIn: 28 },
    { id: 'OFR-104', pickup: 'Pista at Kape', dropoff: 'BGC Corporate Center, Taguig', payout: 220, distance: '5.1 km', expiresIn: 44 },
  ],
  earnings: [320, 460, 280, 540, 380, 500, 0],
};
