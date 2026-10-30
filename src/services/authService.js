import { demoAccounts, legacyDemoCredentials, legacyDemoEmailMap, mockEmailVerificationCode } from '../mock/accounts';
import { config } from '../config';
import { apiRequest } from './apiClient';

const USERS_STORAGE_KEY = 'salo-registered-users-v1';
const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeEmail = (email = '') => email.trim().toLowerCase();
const getDemoAccount = (email, password) => {
  const normalizedEmail = normalizeEmail(email);
  const canonicalEmail = legacyDemoEmailMap[normalizedEmail] || normalizedEmail;
  const account = demoAccounts.find((entry) => normalizeEmail(entry.email) === canonicalEmail && entry.password === password);
  if (account) return account;
  const legacyCredential = legacyDemoCredentials.find((entry) => normalizeEmail(entry.email) === canonicalEmail && entry.password === password);
  return demoAccounts.find((entry) => entry.user.id === legacyCredential?.accountId) || null;
};

const normalizeApiUser = (user) => {
  const nameParts = (user.name || '').trim().split(/\s+/).filter(Boolean);
  return {
    ...user,
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' '),
    avatar: user.avatar_url || `${nameParts[0]?.[0] || ''}${nameParts[nameParts.length - 1]?.[0] || ''}`,
    email_verified: Boolean(user.email_verified_at),
  };
};

const formatApiAddress = (address) => ({
  label: address.label,
  region: address.region,
  province: address.province,
  city_municipality: address.city_municipality,
  barangay: address.barangay,
  street: address.street,
  house_no: address.house_no || null,
  latitude: address.latitude,
  longitude: address.longitude,
  rider_note: address.rider_note || null,
});

const readUsers = () => {
  try {
    const stored = window.localStorage.getItem(USERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Unable to read registered mock accounts.', error);
    throw new Error('Registered mock accounts are unavailable. Clear site storage and try again.', { cause: error });
  }
};

export const authService = {
  getDemoAccounts() {
    return demoAccounts;
  },

  getDemoAccount(email, password) {
    return getDemoAccount(email, password);
  },

  verifyEmailCode(code) {
    return code === mockEmailVerificationCode;
  },

  async isEmailRegistered(email) {
    if (!config.useMock) return null;
    await wait();
    return readUsers().some((user) => normalizeEmail(user.email) === normalizeEmail(email));
  },

  async register({ user, address, password }) {
    if (!config.useMock) {
      const name = user.name || [user.first_name, user.middle_name, user.last_name, user.suffix].filter(Boolean).join(' ');
      const created = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          name,
          email: normalizeEmail(user.email),
          phone: user.phone || null,
          password,
          password_confirmation: password,
          address: address ? formatApiAddress(address) : undefined,
        },
      });
      return normalizeApiUser(created);
    }

    await wait(500);
    const registeredUsers = readUsers();
    if (registeredUsers.some((entry) => normalizeEmail(entry.email) === normalizeEmail(user.email))) {
      throw new Error('An account with this email already exists.');
    }

    const registeredUser = {
      id: `customer-${Date.now()}`,
      ...user,
      role: 'customer',
      email_verified: false,
      phone: '',
      address: { ...address, id: `address-${Date.now()}`, is_main: true },
      password,
    };

    // MOCK-ONLY: browser storage stands in for the future account API.
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([...registeredUsers, registeredUser]));
    return registeredUser;
  },

  async login(email, password) {
    if (!config.useMock) {
      try {
        return normalizeApiUser(await apiRequest('/auth/login', {
          method: 'POST',
          body: { email: normalizeEmail(email), password },
        }));
      } catch (error) {
        if (error.status === 401) return null;
        throw error;
      }
    }

    await wait(200);
    const user = readUsers().find((entry) => normalizeEmail(entry.email) === normalizeEmail(email) && entry.password === password);
    if (!user) return null;
    return { ...user, password: undefined };
  },

  async updateRegisteredUser(id, updates) {
    await wait(100);
    const users = readUsers();
    const user = users.find((entry) => entry.id === id);
    if (!user) throw new Error('Registered account could not be found.');
    const updatedUser = { ...user, ...updates };
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users.map((entry) => entry.id === id ? updatedUser : entry)));
    return { ...updatedUser, password: undefined };
  },

  async getCurrentUser() {
    return normalizeApiUser(await apiRequest('/auth/me'));
  },

  async updateProfile(updates) {
    return normalizeApiUser(await apiRequest('/customer/profile', { method: 'PATCH', body: updates }));
  },

  async deactivateAccount({ password, reason }) {
    return apiRequest('/customer/profile', { method: 'DELETE', body: { password, reason } });
  },

  async requestPasswordReset(email) {
    return apiRequest('/auth/forgot-password', { method: 'POST', body: { email: normalizeEmail(email) } });
  },

  async resetPassword({ email, token, password, passwordConfirmation }) {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: {
        email: normalizeEmail(email),
        token,
        password,
        password_confirmation: passwordConfirmation,
      },
    });
  },

  async sendVerificationEmail() {
    return apiRequest('/auth/email/verification/send', { method: 'POST', body: {} });
  },

  async verifyEmailToken(token) {
    return normalizeApiUser(await apiRequest('/auth/email/verification/verify', {
      method: 'POST',
      body: { code: token },
    }));
  },

  async setActiveMode(mode, selectedRestaurantId) {
    return normalizeApiUser(await apiRequest('/auth/mode', {
      method: 'POST',
      body: {
        mode,
        selected_restaurant_id: selectedRestaurantId,
      },
    }));
  },

  async logout() {
    if (!config.useMock) await apiRequest('/auth/logout', { method: 'POST', body: {} });
  },

  async getSettings() {
    return apiRequest('/customer/settings');
  },

  async updateSettings(updates) {
    return apiRequest('/customer/settings', { method: 'PATCH', body: updates });
  },
};

export default authService;
