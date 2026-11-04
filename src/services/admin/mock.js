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
const adminStatuses = new Map(users.filter((user) => user.capabilities.includes('admin')).map((user) => [user.id, 'active']));
const adminAccountView = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  status: adminStatuses.get(user.id) || 'active',
  account_status: user.status,
});
const assertNotAdminUser = (id) => {
  const user = find(users, id);
  if (user.capabilities.includes('admin')) {
    failure(422, 'Admin accounts must be managed through Admin account management.', { user: ['Use Admin account management for this account.'] });
  }
  return user;
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
const mockRiderShifts = [
  { id: 'mock-shift-morning', name: 'Morning', start_time: '06:00', end_time: '12:00' },
  { id: 'mock-shift-afternoon', name: 'Afternoon', start_time: '12:00', end_time: '18:00' },
  { id: 'mock-shift-evening', name: 'Evening', start_time: '18:00', end_time: '23:59' },
];
const mockRiderZones = serviceAreas.map((area) => ({
  id: area.id,
  psgc_code: area.city_code,
  name: area.name,
  center_lat: area.latitude,
  center_lng: area.longitude,
  radius_km: 5,
  is_active: area.is_active,
  capacities: mockRiderShifts.map((shift) => ({
    shift_id: shift.id,
    shift_name: shift.name,
    start_time: shift.start_time,
    end_time: shift.end_time,
    max_riders: area.max_riders,
    assigned_riders: schedules.filter((item) => item.service_area.id === area.id
      && (item.start_time === shift.start_time || item.start_time === '08:00' && shift.id === 'mock-shift-morning')).length,
    available_slots: 0,
  })),
}));
mockRiderZones.forEach((zone) => zone.capacities.forEach((capacity) => {
  capacity.available_slots = Math.max(0, capacity.max_riders - capacity.assigned_riders);
}));
const mockRiderAssignments = schedules.map((schedule) => {
  const shift = mockRiderShifts.find((item) => (
    schedule.start_time === item.start_time
    || schedule.start_time === '08:00' && item.id === 'mock-shift-morning'
    || schedule.start_time === '14:00' && item.id === 'mock-shift-afternoon'
  )) || mockRiderShifts[0];
  return {
    id: schedule.id,
    rider_id: schedule.rider.id,
    rider_name: schedule.rider.name,
    rider_status: riders.find((rider) => rider.id === schedule.rider.id)?.status || 'active',
    application_status: 'approved',
    zone_id: schedule.service_area.id,
    zone_name: schedule.service_area.name,
    shift_id: shift.id,
    shift_name: shift.name,
    shift_start_time: shift.start_time,
    shift_end_time: shift.end_time,
    status: 'assigned',
    assigned_by: 'system',
    reason: null,
  };
});
const mockRiderSchedulingOverview = () => ({
  zones: copy(mockRiderZones),
  shifts: copy(mockRiderShifts),
  max_zone_distance_km: 10,
});
const recheckMockRiderWaitlist = () => {
  mockRiderAssignments.filter((assignment) => assignment.status === 'waitlisted').forEach((assignment) => {
    const zone = mockRiderZones.find((candidate) => (
      candidate.is_active
      && candidate.capacities.some((capacity) => (
        capacity.shift_id === assignment.shift_id && capacity.available_slots > 0
      ))
    ));
    if (!zone) return;
    const capacity = zone.capacities.find((item) => item.shift_id === assignment.shift_id);
    capacity.available_slots -= 1;
    capacity.assigned_riders += 1;
    assignment.zone_id = zone.id;
    assignment.zone_name = zone.name;
    assignment.status = 'assigned';
    assignment.assigned_by = 'system';
    assignment.reason = null;
  });
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
  async listUsers(params = {}) { await wait(); return listRecords('users', users.filter((user) => !user.capabilities.includes('admin')), params); },
  async getUser(id) { await wait(); return copy(assertNotAdminUser(id)); },
  async createUser(body) {
    await wait();
    if (!body.name || !body.email || !body.password || !Array.isArray(body.capabilities)) {
      failure(422, 'The submitted data is invalid.', { name: !body.name ? ['This field is required.'] : undefined, email: !body.email ? ['This field is required.'] : undefined, password: !body.password ? ['This field is required.'] : undefined });
    }
    if (body.capabilities.includes('admin')) {
      failure(422, 'Create Admin accounts through Admin account management.', { capabilities: ['Admin capability cannot be assigned through generic user management.'] });
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
    const current = assertNotAdminUser(id);
    if (body.capabilities?.includes('admin')) {
      failure(422, 'Manage Admin capability through Admin account management.', { capabilities: ['Admin capability cannot be assigned through generic user management.'] });
    }
    if (body.email && body.email !== current.email) uniqueEmail(body.email, id);
    const capabilities = body.capabilities ? [...new Set(['customer', ...body.capabilities])] : current.capabilities;
    assertRoleCombination(capabilities, body.memberships || current.memberships || []);
    const safeBody = omit(body, ['password']);
    Object.assign(current, safeBody, { capabilities });
    addHistory('user', id, 'updated', { fields: Object.keys(safeBody) });
    return copy(current);
  },
  async deleteUser(id) { await wait(); assertNotAdminUser(id); users.splice(users.findIndex((item) => item.id === id), 1); addHistory('user', id, 'deleted'); return null; },
  async suspendUser(id, body = {}) { await wait(); assertNotAdminUser(id); return changeUserStatus(id, 'suspended', body.reason); },
  async reactivateUser(id) { await wait(); assertNotAdminUser(id); return changeUserStatus(id, 'active'); },
  async listAdminAccounts(params = {}) {
    await wait();
    const records = users
      .filter((user) => user.capabilities.includes('admin'))
      .map(adminAccountView);
    return page(records, params);
  },
  async getAdminAccount(id) {
    await wait();
    const user = find(users, id);
    if (!user.capabilities.includes('admin')) failure(404, 'The requested Admin account was not found.');
    return copy(adminAccountView(user));
  },
  async createAdminAccount(body) {
    await wait();
    if (!body.name?.trim() || !body.email?.trim() || !body.password || body.password !== body.password_confirmation) {
      failure(422, 'The submitted data is invalid.', { password: ['Provide an email, name, and matching password confirmation.'] });
    }
    if (body.password.length < 8 || !/[A-Za-z]/.test(body.password) || !/\d/.test(body.password)) {
      failure(422, 'The submitted data is invalid.', { password: ['Use at least eight characters with a letter and a number.'] });
    }
    uniqueEmail(body.email);
    const user = {
      id: newId(),
      name: body.name.trim(),
      email: body.email.trim(),
      phone: body.phone || null,
      avatar_url: null,
      status: 'active',
      capabilities: ['customer', 'admin'],
      memberships: [],
      driver_state: null,
      email_verified_at: null,
      created_at: new Date().toISOString(),
    };
    users.unshift(user);
    adminStatuses.set(user.id, 'active');
    addHistory('platform_admin', user.id, 'created', { email: user.email });
    return copy(adminAccountView(user));
  },
  async updateAdminAccount(id, body) {
    await wait();
    const user = find(users, id);
    if (!user.capabilities.includes('admin')) failure(404, 'The requested Admin account was not found.');
    if (body.email && body.email !== user.email) uniqueEmail(body.email, id);
    Object.assign(user, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
    });
    addHistory('platform_admin', id, 'updated', { fields: Object.keys(body) });
    return copy(adminAccountView(user));
  },
  async setAdminAccountStatus(id, body) {
    await wait();
    if (!['active', 'suspended'].includes(body.status)) failure(422, 'Choose a valid Admin status.', { status: ['Choose active or suspended.'] });
    const user = find(users, id);
    if (!user.capabilities.includes('admin')) failure(404, 'The requested Admin account was not found.');
    if (body.status === 'suspended') {
      const activeAdmins = users.filter((item) => (
        item.capabilities.includes('admin')
        && item.status === 'active'
        && adminStatuses.get(item.id) === 'active'
      ));
      if (adminStatuses.get(id) === 'active' && activeAdmins.length <= 1) {
        failure(422, 'The last active Admin account cannot be deactivated.', { status: ['At least one active Admin account must remain.'] });
      }
    }
    adminStatuses.set(id, body.status);
    addHistory('platform_admin', id, 'status_changed', { status: body.status });
    return copy(adminAccountView(user));
  },
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
  async getRiderScheduling() { await wait(); return mockRiderSchedulingOverview(); },
  async listRiderAssignments(params = {}) {
    await wait();
    const filtered = mockRiderAssignments.filter((assignment) => (
      (!params.status || assignment.status === params.status)
      && (!params.shift_id || assignment.shift_id === params.shift_id)
    ));
    return page(filtered, params);
  },
  async createRiderZone(body) {
    await wait();
    if (!body.name?.trim() || !Number.isFinite(Number(body.center_lat)) || !Number.isFinite(Number(body.center_lng))
      || !Number.isFinite(Number(body.radius_km)) || Number(body.radius_km) <= 0
      || !Array.isArray(body.capacities) || body.capacities.length !== mockRiderShifts.length) {
      failure(422, 'The submitted data is invalid.', { name: ['Complete the zone details and capacity for each shift.'] });
    }
    const zone = {
      id: newId(),
      psgc_code: body.psgc_code || null,
      name: body.name.trim(),
      center_lat: Number(body.center_lat),
      center_lng: Number(body.center_lng),
      radius_km: Number(body.radius_km),
      is_active: body.is_active ?? true,
      capacities: body.capacities.map((capacity) => {
        const shift = find(mockRiderShifts, capacity.shift_id);
        const maxRiders = Number(capacity.max_riders);
        if (!Number.isInteger(maxRiders) || maxRiders < 1) failure(422, 'The submitted data is invalid.', { capacities: ['Enter a positive capacity for each shift.'] });
        return { shift_id: shift.id, shift_name: shift.name, start_time: shift.start_time, end_time: shift.end_time, max_riders: maxRiders, assigned_riders: 0, available_slots: maxRiders };
      }),
    };
    mockRiderZones.push(zone);
    addHistory('rider_zone', zone.id, 'created');
    return copy(zone);
  },
  async updateRiderZone(id, body) {
    await wait();
    const zone = find(mockRiderZones, id);
    const wasActive = zone.is_active;
    Object.assign(zone, body);
    if (wasActive && zone.is_active === false) {
      mockRiderAssignments.filter((assignment) => assignment.zone_id === id && assignment.status === 'assigned').forEach((assignment) => {
        const capacity = zone.capacities.find((item) => item.shift_id === assignment.shift_id);
        if (capacity) {
          capacity.assigned_riders = Math.max(0, capacity.assigned_riders - 1);
          capacity.available_slots = Math.max(0, capacity.max_riders - capacity.assigned_riders);
        }
        assignment.zone_id = null;
        assignment.zone_name = null;
        assignment.status = 'waitlisted';
        assignment.reason = 'Zone deactivated';
      });
      recheckMockRiderWaitlist();
    }
    addHistory('rider_zone', id, 'updated', { fields: Object.keys(body) });
    return copy(zone);
  },
  async setRiderZoneCapacity(zoneId, shiftId, body) {
    await wait();
    const zone = find(mockRiderZones, zoneId);
    const capacity = zone.capacities.find((item) => item.shift_id === shiftId);
    if (!capacity) failure(404, 'The requested record was not found.');
    const maxRiders = Number(body.max_riders);
    if (!Number.isInteger(maxRiders) || maxRiders < 1) failure(422, 'The submitted data is invalid.', { max_riders: ['Enter a positive capacity.'] });
    const increased = maxRiders > capacity.max_riders;
    capacity.max_riders = maxRiders;
    capacity.available_slots = Math.max(0, maxRiders - capacity.assigned_riders);
    addHistory('zone_shift_capacity', `${zoneId}:${shiftId}`, 'updated', { max_riders: maxRiders });
    if (increased) recheckMockRiderWaitlist();
    return mockRiderSchedulingOverview();
  },
  async overrideRiderAssignment(riderId, assignmentId, body) {
    await wait();
    const assignment = find(mockRiderAssignments, assignmentId);
    const zone = find(mockRiderZones, body.zone_id);
    const capacity = zone.capacities.find((item) => item.shift_id === body.shift_id);
    if (assignment.rider_id !== riderId) failure(404, 'The requested record was not found.');
    if (!zone.is_active || !capacity || capacity.available_slots < 1 || !body.reason?.trim()) {
      failure(422, 'The submitted data is invalid.', { zone_id: ['Choose an active zone and shift with capacity and provide a reason.'] });
    }
    const previousZone = mockRiderZones.find((item) => item.id === assignment.zone_id);
    const previousCapacity = previousZone?.capacities.find((item) => item.shift_id === assignment.shift_id);
    if (previousCapacity && assignment.status === 'assigned') {
      previousCapacity.assigned_riders = Math.max(0, previousCapacity.assigned_riders - 1);
      previousCapacity.available_slots = Math.max(0, previousCapacity.max_riders - previousCapacity.assigned_riders);
    }
    capacity.assigned_riders += 1;
    capacity.available_slots = Math.max(0, capacity.max_riders - capacity.assigned_riders);
    Object.assign(assignment, {
      zone_id: zone.id,
      zone_name: zone.name,
      shift_id: body.shift_id,
      shift_name: mockRiderShifts.find((item) => item.id === body.shift_id)?.name,
      status: 'assigned',
      assigned_by: 'admin',
      reason: body.reason.trim(),
    });
    addHistory('rider_shift_assignment', assignment.id, 'overridden', { reason: body.reason.trim() });
    return copy(assignment);
  },
  async setRiderOperatingStatus(id, body) {
    await wait();
    const rider = find(riders, id);
    if (rider.status === 'pending_activation' && body.status === 'active') failure(409, 'OTP activation is required before this rider can become active.');
    rider.status = body.status;
    if (body.status === 'suspended') {
      mockRiderAssignments.filter((assignment) => assignment.rider_id === id && assignment.status === 'assigned').forEach((assignment) => {
        const zone = mockRiderZones.find((item) => item.id === assignment.zone_id);
        const capacity = zone?.capacities.find((item) => item.shift_id === assignment.shift_id);
        if (capacity) {
          capacity.assigned_riders = Math.max(0, capacity.assigned_riders - 1);
          capacity.available_slots = Math.max(0, capacity.max_riders - capacity.assigned_riders);
        }
        assignment.zone_id = null;
        assignment.zone_name = null;
        assignment.status = 'waitlisted';
        assignment.reason = 'Rider suspended';
      });
      recheckMockRiderWaitlist();
    }
    addHistory('rider', id, 'status_changed', { status: body.status });
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
