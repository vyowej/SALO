import apiRequest, { apiUploadRequest } from './apiClient';
import config from '../config';

const mockStorageKey = 'salo.business.pages.mock.v1';

function restaurantPath(restaurantId, endpoint = '') {
  return `/manage/restaurants/${encodeURIComponent(restaurantId)}/business${endpoint}`;
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
    };
  }
  const save = () => {
    allStates[key] = state;
    localStorage.setItem(mockStorageKey, JSON.stringify(allStates));
  };
  const state = allStates[key];
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
    orderable_item: { label: 'At least one published, orderable menu item exists', complete: false, blocked_until: 'B4' },
  };
  return { checks, can_publish: Object.values(checks).every((check) => check.complete) };
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
    restaurant: { ...state.restaurant },
    setup_checklist: [
      { key: 'profile', label: 'Complete restaurant profile', complete: Boolean(state.restaurant.category && state.restaurant.description), href: '/business/profile' },
      { key: 'hours', label: 'Confirm opening hours', complete: Boolean(state.restaurant.is_24_7 || Object.values(state.hours).some((shifts) => shifts.length)), href: '/business/hours' },
      { key: 'menu', label: 'Add and publish menu items', complete: false, href: '/business/menu' },
      { key: 'tables', label: 'Set up reservation tables', complete: false, href: '/business/tables' },
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
  state.hours = data.hours || [];
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
  if (published && !checklist.ready) throw new Error('Publishing is blocked until every checklist item is complete.');
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

export async function getPublicationChecklist(restaurantId, user) {
  if (!config.useMock) return apiRequest(restaurantPath(restaurantId, '/publish-checklist'));
  const { state } = mockState(restaurantId, user);
  return mockChecklist(state);
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
  getPublicationChecklist,
};
