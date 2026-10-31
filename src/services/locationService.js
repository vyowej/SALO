import { barangays, cities, provinces, regions } from '../mock/locations/philippines';
import { defaultMockAddress, defaultMockCoordinates, mockPlaceSearchResults } from '../mock/locationData';
import { locationSettings } from '../mock/locationSettings';
import { config } from '../config';
import { apiRequest } from './apiClient';

const wait = (ms = config.mockDelay) => new Promise((resolve) => setTimeout(resolve, ms));
let philippinesBoundsRequest;
const unsupportedProvider = () => {
  if (config.locationProvider !== 'mock') {
    throw new Error(`The "${config.locationProvider}" location provider is configured but not implemented yet.`);
  }
};

const findByName = (list, term) => list.find((entry) => entry.name.toLowerCase().includes(term.toLowerCase()));
const loadPsgcLocations = (level, parentCode) => {
  const params = new URLSearchParams({ level });
  if (parentCode) params.set('parent_code', parentCode);
  return apiRequest(`/locations/psgc?${params.toString()}`);
};

const searchMockLocations = async (query) => {
  await wait(200);
  const locations = [
    ...regions.map((entry) => ({ ...entry, level: 'region' })),
    ...Object.values(provinces).flat().map((entry) => ({ ...entry, level: 'province' })),
    ...Object.values(cities).flat().map((entry) => ({ ...entry, level: 'city' })),
    ...Object.values(barangays).flat().map((entry) => ({ ...entry, level: 'barangay' })),
  ];
  const term = query.trim().toLowerCase();
  return locations
    .filter((entry) => entry.name.toLowerCase().includes(term))
    .slice(0, 30)
    .map((entry) => ({
      ...entry,
      full_name: entry.name,
      region: '',
      province: '',
      city_municipality: entry.level === 'city' ? entry.name : '',
      barangay: entry.level === 'barangay' ? entry.name : '',
    }));
};

export const locationService = {
  getDefaultMapCenter() {
    return defaultMockCoordinates;
  },

  async getPhilippineBounds() {
    if (!philippinesBoundsRequest) {
      philippinesBoundsRequest = fetch(`${import.meta.env.BASE_URL}location-bounds.json`, { headers: { Accept: 'application/json' } })
        .then(async (response) => {
          if (!response.ok) throw new Error('The Philippines coordinate bounds configuration could not be loaded.');
          return response.json();
        })
        .then((bounds) => {
          const values = ['min_latitude', 'max_latitude', 'min_longitude', 'max_longitude'];
          if (!values.every((key) => Number.isFinite(bounds[key]))) {
            throw new Error('The Philippines coordinate bounds configuration is invalid.');
          }
          return bounds;
        })
        .catch((error) => {
          philippinesBoundsRequest = undefined;
          throw error;
        });
    }
    return philippinesBoundsRequest;
  },

  async isWithinPhilippines({ latitude, longitude }) {
    const bounds = await this.getPhilippineBounds();
    return Number.isFinite(Number(latitude))
      && Number.isFinite(Number(longitude))
      && Number(latitude) >= bounds.min_latitude
      && Number(latitude) <= bounds.max_latitude
      && Number(longitude) >= bounds.min_longitude
      && Number(longitude) <= bounds.max_longitude;
  },

  async getRegions() {
    if (!config.useMock) return loadPsgcLocations('region');
    await wait();
    unsupportedProvider();
    return regions;
  },

  async getProvinces(regionCode) {
    if (!config.useMock) return loadPsgcLocations('province', regionCode);
    await wait(300);
    unsupportedProvider();
    return provinces[regionCode] || [];
  },

  async getCities(provinceCode) {
    if (!config.useMock) return loadPsgcLocations('city', provinceCode);
    await wait(300);
    unsupportedProvider();
    return cities[provinceCode] || [];
  },

  async getBarangays(cityCode) {
    if (!config.useMock) return loadPsgcLocations('barangay', cityCode);
    await wait(300);
    unsupportedProvider();
    return barangays[cityCode] || [];
  },

  async searchPlaces(query) {
    if (!query.trim()) return [];
    if (config.useMock) {
      await wait(200);
      return mockPlaceSearchResults.filter((place) => `${place.detail} ${place.label}`.toLowerCase().includes(query.toLowerCase()));
    }

    return (await this.searchPsgcLocations(query)).map((location) => ({
      ...location,
      psgc_code: location.code,
      label: location.name,
      detail: location.full_name,
      street: '',
      house_no: '',
      latitude: null,
      longitude: null,
      is_main: false,
      rider_note: '',
    }));
  },

  async searchPsgcLocations(query) {
    if (!query.trim()) return [];
    if (!config.useMock) {
      const params = new URLSearchParams({ query: query.trim() });
      return apiRequest(`/locations/psgc/search?${params.toString()}`);
    }
    return searchMockLocations(query);
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
        ({ coords }) => resolve({
          state: 'granted',
          position: { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy },
        }),
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
