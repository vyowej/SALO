import apiRequest, { apiDownloadRequest, apiUploadRequest } from './apiClient';
import config from '../config';
import { recordBusinessAudit } from './teamService';

const mockStorageKey = 'salo.business.pages.mock.v1';
const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function restaurantPath(restaurantId, endpoint = '') {
  return `/manage/restaurants/${encodeURIComponent(restaurantId)}/business${endpoint}`;
}

function menuPath(restaurantId, endpoint = '') {
  return `/manage/restaurants/${encodeURIComponent(restaurantId)}/menu${endpoint}`;
}

function ordersPath(restaurantId, endpoint = '') {
  return `/manage/restaurants/${encodeURIComponent(restaurantId)}/orders${endpoint}`;
}

function reservationsPath(restaurantId, endpoint = '') {
  return `/manage/restaurants/${encodeURIComponent(restaurantId)}/reservations${endpoint}`;
}

function tablesPath(restaurantId, endpoint = '') {
  return `/manage/restaurants/${encodeURIComponent(restaurantId)}/tables${endpoint}`;
}

function discountsPath(restaurantId, endpoint = '') {
  return `/manage/restaurants/${encodeURIComponent(restaurantId)}/discounts${endpoint}`;
}

function reportsPath(restaurantId, endpoint = '') {
  return `/manage/restaurants/${encodeURIComponent(restaurantId)}/reports${endpoint}`;
}

function calendarPath(restaurantId) {
  return `/manage/restaurants/${encodeURIComponent(restaurantId)}/calendar`;
}

function seedBusinessDiscounts() {
  const now = new Date();
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return [{
    id: 'demo-discount-welcome',
    code: 'WELCOME10',
    name: 'Welcome offer',
    description: 'A sample discount for the first order.',
    funded_by: 'restaurant',
    type: 'percentage',
    first_order_only: true,
    value: '10.00',
    min_order_amount: '200.00',
    max_discount: '100.00',
    starts_at: now.toISOString(),
    ends_at: inThirtyDays.toISOString(),
    usage_limit: 100,
    per_customer_limit: 1,
    usage_count: 7,
    is_active: true,
  }];
}

function seedReservationSettings() {
  return {
    accepts_reservations: true,
    confirm_mode: 'manual',
    review_window_hours: 2,
    slot_minutes: 30,
    dining_minutes: 90,
    min_lead_hours: 1,
    max_months_ahead: 3,
    max_party_size: 12,
    grace_minutes: 15,
    cancel_cutoff_hours: 2,
    is_configured: true,
  };
}

function seedBusinessOrders(restaurantId) {
  const now = Date.now();
  const placedAt = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString();
  return [
    {
      id: `demo-${restaurantId}-1048`,
      reference_code: 'SALO-DEMO-1048',
      order_type: 'delivery',
      status: 'placed',
      placed_at: placedAt(2),
      recipient: { name: 'Sample Customer', phone: '09XX XXX 1048' },
      delivery: { address: 'Demo address, Quezon City', latitude: 14.676, longitude: 121.0437 },
      items: [{ name: 'Chicken adobo', unit_price: '185.00', quantity: 2, note: 'Demo order', line_total: '370.00' }],
      totals: { subtotal: '370.00', delivery_fee: '35.00', service_fee: '18.50', discount_amount: '0.00', total: '423.50' },
      payment: { method: 'cash_on_delivery', status: 'unpaid' },
      cancel_reason: null,
      status_history: [{ from_status: null, to_status: 'placed', reason: null, changed_at: placedAt(2), actor: null }],
    },
    {
      id: `demo-${restaurantId}-1047`,
      reference_code: 'SALO-DEMO-1047',
      order_type: 'pick_up',
      status: 'confirmed',
      placed_at: placedAt(12),
      recipient: { name: 'Demo Pickup', phone: '09XX XXX 1047' },
      delivery: null,
      items: [{ name: 'Pancit bihon', unit_price: '160.00', quantity: 1, note: null, line_total: '160.00' }],
      totals: { subtotal: '160.00', delivery_fee: '0.00', service_fee: '8.00', discount_amount: '0.00', total: '168.00' },
      payment: { method: 'pay_at_pick_up', status: 'unpaid' },
      cancel_reason: null,
      status_history: [
        { from_status: null, to_status: 'placed', reason: null, changed_at: placedAt(12), actor: null },
        { from_status: 'placed', to_status: 'confirmed', reason: null, changed_at: placedAt(10), actor: { id: 'demo-owner', name: 'Sample Owner' } },
      ],
    },
    {
      id: `demo-${restaurantId}-1046`,
      reference_code: 'SALO-DEMO-1046',
      order_type: 'delivery',
      status: 'preparing',
      placed_at: placedAt(25),
      recipient: { name: 'Demo Recipient', phone: '09XX XXX 1046' },
      delivery: { address: 'Demo address, Quezon City', latitude: 14.676, longitude: 121.0437 },
      items: [{ name: 'Vegetable curry', unit_price: '125.00', quantity: 1, note: null, line_total: '125.00' }],
      totals: { subtotal: '125.00', delivery_fee: '35.00', service_fee: '6.25', discount_amount: '0.00', total: '166.25' },
      payment: { method: 'cash_on_delivery', status: 'unpaid' },
      cancel_reason: null,
      status_history: [
        { from_status: null, to_status: 'placed', reason: null, changed_at: placedAt(25), actor: null },
        { from_status: 'placed', to_status: 'confirmed', reason: null, changed_at: placedAt(22), actor: { id: 'demo-owner', name: 'Sample Owner' } },
        { from_status: 'confirmed', to_status: 'preparing', reason: null, changed_at: placedAt(18), actor: { id: 'demo-staff', name: 'Sample Staff' } },
      ],
    },
    {
      id: `demo-${restaurantId}-1045`,
      reference_code: 'SALO-DEMO-1045',
      order_type: 'pick_up',
      status: 'ready',
      placed_at: placedAt(40),
      recipient: { name: 'Demo Collector', phone: '09XX XXX 1045' },
      delivery: null,
      items: [{ name: 'Turon (4 pcs)', unit_price: '80.00', quantity: 2, note: null, line_total: '160.00' }],
      totals: { subtotal: '160.00', delivery_fee: '0.00', service_fee: '8.00', discount_amount: '0.00', total: '168.00' },
      payment: { method: 'pay_at_pick_up', status: 'unpaid' },
      cancel_reason: null,
      status_history: [
        { from_status: null, to_status: 'placed', reason: null, changed_at: placedAt(40), actor: null },
        { from_status: 'placed', to_status: 'confirmed', reason: null, changed_at: placedAt(37), actor: { id: 'demo-owner', name: 'Sample Owner' } },
        { from_status: 'confirmed', to_status: 'preparing', reason: null, changed_at: placedAt(32), actor: { id: 'demo-staff', name: 'Sample Staff' } },
        { from_status: 'preparing', to_status: 'ready', reason: null, changed_at: placedAt(15), actor: { id: 'demo-staff', name: 'Sample Staff' } },
      ],
    },
  ];
}

function seedBusinessReservations(restaurantId) {
  const reservedAt = (daysAhead, hour, minute = 0) => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    const [year, month, day] = today.split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1, day + daysAhead)).toISOString().slice(0, 10);
    return new Date(`${target}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`).toISOString();
  };
  return [
    {
      id: `demo-${restaurantId}-reservation-201`,
      reference_code: 'SALO-DEMO-201',
      customer: { name: 'Sample Customer', phone: '09XX XXX 1201' },
      start_at: reservedAt(0, 19, 0),
      end_at: reservedAt(0, 20, 30),
      duration_minutes: 90,
      guest_count: 4,
      table_id: `demo-${restaurantId}-table-2`,
      status: 'pending',
      special_request: 'Window seat, if available.',
      created_at: new Date().toISOString(),
    },
    {
      id: `demo-${restaurantId}-reservation-202`,
      reference_code: 'SALO-DEMO-202',
      customer: { name: 'Demo Guest', phone: '09XX XXX 1202' },
      start_at: reservedAt(0, 20, 0),
      end_at: reservedAt(0, 21, 30),
      duration_minutes: 90,
      guest_count: 2,
      table_id: `demo-${restaurantId}-table-1`,
      status: 'confirmed',
      special_request: '',
      created_at: new Date(Date.now() - 45 * 60_000).toISOString(),
    },
    {
      id: `demo-${restaurantId}-reservation-203`,
      reference_code: 'SALO-DEMO-203',
      customer: { name: 'Sample Party', phone: '09XX XXX 1203' },
      start_at: reservedAt(1, 18, 30),
      end_at: reservedAt(1, 20, 0),
      duration_minutes: 90,
      guest_count: 6,
      table_id: `demo-${restaurantId}-table-3`,
      status: 'confirmed',
      special_request: 'High chair requested.',
      created_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    },
  ];
}

