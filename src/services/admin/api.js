import { apiRequest } from '../apiClient';

const queryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
};
const resourcePath = (resource, id) => `/admin/${resource}/${encodeURIComponent(id)}`;
const list = (path, params) => apiRequest(`${path}${queryString(params)}`, { preserveEnvelope: true });

export const adminApi = {
  getDashboard: () => apiRequest('/admin/dashboard'),
  listUsers: (params) => list('/admin/users', params),
  getUser: (id) => apiRequest(resourcePath('users', id)),
  createUser: (body) => apiRequest('/admin/users', { method: 'POST', body }),
  updateUser: (id, body) => apiRequest(resourcePath('users', id), { method: 'PUT', body }),
  deleteUser: (id) => apiRequest(resourcePath('users', id), { method: 'DELETE' }),
  suspendUser: (id, body = {}) => apiRequest(`${resourcePath('users', id)}/suspend`, { method: 'POST', body }),
  reactivateUser: (id) => apiRequest(`${resourcePath('users', id)}/reactivate`, { method: 'POST', body: {} }),
  listRestaurants: (params) => list('/admin/restaurants', params),
  getRestaurant: (id) => apiRequest(resourcePath('restaurants', id)),
  createRestaurant: (body) => apiRequest('/admin/restaurants', { method: 'POST', body }),
  updateRestaurant: (id, body) => apiRequest(resourcePath('restaurants', id), { method: 'PUT', body }),
  deleteRestaurant: (id) => apiRequest(resourcePath('restaurants', id), { method: 'DELETE' }),
  setRestaurantStatus: (id, body) => apiRequest(`${resourcePath('restaurants', id)}/status`, { method: 'PATCH', body }),
  listApplications: (params) => list('/admin/applications', params),
  getApplication: (type, id) => apiRequest(`/admin/applications/${encodeURIComponent(type)}/${encodeURIComponent(id)}`),
  approveApplication: (type, id, body = {}) => apiRequest(`/admin/applications/${encodeURIComponent(type)}/${encodeURIComponent(id)}/approve`, { method: 'POST', body }),
  rejectApplication: (type, id, body) => apiRequest(`/admin/applications/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reject`, { method: 'POST', body }),
  requestRevisionApplication: (type, id, body) => apiRequest(`/admin/applications/${encodeURIComponent(type)}/${encodeURIComponent(id)}/request-revision`, { method: 'POST', body }),
  startReviewApplication: (type, id) => apiRequest(`/admin/applications/${encodeURIComponent(type)}/${encodeURIComponent(id)}/start-review`, { method: 'POST', body: {} }),
  getApplicationDocumentUrl: (id) => apiRequest(`/applications/documents/${encodeURIComponent(id)}/download-url`),
  listRiders: (params) => list('/admin/riders', params),
  getRider: (id) => apiRequest(resourcePath('riders', id)),
  setRiderStatus: (id, body) => apiRequest(`${resourcePath('riders', id)}/status`, { method: 'PATCH', body }),
  listRiderProofs: (id, params) => list(`${resourcePath('riders', id)}/proofs`, params),
  listOrders: (params) => list('/admin/orders', params),
  getOrder: (id) => apiRequest(resourcePath('orders', id)),
  cancelOrder: (id, body) => apiRequest(`${resourcePath('orders', id)}/cancel`, { method: 'POST', body }),
  listReservations: (params) => list('/admin/reservations', params),
  getReservation: (id) => apiRequest(resourcePath('reservations', id)),
  setReservationStatus: (id, body) => apiRequest(`${resourcePath('reservations', id)}/status`, { method: 'PATCH', body }),
  getReport: (report, params) => apiRequest(`${resourcePath('reports', report)}${queryString(params)}`),
  listHistory: (params) => list('/admin/history', params),
  getCalendar: (params) => apiRequest(`/admin/calendar${queryString(params)}`),
  getSettings: () => apiRequest('/admin/settings'),
  updateSettings: (body) => apiRequest('/admin/settings', { method: 'PUT', body }),
  listServiceAreas: (params) => list('/admin/service-areas', params),
  createServiceArea: (body) => apiRequest('/admin/service-areas', { method: 'POST', body }),
  updateServiceArea: (id, body) => apiRequest(resourcePath('service-areas', id), { method: 'PUT', body }),
  deleteServiceArea: (id) => apiRequest(resourcePath('service-areas', id), { method: 'DELETE' }),
  listSchedules: (params) => list('/admin/schedules', params),
  generateSchedule: (body) => apiRequest('/admin/schedules/generate', { method: 'POST', body }),
};
