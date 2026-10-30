import { ApiError } from '../apiClient';
import {
  applications,
  closures,
  dashboardData,
  history,
  orders,
  proofs,
  reservations,
  restaurants,
  riders,
  schedules,
  serviceAreas,
  settings,
  users,
} from '../../mock/admin/fixtures';
import { paginate } from '../../mock/admin/paginate';
import { seedPlaceholderPhotos } from '../../mock/admin/photoStore';

const wait = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));
const newId = () => globalThis.crypto?.randomUUID?.() || `00000000-0000-4000-8000-${String(Date.now()).padStart(12, '0')}`;
const copy = (value) => structuredClone(value);
const omit = (record, keys) => Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));
const failure = (status, message, fields = {}) => {
  throw new ApiError(message, { status, code: status === 422 ? 'VALIDATION_FAILED' : 'NOT_FOUND', fields });
};
const find = (collection, id) => {
  const record = collection.find((item) => item.id === id);
  if (!record) failure(404, 'The requested record was not found.');
  return record;
};
const addHistory = (subjectType, subjectId, action, changes = null, restaurant = null) => {
  history.unshift({
    id: newId(),
    actor: { id: users[0].id, name: users[0].name },
    restaurant,
    subject_type: subjectType,
    subject_id: subjectId,
    action,
    changes,
    created_at: new Date().toISOString(),
  });
};
const assertRoleCombination = (capabilities, memberships) => {
  if (capabilities.includes('driver') && memberships.some((membership) => membership.role === 'owner')) {
    failure(422, 'The submitted data is invalid.', { capabilities: ['A user cannot have an owner membership and the driver capability at the same time.'] });
  }
};
const uniqueEmail = (email, exceptId) => {
  if (users.some((user) => user.email.toLocaleLowerCase() === email.toLocaleLowerCase() && user.id !== exceptId)) {
    failure(422, 'The submitted data is invalid.', { email: ['This email address is already in use.'] });
  }
};
const page = (items, params = {}) => {
  const result = paginate(items, params);
  return {
    ...result,
    data: result.data.map((item) => {
      if (item.password_hash || item.password) {
        return omit(item, ['password_hash', 'password']);
      }
      return item;
    }),
  };
};
const photoRefs = () => {
  const refs = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([key, child]) => {
      if (['photo_ref', 'logo_ref', 'cover_ref'].includes(key) && typeof child === 'string') refs.push(child);
      else visit(child);
    });
  };
  [applications, restaurants, proofs].forEach(visit);
  if (typeof document !== 'undefined') seedPlaceholderPhotos(refs);
};
const serializeResource = (resource, record) => {
  if (resource !== 'orders') return record;
  return omit(record, ['subtotal', 'delivery_fee', 'discount_total', 'cancelled_by', 'cancel_reason', 'delivery_address_text', 'rider', 'items', 'status_history']);
};
const listRecords = (resource, data, params) => {
  const result = page(data, params);
  return { ...result, data: result.data.map((record) => serializeResource(resource, record)) };
};

photoRefs();