function seedBusinessTables(restaurantId) {
  return [
    { id: `demo-${restaurantId}-table-1`, table_number: '1', capacity: 2, area: 'Indoor', status: 'active', attention_count: 0 },
    { id: `demo-${restaurantId}-table-2`, table_number: '2', capacity: 4, area: 'Window', status: 'active', attention_count: 0 },
    { id: `demo-${restaurantId}-table-3`, table_number: '3', capacity: 6, area: 'Patio', status: 'active', attention_count: 0 },
  ];
}

function mockCanViewOrderActors(restaurantId, user) {
  return user?.memberships?.find((membership) => String(membership.restaurant_id) === String(restaurantId))
    ?.permissions?.includes('audit.view') || false;
}

function serializeMockOrder(order, includeActors) {
  return {
    ...order,
    status_history: order.status_history.map((event) => {
      const { actor, ...visibleEvent } = event;
      return includeActors ? { ...visibleEvent, actor } : visibleEvent;
    }),
  };
}

function mockState(restaurantId, user) {
  const allStates = JSON.parse(localStorage.getItem(mockStorageKey) || '{}');
  const key = String(restaurantId);
  if (!allStates[key]) {
    const membership = user?.memberships?.find((item) => String(item.restaurant_id) === key);
    allStates[key] = {
      restaurant: {
        id: restaurantId,
        name: membership?.restaurant_name || 'My restaurant',
        legal_name: '',
        category: '',
        description: '',
        psgc_code: '',
        street: '',
        latitude: null,
        longitude: null,
        contact_number: '',
        is_24_7: false,
        is_published: false,
        status: 'approved',
      },
      photos: [],
      hours: Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => [day, []])),
      closures: [],
      sensitive_update: null,
      menu: { categories: [], items: [], halal_certificate_available: false },
    };
  }
  const save = () => {
    allStates[key] = state;
    localStorage.setItem(mockStorageKey, JSON.stringify(allStates));
  };
  const state = allStates[key];
  state.menu ||= { categories: [], items: [], halal_certificate_available: false };
  state.menu.halal_certificate_expiry_date ??= null;
  if (!Array.isArray(state.businessOrders)) state.businessOrders = seedBusinessOrders(restaurantId);
  if (!Array.isArray(state.businessReservations)) state.businessReservations = seedBusinessReservations(restaurantId);
  if (!Array.isArray(state.businessTables)) state.businessTables = seedBusinessTables(restaurantId);
  if (!Array.isArray(state.businessDiscounts)) state.businessDiscounts = seedBusinessDiscounts();
  if (!state.reservationSettings) state.reservationSettings = seedReservationSettings();
  return { state, save };
}

function mockChecklist(state) {
  const checks = {
    approved: { label: 'Restaurant is approved', complete: state.restaurant.status === 'approved' },
    pinned_address: {
      label: 'Restaurant address and map pin are set',
      complete: Boolean(
        state.restaurant.psgc_code
        && state.restaurant.street
        && state.restaurant.latitude !== null
        && state.restaurant.longitude !== null,
      ),
    },
    hours: { label: 'Operating hours are set, or restaurant is open 24/7', complete: Boolean(state.restaurant.is_24_7 || Object.values(state.hours).some((shifts) => shifts.length > 0)) },
    category: { label: 'Restaurant category is set', complete: Boolean(state.restaurant.category) },
    orderable_item: {
      label: 'At least one published, orderable menu item exists',
      complete: state.menu.items.some((item) => (
        item.lifecycle_status === 'published'
        && item.is_available
        && item.category_status === 'active'
        && (item.daily_quantity === null || item.quantity_left > 0)
      )),
    },
  };
  return { checks, can_publish: Object.values(checks).every((check) => check.complete) };
}

function manilaToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function hasValidMockHalalCertificate(state) {
  return state.menu.halal_certificate_available
    && (!state.menu.halal_certificate_expiry_date || state.menu.halal_certificate_expiry_date >= manilaToday());
}

function imageBlob(canvas, quality = 0.86) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The image could not be processed.'));
    }, 'image/webp', quality);
  });
}

function drawImage(bitmap, maxWidth, maxHeight, aspectRatio) {
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = bitmap.width;
  let sourceHeight = bitmap.height;
  if (aspectRatio) {
    const sourceRatio = sourceWidth / sourceHeight;
    if (sourceRatio > aspectRatio) {
      sourceWidth = sourceHeight * aspectRatio;
      sourceX = (bitmap.width - sourceWidth) / 2;
    } else {
      sourceHeight = sourceWidth / aspectRatio;
      sourceY = (bitmap.height - sourceHeight) / 2;
    }
  }
  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable in this browser.');
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  return canvas;
}

async function createPhotoVariants(file, kind) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose an image file.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('The selected image could not be opened.');
  }
  const aspectRatio = kind === 'cover' ? 16 / 9 : kind === 'logo' ? 1 : undefined;
  try {
    const variants = [
      ['file', drawImage(bitmap, 1800, 1800, aspectRatio)],
      ['medium', drawImage(bitmap, 960, 960, aspectRatio)],
      ['thumbnail', drawImage(bitmap, 360, 360, aspectRatio)],
    ];
    const files = {};
    for (const [name, canvas] of variants) {
      const blob = await imageBlob(canvas);
      files[name] = new File([blob], `${name}.webp`, { type: 'image/webp' });
    }
    return files;
  } finally {
    bitmap.close();
  }
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(new Error('The image preview could not be created.')));
    reader.readAsDataURL(file);
  });
}

export async function getWorkspace(restaurantId, user) {
  if (!config.useMock) return apiRequest(restaurantPath(restaurantId));
  const { state } = mockState(restaurantId, user);
  return {
    restaurant: {
      ...state.restaurant,
      is_read_only: ['suspended', 'inactive'].includes(state.restaurant.status),
      is_deactivated: state.restaurant.status === 'inactive',
    },
    setup_checklist: [
      { key: 'profile', label: 'Complete restaurant profile', complete: Boolean(state.restaurant.category && state.restaurant.description), href: '/business/profile' },
      { key: 'hours', label: 'Confirm opening hours', complete: Boolean(state.restaurant.is_24_7 || Object.values(state.hours).some((shifts) => shifts.length)), href: '/business/hours' },
      { key: 'menu', label: 'Add and publish menu items', complete: mockChecklist(state).checks.orderable_item.complete, href: '/business/menu' },
      { key: 'tables', label: 'Set up reservation tables', complete: false, href: '/business/reservations?tab=tables' },
      { key: 'publish', label: 'Review publish checklist', complete: Boolean(state.restaurant.is_published), href: '/business/publish' },
    ],
  };
}

export async function getProfile(restaurantId, user) {
  if (!config.useMock) return apiRequest(restaurantPath(restaurantId, '/profile'));
  const { state } = mockState(restaurantId, user);
  return {
    restaurant: { ...state.restaurant },
    hours: { is_24_7: state.restaurant.is_24_7, hours: state.hours },
    closures: state.closures,
    open_now: false,
    pending_sensitive_update: state.sensitive_update,
  };
}

