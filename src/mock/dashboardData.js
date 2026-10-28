export const ownerDashboardSeed = {
  acceptingOrders: true,
  incomingOrders: [
    { id: 'ORD-1049', customer: 'Nina L.', items: 'Family Hapag Platter ×1', total: 640, placedMinutesAgo: 2, eta: '12 mins', mode: 'Delivery', status: 'Placed' },
    { id: 'ORD-1050', customer: 'Jojo T.', items: 'Chicken Adobo Bowl ×2', total: 440, placedMinutesAgo: 5, eta: '8 mins', mode: 'Pick-up', status: 'Placed' },
    { id: 'ORD-1051', customer: 'Lena R.', items: 'Halo-Halo ×2, Biko Slice ×1', total: 410, placedMinutesAgo: 8, eta: '5 mins', mode: 'Delivery', status: 'Preparing' },
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
  overview: {
    metricValues: {
      sales: 12842,
      orders: 342,
      pendingOrders: 12,
      reservations: 58,
      averageRating: 4.8,
      completionRate: 96,
    },
    rangeMultipliers: { Today: 1, '7 days': 7, '30 days': 26 },
    chartDayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    metricDeltas: ['+12.4%', '+18%', '3 need attention', '+9%', '+0.2', '+2.1%'],
    chartValues: [5000, 5791, 6582, 7373, 8164, 8955, 9746, 10537, 5128, 5919, 6710, 7501],
    topItems: [
      { label: 'Adobo bowl', value: 84 },
      { label: 'Halo-Halo', value: 61 },
      { label: 'Tinola', value: 46 },
      { label: 'Biko', value: 29 },
    ],
    orderStatuses: [
      { label: 'Preparing', value: 12 },
      { label: 'Completed', value: 42 },
      { label: 'Cancelled', value: 3 },
    ],
    highlights: [
      { label: 'Peak time', value: '7:00 PM - 8:30 PM' },
      { label: 'Top seller', value: 'Chicken adobo bowl' },
      { label: 'Table occupancy', value: '74% across 18 active tables' },
      { label: 'Promotion', value: 'Lunch combo uplift +22%' },
    ],
  },
};

export const adminDashboardSeed = {
  overview: {
    gmv: 4200000,
    orders: 18240,
    activeRestaurants: 248,
    activeUsers: 48200,
    activeRiders: 318,
    disputes: 8,
    metricDeltas: ['+17.8%', '+12%', '+14 this month', '+8.3%'],
    pendingApplicationsDelta: 'Needs review',
    openTicketsDelta: '2 urgent',
    workspaceDeltas: ['+14 this month', '92% availability', 'Down 6%', '+17.8% MoM'],
    trendLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    trendValues: [840, 937, 1134, 1131, 1328, 1425, 1522],
    topRestaurants: ['Mang Toma’s Kitchen', 'Dagat Kusina', 'Harana Grill House'],
    operations: [
      { label: 'Restaurant onboarding', detail: '3 vendors have incomplete documents', tone: 'warning' },
      { label: 'Rider coverage', detail: 'Metro Manila coverage stable but Cebu needs 2 more riders', tone: 'info' },
      { label: 'Payment reconciliation', detail: '1 settlement is pending review', tone: 'danger' },
    ],
    vendorHealth: [
      { name: 'Mang Toma’s Kitchen', status: 'Healthy', score: '96%' },
      { name: 'Harana Grill House', status: 'Review', score: '84%' },
      { name: 'Dagat Kusina', status: 'Healthy', score: '92%' },
    ],
  },
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
  overview: {
    earnings: 2480,
    deliveries: 12,
    rangeMultipliers: { Today: 1, '7 days': 7, '30 days': 26 },
    acceptanceRate: 94,
    cashToRemit: 640,
    earningsChange: '+8.2% vs yesterday',
    averageRating: 4.8,
    settlementDeadline: '10:00 PM',
    completedRoute: ['Accepted', 'Picked up', 'Delivered'],
  },
  deliveries: [
    { id: 'OFR-102', place: 'Mang Toma’s Kitchen', destination: 'Sampaguita Street, Quezon City', payout: 185, status: 'Pickup ready' },
    { id: 'OFR-103', place: 'Pista at Kape', destination: 'BGC Corporate Center, Taguig', payout: 220, status: 'Offer · 00:28' },
  ],
  offers: [
    { id: 'OFR-103', pickup: 'Mang Toma’s Kitchen', dropoff: 'Sampaguita St., Quezon City', payout: 185, distance: '3.2 km', expiresIn: 28 },
    { id: 'OFR-104', pickup: 'Pista at Kape', dropoff: 'BGC Corporate Center, Taguig', payout: 220, distance: '5.1 km', expiresIn: 44 },
  ],
  earnings: [320, 460, 280, 540, 380, 500, 0],
};
