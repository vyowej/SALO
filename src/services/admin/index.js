import { config } from '../../config';
import { adminApi } from './api';
import { adminMock } from './mock';

export const adminService = config.useMock ? adminMock : adminApi;

export const {
  getDashboard,
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  suspendUser,
  reactivateUser,
  listRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  setRestaurantStatus,
  listApplications,
  getApplication,
  approveApplication,
  rejectApplication,
  listRiders,
  getRider,
  setRiderStatus,
  listRiderProofs,
  listOrders,
  getOrder,
  cancelOrder,
  listReservations,
  getReservation,
  setReservationStatus,
  getReport,
  listHistory,
  getCalendar,
  getSettings,
  updateSettings,
  listServiceAreas,
  createServiceArea,
  updateServiceArea,
  deleteServiceArea,
  listSchedules,
  generateSchedule,
} = adminService;

export default adminService;