export async function getPreview(restaurantId, user) {
  if (!config.useMock) return apiRequest(restaurantPath(restaurantId, '/preview'));
  const { state } = mockState(restaurantId, user);
  return {
    restaurant: {
      ...state.restaurant,
      logo_url: state.photos.find((photo) => photo.kind === 'logo')?.url || null,
      cover_url: state.photos.find((photo) => photo.kind === 'cover')?.url || null,
      photos: state.photos.filter((photo) => photo.kind === 'gallery'),
      open_now: false,
    },
    hours: { is_24_7: state.restaurant.is_24_7, hours: state.hours },
  };
}

export async function updateProfile(restaurantId, data, user) {
  if (!config.useMock) {
    return apiRequest(restaurantPath(restaurantId, '/profile'), { method: 'PATCH', body: data });
  }
  const { state, save } = mockState(restaurantId, user);
  state.restaurant = { ...state.restaurant, ...data };
  save();
  return { ...state.restaurant };
}

export async function proposeSensitiveUpdate(restaurantId, changes, permitFiles, user, permitExpiryDate) {
  if (!config.useMock) {
    const form = new FormData();
    Object.entries(changes).forEach(([key, value]) => form.append(`proposed_changes[${key}]`, value));
    Array.from(permitFiles || []).forEach((file, index) => form.append(`permit_files[${index}]`, file));
    if (permitExpiryDate) form.append('permit_expiry_date', permitExpiryDate);
    form.append('_method', 'PATCH');
    return apiUploadRequest(restaurantPath(restaurantId, '/sensitive-profile'), form);
  }
  const { state, save } = mockState(restaurantId, user);
  state.sensitive_update = { status: 'pending', proposed_changes: { ...changes } };
  save();
  return state.sensitive_update;
}

export async function getPhotos(restaurantId, user) {
  if (!config.useMock) return apiRequest(restaurantPath(restaurantId, '/photos'));
  const { state } = mockState(restaurantId, user);
  return {
    logo_url: state.photos.find((photo) => photo.kind === 'logo')?.url || null,
    cover_url: state.photos.find((photo) => photo.kind === 'cover')?.url || null,
    photos: state.photos.filter((photo) => photo.kind === 'gallery'),
  };
}

export async function uploadPhoto(restaurantId, file, kind, altText, user, onProgress) {
  const variants = await createPhotoVariants(file, kind);
  if (!config.useMock) {
    const form = new FormData();
    form.append('kind', kind);
    form.append('alt_text', altText || '');
    Object.entries(variants).forEach(([name, image]) => form.append(name, image));
    return apiUploadRequest(restaurantPath(restaurantId, '/photos'), form, { onProgress });
  }
  const { state, save } = mockState(restaurantId, user);
  const photo = {
    id: `mock-${Date.now()}`,
    kind,
    alt_text: altText || '',
    url: await fileAsDataUrl(variants.file),
    sort_order: state.photos.length,
    is_published: true,
  };
  if (kind !== 'gallery') state.photos = state.photos.filter((item) => item.kind !== kind);
  state.photos.push(photo);
  save();
  onProgress?.(100);
  return photo;
}

export async function updatePhoto(restaurantId, photoId, data, user) {
  if (!config.useMock) {
    return apiRequest(restaurantPath(restaurantId, `/photos/${encodeURIComponent(photoId)}`), {
      method: 'PATCH',
      body: data,
    });
  }
  const { state, save } = mockState(restaurantId, user);
  const photo = state.photos.find((item) => String(item.id) === String(photoId));
  if (!photo) throw new Error('Photo not found.');
  Object.assign(photo, data);
  save();
  return photo;
}

export async function deletePhoto(restaurantId, photoId, user) {
  if (!config.useMock) {
    return apiRequest(restaurantPath(restaurantId, `/photos/${encodeURIComponent(photoId)}`), { method: 'DELETE' });
  }
  const { state, save } = mockState(restaurantId, user);
  state.photos = state.photos.filter((item) => (
    photoId === 'logo' || photoId === 'cover'
      ? item.kind !== photoId
      : String(item.id) !== String(photoId)
  ));
  save();
  return null;
}

export async function getHours(restaurantId, user) {
  if (!config.useMock) return apiRequest(restaurantPath(restaurantId, '/hours'));
  const { state } = mockState(restaurantId, user);
  return { is_24_7: state.restaurant.is_24_7, hours: state.hours };
}

export async function updateHours(restaurantId, data, user) {
  if (!config.useMock) return apiRequest(restaurantPath(restaurantId, '/hours'), { method: 'PUT', body: data });
  const { state, save } = mockState(restaurantId, user);
  state.restaurant.is_24_7 = Boolean(data.is_24_7);
  state.hours = Object.fromEntries(weekDays.map((day) => [
    day,
    Array.isArray(data.hours?.[day]) ? data.hours[day] : [],
  ]));
  save();
  return { hours: state.hours, is_24_7: state.restaurant.is_24_7 };
}

export async function getClosures(restaurantId, from, to, user) {
  if (!config.useMock) {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const suffix = query.toString();
    return apiRequest(restaurantPath(restaurantId, `/closures${suffix ? `?${suffix}` : ''}`));
  }
  return mockState(restaurantId, user).state.closures;
}

export async function createClosure(restaurantId, data, user) {
  if (!config.useMock) return apiRequest(restaurantPath(restaurantId, '/closures'), { method: 'POST', body: data });
  const { state, save } = mockState(restaurantId, user);
  const closure = { ...data, id: `mock-${Date.now()}` };
  state.closures.push(closure);
  save();
  return closure;
}

export async function deleteClosure(restaurantId, closureId, user) {
  if (!config.useMock) {
    return apiRequest(restaurantPath(restaurantId, `/closures/${encodeURIComponent(closureId)}`), { method: 'DELETE' });
  }
  const { state, save } = mockState(restaurantId, user);
  state.closures = state.closures.filter((closure) => String(closure.id) !== String(closureId));
  save();
  return null;
}

export async function updatePublication(restaurantId, published, user) {
  const endpoint = published ? '/publish' : '/unpublish';
  if (!config.useMock) return apiRequest(restaurantPath(restaurantId, endpoint), { method: 'POST' });
  const { state, save } = mockState(restaurantId, user);
  const checklist = mockChecklist(state);
  if (published && !checklist.can_publish) throw new Error('Publishing is blocked until every checklist item is complete.');
  state.restaurant.is_published = published;
  save();
  return { is_published: published, checklist };
}

export async function setRestaurantClosed(restaurantId, closed, reason, user) {
  if (!config.useMock) {
    return apiRequest(restaurantPath(restaurantId, '/close'), {
      method: 'POST',
      body: { closed, ...(closed ? { reason } : {}) },
    });
  }
  const { state, save } = mockState(restaurantId, user);
  state.restaurant.status = closed ? 'closed' : 'approved';
  save();
  return { status: state.restaurant.status };
}

export async function deactivateRestaurant(restaurantId, user) {
  if (!config.useMock) {
    return apiRequest(restaurantPath(restaurantId, '/deactivate'), { method: 'POST' });
  }
  const permissions = user?.memberships?.find((membership) => String(membership.restaurant_id) === String(restaurantId))
    ?.permissions || [];
  if (!permissions.includes('restaurant.publish')) throw new Error('Only the Owner can deactivate this business.');
  const { state, save } = mockState(restaurantId, user);
  if (state.restaurant.status === 'suspended') {
    throw new Error('A suspended restaurant can only be resolved by an administrator.');
  }
  const before = { status: state.restaurant.status, is_published: state.restaurant.is_published };
  state.restaurant.status = 'inactive';
  state.restaurant.is_published = false;
  save();
  recordBusinessAudit(restaurantId, user, 'restaurant.deactivated', before, {
    status: 'inactive',
    is_published: false,
  });
  return { status: 'inactive', is_published: false };
}

