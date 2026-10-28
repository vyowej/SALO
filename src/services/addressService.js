import { savedAddresses as mockAddresses } from '../mock/restaurants';

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
  region: address.region || 'National Capital Region (NCR)',
  province: address.province || 'Metro Manila',
  city_municipality: address.city_municipality || 'Quezon City',
  barangay: address.barangay || 'Bagong Pag-asa',
  street: address.street || '',
  house_no: address.house_no || '',
  latitude: Number(address.latitude) || 14.6516,
  longitude: Number(address.longitude) || 121.0493,
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

export const addressService = {
  async getSavedAddresses() {
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
    const normalized = normalizeAddress({ ...address, id: address.id || `address-${Date.now()}` });
    const addresses = readAddresses().map((entry) => normalized.is_main ? { ...entry, is_main: false, primary: false } : entry);
    const nextAddresses = [normalized, ...addresses.filter((entry) => entry.id !== normalized.id)];
    saveAddresses(nextAddresses);
    if (normalized.is_main) await this.setSelectedAddress(normalized);
    return normalized;
  },

  async setSelectedAddress(address) {
    if (!address) return null;
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
