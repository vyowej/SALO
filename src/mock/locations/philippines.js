export const regions = [
  { code: '130000000', name: 'National Capital Region (NCR)' },
  { code: '030000000', name: 'Central Luzon' },
  { code: '040000000', name: 'CALABARZON' },
  { code: '090000000', name: 'Zamboanga Peninsula' },
];

export const provinces = {
  '130000000': [{ code: '130000000', name: 'Metro Manila' }],
  '030000000': [
    { code: '030800000', name: 'Bulacan' },
    { code: '031400000', name: 'Pampanga' },
  ],
  '040000000': [
    { code: '042100000', name: 'Rizal' },
    { code: '043400000', name: 'Laguna' },
  ],
  '090000000': [
    { code: '097200000', name: 'Zamboanga del Sur' },
    { code: '097300000', name: 'Zamboanga del Norte' },
  ],
};

export const cities = {
  '130000000': [
    { code: '137404000', name: 'Quezon City' },
    { code: '137602000', name: 'Makati City' },
    { code: '137607000', name: 'Taguig City' },
  ],
  '030800000': [{ code: '031405000', name: 'Malolos City' }],
  '031400000': [{ code: '035416000', name: 'Angeles City' }],
  '042100000': [{ code: '045802000', name: 'Antipolo City' }],
  '043400000': [{ code: '043424000', name: 'Santa Rosa City' }],
  '097200000': [{ code: '097332000', name: 'Pagadian City' }],
  '097300000': [{ code: '097305000', name: 'Dipolog City' }],
};

export const barangays = {
  '137404000': [{ code: '137404001', name: 'Alicia' }, { code: '137404002', name: 'Batasan Hills' }, { code: '137404003', name: 'Bagong Pag-asa' }],
  '137602000': [{ code: '137602001', name: 'Bel-Air' }, { code: '137602002', name: 'Poblacion' }, { code: '137602003', name: 'San Lorenzo' }],
  '137607000': [{ code: '137607001', name: 'Fort Bonifacio' }, { code: '137607002', name: 'Ususan' }],
  '031405000': [{ code: '031405001', name: 'Atlag' }, { code: '031405002', name: 'San Agustin' }],
  '035416000': [{ code: '035416001', name: 'Balibago' }, { code: '035416002', name: 'Malabanias' }],
  '045802000': [{ code: '045802001', name: 'Cupang' }, { code: '045802002', name: 'Dela Paz' }],
  '043424000': [{ code: '043424001', name: 'Balibago' }, { code: '043424002', name: 'Don Jose' }],
  '097332000': [{ code: '097332001', name: 'Balangasan' }, { code: '097332002', name: 'San Francisco' }],
  '097305000': [{ code: '097305001', name: 'Central' }, { code: '097305002', name: 'Minaog' }],
};