export async function reactivateRestaurant(restaurantId, user) {
  if (!config.useMock) {
    return apiRequest(restaurantPath(restaurantId, '/reactivate'), { method: 'POST' });
  }
  const permissions = user?.memberships?.find((membership) => String(membership.restaurant_id) === String(restaurantId))
    ?.permissions || [];
  if (!permissions.includes('restaurant.publish')) throw new Error('Only the Owner can reactivate this business.');
  const { state, save } = mockState(restaurantId, user);
  if (state.restaurant.status !== 'inactive') {
    throw new Error('Only a business deactivated by its Owner can be reactivated here.');
  }
  const before = { status: state.restaurant.status, is_published: state.restaurant.is_published };
  state.restaurant.status = 'approved';
  state.restaurant.is_published = false;
  save();
  recordBusinessAudit(restaurantId, user, 'restaurant.reactivated', before, {
    status: 'approved',
    is_published: false,
  });
  return { status: 'approved', is_published: false };
}

export async function getPublicationChecklist(restaurantId, user) {
  if (!config.useMock) return apiRequest(restaurantPath(restaurantId, '/publish-checklist'));
  const { state } = mockState(restaurantId, user);
  return mockChecklist(state);
}

function mockMenuItem(category, data, id = `mock-${Date.now()}-${Math.random()}`) {
  const quantity = data.daily_quantity ?? null;
  return {
    id: String(id),
    category_id: String(category.id),
    category_name: category.name,
    category_status: category.status,
    name: data.name,
    description: data.description || '',
    price: Number(data.price).toFixed(2),
    image_url: data.image_url || null,
    lifecycle_status: data.lifecycle_status || 'draft',
    is_available: data.is_available ?? true,
    daily_quantity: quantity,
    quantity_left: quantity,
    prep_minutes: data.prep_minutes || null,
    is_orderable: (data.lifecycle_status || 'draft') === 'published'
      && (data.is_available ?? true)
      && category.status === 'active'
      && (quantity === null || quantity > 0),
    dietary_tags: (data.dietary_tag_ids || []).map((tagId) => mockDietaryTags.find((tag) => tag.id === String(tagId))).filter(Boolean),
  };
}

const mockDietaryTags = [
  ['1', 'contains_pork', 'dietary'],
  ['2', 'halal_certified', 'dietary'],
  ['3', 'vegetarian', 'dietary'],
  ['4', 'vegan', 'dietary'],
  ['5', 'contains_peanuts', 'allergen'],
  ['6', 'contains_tree_nuts', 'allergen'],
  ['7', 'contains_dairy', 'allergen'],
  ['8', 'contains_eggs', 'allergen'],
  ['9', 'contains_soy', 'allergen'],
  ['10', 'contains_wheat', 'allergen'],
  ['11', 'contains_shellfish', 'allergen'],
  ['12', 'contains_fish', 'allergen'],
  ['13', 'contains_sesame', 'allergen'],
].map(([id, name, tag_type]) => ({ id, name, tag_type }));

export async function getMenu(restaurantId, filters = {}, user) {
  if (!config.useMock) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined));
    const suffix = query.toString();
    return apiRequest(menuPath(restaurantId, suffix ? `?${suffix}` : ''));
  }
  const { state } = mockState(restaurantId, user);
  const items = state.menu.items.filter((item) => (
    (!filters.status || item.lifecycle_status === filters.status)
    && (!filters.category_id || String(item.category_id) === String(filters.category_id))
    && (!filters.search || `${item.name} ${item.description}`.toLowerCase().includes(filters.search.toLowerCase()))
    && (filters.status === 'archived' || item.category_status === 'active')
  ));
  return {
    categories: [...state.menu.categories]
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((category) => ({
        ...category,
        item_count: state.menu.items.filter((item) => String(item.category_id) === String(category.id)).length,
      })),
    items,
    dietary_tags: mockDietaryTags,
    halal_certificate_available: state.menu.halal_certificate_available,
  };
}

export async function createMenuCategory(restaurantId, data, user) {
  if (!config.useMock) return apiRequest(menuPath(restaurantId, '/categories'), { method: 'POST', body: data });
  const { state, save } = mockState(restaurantId, user);
  const name = data.name.trim();
  if (state.menu.categories.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Category names must be unique within this restaurant.');
  }
  const category = { id: `mock-${Date.now()}-${Math.random()}`, name, sort_order: data.sort_order || 0, status: 'active' };
  state.menu.categories.push(category);
  save();
  return { category };
}

export async function updateMenuCategory(restaurantId, categoryId, data, user) {
  if (!config.useMock) {
    return apiRequest(menuPath(restaurantId, `/categories/${encodeURIComponent(categoryId)}`), { method: 'PATCH', body: data });
  }
  const { state, save } = mockState(restaurantId, user);
  const category = state.menu.categories.find((entry) => String(entry.id) === String(categoryId));
  if (!category) throw new Error('Menu category not found.');
  if (data.name && state.menu.categories.some((entry) => (
    String(entry.id) !== String(categoryId)
    && entry.name.toLowerCase() === data.name.trim().toLowerCase()
  ))) throw new Error('Category names must be unique within this restaurant.');
  if (data.status === 'archived' && state.menu.items.some((item) => String(item.category_id) === String(categoryId) && item.lifecycle_status === 'published')) {
    throw new Error('Archive or move all published items before archiving this category.');
  }
  Object.assign(category, data);
  state.menu.items.forEach((item) => {
    if (String(item.category_id) === String(categoryId)) {
      item.category_name = category.name;
      item.category_status = category.status;
      item.is_orderable = item.lifecycle_status === 'published' && item.is_available && category.status === 'active' && (item.daily_quantity === null || item.quantity_left > 0);
    }
  });
  save();
  return { category };
}

export async function archiveMenuCategory(restaurantId, categoryId, user) {
  if (!config.useMock) {
    return apiRequest(menuPath(restaurantId, `/categories/${encodeURIComponent(categoryId)}`), { method: 'DELETE' });
  }
  await updateMenuCategory(restaurantId, categoryId, { status: 'archived' }, user);
  return null;
}

export async function createMenuItem(restaurantId, data, user, photo) {
  if (!photo) throw new Error('Please upload a photo for this menu item.');
  if (!config.useMock) {
    const form = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((entry, index) => form.append(`${key}[${index}]`, String(entry)));
      } else {
        form.append(key, String(value));
      }
    });
    form.append('file', photo);
    return apiUploadRequest(menuPath(restaurantId, '/items'), form);
  }
  const { state, save } = mockState(restaurantId, user);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 2 * 1024 * 1024) {
    throw new Error('Choose a JPG, PNG, or WebP image no larger than 2 MB.');
  }
  if (!Number.isFinite(Number(data.price)) || Number(data.price) <= 0) throw new Error('Price must be greater than zero.');
  const category = state.menu.categories.find((entry) => String(entry.id) === String(data.category_id) && entry.status === 'active');
  if (!category) throw new Error('Choose an active category in this restaurant.');
  if (data.dietary_tag_ids?.some((id) => String(id) === '2') && !hasValidMockHalalCertificate(state)) {
    throw new Error('Upload a valid Halal certificate before assigning the Halal-certified tag.');
  }
  const item = mockMenuItem(category, data);
  item.image_url = await fileAsDataUrl(photo);
  item.dietary_tags = (data.dietary_tag_ids || []).map((tagId) => mockDietaryTags.find((tag) => tag.id === String(tagId))).filter(Boolean);
  state.menu.items.push(item);
  save();
  return { item };
}