export const adminMock = {
  async getDashboard() {
    await wait();
    return copy({
      ...dashboardData,
      totals: {
        ...dashboardData.totals,
        users: users.length,
        restaurants: restaurants.length,
        riders: riders.length,
        orders: orders.length,
        revenue: orders.reduce((sum, order) => sum + order.total, 0),
      },
    });
  },
  async listUsers(params = {}) { await wait(); return listRecords('users', users, params); },
  async getUser(id) { await wait(); return copy(find(users, id)); },
  async createUser(body) {
    await wait();
    if (!body.name || !body.email || !body.password || !Array.isArray(body.capabilities)) {
      failure(422, 'The submitted data is invalid.', { name: !body.name ? ['This field is required.'] : undefined, email: !body.email ? ['This field is required.'] : undefined, password: !body.password ? ['This field is required.'] : undefined });
    }
    uniqueEmail(body.email);
    const capabilities = [...new Set(['customer', ...body.capabilities])];
    assertRoleCombination(capabilities, body.memberships || []);
    const safeBody = omit(body, ['password']);
    const record = {
      id: newId(), ...safeBody, capabilities, avatar_url: null, memberships: [],
      driver_state: null, status: 'active', email_verified_at: null, created_at: new Date().toISOString(),
    };
    users.unshift(record);
    addHistory('user', record.id, 'created');
    return copy(record);
  },
  async updateUser(id, body) {
    await wait();
    const current = find(users, id);
    if (body.email && body.email !== current.email) uniqueEmail(body.email, id);
    const capabilities = body.capabilities ? [...new Set(['customer', ...body.capabilities])] : current.capabilities;
    assertRoleCombination(capabilities, body.memberships || current.memberships || []);
    const safeBody = omit(body, ['password']);
    Object.assign(current, safeBody, { capabilities });
    addHistory('user', id, 'updated', { fields: Object.keys(safeBody) });
    return copy(current);
  },
  async deleteUser(id) { await wait(); find(users, id); users.splice(users.findIndex((item) => item.id === id), 1); addHistory('user', id, 'deleted'); return null; },
  async suspendUser(id, body = {}) { await wait(); return changeUserStatus(id, 'suspended', body.reason); },
  async reactivateUser(id) { await wait(); return changeUserStatus(id, 'active'); },
  async listRestaurants(params = {}) { await wait(); return listRecords('restaurants', restaurants, params); },
  async getRestaurant(id) { await wait(); return copy(find(restaurants, id)); },
  async createRestaurant(body) {
    await wait();
    if (!body.name) failure(422, 'The submitted data is invalid.', { name: ['This field is required.'] });
    const record = restaurantDefaults(body);
    restaurants.unshift(record);
    addHistory('restaurant', record.id, 'created');
    return copy(record);
  },
  async updateRestaurant(id, body) {
    await wait();
    const record = find(restaurants, id);
    Object.assign(record, body);
    addHistory('restaurant', id, 'updated', { fields: Object.keys(body) });
    return copy(record);
  },
  async deleteRestaurant(id) { await wait(); find(restaurants, id); restaurants.splice(restaurants.findIndex((item) => item.id === id), 1); addHistory('restaurant', id, 'deleted'); return null; },
  async setRestaurantStatus(id, body) {
    await wait();
    if (!['pending', 'active', 'paused', 'suspended'].includes(body.status)) failure(422, 'The submitted data is invalid.', { status: ['Choose a valid restaurant status.'] });
    const record = find(restaurants, id);
    const previous = record.status;
    record.status = body.status;
    addHistory('restaurant', id, 'status_changed', { status: { from: previous, to: body.status }, note: body.note });
    return copy(record);
  },
  async listApplications(params = {}) { await wait(); return listRecords('applications', applications, params); },
  async getApplication(type, id) { await wait(); const record = find(applications, id); if (record.type !== type) failure(404, 'The requested record was not found.'); return copy(record); },
  async approveApplication(type, id, body = {}) { await wait(); return reviewApplication(type, id, true, body.note); },
  async rejectApplication(type, id, body) {
    await wait();
    if (!body?.note?.trim()) failure(422, 'The submitted data is invalid.', { note: ['Add a note to document this decision.'] });
    return reviewApplication(type, id, false, body.note);
  },
  async requestRevisionApplication(type, id, body) {
    await wait();
    if (!body?.note?.trim()) failure(422, 'The submitted data is invalid.', { note: ['Add the requested changes.'] });
    const application = find(applications, id);
    if (application.type !== type || application.status !== 'under_review') {
      failure(422, 'The submitted data is invalid.', { status: ['Only an application in review can be returned.'] });
    }
    application.status = 'needs_revision';
    application.review_note = body.note;
    application.reviewed_at = new Date().toISOString();
    addHistory('application', id, 'needs_revision', { note: body.note });
    return copy(application);
  },
  async startReviewApplication(type, id) {
    await wait();
    const application = find(applications, id);
    if (application.type !== type || !['pending', 'submitted'].includes(application.status)) {
      failure(422, 'The submitted data is invalid.', { status: ['Only submitted applications can enter review.'] });
    }
    application.status = 'under_review';
    addHistory('application', id, 'under_review');
    return copy(application);
  },
  async listRiders(params = {}) { await wait(); return listRecords('riders', riders, params); },
  async getRider(id) { await wait(); return copy(find(riders, id)); },
  async setRiderStatus(id, body) {
    await wait();
    if (!['active', 'suspended'].includes(body.status)) failure(422, 'The submitted data is invalid.', { status: ['Choose a valid rider status.'] });
    const rider = find(riders, id);
    const previous = rider.status;
    rider.status = body.status;
    addHistory('rider', id, 'status_changed', { status: { from: previous, to: body.status } });
    return copy(rider);
  },
  async listRiderProofs(id, params = {}) { await wait(); find(riders, id); return page(proofs.filter((proof) => proof.rider_id === id), params); },
  async listOrders(params = {}) { await wait(); return listRecords('orders', orders, params); },
  async getOrder(id) { await wait(); return copy(find(orders, id)); },
  async cancelOrder(id, body) {
    await wait();
    if (!body?.reason?.trim()) failure(422, 'The submitted data is invalid.', { reason: ['A reason is required.'] });
    const order = find(orders, id);
    if (['completed', 'cancelled', 'rejected'].includes(order.status)) failure(422, 'The submitted data is invalid.', { status: ['This order cannot be cancelled.'] });
    order.status = 'cancelled';
    order.cancelled_by = 'admin';
    order.cancel_reason = body.reason;
    order.status_history.push({ status: 'cancelled', changed_by: users[0].id, note: body.reason, created_at: new Date().toISOString() });
    addHistory('order', id, 'cancelled', { reason: body.reason });
    return copy(order);
  },
  async listReservations(params = {}) { await wait(); return listRecords('reservations', reservations, params); },
  async getReservation(id) { await wait(); return copy(find(reservations, id)); },
  async setReservationStatus(id, body) {
    await wait();
    const transitions = { pending: ['confirmed', 'cancelled'], confirmed: ['seated', 'cancelled', 'no_show'], seated: ['completed'] };
    const reservation = find(reservations, id);
    if (body.status === 'cancelled' && !body.reason?.trim()) failure(422, 'The submitted data is invalid.', { reason: ['A cancellation reason is required.'] });
    if (!transitions[reservation.status]?.includes(body.status)) failure(422, 'The submitted data is invalid.', { status: ['This reservation status transition is not allowed.'] });
    const previous = reservation.status;
    reservation.status = body.status;
    if (body.status === 'cancelled') {
      reservation.cancelled_at = new Date().toISOString();
      reservation.cancel_reason = body.reason;
    }
    addHistory('reservation', id, 'status_changed', { status: { from: previous, to: body.status }, reason: body.reason });
    return copy(reservation);
  },
  async getReport(report, params = {}) {
    await wait();
    const reportTitle = { sales: 'Sales by day', 'orders-by-status': 'Orders by status', 'restaurant-ranking': 'Restaurant ranking', 'rider-performance': 'Rider performance' };
    if (!reportTitle[report]) failure(404, 'The requested report was not found.');
    if (report === 'orders-by-status') {
      return { title: reportTitle[report], from: params.from || '', to: params.to || '', columns: [{ key: 'label', label: 'Status', type: 'text' }, { key: 'orders', label: 'Orders', type: 'number' }], rows: copy(dashboardData.orders_by_status.map((item) => ({ label: item.status, orders: item.count }))), totals: { orders: orders.length } };
    }
    if (report === 'restaurant-ranking') {
      return { title: reportTitle[report], from: params.from || '', to: params.to || '', columns: [{ key: 'label', label: 'Restaurant', type: 'text' }, { key: 'orders', label: 'Orders', type: 'number' }, { key: 'revenue', label: 'Revenue', type: 'money' }, { key: 'rating_avg', label: 'Rating', type: 'number' }], rows: restaurants.slice(0, 5).map((restaurant, index) => ({ label: restaurant.name, orders: 12 - index, revenue: (12 - index) * 450, rating_avg: restaurant.rating_avg })), totals: null };
    }
    if (report === 'rider-performance') {
      return { title: reportTitle[report], from: params.from || '', to: params.to || '', columns: [{ key: 'label', label: 'Rider', type: 'text' }, { key: 'deliveries', label: 'Deliveries', type: 'number' }, { key: 'earnings', label: 'Earnings', type: 'money' }], rows: riders.map((rider) => ({ label: rider.name, deliveries: rider.earnings.deliveries_count, earnings: rider.earnings.total })), totals: null };
    }
    const rows = dashboardData.orders_per_day.filter((point) => (!params.from || point.date >= params.from) && (!params.to || point.date <= params.to)).map((point) => ({ label: point.date, orders: point.orders, revenue: point.revenue }));
    return { title: reportTitle[report], from: params.from || rows[0]?.label || '', to: params.to || rows.at(-1)?.label || '', columns: [{ key: 'label', label: 'Date', type: 'date' }, { key: 'orders', label: 'Orders', type: 'number' }, { key: 'revenue', label: 'Revenue', type: 'money' }], rows, totals: { orders: rows.reduce((total, row) => total + row.orders, 0), revenue: rows.reduce((total, row) => total + row.revenue, 0) } };
  },
  async listHistory(params = {}) { await wait(); return page(history, params); },
  async getCalendar(params = {}) {
    await wait();
    const events = [
      ...schedules.map((shift) => ({ id: `shift-${shift.id}`, type: 'shift', title: `${shift.rider.name} - ${shift.service_area.name}`, start: `${shift.shift_date}T${shift.start_time}:00Z`, end: `${shift.shift_date}T${shift.end_time}:00Z`, all_day: false, meta: { rider_id: shift.rider.id, service_area_id: shift.service_area.id } })),
      ...closures.map((closure) => ({ id: `closure-${closure.id}`, type: 'closure', title: `${closure.restaurant.name} closed`, start: closure.date, end: closure.date, all_day: true, meta: { restaurant_id: closure.restaurant.id } })),
      ...reservations.map((reservation) => ({ id: `reservation-${reservation.id}`, type: 'reservation', title: `${reservation.restaurant.name} - party of ${reservation.party_size}`, start: reservation.reserved_for, end: new Date(Date.parse(reservation.reserved_for) + reservation.duration_minutes * 60000).toISOString(), all_day: false, meta: { reservation_id: reservation.id } })),
    ];
    return events.filter((event) => (!params.from || event.start.slice(0, 10) >= params.from) && (!params.to || event.start.slice(0, 10) <= params.to));
  },
  async getSettings() { await wait(); return copy(settings); },
  async updateSettings(body) { await wait(); Object.assign(settings, body); addHistory('settings', 'platform', 'updated', { fields: Object.keys(body) }); return copy(settings); },
  async listServiceAreas(params = {}) { await wait(); return page(serviceAreas, params); },
  async createServiceArea(body) {
    await wait();
    if (!body.name || !Number.isFinite(Number(body.latitude)) || !Number.isFinite(Number(body.longitude)) || !Number.isInteger(Number(body.max_riders)) || Number(body.max_riders) < 1) {
      failure(422, 'The submitted data is invalid.', { name: !body.name ? ['This field is required.'] : undefined, latitude: !Number.isFinite(Number(body.latitude)) ? ['Enter a valid latitude.'] : undefined, max_riders: Number(body.max_riders) < 1 ? ['Enter a positive capacity.'] : undefined });
    }
    const area = { ...body, id: newId(), is_active: body.is_active ?? true };
    serviceAreas.unshift(area);
    addHistory('service_area', area.id, 'created');
    return copy(area);
  },
  async updateServiceArea(id, body) { await wait(); const area = find(serviceAreas, id); Object.assign(area, body); addHistory('service_area', id, 'updated', { fields: Object.keys(body) }); return copy(area); },
  async deleteServiceArea(id) { await wait(); find(serviceAreas, id); serviceAreas.splice(serviceAreas.findIndex((item) => item.id === id), 1); addHistory('service_area', id, 'deleted'); return null; },
  async listSchedules(params = {}) { await wait(); return page(schedules, params); },
  async generateSchedule(body) {
    await wait();
    if (!body.date) failure(422, 'The submitted data is invalid.', { date: ['Choose a date.'] });
    const slots = body.slots || settings.rider_slots;
    const assigned = [];
    const unassigned = [];
    const areaUsage = [];
    const existing = schedules.filter((item) => item.shift_date === body.date);
    slots.forEach((slot) => {
      const counts = Object.fromEntries(serviceAreas.map((area) => [area.id, existing.filter((shift) => shift.service_area.id === area.id && shift.start_time === slot.start_time).length]));
      const booked = new Set(existing.filter((shift) => shift.start_time === slot.start_time).map((shift) => shift.rider.id));
      riders.filter((rider) => rider.status === 'active' && !booked.has(rider.id)).forEach((rider) => {
        const options = serviceAreas.filter((area) => area.is_active && counts[area.id] < area.max_riders);
        options.sort((a, b) => distance(rider.last_position, a) - distance(rider.last_position, b) || a.id.localeCompare(b.id));
        if (!options.length) {
          unassigned.push({ rider_id: rider.id, reason: 'All service areas are full for this slot' });
          return;
        }
        const area = options[0];
        counts[area.id] += 1;
        assigned.push({ rider_id: rider.id, service_area_id: area.id, start_time: slot.start_time, end_time: slot.end_time });
        schedules.push({ id: newId(), rider: { id: rider.id, name: rider.name }, service_area: { id: area.id, name: area.name }, shift_date: body.date, start_time: slot.start_time, end_time: slot.end_time, status: 'scheduled' });
      });
      serviceAreas.forEach((area) => areaUsage.push({ service_area_id: area.id, start_time: slot.start_time, assigned: counts[area.id], max: area.max_riders }));
    });
    addHistory('schedule', body.date, 'generated', { assigned: assigned.length, unassigned: unassigned.length });
    return { date: body.date, assigned, unassigned, area_usage: areaUsage };
  },
};

