import {
  appSettings,
  categories,
  orders,
  reservations,
  restaurants,
  userProfile,
} from '../mock/restaurants';
import { mockOrderFlow } from '../mock/orderFlowData';
import { customerHomeContent } from '../mock/customerHomeData';
import { landingFilterPills, landingReservationPreview, popularRestaurantIds } from '../mock/landingData';
import { GUEST_POPULAR_RESTAURANT_LIMIT } from '../constants/guestExperience';
import { config } from '../config';
import { addressService } from './addressService';
import { authService } from './authService';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ORDER_STORAGE_KEY = 'salo-order-records-v1';
const orderSteps = mockOrderFlow.statusSteps;
const readStoredOrders = () => {
  if (typeof window === 'undefined') return orders.map((order) => ({ ...order }));
  try {
    const stored = window.localStorage.getItem(ORDER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : orders.map((order) => ({ ...order }));
  } catch (error) {
    console.error('Unable to read saved mock orders.', error);
    throw new Error('Saved orders are unavailable. Clear site storage and try again.', { cause: error });
  }
};
const saveOrders = (nextOrders) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(nextOrders));
};
let orderRecords = readStoredOrders();
let reservationRecords = reservations.map((reservation) => ({ ...reservation }));
let nextOrderNumber = mockOrderFlow.initialOrderNumber;
let nextReservationNumber = mockOrderFlow.initialReservationNumber;
const idempotentOrderRequests = new Map();

export const restaurantService = {
  async getFeaturedRestaurants({ filipinoOnly = false } = {}) {
    await wait(config.mockDelay);

    const list = filipinoOnly
      ? restaurants.filter((restaurant) => restaurant.filipinoOnly || restaurant.tags.includes('Filipino'))
      : restaurants;

    return list.slice(0, 3);
  },

  async getPopularRestaurants() {
    await wait(config.mockDelay);
    const popularRestaurants = popularRestaurantIds
      .map((id) => restaurants.find((restaurant) => restaurant.id === id))
      .filter(Boolean);
    return popularRestaurants.slice(0, GUEST_POPULAR_RESTAURANT_LIMIT);
  },

  async getAllRestaurants() {
    await wait(config.mockDelay + 150);
    return restaurants;
  },

  async getCategories() {
    await wait(350);
    return categories;
  },

  async getCustomerHomeContent() {
    await wait(0);
    return customerHomeContent;
  },

  async getLandingContent() {
    await wait(0);
    return { filterPills: landingFilterPills, reservationPreview: landingReservationPreview };
  },

  async getRestaurantById(id) {
    await wait(350);
    return restaurants.find((restaurant) => restaurant.id === id) || null;
  },

  async searchRestaurants(query) {
    await wait(250);
    const clean = query.trim().toLowerCase();

    if (!clean) return restaurants;

    return restaurants.filter((restaurant) => {
      const dishes = restaurant.menu.flatMap((group) => group.items.map((item) => item.name)).join(' ');
      const text = `${restaurant.name} ${restaurant.cuisine} ${restaurant.tags.join(' ')} ${dishes}`.toLowerCase();
      return text.includes(clean);
    });
  },

  async getOrders() {
    await wait(350);
    orderRecords = readStoredOrders();
    return orderRecords;
  },

  async getOrderById(id) {
    await wait(250);
    orderRecords = readStoredOrders();
    return orderRecords.find((order) => order.id === id) || null;
  },

  async createOrder(details) {
    const key = details.idempotencyKey;
    if (key) {
      orderRecords = readStoredOrders();
      const previous = orderRecords.find((order) => order.idempotencyKey === key);
      if (previous) return previous;
      if (idempotentOrderRequests.has(key)) return idempotentOrderRequests.get(key);
    }

    const request = (async () => {
      await wait(config.mockDelay);
      orderRecords = readStoredOrders();
      const previous = key && orderRecords.find((order) => order.idempotencyKey === key);
      if (previous) return previous;
      const newOrder = {
        ...details,
        id: `ORD-${Date.now()}-${nextOrderNumber++}`,
        status: 'Placed',
        trackingStep: 0,
        createdAt: new Date().toISOString(),
        eta: mockOrderFlow.estimatedDeliveryTime,
        date: new Date().toISOString().slice(0, 10),
      };
      orderRecords = [newOrder, ...orderRecords];
      saveOrders(orderRecords);
      return newOrder;
    })();

    if (key) idempotentOrderRequests.set(key, request);
    try {
      return await request;
    } finally {
      if (key) idempotentOrderRequests.delete(key);
    }
  },

  async advanceOrder(id) {
    await wait(80);
    orderRecords = readStoredOrders();
    const order = orderRecords.find((item) => item.id === id);
    if (!order || order.status === 'Completed' || order.status === 'Cancelled') return order || null;
    const currentStep = Math.max(0, orderSteps.indexOf(order.status));
    const nextStep = Math.min(orderSteps.length - 1, currentStep + 1);
    const updated = {
      ...order,
      status: orderSteps[nextStep],
      trackingStep: nextStep,
      rider: nextStep >= 4 ? { ...mockOrderFlow.rider } : order.rider,
    };
    orderRecords = orderRecords.map((item) => item.id === id ? updated : item);
    saveOrders(orderRecords);
    return updated;
  },

  async cancelOrder(id, reason = '') {
    await wait(250);
    orderRecords = readStoredOrders();
    const order = orderRecords.find((item) => item.id === id);
    if (!order || order.status !== 'Placed') return null;
    orderRecords = orderRecords.map((item) => item.id === id ? { ...item, status: 'Cancelled', cancelReason: reason } : item);
    saveOrders(orderRecords);
    return orderRecords.find((item) => item.id === id);
  },

  async getReservations() {
    await wait(350);
    return reservationRecords;
  },

  async createReservation(details) {
    await wait(config.mockDelay);
    const reservation = { ...details, id: `RES-${nextReservationNumber++}`, status: mockOrderFlow.initialReservationStatus };
    reservationRecords = [reservation, ...reservationRecords];
    return reservation;
  },

  async cancelReservation(id) {
    await wait(250);
    const reservation = reservationRecords.find((item) => item.id === id);
    if (!reservation || !['Pending', 'Confirmed'].includes(reservation.status)) return null;
    reservationRecords = reservationRecords.map((item) => item.id === id ? { ...item, status: 'Cancelled' } : item);
    return reservationRecords.find((item) => item.id === id);
  },

  async getProfile() {
    if (!config.useMock) return authService.getCurrentUser();
    await wait(350);
    return userProfile;
  },

  async getSavedAddresses() {
    return addressService.getSavedAddresses();
  },

  async getSettings() {
    if (!config.useMock) return authService.getSettings();
    await wait(250);
    return appSettings;
  },

  async updateSettings(updates) {
    if (!config.useMock) return authService.updateSettings(updates);
    await wait(100);
    Object.assign(appSettings, updates);
    return appSettings;
  },
};

export default restaurantService;