export async function updateMenuItem(restaurantId, itemId, data, user) {
  if (!config.useMock) {
    return apiRequest(menuPath(restaurantId, `/items/${encodeURIComponent(itemId)}`), { method: 'PATCH', body: data });
  }
  const { state, save } = mockState(restaurantId, user);
  const item = state.menu.items.find((entry) => String(entry.id) === String(itemId));
  if (!item || item.lifecycle_status === 'archived') throw new Error('This menu item cannot be edited.');
  if (data.price !== undefined && (!Number.isFinite(Number(data.price)) || Number(data.price) <= 0)) {
    throw new Error('Price must be greater than zero.');
  }
  if (data.price !== undefined && Number(data.price).toFixed(2) !== Number(item.price).toFixed(2) && !data.price_change_acknowledged) {
    throw new Error('Confirm the price-change warning before saving this update.');
  }
  const category = state.menu.categories.find((entry) => String(entry.id) === String(data.category_id ?? item.category_id) && entry.status === 'active');
  if (!category) throw new Error('Choose an active category in this restaurant.');
  const tags = data.dietary_tag_ids ?? item.dietary_tags.map((tag) => tag.id);
  if (tags.some((id) => String(id) === '2') && !hasValidMockHalalCertificate(state)) {
    throw new Error('Upload a valid Halal certificate before assigning the Halal-certified tag.');
  }
  const previousQuantityLeft = item.quantity_left;
  const nextQuantity = data.daily_quantity === '' ? null : data.daily_quantity;
  const resetQuantity = Object.hasOwn(data, 'daily_quantity')
    && (nextQuantity === null ? item.daily_quantity !== null : Number(nextQuantity) !== Number(item.daily_quantity));
  const quantityToPreserve = item.daily_quantity;
  const updateData = { ...data, daily_quantity: resetQuantity ? nextQuantity : quantityToPreserve };
  Object.assign(item, mockMenuItem(category, { ...item, ...updateData, dietary_tag_ids: tags }, item.id));
  item.dietary_tags = tags.map((tagId) => mockDietaryTags.find((tag) => tag.id === String(tagId))).filter(Boolean);
  item.price = Number(data.price ?? item.price).toFixed(2);
  if (!resetQuantity) item.quantity_left = previousQuantityLeft;
  item.is_orderable = item.lifecycle_status === 'published'
    && item.is_available
    && item.category_status === 'active'
    && (item.daily_quantity === null || item.quantity_left > 0);
  save();
  return { item };
}

export async function archiveMenuItem(restaurantId, itemId, user) {
  if (!config.useMock) {
    return apiRequest(menuPath(restaurantId, `/items/${encodeURIComponent(itemId)}`), { method: 'DELETE' });
  }
  const { state, save } = mockState(restaurantId, user);
  const item = state.menu.items.find((entry) => String(entry.id) === String(itemId));
  if (!item) throw new Error('Menu item not found.');
  item.lifecycle_status = 'archived';
  item.is_orderable = false;
  save();
  return null;
}

export async function publishMenuItems(restaurantId, itemIds, user) {
  if (!config.useMock) return apiRequest(menuPath(restaurantId, '/items/bulk-publish'), { method: 'POST', body: { item_ids: itemIds } });
  const { state, save } = mockState(restaurantId, user);
  const items = [];
  const failures = [];
  itemIds.forEach((itemId) => {
    const item = state.menu.items.find((entry) => String(entry.id) === String(itemId));
    if (!item || item.lifecycle_status === 'archived' || item.category_status !== 'active') {
      failures.push({ item_id: String(itemId), message: 'Item is unavailable or its category is archived.' });
    } else if (item.dietary_tags.some((tag) => tag.name === 'halal_certified') && !hasValidMockHalalCertificate(state)) {
      failures.push({ item_id: String(itemId), message: 'Upload a valid Halal certificate before publishing this item.' });
    } else {
      item.lifecycle_status = 'published';
      item.is_orderable = item.is_available && (item.daily_quantity === null || item.quantity_left > 0);
      items.push(item);
    }
  });
  save();
  return { items, failures };
}

export async function updateMenuAvailability(restaurantId, itemId, isAvailable, user) {
  if (!config.useMock) {
    return apiRequest(menuPath(restaurantId, `/items/${encodeURIComponent(itemId)}/availability`), {
      method: 'PATCH',
      body: { is_available: isAvailable },
    });
  }
  const { state, save } = mockState(restaurantId, user);
  const item = state.menu.items.find((entry) => String(entry.id) === String(itemId));
  if (!item || item.lifecycle_status === 'archived') throw new Error('Archived items cannot change availability.');
  item.is_available = isAvailable;
  item.is_orderable = item.lifecycle_status === 'published' && item.is_available && item.category_status === 'active' && (item.daily_quantity === null || item.quantity_left > 0);
  save();
  return { item };
}

export async function uploadMenuPhoto(restaurantId, itemId, file, user) {
  if (!config.useMock) {
    const form = new FormData();
    form.append('file', file);
    return apiUploadRequest(menuPath(restaurantId, `/items/${encodeURIComponent(itemId)}/photo`), form);
  }
  const { state, save } = mockState(restaurantId, user);
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    throw new Error('Choose a JPG, PNG, or WebP image no larger than 2 MB.');
  }
  const item = state.menu.items.find((entry) => String(entry.id) === String(itemId));
  if (!item) throw new Error('Menu item not found.');
  item.image_url = await fileAsDataUrl(file);
  save();
  return { item };
}

export async function uploadHalalCertificate(restaurantId, file, expiryDate, user) {
  if (!config.useMock) {
    const form = new FormData();
    form.append('file', file);
    if (expiryDate) form.append('expiry_date', expiryDate);
    return apiUploadRequest(menuPath(restaurantId, '/halal-certificate'), form);
  }
  const { state, save } = mockState(restaurantId, user);
  if (!file || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    throw new Error('Choose a PDF, JPG, PNG, or WebP certificate no larger than 2 MB.');
  }
  const today = manilaToday();
  if (expiryDate && expiryDate < today) throw new Error('The certificate expiry date must be today or later.');
  state.menu.halal_certificate_available = true;
  state.menu.halal_certificate_expiry_date = expiryDate || null;
  save();
  return { halal_certificate_available: hasValidMockHalalCertificate(state) };
}

export async function getBusinessOrders(restaurantId, filters = {}, user) {
  if (!config.useMock) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined));
    const suffix = query.toString();
    return apiRequest(ordersPath(restaurantId, suffix ? `?${suffix}` : ''), { preserveEnvelope: true });
  }
  const { state, save } = mockState(restaurantId, user);
  save();
  const includeActors = mockCanViewOrderActors(restaurantId, user);
  const matched = state.businessOrders.filter((order) => (
    (!filters.status || order.status === filters.status)
    && (!filters.from || order.placed_at.slice(0, 10) >= filters.from)
    && (!filters.to || order.placed_at.slice(0, 10) <= filters.to)
    && (!filters.search || `${order.reference_code} ${order.recipient.name}`.toLowerCase().includes(filters.search.toLowerCase()))
  ));
  const perPage = Math.min(100, Math.max(1, Number(filters.per_page) || 15));
  const page = Math.max(1, Number(filters.page) || 1);
  return {
    data: matched.slice((page - 1) * perPage, page * perPage).map((order) => serializeMockOrder(order, includeActors)),
    meta: {
      current_page: page,
      per_page: perPage,
      total: matched.length,
      last_page: Math.max(1, Math.ceil(matched.length / perPage)),
    },
  };
}

export async function getBusinessOrder(restaurantId, orderId, user) {
  if (!config.useMock) {
    return apiRequest(ordersPath(restaurantId, `/${encodeURIComponent(orderId)}`));
  }
  const { state } = mockState(restaurantId, user);
  const order = state.businessOrders.find((entry) => String(entry.id) === String(orderId));
  if (!order) throw new Error('Order not found.');
  return serializeMockOrder(order, mockCanViewOrderActors(restaurantId, user));
}

