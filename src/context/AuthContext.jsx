/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { addressService } from '../services/addressService';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'salo-auth-v1';

export const USER_ROLES = {
  GUEST: 'guest',
  CUSTOMER: 'customer',
  RESTAURANT_OWNER: 'restaurantOwner',
  RIDER: 'rider',
  ADMIN: 'admin',
};

const normalizeEmail = (value = '') => value.trim().toLowerCase();

const legacyEmailMap = {
  'customer@salo.test': 'customer@salo.app',
  'owner@salo.test': 'owner@salo.app',
  'rider@salo.test': 'rider@salo.app',
  'admin@salo.test': 'admin@salo.app',
};

const accounts = [
  {
    email: 'customer@salo.app',
    password: 'customer123',
    role: USER_ROLES.CUSTOMER,
    capabilities: [USER_ROLES.CUSTOMER],
    user: { id: 'cust-1', name: 'Cass Santos', email: 'customer@salo.app', avatar: 'CS' },
  },
  {
    email: 'owner@salo.app',
    password: 'rider123',
    role: USER_ROLES.RESTAURANT_OWNER,
    capabilities: [USER_ROLES.CUSTOMER, USER_ROLES.RESTAURANT_OWNER],
    user: { id: 'owner-1', name: 'Ramon Dela Cruz', email: 'owner@salo.app', avatar: 'RD', restaurantId: 'mang-toma' },
  },
  {
    email: 'rider@salo.app',
    password: 'rider123',
    role: USER_ROLES.RIDER,
    capabilities: [USER_ROLES.CUSTOMER, USER_ROLES.RIDER],
    user: { id: 'rider-1', name: 'Rey Cruz', email: 'rider@salo.app', avatar: 'RC' },
  },
  {
    email: 'admin@salo.app',
    password: 'admin123',
    role: USER_ROLES.ADMIN,
    capabilities: [USER_ROLES.ADMIN],
    user: { id: 'admin-1', name: 'Alyssa Reyes', email: 'admin@salo.app', avatar: 'AR', adminLevel: 'Super Admin' },
  },
];

const getAccountByCredentials = (email, password) => {
  const normalizedEmail = normalizeEmail(email);
  const canonicalEmail = legacyEmailMap[normalizedEmail] || normalizedEmail;
  const match = accounts.find(
    (candidate) => normalizeEmail(candidate.email) === canonicalEmail && candidate.password === password,
  );

  if (match) return match;

  if (canonicalEmail === 'owner@salo.app' && (password === 'owner123' || password === 'rider123')) {
    return accounts.find((candidate) => normalizeEmail(candidate.email) === 'owner@salo.app');
  }

  return null;
};

export const DEMO_ACCOUNTS = accounts.map(({ email, password, role }) => ({ email, password, role }));

const readStoredAuth = () => {
  try {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return { user: null, capabilities: [], activeView: USER_ROLES.GUEST, emailVerified: true };
    const parsed = JSON.parse(stored);
    const account = accounts.find((entry) => entry.user.id === parsed.user?.id);
    if (!account && !parsed.user?.id) return { user: null, capabilities: [], activeView: USER_ROLES.GUEST, emailVerified: true };

    return {
      user: account?.user || parsed.user,
      capabilities: account?.capabilities || parsed.capabilities || [USER_ROLES.CUSTOMER],
      activeView: account
        ? (account.capabilities.includes(parsed.activeView) ? parsed.activeView : account.role)
        : USER_ROLES.CUSTOMER,
      emailVerified: parsed.emailVerified ?? true,
    };
  } catch {
    return { user: null, capabilities: [], activeView: USER_ROLES.GUEST, emailVerified: true };
  }
};

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);

  const persistAuth = useCallback((nextAuth) => {
    setAuth(nextAuth);
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  }, []);

  const login = useCallback(async (email, password) => {
    const account = getAccountByCredentials(email, password);
    if (account) {
      persistAuth({ user: account.user, capabilities: account.capabilities, activeView: account.role, emailVerified: true });
      return true;
    }

    const registeredUser = await authService.login(email, password);
    if (!registeredUser) return false;
    persistAuth({
      user: { ...registeredUser, avatar: `${registeredUser.first_name?.[0] || ''}${registeredUser.last_name?.[0] || ''}` },
      capabilities: [USER_ROLES.CUSTOMER],
      activeView: USER_ROLES.CUSTOMER,
      emailVerified: Boolean(registeredUser.email_verified),
    });
    return true;
  }, [persistAuth]);

  const register = useCallback(async (details) => {
    const registeredUser = await authService.register(details);
    const savedAddress = await addressService.saveAddress(registeredUser.address);
    const user = {
      ...registeredUser,
      address: savedAddress,
      name: [registeredUser.first_name, registeredUser.middle_name, registeredUser.last_name, registeredUser.suffix].filter(Boolean).join(' '),
      avatar: `${registeredUser.first_name?.[0] || ''}${registeredUser.last_name?.[0] || ''}`,
    };
    persistAuth({
      user,
      capabilities: [USER_ROLES.CUSTOMER],
      activeView: USER_ROLES.CUSTOMER,
      emailVerified: false,
    });
    return user;
  }, [persistAuth]);

  const verifyEmail = useCallback(async (code) => {
    if (code !== '123456' || !auth.user) return false;
    const user = await authService.updateRegisteredUser(auth.user.id, { email_verified: true });
    persistAuth({ ...auth, user, emailVerified: true });
    return true;
  }, [auth, persistAuth]);

  const updateUser = useCallback(async (updates) => {
    if (!auth.user) throw new Error('You must be signed in to update your account.');
    const isDemoAccount = accounts.some((entry) => entry.user.id === auth.user.id);
    const user = isDemoAccount
      ? { ...auth.user, ...updates }
      : await authService.updateRegisteredUser(auth.user.id, updates);
    persistAuth({ ...auth, user });
    return user;
  }, [auth, persistAuth]);

  const switchView = useCallback((view) => {
    if (!auth.capabilities.includes(view)) return false;
    const nextAuth = { ...auth, activeView: view };
    setAuth(nextAuth);
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
    return true;
  }, [auth]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuth({ user: null, capabilities: [], activeView: USER_ROLES.GUEST, emailVerified: true });
  }, []);

  const value = useMemo(() => ({
    user: auth.user,
    capabilities: auth.capabilities,
    userRole: auth.activeView,
    activeView: auth.activeView,
    isLoggedIn: Boolean(auth.user),
    emailVerified: auth.emailVerified,
    login,
    register,
    verifyEmail,
    updateUser,
    logout,
    switchView,
    USER_ROLES,
  }), [auth, login, register, verifyEmail, updateUser, logout, switchView]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export { accounts as USERS };
