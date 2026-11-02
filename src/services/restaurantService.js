import {
  appSettings,
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
import { apiRequest } from './apiClient';
import { getOpenStatus } from '../utils/getOpenStatus';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ORDER_STORAGE_KEY = 'salo-order-records-v1';
const FAVORITE_RESTAURANT_STORAGE_KEY = 'salo-favorite-restaurants-v1';
const FAVORITE_MENU_ITEM_STORAGE_KEY = 'salo-favorite-menu-items-v1';
const CUSTOMER_RESERVATION_STORAGE_KEY = 'salo-customer-reservations-v1';
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
const readFavoriteIds = (storageKey) => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(storageKey);
    const ids = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(ids)) throw new Error('Stored favorite data is not a list.');
    return ids;
  } catch (error) {
    console.error('Unable to read saved favorites.', error);
    throw new Error('Saved favorites are unavailable. Clear site storage and try again.', { cause: error });
  }
};
const saveFavoriteIds = (storageKey, ids) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, JSON.stringify(ids));
};
let orderRecords = readStoredOrders();
let reservationRecords = reservations.map((reservation) => ({ ...reservation }));
let nextOrderNumber = mockOrderFlow.initialOrderNumber;
let nextReservationNumber = mockOrderFlow.initialReservationNumber;
const idempotentOrderRequests = new Map();
const distanceBetween = (latitude, longitude, restaurant) => {
  if (!Number.isFinite(Number(restaurant.latitude)) || !Number.isFinite(Number(restaurant.longitude))) {
    return Number(restaurant.distanceKm) || Number.POSITIVE_INFINITY;
  }
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(Number(restaurant.latitude) - latitude);
  const longitudeDelta = radians(Number(restaurant.longitude) - longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude)) * Math.cos(radians(Number(restaurant.latitude)))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const normalizeMenuCategory = (category) => ({
  ...category,
  category: category.name || category.category,
  items: (category.items || []).map((item) => ({
    ...item,
    soldOut: item.is_orderable === undefined ? Boolean(item.soldOut) : !item.is_orderable,
    dietaryTags: item.dietary_tags
      ? item.dietary_tags.map((tag) => tag.name)
      : item.dietaryTags || [],
    image: item.image_url || item.image || null,
    options: item.options || [],
  })),
});

const normalizeCustomerRestaurant = (restaurant) => ({
  ...restaurant,
  image: restaurant.image || restaurant.cover_url || restaurant.logo_url || null,
  cuisine: restaurant.cuisine || (restaurant.cuisines || []).join(', '),
  location: restaurant.location || restaurant.formatted_address || '',
  rating: restaurant.rating === null || restaurant.rating === undefined ? null : Number(restaurant.rating),
  ratingCount: Number(restaurant.rating_count || 0),
  popularityCount: Number(restaurant.popularity_count || 0),
  distanceKm: restaurant.distance_km === null || restaurant.distance_km === undefined
    ? null
    : Number(restaurant.distance_km),
  deliveryFee: restaurant.delivery_fee === null || restaurant.delivery_fee === undefined
    ? null
    : Number(restaurant.delivery_fee),
  deliveryTime: restaurant.delivery_time || '',
  delivery_radius_km: restaurant.delivery_radius_km === null || restaurant.delivery_radius_km === undefined
    ? null
    : Number(restaurant.delivery_radius_km),
  serviceModes: restaurant.service_modes || [],
  acceptsReservations: Boolean(restaurant.accepts_reservations),
  filipinoOnly: Boolean(restaurant.filipino_only),
  is_24_7: Boolean(restaurant.is_24_7),
  operatingHours: restaurant.operating_hours || {},
  closureDates: restaurant.closure_dates || [],
  menu: (restaurant.menu || []).map(normalizeMenuCategory),
});

