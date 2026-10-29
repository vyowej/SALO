const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const today = new Date();
const day = (offset = 0) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};
const stamp = (date, time = '08:00:00') => `${date}T${time}Z`;

export const users = Array.from({ length: 25 }, (_, index) => {
  const number = index + 1;
  const rider = number > 2 && number < 9;
  return {
    id: id(100 + number),
    name: number === 1 ? 'SALO Admin' : `Sample User ${number}`,
    email: number === 1 ? 'admin@salo.app' : `sample.user${number}@example.test`,
    phone: `0900000${String(number).padStart(4, '0')}`,
    avatar_url: null,
    status: 'active',
    capabilities: number === 1 ? ['customer', 'admin'] : rider ? ['customer', 'driver'] : ['customer'],
    memberships: number === 2 ? [{
      restaurant_id: id(202),
      role: 'owner',
      status: 'active',
      permissions: ['restaurant.view', 'restaurant.edit', 'menu.manage', 'orders.view', 'orders.manage', 'reservations.view', 'reservations.manage', 'tables.manage', 'discounts.manage', 'team.manage', 'analytics.view'],
    }] : [],
    driver_state: rider ? { approval_status: 'approved', availability_status: 'available' } : null,
    email_verified_at: stamp(day(-28), '09:00:00'),
    created_at: stamp(day(-29)),
  };
});

export const restaurants = Array.from({ length: 8 }, (_, index) => ({
  id: id(201 + index),
  name: ['Mang Toma’s Kitchen', 'Sample Grill', 'Dagat Kusina', 'Harana Grill House', 'Pista at Kape', 'Kubo Kusina', 'Sarap Seoul', 'Lutong Bahay'][index],
  slug: `sample-restaurant-${index + 1}`,
  description: 'A fictional SALO sample restaurant.',
  owner: { id: id(102), name: 'Sample User 2' },
  phone: '09000000001',
  email: `restaurant${index + 1}@example.test`,
  logo_ref: `photo:rest-${index + 1}-logo`,
  cover_ref: `photo:rest-${index + 1}-cover`,
  address: {
    street_line: 'Placeholder Street',
    city_code: '0972200000',
    city_name: 'Zamboanga City',
    latitude: 6.9214,
    longitude: 122.079,
  },
  categories: ['Filipino', 'Grill'],
  status: index === 1 ? 'pending' : 'active',
  accepts_delivery: true,
  accepts_pickup: true,
  accepts_reservations: true,
  rating_avg: 4.3,
  rating_count: 18,
  created_at: stamp(day(-28)),
}));

export const applications = Array.from({ length: 6 }, (_, index) => {
  const number = index + 1;
  const type = number <= 3 ? 'partner' : 'rider';
  const applicant = users[number + 7];
  return {
    id: id(301 + index),
    type,
    status: number === 3 ? 'approved' : 'pending',
    applicant: { id: applicant.id, name: applicant.name, email: applicant.email },
    submitted_at: stamp(day(-5 + index), '10:00:00'),
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    details: type === 'rider'
      ? {
          birth_date: '2002-05-14',
          vehicle_type: 'motorcycle',
          plate_no: 'ABC 1234',
          license_no: 'N00-00-000000',
          tin_no: '000-000-000',
          service_area_city_code: '0972200000',
          payout: { provider: 'GCash', name: applicant.name, account_masked: '****0000' },
        }
      : {
          business_name: `Sample Business ${number}`,
          business_type: 'restaurant',
          business_address: 'Placeholder Street',
          city_code: '0972200000',
          latitude: 6.9214,
          longitude: 122.079,
          contact_phone: '09000000001',
          cuisine_summary: 'Fictional Filipino menu',
          payout: { provider: 'GCash', name: applicant.name, account_masked: '****0000' },
        },
    documents: [{
      id: id(900 + index),
      doc_type: 'valid_id',
      photo_ref: `photo:application-${number}-valid-id`,
      status: 'submitted',
      note: null,
    }],
  };
});

export const riders = Array.from({ length: 6 }, (_, index) => {
  const account = users[index + 2];
  return {
    id: account.id,
    name: `Sample Rider ${index + 1}`,
    email: account.email,
    phone: account.phone,
    status: index === 5 ? 'pending_activation' : 'active',
    vehicle_type: 'motorcycle',
    plate_no: 'ABC 1234',
    is_online: index < 3,
    last_position: { latitude: 6.93 + index / 1000, longitude: 122.08, seen_at: stamp(day(0), '08:10:00') },
    earnings: { total: 3200 + index * 100, this_week: 640, deliveries_count: 41 + index },
    activated_at: stamp(day(-8), '09:00:00'),
    resigned_at: null,
    created_at: stamp(day(-9)),
  };
});

