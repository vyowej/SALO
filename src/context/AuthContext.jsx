/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { addressService } from '../services/addressService';
import { config } from '../config';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'salo-auth-v1';

export const USER_ROLES = {
  GUEST: 'guest',
  CUSTOMER: 'customer',
  RESTAURANT_OWNER: 'restaurantOwner',
  RIDER: 'rider',
  ADMIN: 'admin',
};

const accounts = authService.getDemoAccounts();
const emptyAuth = { user: null, capabilities: [], activeView: USER_ROLES.GUEST, emailVerified: true };
const authForApiUser = (user) => {
  const capabilities = [
    ...(user.capabilities || []),
    ...(user.capabilities?.includes('driver') ? [USER_ROLES.RIDER] : []),
    ...(user.memberships?.some((membership) => membership.status === 'active') ? [USER_ROLES.RESTAURANT_OWNER] : []),
  ];
  const activeView = capabilities.includes(USER_ROLES.ADMIN)
    ? USER_ROLES.ADMIN
    : capabilities.includes(USER_ROLES.RIDER)
      ? USER_ROLES.RIDER
      : capabilities.includes(USER_ROLES.RESTAURANT_OWNER)
        ? USER_ROLES.RESTAURANT_OWNER
        : USER_ROLES.CUSTOMER;

  return {
    user,
    capabilities: [...new Set(capabilities)],
    activeView,
    emailVerified: user.email_verified,
  };
};

const getAccountByCredentials = (email, password) => {
  return authService.getDemoAccount(email, password);
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
  const [auth, setAuth] = useState(() => config.useMock ? readStoredAuth() : emptyAuth);
  const [authLoading, setAuthLoading] = useState(!config.useMock);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (config.useMock) return undefined;
    let active = true;
    authService.getCurrentUser()
      .then((user) => {
        if (!active) return;
        setAuth(authForApiUser(user));
        setAuthError('');
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) {
          setAuth(emptyAuth);
          setAuthError('');
        } else {
          console.error('Unable to verify the current account.', error);
          setAuthError('We couldn’t verify your account. Check your connection and try again.');
        }
      })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  const persistAuth = useCallback((nextAuth) => {
    setAuth(nextAuth);
    setAuthError('');
    if (config.useMock) window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  }, []);

  const login = useCallback(async (email, password) => {
    const account = config.useMock ? getAccountByCredentials(email, password) : null;
    if (account) {
      persistAuth({ user: account.user, capabilities: account.capabilities, activeView: account.role, emailVerified: true });
      return true;
    }

    const registeredUser = await authService.login(email, password);
    if (!registeredUser) return false;
    persistAuth(authForApiUser(registeredUser));
    return true;
  }, [persistAuth]);

  const register = useCallback(async (details) => {
    const registeredUser = await authService.register(details);
    const savedAddress = config.useMock ? await addressService.saveAddress(registeredUser.address) : null;
    const user = config.useMock ? {
      ...registeredUser,
      address: savedAddress,
      name: [registeredUser.first_name, registeredUser.middle_name, registeredUser.last_name, registeredUser.suffix].filter(Boolean).join(' '),
      avatar: `${registeredUser.first_name?.[0] || ''}${registeredUser.last_name?.[0] || ''}`,
    } : registeredUser;
    persistAuth(config.useMock
      ? {
          user,
          capabilities: registeredUser.capabilities || [USER_ROLES.CUSTOMER],
          activeView: USER_ROLES.CUSTOMER,
          emailVerified: registeredUser.email_verified,
        }
      : authForApiUser(user));
    return user;
  }, [persistAuth]);

  const verifyEmail = useCallback(async (code) => {
    if (!config.useMock) {
      const user = await authService.verifyEmailToken(code);
      persistAuth(authForApiUser(user));
      return true;
    }
    if (!authService.verifyEmailCode(code) || !auth.user) return false;
    const user = await authService.updateRegisteredUser(auth.user.id, { email_verified: true });
    persistAuth({ ...auth, user, emailVerified: true });
    return true;
  }, [auth, persistAuth]);

  const sendVerificationEmail = useCallback(() => authService.sendVerificationEmail(), []);

  const updateUser = useCallback(async (updates) => {
    if (!auth.user) throw new Error('You must be signed in to update your account.');
    const isDemoAccount = config.useMock && accounts.some((entry) => entry.user.id === auth.user.id);
    const user = !config.useMock
      ? await authService.updateProfile(updates)
      : isDemoAccount
      ? { ...auth.user, ...updates }
      : await authService.updateRegisteredUser(auth.user.id, updates);
    persistAuth({ ...auth, user });
    return user;
  }, [auth, persistAuth]);

  const switchView = useCallback((view) => {
    if (!auth.capabilities.includes(view)) return false;
    const nextAuth = { ...auth, activeView: view };
    setAuth(nextAuth);
    if (config.useMock) window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
    return true;
  }, [auth]);

  const clearAuth = useCallback(() => {
    if (config.useMock) window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuth(emptyAuth);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    clearAuth();
  }, [clearAuth]);

  const deactivateAccount = useCallback(async (details) => {
    await authService.deactivateAccount(details);
    clearAuth();
  }, [clearAuth]);

  const value = useMemo(() => ({
    user: auth.user,
    capabilities: auth.capabilities,
    userRole: auth.activeView,
    activeView: auth.activeView,
    isLoggedIn: Boolean(auth.user),
    emailVerified: auth.emailVerified,
    authLoading,
    authError,
    login,
    register,
    verifyEmail,
    sendVerificationEmail,
    updateUser,
    logout,
    deactivateAccount,
    switchView,
    USER_ROLES,
  }), [auth, authLoading, authError, login, register, verifyEmail, sendVerificationEmail, updateUser, logout, deactivateAccount, switchView]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export { accounts as USERS };