export async function updateBusinessOrderStatus(restaurantId, orderId, status, reason, user) {
  if (!config.useMock) {
    return apiRequest(ordersPath(restaurantId, `/${encodeURIComponent(orderId)}/status`), {
      method: 'PATCH',
      body: { status, ...(reason ? { reason } : {}) },
    });
  }
  const { state, save } = mockState(restaurantId, user);
  const permissions = user?.memberships?.find((membership) => String(membership.restaurant_id) === String(restaurantId))
    ?.permissions || [];
  if (!permissions.includes('orders.status.update')) throw new Error('You do not have permission to update order status.');
  if (['rejected', 'cancelled'].includes(status) && !permissions.includes('orders.cancel')) {
    throw new Error('You do not have permission to reject or cancel orders.');
  }
  const order = state.businessOrders.find((entry) => String(entry.id) === String(orderId));
  if (!order) throw new Error('Order not found.');
  const allowedTransitions = {
    placed: ['confirmed', 'rejected'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed', 'cancelled'],
  };
  if (!allowedTransitions[order.status]?.includes(status)) {
    throw new Error('This order cannot move from its current status to the requested status.');
  }
  if (status === 'completed' && order.order_type !== 'pick_up') {
    throw new Error('Only a Pick-up order can be completed by the restaurant.');
  }
  if (['rejected', 'cancelled'].includes(status) && !reason?.trim()) {
    throw new Error('A reason is required to reject or cancel an order.');
  }
  const previous = order.status;
  order.status = status;
  order.cancel_reason = ['rejected', 'cancelled'].includes(status) ? reason.trim() : null;
  order.status_history.push({
    from_status: previous,
    to_status: status,
    reason: reason?.trim() || null,
    changed_at: new Date().toISOString(),
    actor: { id: String(user?.id || 'demo-user'), name: user?.name || 'Demo user' },
  });
  save();
  return serializeMockOrder(order, mockCanViewOrderActors(restaurantId, user));
}

export async function getBusinessReservations(restaurantId, user, filters = {}) {
  if (!config.useMock) {
    const query = new URLSearchParams(Object.entries(filters)
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]));
    const [reservationResult, tables, settings] = await Promise.all([
      apiRequest(`${reservationsPath(restaurantId)}${query.size ? `?${query}` : ''}`, { preserveEnvelope: true }),
      apiRequest(tablesPath(restaurantId)),
      apiRequest(restaurantPath(restaurantId, '/reservation-settings')),
    ]);
    return {
      reservations: reservationResult.data || [],
      meta: reservationResult.meta,
      tables: Array.isArray(tables) ? tables : tables.data || [],
      settings,
    };
  }
  const { state, save } = mockState(restaurantId, user);
  save();
  let reservations = [...state.businessReservations];
  if (filters.status) reservations = reservations.filter((item) => item.status === filters.status);
  if (filters.from) reservations = reservations.filter((item) => new Date(item.start_at) >= new Date(filters.from));
  if (filters.to) reservations = reservations.filter((item) => new Date(item.start_at) < new Date(filters.to));
  if (filters.table_id) reservations = reservations.filter((item) => String(item.table_id) === String(filters.table_id));
  if (filters.needs_attention) {
    const tableIds = state.businessTables.filter((table) => table.status !== 'active').map((table) => String(table.id));
    reservations = reservations.filter((item) => (
      ['pending', 'confirmed'].includes(item.status)
      && new Date(item.start_at) > new Date()
      && tableIds.includes(String(item.table_id))
    ));
  }
  reservations.sort((a, b) => a.start_at.localeCompare(b.start_at));
  const updatedTables = state.businessTables.map((table) => ({
    ...table,
    attention_count: table.status === 'active' ? 0 : reservations.filter((reservation) => (
      String(reservation.table_id) === String(table.id)
      && activeReservationsForMock(reservation)
      && new Date(reservation.start_at) > new Date()
    )).length,
  }));
  return {
    reservations,
    tables: updatedTables,
    settings: { ...state.reservationSettings },
    meta: { current_page: 1, per_page: reservations.length, total: reservations.length, last_page: 1 },
  };
}

export async function updateBusinessReservationStatus(restaurantId, reservationId, status, reason, user) {
  if (!config.useMock) {
    return apiRequest(reservationsPath(restaurantId, `/${encodeURIComponent(reservationId)}/status`), {
      method: 'PATCH',
      body: { status, ...(reason ? { reason } : {}) },
    });
  }
  const permissions = user?.memberships?.find((membership) => String(membership.restaurant_id) === String(restaurantId))
    ?.permissions || [];
  if (!permissions.includes('reservations.manage')) throw new Error('You do not have permission to manage reservations.');
  const { state, save } = mockState(restaurantId, user);
  const reservation = state.businessReservations.find((item) => String(item.id) === String(reservationId));
  if (!reservation) throw new Error('Reservation not found.');
  const allowedTransitions = {
    pending: ['confirmed', 'declined', 'cancelled'],
    confirmed: ['completed', 'cancelled', 'no_show'],
  };
  if (!allowedTransitions[reservation.status]?.includes(status)) {
    throw new Error('This reservation cannot move from its current status to the requested status.');
  }
  if (['declined', 'cancelled'].includes(status) && !reason?.trim()) {
    throw new Error('A reason is required to decline or cancel a reservation.');
  }
  if (status === 'no_show' && Date.now() < new Date(reservation.start_at).getTime() + state.reservationSettings.grace_minutes * 60_000) {
    throw new Error('The reservation grace period has not elapsed.');
  }
  reservation.status = status;
  reservation.response_reason = status === 'declined' ? reason.trim() : reservation.response_reason || null;
  reservation.cancel_reason = status === 'cancelled' ? reason.trim() : reservation.cancel_reason || null;
  reservation.updated_at = new Date().toISOString();
  save();
  return reservation;
}

export async function saveBusinessTable(restaurantId, table, user) {
  if (!config.useMock) {
    const data = {
      table_number: String(table.table_number).trim(),
      capacity: Number(table.capacity),
      area: table.area?.trim() || null,
      status: table.status || 'active',
    };
    return apiRequest(tablesPath(restaurantId, table.id ? `/${encodeURIComponent(table.id)}` : ''), {
      method: table.id ? 'PATCH' : 'POST',
      body: data,
    });
  }
  const permissions = user?.memberships?.find((membership) => String(membership.restaurant_id) === String(restaurantId))
    ?.permissions || [];
  if (!permissions.includes('tables.manage')) throw new Error('You do not have permission to manage tables.');
  const { state, save } = mockState(restaurantId, user);
  if (table.id) {
    const existing = state.businessTables.find((item) => String(item.id) === String(table.id));
    if (!existing) throw new Error('Table not found.');
    const previousStatus = existing.status;
    const previousCapacity = Number(existing.capacity);
    Object.assign(existing, {
      table_number: String(table.table_number).trim(),
      area: table.area?.trim() || null,
      capacity: Number(table.capacity),
      status: table.status,
    });
    save();
    const affectedReservations = state.businessReservations.filter((reservation) => (
      String(reservation.table_id) === String(existing.id)
      && activeReservationsForMock(reservation)
      && new Date(reservation.start_at) > new Date()
      && (
        (existing.status !== 'active' && previousStatus === 'active')
        || (Number(existing.capacity) < previousCapacity && Number(reservation.guest_count) > Number(existing.capacity))
      )
    )).length;
    return { ...existing, affected_reservations: affectedReservations };
  }
  const created = {
    id: `demo-${restaurantId}-table-${Date.now()}`,
    table_number: String(table.table_number).trim(),
    area: table.area?.trim() || null,
    capacity: Number(table.capacity),
    status: 'active',
  };
  state.businessTables.push(created);
  save();
  return created;
}

export async function deleteBusinessTable(restaurantId, tableId, user) {
  if (!config.useMock) {
    return apiRequest(tablesPath(restaurantId, `/${encodeURIComponent(tableId)}`), { method: 'DELETE' });
  }
  const permissions = user?.memberships?.find((membership) => String(membership.restaurant_id) === String(restaurantId))
    ?.permissions || [];
  if (!permissions.includes('tables.manage')) throw new Error('You do not have permission to manage tables.');
  const { state, save } = mockState(restaurantId, user);
  if (state.businessReservations.some((reservation) => String(reservation.table_id) === String(tableId))) {
    throw new Error('Tables with reservation history cannot be deleted. Set the table to Inactive instead.');
  }
  state.businessTables = state.businessTables.filter((table) => String(table.id) !== String(tableId));
  save();
}

export async function updateBusinessReservationSettings(restaurantId, settings, user) {
  if (!config.useMock) {
    return apiRequest(restaurantPath(restaurantId, '/reservation-settings'), {
      method: 'PUT',
      body: settings,
    });
  }
  const permissions = user?.memberships?.find((membership) => String(membership.restaurant_id) === String(restaurantId))
    ?.permissions || [];
  if (!permissions.includes('reservations.manage')) throw new Error('You do not have permission to manage reservation settings.');
  const { state, save } = mockState(restaurantId, user);
  state.reservationSettings = { ...settings, is_configured: true };
  save();
  return { ...state.reservationSettings };
}

