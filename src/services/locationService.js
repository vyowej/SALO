import { barangays, cities, provinces, regions } from '../mock/locations/philippines';
import { defaultMockAddress, defaultMockCoordinates, mockPlaceSearchResults } from '../mock/locationData';
import { locationSettings } from '../mock/locationSettings';
import { config } from '../config';

const wait = (ms = config.mockDelay) => new Promise((resolve) => setTimeout(resolve, ms));
const unsupportedProvider = () => {
  if (config.locationProvider !== 'mock') {
    throw new Error(`The "${config.locationProvider}" location provider is configured but not implemented yet.`);
  }
};

const findByName = (list, term) => list.find((entry) => entry.name.toLowerCase().includes(term.toLowerCase()));

export const locationService = {
  getDefaultMapCenter() {
    return defaultMockCoordinates;
  },

  async getRegions() {
    await wait();
    unsupportedProvider();
    return regions;
  },

  async getProvinces(regionCode) {
    await wait(300);
    unsupportedProvider();
    return provinces[regionCode] || [];
  },

  async getCities(provinceCode) {
    await wait(300);
    unsupportedProvider();
    return cities[provinceCode] || [];
  },

  async getBarangays(cityCode) {
    await wait(300);
    unsupportedProvider();
    return barangays[cityCode] || [];
  },

  async searchPlaces(query) {
    await wait(200);
    unsupportedProvider();
    if (!query.trim()) return [];
    return mockPlaceSearchResults.filter((place) => `${place.detail} ${place.label}`.toLowerCase().includes(query.toLowerCase()));
  },

  async reverseGeocode(latitude, longitude) {
    await wait(250);
    unsupportedProvider();
    return { ...defaultMockAddress, latitude, longitude };
  },

  async getCurrentPosition() {
    if (!navigator.geolocation) return { state: 'unavailable', position: null };
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ state: 'granted', position: { latitude: coords.latitude, longitude: coords.longitude } }),
        (error) => {
          const state = error.code === error.PERMISSION_DENIED
            ? 'denied'
            : error.code === error.TIMEOUT
              ? 'timeout'
              : 'unavailable';
          resolve({ state, position: null });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  },

  async getDistanceKm(from, to) {
    await wait(0);
    const radians = (degrees) => (degrees * Math.PI) / 180;
    const latitudeDelta = radians(to.latitude - from.latitude);
    const longitudeDelta = radians(to.longitude - from.longitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
      * Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  },

  async estimateDeliveryFee(distanceKm, restaurant = {}) {
    await wait(0);
    const fee = locationSettings.baseDeliveryFee + Math.ceil(distanceKm) * locationSettings.feePerKm;
    return Math.max(Number(restaurant.deliveryFee) || 0, fee);
  },

  async resolveMockAddress(address) {
    await wait(200);
    unsupportedProvider();
    const region = findByName(regions, address.region || defaultMockAddress.region);
    const regionProvinces = provinces[region?.code] || [];
    const province = findByName(regionProvinces, address.province || defaultMockAddress.province);
    const provinceCities = cities[province?.code] || [];
    const city = findByName(provinceCities, address.city_municipality || defaultMockAddress.city_municipality);
    const cityBarangays = barangays[city?.code] || [];
    const barangay = findByName(cityBarangays, address.barangay || defaultMockAddress.barangay);
    return { region, province, city, barangay };
  },
};

export default locationService;
