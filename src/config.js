export const config = {
  useMock: import.meta.env.VITE_USE_MOCK !== 'false',
  apiBaseUrl: import.meta.env.VITE_SALO_API_URL || '',
  mockDelay: 750,
  locationProvider: import.meta.env.VITE_LOCATION_PROVIDER || 'mock',
};

export default config;
