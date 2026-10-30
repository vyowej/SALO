import { config } from '../config';

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let requestMode = 'customer';
let requestRestaurantId = null;

export function setApiRequestContext(mode, restaurantId = null) {
  requestMode = mode === 'restaurantOwner' ? 'business' : mode;
  requestRestaurantId = restaurantId === null ? null : String(restaurantId);
}

export class ApiError extends Error {
  constructor(message, { status, code, fields } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const readCsrfCookie = () => {
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : '';
};

const getApiBaseUrl = () => {
  if (!config.apiBaseUrl) throw new Error('Set VITE_SALO_API_URL before enabling API mode.');
  return config.apiBaseUrl.replace(/\/+$/, '');
};

const ensureCsrfCookie = async (apiBaseUrl) => {
  const response = await fetch(`${new URL(apiBaseUrl).origin}/sanctum/csrf-cookie`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new ApiError('Unable to initialize a secure session.', { status: response.status });
  const token = readCsrfCookie();
  if (!token) throw new ApiError('The secure session token was not set by the API.', { status: response.status });
  return token;
};

export async function apiRequest(path, {
  method = 'GET',
  body,
  headers = {},
  preserveEnvelope = false,
} = {}) {
  const normalizedMethod = method.toUpperCase();
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json');
  requestHeaders.set('X-SALO-Mode', requestMode);
  if (requestRestaurantId) requestHeaders.set('X-SALO-Restaurant', requestRestaurantId);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) requestHeaders.set('Content-Type', 'application/json');
  if (config.useMock) throw new Error('API requests are disabled while mock mode is enabled.');
  const apiBaseUrl = getApiBaseUrl();

  if (mutatingMethods.has(normalizedMethod)) {
    requestHeaders.set('X-XSRF-TOKEN', await ensureCsrfCookie(apiBaseUrl));
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: normalizedMethod,
    credentials: 'include',
    headers: requestHeaders,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (response.status === 204) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('The API returned an invalid response.', { status: response.status });
  }
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(error?.message || payload?.message || 'The request could not be completed.', {
      status: response.status,
      code: error?.code,
      fields: error?.fields || payload?.errors,
    });
  }

  return preserveEnvelope ? payload : payload?.data ?? payload;
}

export async function apiDownloadRequest(path) {
  if (config.useMock) throw new Error('API requests are disabled while mock mode is enabled.');
  const requestHeaders = new Headers({
    Accept: 'text/csv',
    'X-SALO-Mode': requestMode,
  });
  if (requestRestaurantId) requestHeaders.set('X-SALO-Restaurant', requestRestaurantId);
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: 'include',
    headers: requestHeaders,
  });
  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError('The report could not be downloaded.', { status: response.status });
    }
    const error = payload?.error;
    throw new ApiError(error?.message || payload?.message || 'The report could not be downloaded.', {
      status: response.status,
      code: error?.code,
      fields: error?.fields || payload?.errors,
    });
  }
  return response.blob();
}

export async function apiUploadRequest(path, body, { method = 'POST', onProgress } = {}) {
  if (config.useMock) throw new Error('API requests are disabled while mock mode is enabled.');
  const apiBaseUrl = getApiBaseUrl();
  const csrfToken = await ensureCsrfCookie(apiBaseUrl);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, `${apiBaseUrl}${path}`);
    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('X-SALO-Mode', requestMode);
    if (requestRestaurantId) request.setRequestHeader('X-SALO-Restaurant', requestRestaurantId);
    request.setRequestHeader('X-XSRF-TOKEN', csrfToken);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener('error', () => reject(new ApiError('The upload could not reach the API.')));
    request.addEventListener('load', () => {
      if (request.status === 204) {
        resolve(null);
        return;
      }
      let payload;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new ApiError('The API returned an invalid response.', { status: request.status }));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        const error = payload?.error;
        reject(new ApiError(error?.message || payload?.message || 'The request could not be completed.', {
          status: request.status,
          code: error?.code,
          fields: error?.fields || payload?.errors,
        }));
        return;
      }
      resolve(payload?.data ?? payload);
    });
    request.send(body);
  });
}

export default apiRequest;
