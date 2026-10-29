import { savedAddresses as mockAddresses } from '../mock/restaurants';
import { defaultMockAddress } from '../mock/locationData';
import { config } from '../config';
import { apiRequest } from './apiClient';

const ADDRESSES_KEY = 'salo-saved-addresses-v1';
const SELECTED_ADDRESS_KEY = 'salo-selected-address-v1';

const normalizeAddress = (address, index = 0) => ({
  id: address.id || `saved-${index + 1}`,
  label: address.label || 'Home',
  detail: address.detail || [
    address.house_no,
    address.street,
    address.barangay,
    address.city_municipality,
    address.province,
  ].filter(Boolean).join(', '),
  region: address.region || defaultMockAddress.region,
  province: address.province || defaultMockAddress.province,
  city_municipality: address.city_municipality || defaultMockAddress.city_municipality,
  barangay: address.barangay || defaultMockAddress.barangay,
  street: address.street || '',
  house_no: address.house_no || '',
  latitude: Number(address.latitude) || defaultMockAddress.latitude,
  longitude: Number(address.longitude) || defaultMockAddress.longitude,
  is_main: address.is_main ?? Boolean(address.primary),
  primary: address.is_main ?? Boolean(address.primary),
  rider_note: address.rider_note || '',
});

const readAddresses = () => {
  try {
    const stored = window.localStorage.getItem(ADDRESSES_KEY);
    if (stored) return JSON.parse(stored).map((address, index) => normalizeAddress(address, index));
  } catch (error) {
    console.error('Unable to read saved addresses.', error);
    throw new Error('Saved addresses are unavailable. Clear site storage and try again.', { cause: error });
  }
  return mockAddresses.map((address, index) => normalizeAddress(address, index));
};

const saveAddresses = (addresses) => {
  window.localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
};

const toApiAddress = (address) => ({
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

export const addressService = {
  async getSavedAddresses() {
    if (!config.useMock) {
      const addresses = await apiRequest('/customer/addresses');
      return addresses.map((address, index) => normalizeAddress(address, index));
    }
    return readAddresses();
  },

  async getSelectedAddress() {
    let selectedId = '';
    try {
      selectedId = window.localStorage.getItem(SELECTED_ADDRESS_KEY) || '';
    } catch (error) {
      console.error('Unable to read the selected address.', error);
      throw new Error('The selected address is unavailable. Check browser storage and try again.', { cause: error });
    }
    const addresses = readAddresses();
    return addresses.find((address) => address.id === selectedId)
      || addresses.find((address) => address.is_main)
      || addresses[0]
      || null;
  },

  async saveAddress(address) {
    if (!config.useMock) {
      const endpoint = address.id
        ? `/customer/addresses/${encodeURIComponent(address.id)}`
        : '/customer/addresses';
      let saved = await apiRequest(endpoint, {
        method: address.id ? 'PATCH' : 'POST',
        body: toApiAddress(address),
      });
      if (address.is_main) {
        saved = await apiRequest(`/customer/addresses/${encodeURIComponent(saved.id)}/primary`, {
          method: 'PATCH',
          body: {},
        });
      }
      const normalizedSaved = normalizeAddress(saved);
      if (normalizedSaved.is_main) await this.setSelectedAddress(normalizedSaved);
      return normalizedSaved;
    }

    const normalized = normalizeAddress({ ...address, id: address.id || `address-${Date.now()}` });
    const addresses = readAddresses().map((entry) => normalized.is_main ? { ...entry, is_main: false, primary: false } : entry);
    const nextAddresses = [normalized, ...addresses.filter((entry) => entry.id !== normalized.id)];
    saveAddresses(nextAddresses);
    if (normalized.is_main) await this.setSelectedAddress(normalized);
    return normalized;
  },

  async setPrimaryAddress(address) {
    if (!address?.id) throw new Error('A saved address is required to set a primary destination.');
    if (!config.useMock) {
      const primary = await apiRequest(`/customer/addresses/${encodeURIComponent(address.id)}/primary`, {
        method: 'PATCH',
        body: {},
      });
      return normalizeAddress(primary);
    }

    const addresses = readAddresses().map((entry) => ({
      ...entry,
      is_main: entry.id === address.id,
      primary: entry.id === address.id,
    }));
    saveAddresses(addresses);
    return normalizeAddress(addresses.find((entry) => entry.id === address.id));
  },

  async deleteAddress(address) {
    if (!address?.id) throw new Error('A saved address is required for removal.');
    if (!config.useMock) {
      await apiRequest(`/customer/addresses/${encodeURIComponent(address.id)}`, { method: 'DELETE' });
      return;
    }

    const remaining = readAddresses().filter((entry) => entry.id !== address.id);
    if (remaining.length && !remaining.some((entry) => entry.is_main)) {
      remaining[0] = { ...remaining[0], is_main: true, primary: true };
    }
    saveAddresses(remaining);
  },

  async setSelectedAddress(address) {
    if (!address) {
      try {
        window.localStorage.removeItem(SELECTED_ADDRESS_KEY);
        window.dispatchEvent(new CustomEvent('salo:address-change', { detail: null }));
      } catch (error) {
        console.error('Unable to clear the selected address.', error);
        throw error;
      }
      return null;
    }
    const normalized = normalizeAddress(address);
    try {
      window.localStorage.setItem(SELECTED_ADDRESS_KEY, normalized.id);
      window.dispatchEvent(new CustomEvent('salo:address-change', { detail: normalized }));
    } catch (error) {
      console.error('Unable to save the selected address.', error);
      throw error;
    }
    return normalized;
  },
};

export default addressService;
