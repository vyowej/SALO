import { ROLE_PATHS } from '../constants/navigation';
import { USER_ROLES } from '../context/AuthContext';

const protectedDestinations = [
  { path: '/admin', role: USER_ROLES.ADMIN },
  { path: '/dashboard', role: USER_ROLES.RESTAURANT_OWNER },
  { path: '/rider', role: USER_ROLES.RIDER },
];
const internalOrigin = 'https://salo.internal';

function getRequestedPath(from) {
  if (typeof from === 'string') return from;
  if (!from || typeof from.pathname !== 'string') return '';
  return `${from.pathname}${from.search || ''}${from.hash || ''}`;
}

export function getPostAuthDestination(from, role) {
  const defaultDestination = ROLE_PATHS[role] || ROLE_PATHS[USER_ROLES.CUSTOMER];
  const requestedPath = getRequestedPath(from);
  if (!requestedPath.startsWith('/') || requestedPath.startsWith('//')) return defaultDestination;

  let destination;
  try {
    destination = new URL(requestedPath, internalOrigin);
  } catch {
    return defaultDestination;
  }
  if (destination.origin !== internalOrigin) return defaultDestination;

  const protectedRoute = protectedDestinations.find(({ path }) => (
    destination.pathname === path || destination.pathname.startsWith(`${path}/`)
  ));
  if (protectedRoute && protectedRoute.role !== role) return defaultDestination;

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

