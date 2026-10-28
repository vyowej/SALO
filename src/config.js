export const config = {
  useMock: import.meta.env.VITE_USE_MOCK !== 'false',
  mockDelay: 750,
  locationProvider: import.meta.env.VITE_LOCATION_PROVIDER || 'mock',
};

export default config;