const normalizeCustomerReservation = (reservation) => {
  const start = reservation.start_at ? new Date(reservation.start_at) : null;
  const date = reservation.date || (start
    ? new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(start)
    : '');
  const time = reservation.time || (start
    ? new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
    }).format(start)
    : '');
  const rawStatus = reservation.status || 'pending';

  return {
    ...reservation,
    restaurant: reservation.restaurant?.name || reservation.restaurant || '',
    restaurant_id: String(reservation.restaurant_id || reservation.restaurantId || ''),
    date,
    time,
    guests: Number(reservation.guest_count ?? reservation.guests ?? 0),
    statusCode: String(reservation.statusCode || rawStatus).toLowerCase(),
    status: String(rawStatus).charAt(0).toUpperCase() + String(rawStatus).slice(1).replaceAll('_', ' '),
    can_cancel: Boolean(reservation.can_cancel),
  };
};

const readStoredCustomerReservations = () => {
  if (typeof window === 'undefined') return reservationRecords;
  try {
    const stored = window.localStorage.getItem(CUSTOMER_RESERVATION_STORAGE_KEY);
    if (!stored) return reservationRecords;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('Stored reservation data is not a list.');
    return parsed.map(normalizeCustomerReservation);
  } catch (error) {
    console.error('Unable to read saved reservations.', error);
    throw new Error('Saved reservations are unavailable. Clear site storage and try again.', { cause: error });
  }
};

const saveCustomerReservations = (records) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CUSTOMER_RESERVATION_STORAGE_KEY, JSON.stringify(records));
  }
};

const paramsFrom = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      if (Array.isArray(value)) value.forEach((item) => params.append(`${key}[]`, String(item)));
      else params.set(key, String(value));
    }
  });
  return params;
};

