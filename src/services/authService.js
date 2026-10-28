import { demoAccounts, legacyDemoCredentials, legacyDemoEmailMap, mockEmailVerificationCode } from '../mock/accounts';

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
    await wait();
    return readUsers().some((user) => normalizeEmail(user.email) === normalizeEmail(email));
  },

  async register({ user, address, password }) {
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
};

export default authService;
