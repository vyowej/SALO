export const defaultMockAddress = {
  region: 'National Capital Region (NCR)',
  province: 'Metro Manila',
  city_municipality: 'Quezon City',
  barangay: 'Bagong Pag-asa',
  street: 'Sampaguita Street',
  house_no: '',
  latitude: 14.6516,
  longitude: 121.0493,
};

export const mockPlaceSearchResults = [
  { ...defaultMockAddress, label: 'Home', detail: 'Sampaguita Street, Quezon City' },
  {
    ...defaultMockAddress,
    city_municipality: 'Makati City',
    barangay: 'Bel-Air',
    label: 'Office',
    detail: 'Bel-Air, Makati City',
  },
];

export const defaultMockCoordinates = { latitude: 14.6516, longitude: 121.0493 };