export async function rescheduleBusinessReservation(restaurantId, reservationId, data, user) {
  if (!config.useMock) {
    return apiRequest(reservationsPath(restaurantId, `/${encodeURIComponent(reservationId)}/reschedule`), {
      method: 'POST',
      body: data,
    });
  }
  const permissions = user?.memberships?.find((membership) => String(membership.restaurant_id) === String(restaurantId))
    ?.permissions || [];
  if (!permissions.includes('reservations.manage')) throw new Error('You do not have permission to manage reservations.');
  const { state, save } = mockState(restaurantId, user);
  const reservation = state.businessReservations.find((item) => String(item.id) === String(reservationId));
  if (!reservation) throw new Error('Reservation not found.');
  if (!['pending', 'confirmed'].includes(reservation.status)) {
    throw new Error('Only Pending or Confirmed reservations can be rescheduled.');
  }
  const start = new Date(data.start_at);
  if (Number.isNaN(start.getTime()) || start <= new Date()) throw new Error('Choose a future reservation time.');
  const duration = Number(data.duration_minutes || reservation.duration_minutes);
  const end = new Date(start.getTime() + duration * 60_000);
  const settings = state.reservationSettings;
  if (!settings.accepts_reservations) throw new Error('This restaurant is not accepting reservations.');
  if (Number(reservation.guest_count) > Number(settings.max_party_size)) throw new Error('The party exceeds this restaurant’s reservation limit.');
  if (start < new Date(Date.now() + Number(settings.min_lead_hours) * 3_600_000)) throw new Error('Choose a time that meets the minimum lead time.');
  const latest = new Date();
  latest.setMonth(latest.getMonth() + Number(settings.max_months_ahead));
  if (start > latest) throw new Error('Reservations are not available that far in advance.');
  const candidates = state.businessTables
    .filter((table) => table.status === 'active' && Number(table.capacity) >= Number(reservation.guest_count))
    .filter((table) => !data.table_id || String(table.id) === String(data.table_id))
    .sort((left, right) => Number(left.capacity) - Number(right.capacity));
  const table = candidates.find((candidate) => !state.businessReservations.some((other) => {
    if (String(other.id) === String(reservation.id) || String(other.table_id) !== String(candidate.id) || !activeReservationsForMock(other)) return false;
    const otherStart = new Date(other.start_at);
    const otherEnd = new Date(other.end_at || (otherStart.getTime() + Number(other.duration_minutes) * 60_000));
    return otherStart < end && otherEnd > start;
  }));
  if (!table) throw new Error('No suitable table is available for that time.');
  reservation.start_at = start.toISOString();
  reservation.duration_minutes = duration;
  reservation.end_at = end.toISOString();
  reservation.table_id = String(table.id);
  save();
  return { ...reservation };
}

function activeReservationsForMock(reservation) {
  return ['pending', 'confirmed'].includes(reservation.status)
    && (reservation.status !== 'pending' || !reservation.expires_at || new Date(reservation.expires_at) > new Date());
}

function membershipPermissions(restaurantId, user) {
  return user?.memberships?.find((membership) => String(membership.restaurant_id) === String(restaurantId))
    ?.permissions || [];
}

function assertBusinessPermission(restaurantId, user, permission) {
  if (!membershipPermissions(restaurantId, user).includes(permission)) {
    throw new Error('You do not have permission to access this business resource.');
  }
}

function mockReport(restaurantId, report, from, to, user) {
  const { state } = mockState(restaurantId, user);
  const orders = state.businessOrders.filter((order) => (
    order.placed_at.slice(0, 10) >= from && order.placed_at.slice(0, 10) <= to
  ));
  const reservations = state.businessReservations.filter((reservation) => (
    reservation.start_at.slice(0, 10) >= from && reservation.start_at.slice(0, 10) <= to
  ));
  if (report === 'sales_summary') {
    const completed = orders.filter((order) => order.status === 'completed');
    const series = orders.reduce((days, order) => {
      const date = order.placed_at.slice(0, 10);
      days[date] ||= { date, orders: 0, completed_orders: 0, sales: 0 };
      days[date].orders += 1;
      if (order.status === 'completed') {
        days[date].completed_orders += 1;
        days[date].sales += Number(order.totals.total);
      }
      return days;
    }, {});
    const rows = Object.values(series).sort((a, b) => a.date.localeCompare(b.date));
    return {
      report,
      summary: {
        orders: orders.length,
        completed_orders: completed.length,
        cancelled_orders: orders.filter((order) => ['cancelled', 'rejected', 'delivery_failed'].includes(order.status)).length,
        sales: completed.reduce((sum, order) => sum + Number(order.totals.total), 0),
        discounts: completed.reduce((sum, order) => sum + Number(order.totals.discount_amount || 0), 0),
      },
      columns: ['date', 'orders', 'completed_orders', 'sales'],
      rows,
      series: rows,
    };
  }
  if (report === 'orders_by_status') {
    const rows = Object.entries(orders.reduce((counts, order) => {
      counts[order.status] ||= { status: order.status, orders: 0, order_value: 0 };
      counts[order.status].orders += 1;
      counts[order.status].order_value += Number(order.totals.total || 0);
      return counts;
    }, {})).map(([, row]) => row);
    return { report, summary: { orders: orders.length }, columns: ['status', 'orders', 'order_value'], rows, series: rows };
  }
  if (report === 'popular_items') {
    const items = orders.filter((order) => order.status === 'completed').flatMap((order) => order.items);
    const rows = Object.values(items.reduce((counts, item) => {
      counts[item.name] ||= { item: item.name, quantity: 0, order_lines: 0, sales: 0 };
      counts[item.name].quantity += Number(item.quantity);
      counts[item.name].order_lines += 1;
      counts[item.name].sales += Number(item.line_total);
      return counts;
    }, {})).sort((a, b) => b.quantity - a.quantity);
    return { report, summary: { items_sold: rows.reduce((sum, row) => sum + row.quantity, 0) }, columns: ['item', 'quantity', 'order_lines', 'sales'], rows, series: rows };
  }
  if (report === 'discount_usage') {
    const rows = state.businessDiscounts.map((discount) => ({
      code: discount.code,
      name: discount.name,
      type: discount.type,
      uses: Number(discount.usage_count || 0),
      amount_applied: 0,
    }));
    return {
      report,
      summary: { uses: rows.reduce((sum, row) => sum + row.uses, 0), amount_applied: 0 },
      columns: ['code', 'name', 'type', 'uses', 'amount_applied'],
      rows,
      series: rows,
    };
  }
  const counts = reservations.reduce((result, reservation) => {
    result[reservation.status] = (result[reservation.status] || 0) + 1;
    return result;
  }, {});
  if (report === 'reservations') {
    const rows = Object.entries(counts).map(([status, count]) => ({ status, reservations: count }));
    return { report, summary: { reservations: reservations.length }, columns: ['status', 'reservations'], rows, series: rows };
  }
  const completed = counts.completed || 0;
  const noShows = counts.no_show || 0;
  const eligible = completed + noShows;
  const rows = [{ status: 'completed', reservations: completed }, { status: 'no_show', reservations: noShows }];
  return {
    report,
    summary: { eligible_reservations: eligible, no_shows: noShows, no_show_rate_percent: eligible ? (noShows / eligible) * 100 : 0 },
    columns: ['status', 'reservations'],
    rows,
    series: rows,
  };
}

export async function getBusinessDiscounts(restaurantId, filters = {}, user) {
  assertBusinessPermission(restaurantId, user, 'discounts.manage');
  if (!config.useMock) {
    const query = new URLSearchParams(Object.entries(filters)
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]));
    return apiRequest(`${discountsPath(restaurantId)}${query.size ? `?${query}` : ''}`, { preserveEnvelope: true });
  }
  const { state } = mockState(restaurantId, user);
  const search = String(filters.search || '').toLocaleLowerCase();
  const matched = state.businessDiscounts.filter((discount) => (
    (filters.is_active === undefined || String(discount.is_active) === String(filters.is_active))
    && (!search || `${discount.code} ${discount.name}`.toLocaleLowerCase().includes(search))
  ));
  const perPage = Math.min(100, Math.max(1, Number(filters.per_page) || 25));
  const page = Math.max(1, Number(filters.page) || 1);
  return {
    data: matched.slice((page - 1) * perPage, page * perPage),
    meta: { current_page: page, per_page: perPage, total: matched.length, last_page: Math.max(1, Math.ceil(matched.length / perPage)) },
  };
}