export const restaurantService = {
  async getFeaturedRestaurants({ filipinoOnly = false } = {}) {
    await wait(config.mockDelay);

    const list = filipinoOnly
      ? restaurants.filter((restaurant) => restaurant.filipinoOnly || restaurant.tags.includes('Filipino'))
      : restaurants;

    return list.slice(0, 3);
  },

  async getPopularRestaurants() {
    if (!config.useMock) {
      const result = await apiRequest('/restaurants/popular', { preserveEnvelope: true });
      return (result?.data || []).map(normalizeCustomerRestaurant);
    }
    await wait(config.mockDelay);
    const popularRestaurants = popularRestaurantIds
      .map((id) => restaurants.find((restaurant) => restaurant.id === id))
      .filter(Boolean);
    return popularRestaurants.slice(0, GUEST_POPULAR_RESTAURANT_LIMIT);
  },

  async getAllRestaurants() {
    if (!config.useMock) {
      const response = await apiRequest('/restaurants?per_page=100', { preserveEnvelope: true });
      return (response?.data || []).map(normalizeCustomerRestaurant);
    }
    await wait(config.mockDelay + 150);
    return restaurants;
  },

  async getCategories() {
    if (!config.useMock) {
      const result = await apiRequest('/restaurants/categories');
      if (!Array.isArray(result?.categories)) throw new Error('Restaurant categories are unavailable.');
      return result.categories;
    }
    await wait(350);
    return [...new Set(restaurants.map((restaurant) => restaurant.cuisine))].sort();
  },

  async getCustomerHomeContent(filters = {}) {
    if (!config.useMock) {
      const params = paramsFrom(filters);
      const result = await apiRequest(`/customer/home${params.size ? `?${params}` : ''}`);
      return {
        filters: ['Featured', 'Open now', 'Open 24/7', 'Filipino only', 'Halal-certified', 'Vegetarian', 'Vegan', 'Reservations'],
        promotions: [],
        estimatedArrival: '',
        restaurants: (result?.restaurants || []).map(normalizeCustomerRestaurant),
        categories: result?.categories || [],
        meta: result?.meta || null,
      };
    }
    await wait(0);
    const listing = await this.getCustomerRestaurants(filters);
    return {
      ...customerHomeContent,
      filters: ['Featured', 'Open now', 'Open 24/7', 'Filipino only', 'Halal-certified', 'Vegetarian', 'Vegan', 'Reservations'],
      restaurants: listing.items,
      categories: [...new Set(restaurants.map((restaurant) => restaurant.cuisine))].sort(),
      meta: listing.meta,
    };
  },

  async getCustomerRestaurants(filters = {}) {
    if (!config.useMock) {
      const params = paramsFrom(filters);
      const response = await apiRequest(`/restaurants${params.size ? `?${params}` : ''}`, {
        preserveEnvelope: true,
      });
      return {
        items: (response?.data || []).map(normalizeCustomerRestaurant),
        meta: response?.meta || null,
      };
    }

    await wait(250);
    let items = [...restaurants];
    const term = String(filters.q || '').trim().toLocaleLowerCase();
    if (term) {
      items = items.filter((restaurant) => {
        const dishes = restaurant.menu.flatMap((group) => group.items.map((item) => item.name)).join(' ');
        return `${restaurant.name} ${restaurant.cuisine} ${restaurant.tags.join(' ')} ${dishes}`
          .toLocaleLowerCase()
          .includes(term);
      });
    }
    if (filters.cuisine) {
      items = items.filter((restaurant) => restaurant.cuisine === filters.cuisine
        || restaurant.tags.includes(filters.cuisine)
        || restaurant.menu.some((group) => group.category === filters.cuisine));
    }
    if (filters.featured) items = items.filter((restaurant) => popularRestaurantIds.includes(restaurant.id));
    if (filters.open_24_7) items = items.filter((restaurant) => restaurant.is_24_7);
    if (filters.filipino_only) items = items.filter((restaurant) => restaurant.filipinoOnly);
    if (filters.accepts_reservations) items = items.filter((restaurant) => restaurant.acceptsReservations);
    const dietaryFilters = filters.dietary || (filters.dietary_tag ? [filters.dietary_tag] : []);
    dietaryFilters.forEach((dietaryTag) => {
      const expected = String(dietaryTag).replace(/[_-]/g, ' ').toLocaleLowerCase();
      items = items.filter((restaurant) => restaurant.tags.some((tag) => tag
        .replace(/[_-]/g, ' ').toLocaleLowerCase().includes(expected))
        || restaurant.menu.some((group) => group.items.some((item) => (item.dietaryTags || []).some((tag) => tag
          .replace(/[_-]/g, ' ').toLocaleLowerCase().includes(expected)))));
    });
    if (filters.open_now) {
      items = items.filter((restaurant) => ['open', 'closing-soon'].includes(
        getOpenStatus(restaurant).status,
      ));
    }
    if (filters.sort === 'rating') items.sort((first, second) => second.rating - first.rating);
    else if (filters.sort === 'nearest' && Number.isFinite(Number(filters.latitude)) && Number.isFinite(Number(filters.longitude))) {
      items.sort((first, second) => (
        distanceBetween(Number(filters.latitude), Number(filters.longitude), first)
        - distanceBetween(Number(filters.latitude), Number(filters.longitude), second)
      ));
    } else items.sort((first, second) => Number(popularRestaurantIds.includes(second.id)) - Number(popularRestaurantIds.includes(first.id)));

    const page = Math.max(1, Number(filters.page) || 1);
    const perPage = Math.min(30, Math.max(1, Number(filters.per_page) || 12));
    const start = (page - 1) * perPage;
    return {
      items: items.slice(start, start + perPage),
      meta: { current_page: page, last_page: Math.ceil(items.length / perPage), per_page: perPage, total: items.length },
    };
  },

  async getLandingContent() {
    await wait(0);
    return { filterPills: landingFilterPills, reservationPreview: landingReservationPreview };
  },

  async getRestaurantById(id) {
    if (!config.useMock) {
      return normalizeCustomerRestaurant(await apiRequest(`/restaurants/${encodeURIComponent(id)}`));
    }
    await wait(350);
    return restaurants.find((restaurant) => restaurant.id === id) || null;
  },

  async getRestaurantMenu(id, filters = {}) {
    if (!config.useMock) {
      const params = paramsFrom(filters);
      const result = await apiRequest(`/restaurants/${encodeURIComponent(id)}/menu${params.size ? `?${params}` : ''}`);
      return (result?.categories || []).map(normalizeMenuCategory);
    }

    await wait(150);
    const restaurant = restaurants.find((item) => String(item.id) === String(id));
    if (!restaurant) return [];
    const term = String(filters.q || '').trim().toLocaleLowerCase();
    const dietaryFilters = filters.dietary || [];
    return restaurant.menu
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const itemText = `${item.name} ${item.description || ''} ${(item.dietaryTags || []).join(' ')}`
            .toLocaleLowerCase();
          return (!term || itemText.includes(term))
            && dietaryFilters.every((tag) => (item.dietaryTags || []).some((dietaryTag) => dietaryTag
              .replace(/[_-]/g, ' ').toLocaleLowerCase().includes(String(tag).replace(/[_-]/g, ' ').toLocaleLowerCase())));
        }),
      }))
      .filter((group) => group.items.length)
      .map(normalizeMenuCategory);
  },

  async getRestaurantReviews(id, { page = 1, per_page = 10 } = {}) {
    if (!config.useMock) {
      const params = paramsFrom({ page, per_page });
      const response = await apiRequest(`/restaurants/${encodeURIComponent(id)}/reviews?${params}`, {
        preserveEnvelope: true,
      });
      return { items: response?.data || [], meta: response?.meta || null };
    }
    await wait(100);
    return { items: [], meta: { current_page: page, last_page: 1, total: 0 } };
  },

  async searchRestaurants(query) {
    if (!config.useMock) {
      const params = paramsFrom({ q: query.trim(), per_page: 5 });
      const response = await apiRequest(`/restaurants${params.size ? `?${params}` : ''}`, {
        preserveEnvelope: true,
      });
      return (response?.data || []).map(normalizeCustomerRestaurant);
    }
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

  async createCheckoutGroup({ orders: checkoutOrders, idempotencyKey }) {
    if (!config.useMock) throw new Error('Mock checkout groups are unavailable in API mode.');
    const fingerprint = JSON.stringify(checkoutOrders
      .map((order) => ({
        restaurantId: String(order.restaurantId),
        deliveryMode: order.deliveryMode,
        address: order.address,
        addressSnapshot: order.addressSnapshot || null,
        payment: order.payment,
        scheduledAt: order.scheduledAt || '',
        recipientName: order.recipientName || '',
        phone: order.phone || '',
        cartItems: (order.cartItems || []).map((item) => ({
          id: String(item.id),
          name: item.name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          optionLabels: item.optionLabels || [],
          note: item.note || '',
        })),
        subtotal: Number(order.subtotal || 0),
        deliveryFee: Number(order.deliveryFee || 0),
        serviceFee: Number(order.serviceFee || 0),
        discount: Number(order.discount || 0),
        total: Number(order.total || 0),
      }))
      .sort((first, second) => first.restaurantId.localeCompare(second.restaurantId)));
    orderRecords = readStoredOrders();
    const previous = orderRecords.filter((order) => order.checkoutIdempotencyKey === idempotencyKey);
    if (previous.length) {
      if (previous[0].checkoutFingerprint !== fingerprint) {
        throw new Error('This checkout key was already used with different order details.');
      }
      return {
        id: previous[0].checkoutGroupReference,
        reference_code: previous[0].checkoutGroupReference,
        grand_total: previous.reduce((sum, order) => sum + Number(order.total || 0), 0),
        orders: previous,
      };
    }

    await wait(config.mockDelay);
    const groupReference = `CHK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const created = checkoutOrders.map((details) => ({
      ...details,
      id: `ORD-${Date.now()}-${nextOrderNumber++}`,
      status: 'Placed',
      trackingStep: 0,
      createdAt: new Date().toISOString(),
      eta: mockOrderFlow.estimatedDeliveryTime,
      date: new Date().toISOString().slice(0, 10),
      checkoutGroupReference: groupReference,
      checkoutIdempotencyKey: idempotencyKey,
      checkoutFingerprint: fingerprint,
    }));
    orderRecords = [...created, ...orderRecords];
    saveOrders(orderRecords);

    return {
      id: groupReference,
      reference_code: groupReference,
      grand_total: created.reduce((sum, order) => sum + Number(order.total || 0), 0),
      orders: created,
    };
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

  async confirmReceipt(id) {
    await wait(150);
    orderRecords = readStoredOrders();
    const order = orderRecords.find((item) => item.id === id);
    if (!order || order.status !== 'Delivered') return null;
    const updated = {
      ...order,
      status: 'Completed',
      customerConfirmedAt: new Date().toISOString(),
    };
    orderRecords = orderRecords.map((item) => item.id === id ? updated : item);
    saveOrders(orderRecords);
    return updated;
  },

  async reviewRestaurant(id, review) {
    await wait(150);
    orderRecords = readStoredOrders();
    const order = orderRecords.find((item) => item.id === id);
    if (!order || order.status !== 'Completed' || order.restaurantReview) return null;
    const updated = { ...order, restaurantReview: { ...review, createdAt: new Date().toISOString() } };
    orderRecords = orderRecords.map((item) => item.id === id ? updated : item);
    saveOrders(orderRecords);
    return updated;
  },

  async getReservations(page = 1) {
    if (!config.useMock) {
      const response = await apiRequest(`/customer/reservations?page=${page}&per_page=50`, { preserveEnvelope: true });
      return {
        items: (response?.data || []).map(normalizeCustomerReservation),
        meta: response?.meta || { current_page: page, last_page: page },
      };
    }
    await wait(350);
    reservationRecords = readStoredCustomerReservations();
    const records = reservationRecords.map(normalizeCustomerReservation);
    const perPage = 50;
    const lastPage = Math.max(1, Math.ceil(records.length / perPage));
    const currentPage = Math.min(Math.max(1, Number(page) || 1), lastPage);
    const start = (currentPage - 1) * perPage;
    return {
      items: records.slice(start, start + perPage),
      meta: { current_page: currentPage, last_page: lastPage },
    };
  },

  async getReservationSlots(restaurantId, filters) {
    if (!config.useMock) {
      const params = paramsFrom(filters);
      const slots = await apiRequest(`/restaurants/${encodeURIComponent(restaurantId)}/reservation-slots?${params}`);
      return Array.isArray(slots) ? slots : [];
    }

    await wait(config.mockDelay);
    const restaurant = restaurants.find((item) => String(item.id) === String(restaurantId));
    if (!restaurant || !restaurant.acceptsReservations) return [];
    reservationRecords = readStoredCustomerReservations();
    const duration = Number(filters.duration_minutes) || 90;
    const guestCount = Number(filters.guest_count);
    const candidates = [];
    for (let minutes = 11 * 60; minutes <= 21 * 60; minutes += 30) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
      const minute = String(minutes % 60).padStart(2, '0');
      const startAt = new Date(`${filters.date}T${hour}:${minute}:00+08:00`);
      const endAt = new Date(startAt.getTime() + duration * 60_000);
      if (startAt <= new Date(Date.now() + 2 * 60 * 60_000)) continue;
      if (minutes + duration > 22 * 60) continue;
      for (const tableCapacity of [2, 4, 6, 8, 10].filter((capacity) => capacity >= guestCount)) {
        const tableId = `mock-${restaurant.id}-${tableCapacity}`;
        const overlaps = reservationRecords.some((reservation) => (
          String(reservation.restaurant_id) === String(restaurantId)
          && String(reservation.table_id) === tableId
          && ['pending', 'confirmed'].includes(reservation.statusCode)
          && reservation.start_at
          && new Date(reservation.start_at) < endAt
          && new Date(reservation.end_at) > startAt
        ));
        if (overlaps) continue;
        candidates.push({
          table_id: tableId,
          table_number: `Table ${tableCapacity}`,
          capacity: tableCapacity,
          area: 'Main dining area',
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          duration_minutes: duration,
          guest_count: guestCount,
        });
        break;
      }
    }
    return candidates;
  },

  async getReservation(id) {
    if (!config.useMock) {
      const reservation = await apiRequest(`/customer/reservations/${encodeURIComponent(id)}`);
      return normalizeCustomerReservation(reservation);
    }
    await wait(150);
    reservationRecords = readStoredCustomerReservations();
    const reservation = reservationRecords.find((item) => String(item.id) === String(id));
    return reservation ? normalizeCustomerReservation(reservation) : null;
  },

  async createReservation(details) {
    if (!config.useMock) {
      const reservation = await apiRequest('/customer/reservations', { method: 'POST', body: details });
      return normalizeCustomerReservation(reservation);
    }
    await wait(config.mockDelay);
    reservationRecords = readStoredCustomerReservations();
    const restaurant = restaurants.find((item) => String(item.id) === String(details.restaurant_id));
    const reservation = normalizeCustomerReservation({
      ...details,
      id: `RES-${Date.now()}-${nextReservationNumber++}`,
      reference_code: `MOCK-${Date.now()}`,
      restaurant_id: String(details.restaurant_id),
      restaurant: { name: restaurant?.name || '' },
      end_at: new Date(new Date(details.start_at).getTime() + Number(details.duration_minutes) * 60_000).toISOString(),
      status: mockOrderFlow.initialReservationStatus.toLowerCase(),
      can_cancel: true,
    });
    reservationRecords = [reservation, ...reservationRecords];
    saveCustomerReservations(reservationRecords);
    return reservation;
  },

  async cancelReservation(id, reason = null) {
    if (!config.useMock) {
      const reservation = await apiRequest(`/customer/reservations/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: { reason },
      });
      return normalizeCustomerReservation(reservation);
    }
    await wait(250);
    reservationRecords = readStoredCustomerReservations();
    const reservation = reservationRecords.find((item) => item.id === id);
    if (!reservation || !['pending', 'confirmed'].includes(reservation.statusCode) || !reservation.can_cancel) return null;
    reservationRecords = reservationRecords.map((item) => item.id === id
      ? { ...item, status: 'Cancelled', statusCode: 'cancelled', can_cancel: false, cancel_reason: reason }
      : item);
    saveCustomerReservations(reservationRecords);
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

  async getFavorites(type) {
    if (!config.useMock) {
      const params = paramsFrom({ type });
      return apiRequest(`/customer/favorites${params.size ? `?${params}` : ''}`);
    }
    await wait(100);
    const restaurantIds = readFavoriteIds(FAVORITE_RESTAURANT_STORAGE_KEY);
    const menuItemIds = readFavoriteIds(FAVORITE_MENU_ITEM_STORAGE_KEY);
    return [
      ...(type && type !== 'restaurant' ? [] : restaurants
        .filter((restaurant) => restaurantIds.includes(String(restaurant.id)))
        .map((restaurant) => ({ type: 'restaurant', id: String(restaurant.id), name: restaurant.name }))),
      ...(type && type !== 'menu_item' ? [] : restaurants.flatMap((restaurant) => restaurant.menu.flatMap((group) => group.items
        .filter((item) => menuItemIds.includes(String(item.id)))
        .map((item) => ({ type: 'menu_item', id: String(item.id), name: item.name, restaurant_id: String(restaurant.id) }))))),
    ];
  },

  async isRestaurantFavorite(id) {
    const favorites = await this.getFavorites('restaurant');
    return favorites.some((favorite) => String(favorite.id) === String(id));
  },

  async setRestaurantFavorite(id, favorited) {
    if (!config.useMock) {
      const method = favorited ? 'PUT' : 'DELETE';
      return apiRequest(`/customer/favorites/restaurants/${encodeURIComponent(id)}`, {
        method,
        ...(favorited ? { body: {} } : {}),
      });
    }
    await wait(100);
    const favoriteIds = readFavoriteIds(FAVORITE_RESTAURANT_STORAGE_KEY).map(String);
    const nextIds = favorited
      ? [...new Set([...favoriteIds, String(id)])]
      : favoriteIds.filter((favoriteId) => favoriteId !== String(id));
    saveFavoriteIds(FAVORITE_RESTAURANT_STORAGE_KEY, nextIds);
    return { favorited };
  },

  async setMenuItemFavorite(id, favorited) {
    if (!config.useMock) {
      const method = favorited ? 'PUT' : 'DELETE';
      return apiRequest(`/customer/favorites/menu-items/${encodeURIComponent(id)}`, {
        method,
        ...(favorited ? { body: {} } : {}),
      });
    }
    await wait(100);
    const favoriteIds = readFavoriteIds(FAVORITE_MENU_ITEM_STORAGE_KEY).map(String);
    const nextIds = favorited
      ? [...new Set([...favoriteIds, String(id)])]
      : favoriteIds.filter((favoriteId) => favoriteId !== String(id));
    saveFavoriteIds(FAVORITE_MENU_ITEM_STORAGE_KEY, nextIds);
    return { favorited };
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
