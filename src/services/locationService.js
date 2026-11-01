import { barangays, cities, provinces, regions } from '../mock/locations/philippines';
import { defaultMockAddress, defaultMockCoordinates, mockPlaceSearchResults } from '../mock/locationData';
import { locationSettings } from '../mock/locationSettings';
import { config } from '../config';
import { apiRequest } from './apiClient';

const wait = (ms = config.mockDelay) => new Promise((resolve) => setTimeout(resolve, ms));
let philippinesBoundsRequest;
const mockIndependentCities = [
  { code: '097332000', parent_code: '090000000', name: 'Zamboanga City', level: 'city' },
];
const unsupportedProvider = () => {
  if (config.locationProvider !== 'mock') {
    throw new Error(`The "${config.locationProvider}" location provider is configured but not implemented yet.`);
  }
};

const findByName = (list, term) => list.find((entry) => entry.name.toLowerCase().includes(term.toLowerCase()));
const loadPsgcLocations = (level, parentCode, search) => {
  const params = new URLSearchParams({ level });
  if (parentCode) params.set('parent_code', parentCode);
  if (search?.trim()) params.set('search', search.trim());
  return apiRequest(`/locations/psgc?${params.toString()}`);
};

const getMockPsgcLocations = () => {
  const baseLocations = [
    ...regions.map((entry) => ({ ...entry, level: 'region', parent_code: null })),
    ...Object.entries(provinces).flatMap(([regionCode, entries]) => (
      regionCode === '130000000'
        ? []
        : entries.map((entry) => ({ ...entry, level: 'province', parent_code: regionCode }))
    )),
    ...Object.entries(cities).flatMap(([parentCode, entries]) => entries
      .filter((entry) => entry.code !== '097332000')
      .map((entry) => ({ ...entry, level: 'city', parent_code: parentCode }))),
    ...mockIndependentCities,
    ...Object.entries(barangays).flatMap(([cityCode, entries]) => (
      cityCode === '097332000'
        ? []
        : entries.map((entry) => ({
          ...entry,
          level: 'barangay',
          parent_code: cityCode,
        }))
    )),
  ];
  const locationsByCode = new Map(baseLocations.map((location) => [location.code, location]));

  return baseLocations.map((location) => {
    const ancestors = [];
    let parent = locationsByCode.get(location.parent_code);
    while (parent) {
      ancestors.push(parent);
      parent = locationsByCode.get(parent.parent_code);
    }
    const chain = [location, ...ancestors];
    const ancestor = (level) => chain.find((entry) => entry.level === level);

    return {
      ...location,
      full_name: chain.map((entry) => entry.name).join(', '),
      region: ancestor('region')?.name || (location.level === 'region' ? location.name : ''),
      province: ancestor('province')?.name || '',
      city_municipality: ancestor('city')?.name || (location.level === 'city' ? location.name : ''),
      barangay: ancestor('barangay')?.name || (location.level === 'barangay' ? location.name : ''),
      region_code: ancestor('region')?.code || (location.level === 'region' ? location.code : ''),
      province_code: ancestor('province')?.code || '',
      city_code: ancestor('city')?.code || (location.level === 'city' ? location.code : ''),
      barangay_code: ancestor('barangay')?.code || (location.level === 'barangay' ? location.code : ''),
    };
  });
};

const listMockLocations = (level, parentCode, search = '') => {
  const term = search.trim().toLocaleLowerCase();
  return getMockPsgcLocations()
    .filter((location) => location.level === level)
    .filter((location) => !parentCode || location.parent_code === parentCode)
    .filter((location) => !term || location.name.toLocaleLowerCase().includes(term))
    .slice(0, 30);
};

