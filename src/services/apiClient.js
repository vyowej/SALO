import { config } from '../config';

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

export async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const normalizedMethod = method.toUpperCase();
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json');
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  if (config.useMock) throw new Error('API requests are disabled while mock mode is enabled.');
  const apiBaseUrl = getApiBaseUrl();

  if (mutatingMethods.has(normalizedMethod)) {
    requestHeaders.set('X-XSRF-TOKEN', await ensureCsrfCookie(apiBaseUrl));
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: normalizedMethod,
    credentials: 'include',
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
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
    throw new ApiError(error?.message || 'The request could not be completed.', {
      status: response.status,
      code: error?.code,
      fields: error?.fields,
    });
  }

  return payload?.data ?? payload;
}

export default apiRequest;
