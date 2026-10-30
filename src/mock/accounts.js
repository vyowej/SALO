export const demoAccounts = [
  {
    email: 'customer@salo.app',
    password: 'customer123',
    role: 'customer',
    capabilities: ['customer'],
    user: { id: 'cust-1', name: 'Cass Santos', email: 'customer@salo.app', avatar: 'CS' },
  },
  {
    email: 'owner@salo.app',
    password: 'rider123',
    role: 'restaurantOwner',
    capabilities: ['customer', 'restaurantOwner'],
    user: {
      id: 'owner-1',
      name: 'Ramon Dela Cruz',
      email: 'owner@salo.app',
      avatar: 'RD',
      restaurantId: 'mang-toma',
      memberships: [{
        restaurant_id: 'mang-toma',
        restaurant_name: 'Mang Toma Kitchen',
        role: 'owner',
        status: 'active',
        permissions: [
          'restaurant.view',
          'restaurant.page.edit',
          'restaurant.sensitive.edit',
          'restaurant.publish',
          'restaurant.photos.manage',
          'restaurant.hours.manage',
          'restaurant.menu.manage',
          'menu.availability.manage',
          'orders.view',
          'orders.status.update',
          'orders.cancel',
          'reservations.view',
          'reservations.manage',
          'tables.manage',
          'discounts.manage',
          'reports.sales_reservations.view',
          'reports.reservations.view',
          'team.view',
          'team.manage',
          'audit.view',
        ],
      }],
    },
  },
  {
    email: 'rider@salo.app',
    password: 'rider123',
    role: 'rider',
    capabilities: ['customer', 'rider'],
    user: { id: 'rider-1', name: 'Rey Cruz', email: 'rider@salo.app', avatar: 'RC' },
  },
  {
    email: 'admin@salo.app',
    password: 'admin123',
    role: 'admin',
    capabilities: ['admin'],
    user: { id: 'admin-1', name: 'Alyssa Reyes', email: 'admin@salo.app', avatar: 'AR', adminLevel: 'Super Admin' },
  },
];

export const legacyDemoEmailMap = {
  'customer@salo.test': 'customer@salo.app',
  'owner@salo.test': 'owner@salo.app',
  'rider@salo.test': 'rider@salo.app',
  'admin@salo.test': 'admin@salo.app',
};

export const legacyDemoCredentials = [
  { email: 'owner@salo.app', password: 'owner123', accountId: 'owner-1' },
];

export const mockEmailVerificationCode = '123456';