function changeUserStatus(id, status, reason = null) {
  const user = find(users, id);
  const previous = user.status;
  user.status = status;
  addHistory('user', id, 'status_changed', { status: { from: previous, to: status }, reason });
  return copy(user);
}

function restaurantDefaults(body) {
  const name = body.name;
  return {
    id: newId(),
    name,
    slug: body.slug || `${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
    description: body.description || null,
    owner: body.owner || null,
    phone: body.phone || null,
    email: body.email || null,
    logo_ref: body.logo_ref || null,
    cover_ref: body.cover_ref || null,
    address: body.address || { street_line: null, city_code: null, city_name: null, latitude: null, longitude: null },
    categories: body.categories || [],
    status: body.status || 'pending',
    accepts_delivery: Boolean(body.accepts_delivery),
    accepts_pickup: Boolean(body.accepts_pickup),
    accepts_reservations: Boolean(body.accepts_reservations),
    rating_avg: 0,
    rating_count: 0,
    created_at: new Date().toISOString(),
  };
}

function reviewApplication(type, id, approve, note) {
  const application = find(applications, id);
  if (application.type !== type) failure(404, 'The requested record was not found.');
  if (application.status !== 'under_review') failure(422, 'The submitted data is invalid.', { status: ['Move the application into review before recording a decision.'] });
  const applicant = find(users, application.applicant.id);
  if (approve && type === 'rider') {
    const capabilities = [...new Set([...applicant.capabilities, 'driver'])];
    assertRoleCombination(capabilities, applicant.memberships || []);
    applicant.capabilities = capabilities;
    applicant.driver_state = { approval_status: 'approved', availability_status: 'unavailable' };
    const rider = {
      id: applicant.id, name: applicant.name, email: applicant.email, phone: applicant.phone, status: 'pending_activation',
      vehicle_type: application.details.vehicle_type, plate_no: application.details.plate_no, is_online: false,
      last_position: null, earnings: { total: 0, this_week: 0, deliveries_count: 0 },
      activated_at: null, resigned_at: null, created_at: new Date().toISOString(),
    };
    const index = riders.findIndex((item) => item.id === rider.id);
    if (index >= 0) riders[index] = rider;
    else riders.push(rider);
  }
  if (approve && type === 'partner') {
    assertRoleCombination(applicant.capabilities, [...(applicant.memberships || []), { role: 'owner' }]);
    const restaurant = restaurantDefaults({
      name: application.details.business_name,
      description: application.details.cuisine_summary,
      owner: { id: applicant.id, name: applicant.name },
      email: applicant.email,
      phone: application.details.contact_phone,
      address: {
        street_line: application.details.business_address,
        city_code: application.details.city_code,
        city_name: '',
        latitude: application.details.latitude,
        longitude: application.details.longitude,
      },
      status: 'approved',
      is_published: false,
    });
    restaurants.unshift(restaurant);
    applicant.memberships = [...(applicant.memberships || []), {
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      role: 'owner',
      status: 'active',
      permissions: ['restaurant.view', 'restaurant.page.edit', 'restaurant.publish'],
    }];
  }
  application.status = approve ? 'approved' : 'rejected';
  application.review_note = note || null;
  application.reviewed_at = new Date().toISOString();
  application.reviewed_by = users[0].id;
  addHistory('application', id, approve ? 'approved' : 'rejected', { note, type });
  return copy(application);
}

function distance(point, area) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latA = toRadians(point?.latitude ?? area.latitude);
  const latB = toRadians(area.latitude);
  const deltaLat = latB - latA;
  const deltaLon = toRadians(area.longitude - (point?.longitude ?? area.longitude));
  const term = Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(term));
}