const searchMockLocations = async (query, expectedLevel = null, parentCode = null) => {
  await wait(200);
  const term = query.trim().toLocaleLowerCase();
  return getMockPsgcLocations()
    .filter((entry) => entry.name.toLocaleLowerCase().includes(term)
      || entry.full_name.toLocaleLowerCase().includes(term))
    .filter((entry) => !expectedLevel || entry.level === expectedLevel)
    .filter((entry) => !parentCode || entry.parent_code === parentCode)
    .sort((left, right) => {
      const leftStarts = left.name.toLocaleLowerCase().startsWith(term);
      const rightStarts = right.name.toLocaleLowerCase().startsWith(term);
      return Number(rightStarts) - Number(leftStarts) || left.full_name.localeCompare(right.full_name);
    })
    .slice(0, 30)
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

  async getRegions(search = '') {
    if (!config.useMock) return loadPsgcLocations('region', null, search);
    await wait();
    unsupportedProvider();
    return listMockLocations('region', null, search);
  },

  async getProvinces(regionCode, search = '') {
    if (!config.useMock) return loadPsgcLocations('province', regionCode, search);
    await wait(300);
    unsupportedProvider();
    return listMockLocations('province', regionCode, search);
  },

  async getCities(provinceCode, search = '') {
    if (!config.useMock) return loadPsgcLocations('city', provinceCode, search);
    await wait(300);
    unsupportedProvider();
    return listMockLocations('city', provinceCode, search);
  },

  async getBarangays(cityCode, search = '') {
    if (!config.useMock) return loadPsgcLocations('barangay', cityCode, search);
    await wait(300);
    unsupportedProvider();
    return listMockLocations('barangay', cityCode, search);
  },

  async searchPlaces(query) {
    if (!query.trim()) return [];
    if (config.useMock) {
      await wait(200);
      return mockPlaceSearchResults.filter((place) => `${place.detail} ${place.label}`.toLowerCase().includes(query.toLowerCase()));
    }

    const params = new URLSearchParams({ q: query.trim(), limit: '5' });
    const result = await apiRequest(`/locations/places/search?${params.toString()}`);
    if (!Array.isArray(result?.suggestions)) {
      throw new Error('The location service returned invalid street suggestions.');
    }
    return result.suggestions;
  },

  async searchPsgcLocations(query, level = null, parentCode = null) {
    if (!query.trim()) return [];
    if (!config.useMock) {
      const params = new URLSearchParams({ query: query.trim() });
      if (level) params.set('level', level);
      if (parentCode) params.set('parent_code', parentCode);
      return apiRequest(`/locations/psgc/search?${params.toString()}`);
    }
    return searchMockLocations(query, level, parentCode);
  },

  async reverseGeocode(latitude, longitude) {
    if (!await this.isWithinPhilippines({ latitude, longitude })) {
      throw new Error('The pin must be within the supported Philippines coordinate bounds.');
    }
    if (config.useMock) {
      await wait(250);
      unsupportedProvider();
      const locations = getMockPsgcLocations();
      const city = locations.find((location) => (
        location.level === 'city'
        && location.name.toLocaleLowerCase() === defaultMockAddress.city_municipality.toLocaleLowerCase()
      ));
      const barangay = locations.find((location) => (
        location.level === 'barangay'
        && location.parent_code === city?.code
        && location.name.toLocaleLowerCase() === defaultMockAddress.barangay.toLocaleLowerCase()
      ));
      const provinceDisplay = city?.region_code === '130000000'
        ? 'Metro Manila (NCR)'
        : city && !city.province_code
          ? 'None (independent city)'
          : '';
      const addressParts = [
        defaultMockAddress.house_no,
        defaultMockAddress.street,
        barangay?.name,
        city?.name,
        city?.province || provinceDisplay,
        city?.region,
        'Philippines',
      ].filter(Boolean);

      return {
        country_code: 'PH',
        region_code: city?.region_code || '',
        province_code: city?.province_code || null,
        city_code: city?.code || null,
        barangay_code: barangay?.code || null,
        region: city?.region || '',
        province: city?.province || '',
        province_display: provinceDisplay,
        city: city?.name || '',
        barangay: barangay?.name || '',
        street: defaultMockAddress.street,
        house_no: defaultMockAddress.house_no,
        formatted_address: addressParts.join(', '),
        latitude,
        longitude,
        unresolved_components: [
          ...(!city ? ['city'] : []),
          ...(!barangay ? ['barangay'] : []),
        ],
      };
    }
    return apiRequest('/locations/places/reverse', {
      method: 'POST',
      body: { latitude, longitude },
    });
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