export async function saveBusinessDiscount(restaurantId, discount, user) {
  assertBusinessPermission(restaurantId, user, 'discounts.manage');
  if (!config.useMock) {
    return apiRequest(discountsPath(restaurantId, discount.id ? `/${encodeURIComponent(discount.id)}` : ''), {
      method: discount.id ? 'PATCH' : 'POST',
      body: discount,
    });
  }
  const { state, save } = mockState(restaurantId, user);
  const duplicate = state.businessDiscounts.find((existing) => (
    existing.code.toLocaleLowerCase() === discount.code.trim().toLocaleLowerCase()
    && String(existing.id) !== String(discount.id || '')
  ));
  if (duplicate) throw new Error('A discount with this code already exists.');
  const item = {
    ...discount,
    id: discount.id || `demo-${restaurantId}-discount-${Date.now()}`,
    code: discount.code.trim().toUpperCase(),
    funded_by: 'restaurant',
    usage_count: Number(discount.usage_count || 0),
  };
  if (discount.id) {
    const index = state.businessDiscounts.findIndex((existing) => String(existing.id) === String(discount.id));
    if (index < 0) throw new Error('Discount not found.');
    state.businessDiscounts[index] = item;
  } else {
    state.businessDiscounts.unshift(item);
  }
  save();
  recordBusinessAudit(restaurantId, user, discount.id ? 'discount.updated' : 'discount.created', discount.id ? discount : null, item);
  return item;
}

export async function deactivateBusinessDiscount(restaurantId, discountId, user) {
  assertBusinessPermission(restaurantId, user, 'discounts.manage');
  if (!config.useMock) {
    return apiRequest(discountsPath(restaurantId, `/${encodeURIComponent(discountId)}`), { method: 'DELETE' });
  }
  const { state, save } = mockState(restaurantId, user);
  const discount = state.businessDiscounts.find((item) => String(item.id) === String(discountId));
  if (!discount) throw new Error('Discount not found.');
  const before = { ...discount };
  discount.is_active = false;
  save();
  recordBusinessAudit(restaurantId, user, 'discount.deactivated', before, discount);
}

export async function getBusinessReport(restaurantId, report, filters, user) {
  const permission = ['reservations', 'no_show_rate'].includes(report)
    ? 'reports.reservations.view'
    : 'reports.sales_reservations.view';
  assertBusinessPermission(restaurantId, user, permission);
  if (!config.useMock) {
    const query = new URLSearchParams({ from: filters.from, to: filters.to });
    return apiRequest(reportsPath(restaurantId, `/${encodeURIComponent(report)}?${query}`));
  }
  return mockReport(restaurantId, report, filters.from, filters.to, user);
}

export async function downloadBusinessReport(restaurantId, report, filters, user) {
  const permission = ['reservations', 'no_show_rate'].includes(report)
    ? 'reports.reservations.view'
    : 'reports.sales_reservations.view';
  assertBusinessPermission(restaurantId, user, permission);
  const query = new URLSearchParams({ from: filters.from, to: filters.to });
  if (!config.useMock) {
    return apiDownloadRequest(reportsPath(restaurantId, `/${encodeURIComponent(report)}/export?${query}`));
  }
  const result = mockReport(restaurantId, report, filters.from, filters.to, user);
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [
    result.columns.map(quote).join(','),
    ...result.rows.map((row) => result.columns.map((column) => quote(row[column])).join(',')),
  ].join('\r\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

export async function getBusinessCalendar(restaurantId, range, user) {
  if (!config.useMock) {
    const query = new URLSearchParams({ start: range.start, end: range.end });
    return apiRequest(`${calendarPath(restaurantId)}?${query}`);
  }
  const permissions = membershipPermissions(restaurantId, user);
  if (!permissions.includes('restaurant.view') && !permissions.includes('reservations.view')) {
    throw new Error('You do not have permission to view this calendar.');
  }
  const { state } = mockState(restaurantId, user);
  const includeReservations = permissions.includes('reservations.view');
  const events = [];
  const manilaDate = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
  const startDate = manilaDate(new Date(range.start));
  const endDate = manilaDate(new Date(new Date(range.end).getTime() - 1));
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (state.restaurant.is_24_7) {
    const endExclusive = new Date(end);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    events.push({ id: 'hours-24-7', title: 'Open 24/7', start: startDate, end: endExclusive.toISOString().slice(0, 10), allDay: true, extendedProps: { type: 'hours' } });
  } else {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let day = new Date(start); day <= end; day = new Date(day.getTime() + 86400000)) {
      const date = day.toISOString().slice(0, 10);
      const weekday = dayNames[day.getUTCDay()];
      (state.hours[weekday] || []).forEach((shift, index) => {
        const eventStart = new Date(`${date}T${String(shift.open_time).slice(0, 5)}:00+08:00`);
        const eventEnd = new Date(`${date}T${String(shift.close_time).slice(0, 5)}:00+08:00`);
        if (shift.crosses_midnight) eventEnd.setUTCDate(eventEnd.getUTCDate() + 1);
        events.push({
          id: `hours-${weekday}-${index}-${date}`,
          title: `Open · ${String(shift.open_time).slice(0, 5)}–${String(shift.close_time).slice(0, 5)}`,
          start: eventStart.toISOString(),
          end: eventEnd.toISOString(),
          display: 'background',
          extendedProps: { type: 'hours' },
        });
      });
    }
  }
  state.closures.forEach((closure) => {
    if (closure.closure_date >= startDate && closure.closure_date <= endDate) {
      events.push({ id: `closure-${closure.id}`, title: closure.reason ? `Closed · ${closure.reason}` : 'Closed', start: closure.closure_date, allDay: true, display: 'background', extendedProps: { type: 'closure' } });
    }
  });
  if (includeReservations) {
    state.businessReservations.forEach((reservation) => {
      const startAt = new Date(reservation.start_at);
      const endAt = new Date(reservation.end_at);
      if (startAt < new Date(range.end) && endAt > new Date(range.start)) {
        events.push({
          id: `reservation-${reservation.id}`,
          title: reservation.reference_code,
          start: reservation.start_at,
          end: reservation.end_at,
          extendedProps: {
            type: 'reservation',
            status: reservation.status,
            table_number: state.businessTables.find((table) => String(table.id) === String(reservation.table_id))?.table_number || null,
            guest_count: reservation.guest_count,
          },
        });
      }
    });
  }
  return { data: events };
}

export const businessService = {
  getWorkspace,
  getProfile,
  getPreview,
  updateProfile,
  proposeSensitiveUpdate,
  getPhotos,
  uploadPhoto,
  updatePhoto,
  deletePhoto,
  getHours,
  updateHours,
  getClosures,
  createClosure,
  deleteClosure,
  updatePublication,
  setRestaurantClosed,
  deactivateRestaurant,
  reactivateRestaurant,
  getPublicationChecklist,
  getMenu,
  createMenuCategory,
  updateMenuCategory,
  archiveMenuCategory,
  createMenuItem,
  updateMenuItem,
  archiveMenuItem,
  publishMenuItems,
  updateMenuAvailability,
  uploadMenuPhoto,
  uploadHalalCertificate,
  getBusinessOrders,
  getBusinessOrder,
  updateBusinessOrderStatus,
  getBusinessReservations,
  updateBusinessReservationStatus,
  saveBusinessTable,
  deleteBusinessTable,
  updateBusinessReservationSettings,
  rescheduleBusinessReservation,
  getBusinessDiscounts,
  saveBusinessDiscount,
  deactivateBusinessDiscount,
  getBusinessReport,
  downloadBusinessReport,
  getBusinessCalendar,
};