const orderStatuses = ['completed', 'placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'];
export const orders = Array.from({ length: 40 }, (_, index) => {
  const number = index + 1;
  const status = orderStatuses[index % orderStatuses.length];
  return {
    id: id(501 + index),
    order_number: `SALO-${String(number).padStart(4, '0')}`,
    status,
    fulfilment: number % 2 ? 'delivery' : 'pickup',
    customer: { id: id(101 + (index % 25)), name: 'Sample User' },
    restaurant: { id: id(201 + (index % 8)), name: restaurants[index % 8].name },
    total: 389,
    payment_method: 'cod',
    payment_status: 'paid',
    placed_at: stamp(day(-Math.min(index, 29)), '07:50:00'),
    subtotal: 349,
    delivery_fee: 40,
    discount_total: 0,
    cancelled_by: null,
    cancel_reason: null,
    delivery_address_text: 'Placeholder Street, Zamboanga City',
    rider: { id: riders[0].id, name: riders[0].name },
    items: [{
      item_name: 'Sample Meal',
      quantity: 2,
      unit_price: 174.5,
      line_total: 349,
      note: null,
      options: [{ group_name: 'Size', choice_name: 'Regular', price_delta: 0 }],
    }],
    status_history: [{ status, changed_by: null, note: null, created_at: stamp(day(-Math.min(index, 29)), '07:50:00') }],
  };
});

const reservationStatuses = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'];
export const reservations = Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;
  return {
    id: id(601 + index),
    code: `RSV-${String(number).padStart(4, '0')}`,
    status: reservationStatuses[index % reservationStatuses.length],
    customer: { id: id(101 + (index % 25)), name: 'Sample User' },
    restaurant: { id: restaurants[index % restaurants.length].id, name: restaurants[index % restaurants.length].name },
    table: { id: id(701 + index), label: `Table ${number}` },
    party_size: 4,
    reserved_for: stamp(day(index), '18:30:00'),
    duration_minutes: 90,
    contact_name: 'Sample User',
    contact_phone: '09000000000',
    special_request: null,
    cancelled_at: null,
    cancel_reason: null,
  };
});

export const serviceAreas = ['Pasonanca', 'City Proper', 'Tetuan'].map((name, index) => ({
  id: id(801 + index),
  name,
  city_code: '0972200000',
  latitude: 6.95 + index / 100,
  longitude: 122.06,
  max_riders: 4,
  is_active: true,
}));

export const schedules = Array.from({ length: 15 }, (_, index) => ({
  id: id(851 + index),
  rider: { id: riders[index % riders.length].id, name: riders[index % riders.length].name },
  service_area: { id: serviceAreas[index % serviceAreas.length].id, name: serviceAreas[index % serviceAreas.length].name },
  shift_date: day(index % 7),
  start_time: index % 2 ? '14:00' : '08:00',
  end_time: index % 2 ? '22:00' : '14:00',
  status: 'scheduled',
}));

export const proofs = riders.map((rider, index) => ({
  id: id(951 + index),
  rider_id: rider.id,
  delivery_id: orders[index].id,
  order_number: orders[index].order_number,
  stage: index % 2 ? 'dropoff' : 'pickup',
  photo_ref: `photo:proof-${index + 1}`,
  latitude: 6.93,
  longitude: 122.08,
  taken_at: stamp(day(-index), '08:20:00'),
}));

export const history = Array.from({ length: 20 }, (_, index) => ({
  id: id(881 + index),
  actor: { id: users[0].id, name: users[0].name },
  restaurant: null,
  subject_type: 'restaurant',
  subject_id: restaurants[0].id,
  action: 'status_changed',
  changes: null,
  created_at: stamp(day(-index), '08:00:00'),
}));

export const closures = [{
  id: id(871),
  restaurant: { id: restaurants[0].id, name: restaurants[0].name },
  date: day(5),
}];

export const settings = {
  app_name: 'SALO',
  default_delivery_fee: 40,
  max_riders_per_area: 50,
  rider_slots: [
    { label: 'Morning', start_time: '08:00', end_time: '14:00' },
    { label: 'Evening', start_time: '14:00', end_time: '22:00' },
  ],
};

export const dashboardData = {
  totals: {
    users: users.length,
    restaurants: restaurants.length,
    riders: riders.length,
    orders: orders.length,
    revenue: orders.reduce((total, order) => total + order.total, 0),
  },
  orders_per_day: Array.from({ length: 30 }, (_, index) => ({
    date: day(index - 29),
    orders: index % 7 + 1,
    revenue: (index % 7 + 1) * 389,
  })),
  orders_by_status: orderStatuses.map((status) => ({
    status,
    count: orders.filter((order) => order.status === status).length,
  })),
  top_restaurants: restaurants.slice(0, 5).map((restaurant, index) => ({
    id: restaurant.id,
    name: restaurant.name,
    orders: 12 - index,
    revenue: (12 - index) * 450,
  })),
  new_users_per_week: [0, 1, 2, 3].map((week) => ({
    week_start: day(-week * 7),
    count: 5 + week,
  })),
};
