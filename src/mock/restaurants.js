import foodPlaceholder from '../assets/food-placeholder.svg';

export const categories = [
  'Filipino',
  'Grilled',
  'Rice Meals',
  'Noodles',
  'Seafood',
  'Desserts',
  'Drinks',
  'Vegetarian',
];

const restaurantSeeds = [
  {
    id: 'mang-toma',
    name: 'Mang Toma’s Kitchen',
    cuisine: 'Filipino',
    location: 'Quezon City',
    image: foodPlaceholder,
    rating: 4.8,
    deliveryTime: '18-25 min',
    deliveryFee: 35,
    isOpen: true,
    is_24_7: true,
    acceptsReservations: true,
    filipinoOnly: true,
    tags: ['Filipino', 'Pork-free', 'Popular'],
    description: 'Comforting Filipino classics for everyday salo-salo.',
    menu: [
      {
        category: 'Rice Meals',
        items: [
          { id: 'adobo-rice-bowl', name: 'Chicken Adobo Rice Bowl', price: 220, description: 'Braised chicken, garlic rice, atchara.', dietaryTags: ['Pork-free'], soldOut: false, options: [{ id: 'adobo-extra-rice', name: 'Extra garlic rice', price: 45 }, { id: 'adobo-add-egg', name: 'Add a fried egg', price: 35 }] },
          { id: 'crispy-pata', name: 'Crispy Pata Bowl', price: 310, description: 'Golden pork knuckle with vinegar dip.', dietaryTags: [], soldOut: true },
          { id: 'tinola-soup', name: 'Tinola with Rice', price: 240, description: 'Chicken tinola with ginger and greens.', dietaryTags: ['Pork-free'], soldOut: false },
        ],
      },
      {
        category: 'Desserts',
        items: [
          { id: 'halo-halo', name: 'Classic Halo-Halo', price: 150, description: 'Shaved ice, leche flan, ube and toppings.', dietaryTags: ['Vegetarian'], soldOut: false },
          { id: 'biko', name: 'Biko Slice', price: 110, description: 'Sweet coconut rice cake.', dietaryTags: ['Vegetarian'], soldOut: false },
        ],
      },
    ],
  },
  {
    id: 'nayon-kitchen',
    name: 'Nayon Kitchen',
    cuisine: 'Bicolano',
    location: 'Makati',
    image: foodPlaceholder,
    rating: 4.7,
    deliveryTime: '22-30 min',
    deliveryFee: 45,
    isOpen: true,
    acceptsReservations: true,
    filipinoOnly: true,
    tags: ['Filipino', 'Spicy', 'Seafood'],
    description: 'Bicol express and smoky seafood feasts with a local kick.',
    menu: [
      {
        category: 'Seafood',
        items: [
          { id: 'bicol-sisig', name: 'Bicol Seafood Sisig', price: 290, description: 'Shrimp, squid and chili-lime dressing.', dietaryTags: ['Pork-free'], soldOut: false },
          { id: 'sizzling-gulay', name: 'Sizzling Mixed Vegetables', price: 220, description: 'A colorful vegetable medley with garlic.', dietaryTags: ['Vegetarian'], soldOut: false },
        ],
      },
    ],
  },
  {
    id: 'bahay-ng-hapag',
    name: 'Bahay ng Hapag',
    cuisine: 'Home-style Filipino',
    location: 'Pasig',
    image: foodPlaceholder,
    rating: 4.9,
    deliveryTime: '20-28 min',
    deliveryFee: 40,
    isOpen: false,
    acceptsReservations: true,
    filipinoOnly: true,
    tags: ['Family', 'Rice Meals', 'Vegetarian'],
    description: 'A warm home kitchen serving crowd-pleasing Filipino fare.',
    menu: [
      {
        category: 'Signature Dishes',
        items: [
          { id: 'family-bahay-platter', name: 'Family Hapag Platter', price: 640, description: 'Adobo, sinigang, vegetables, and rice.', dietaryTags: [], soldOut: false },
          { id: 'veggie-bahay', name: 'Vegetable Kare-Kare', price: 260, description: 'Peanut stew with vegetables and bagoong.', dietaryTags: ['Vegetarian'], soldOut: false },
        ],
      },
    ],
  },
  {
    id: 'timpla-albay',
    name: 'Timpla ng Albay',
    cuisine: 'Bicol',
    location: 'Taguig',
    image: foodPlaceholder,
    rating: 4.6,
    deliveryTime: '15-22 min',
    deliveryFee: 30,
    isOpen: true,
    acceptsReservations: false,
    filipinoOnly: true,
    tags: ['Grilled', 'Seafood', 'Pork-free'],
    description: 'Bold and smoky Bicol dishes with the right amount of heat.',
    menu: [
      {
        category: 'Grilled',
        items: [
          { id: 'inihaw-na-tilapia', name: 'Inihaw na Tilapia', price: 280, description: 'Grilled tilapia and calamansi dip.', dietaryTags: ['Pork-free'], soldOut: false },
          { id: 'spicy-chicken', name: 'Spicy Chicken Skewers', price: 240, description: 'Bicol chili glaze and grilled peppers.', dietaryTags: ['Pork-free'], soldOut: false },
        ],
      },
    ],
  },
  {
    id: 'kalamansi-bahay',
    name: 'Kalamansi Bahay',
    cuisine: 'Ilocano',
    location: 'Cebu City',
    image: foodPlaceholder,
    rating: 4.5,
    deliveryTime: '24-32 min',
    deliveryFee: 42,
    isOpen: true,
    acceptsReservations: false,
    filipinoOnly: true,
    tags: ['Rice Meals', 'Vegetarian'],
    description: 'Hearty Ilocano comfort food with bright citrus notes.',
    menu: [
      {
        category: 'Rice Meals',
        items: [
          { id: 'pinapaitan', name: 'Pinapaitan Rice Meal', price: 250, description: 'Goat stew with peppery broth.', dietaryTags: [], soldOut: false },
          { id: 'laing', name: 'Laing Bowl', price: 220, description: 'Taro leaves in coconut milk.', dietaryTags: ['Vegetarian'], soldOut: false },
        ],
      },
    ],
  },
  {
    id: 'pista-kape',
    name: 'Pista at Kape',
    cuisine: 'Cafe Filipino',
    location: 'Davao',
    image: foodPlaceholder,
    rating: 4.8,
    deliveryTime: '12-20 min',
    deliveryFee: 25,
    isOpen: true,
    acceptsReservations: true,
    filipinoOnly: true,
    tags: ['Drinks', 'Desserts'],
    description: 'Coffeehouse classics with a Filipino twist and sweets.',
    menu: [
      {
        category: 'Coffee & Drinks',
        items: [
          { id: 'kapeng-barako', name: 'Kapeng Barako', price: 120, description: 'Bold local coffee in a warm cup.', dietaryTags: [], soldOut: false },
          { id: 'sago-gulaman', name: 'Sago’t Gulaman', price: 90, description: 'Refreshing chilled drink with tapioca pearls.', dietaryTags: ['Vegetarian'], soldOut: false },
        ],
      },
      {
        category: 'Desserts',
        items: [
          { id: 'matamis-na-bao', name: 'Matamis na Bao', price: 160, description: 'Soft bun with caramel drizzle.', dietaryTags: ['Vegetarian'], soldOut: false },
        ],
      },
    ],
  },
  {
    id: 'harana-grill',
    name: 'Harana Grill House',
    cuisine: 'Filipino Grill',
    location: 'Pasay',
    image: foodPlaceholder,
    rating: 4.7,
    deliveryTime: '18-26 min',
    deliveryFee: 38,
    isOpen: true,
    acceptsReservations: true,
    filipinoOnly: true,
    tags: ['Grilled', 'Halal Certified', 'Popular'],
    description: 'Halal-certified grill favorites and shareable seafood platters.',
    menu: [
      {
        category: 'Grill',
        items: [
          { id: 'halal-chicken-inasal', name: 'Halal Chicken Inasal', price: 260, description: 'Marinated chicken, rice, and calamansi.', dietaryTags: ['Halal Certified'], soldOut: false },
          { id: 'grilled-bangus', name: 'Grilled Bangus', price: 290, description: 'Milkfish grilled to perfection.', dietaryTags: ['Pork-free'], soldOut: true },
        ],
      },
    ],
  },
  {
    id: 'lutong-baryo',
    name: 'Lutong Baryo',
    cuisine: 'Kapampangan',
    location: 'Bacolod',
    image: foodPlaceholder,
    rating: 4.4,
    deliveryTime: '25-35 min',
    deliveryFee: 50,
    isOpen: true,
    acceptsReservations: false,
    filipinoOnly: true,
    tags: ['Noodles', 'Rice Meals'],
    description: 'Kapampangan classics and old-family recipes with heavy flavor.',
    menu: [
      {
        category: 'Noodles',
        items: [
          { id: 'bistro-sisig-noodles', name: 'Sisig Noodles', price: 230, description: 'A wok-tossed noodle bowl with sisig bits.', dietaryTags: [], soldOut: false },
          { id: 'pancit-bato', name: 'Pancit Bato', price: 200, description: 'Noodles with veggies and savory sauce.', dietaryTags: ['Vegetarian'], soldOut: false },
        ],
      },
    ],
  },
  {
    id: 'dagat-kusina',
    name: 'Dagat Kusina',
    cuisine: 'Seafood Filipino',
    location: 'Iloilo',
    image: foodPlaceholder,
    rating: 4.6,
    deliveryTime: '20-27 min',
    deliveryFee: 44,
    isOpen: true,
    acceptsReservations: true,
    filipinoOnly: true,
    tags: ['Seafood', 'Filipino'],
    description: 'Fresh seafood and Filipino favorites served seaside style.',
    menu: [
      {
        category: 'Seafood',
        items: [
          { id: 'sinigang-bangus', name: 'Sinigang na Bangus', price: 320, description: 'Fresh milkfish in tamarind broth.', dietaryTags: ['Pork-free'], soldOut: false },
          { id: 'garlic-shrimp', name: 'Garlic Butter Shrimp', price: 340, description: 'Buttery shrimp with garlic rice.', dietaryTags: ['Pork-free'], soldOut: false },
        ],
      },
    ],
  },
  {
    id: 'saging-bahay',
    name: 'Saging Bahay',
    cuisine: 'Dessert & Snacks',
    location: 'Cagayan de Oro',
    image: foodPlaceholder,
    rating: 4.9,
    deliveryTime: '10-15 min',
    deliveryFee: 20,
    isOpen: true,
    acceptsReservations: false,
    filipinoOnly: true,
    tags: ['Desserts', 'Drinks', 'Sweet'],
    description: 'Filipino sweets and easy bites for any kind of gathering.',
    menu: [
      {
        category: 'Sweets',
        items: [
          { id: 'mais-con-yele', name: 'Mais con Yelo', price: 80, description: 'Corn ice dessert with sweet toppings.', dietaryTags: ['Vegetarian'], soldOut: false },
          { id: 'turon', name: 'Turon Rolls', price: 90, description: 'Banana spring rolls with caramel glaze.', dietaryTags: ['Vegetarian'], soldOut: false },
        ],
      },
    ],
  },
  {
    id: 'kubo-kusina',
    name: 'Kubo Kusina',
    cuisine: 'Filipino comfort food',
    location: 'Mandaluyong',
    image: foodPlaceholder,
    rating: 4.7,
    deliveryTime: '16-24 min',
    deliveryFee: 0,
    isOpen: true,
    acceptsReservations: true,
    filipinoOnly: true,
    tags: ['Filipino', 'Pork-free', 'Vegetarian'],
    description: 'Comfort food made for weekday lunches and family dinners.',
    menu: [{ category: 'Favorites', items: [{ id: 'kubo-adobo', name: 'Adobo sa Gata', price: 245, description: 'Chicken adobo simmered in coconut milk.', dietaryTags: ['Pork-free'], soldOut: false }] }],
  },
  {
    id: 'sarap-seoul',
    name: 'Sarap Seoul',
    cuisine: 'Filipino-Korean',
    location: 'Makati',
    image: foodPlaceholder,
    rating: 4.6,
    deliveryTime: '20-30 min',
    deliveryFee: 40,
    isOpen: true,
    acceptsReservations: false,
    filipinoOnly: false,
    tags: ['Grilled', 'Halal Certified', 'Popular'],
    description: 'A lively mix of Korean grill favorites and Filipino sides.',
    menu: [{ category: 'Grill', items: [{ id: 'sarap-chicken', name: 'Soy Garlic Chicken', price: 285, description: 'Crispy chicken with garlic soy glaze.', dietaryTags: ['Halal Certified'], soldOut: false }] }],
  },
  {
    id: 'gulay-garden',
    name: 'Gulay Garden',
    cuisine: 'Plant-based Filipino',
    location: 'Pasig',
    image: foodPlaceholder,
    rating: 4.8,
    deliveryTime: '14-22 min',
    deliveryFee: 25,
    isOpen: true,
    acceptsReservations: true,
    filipinoOnly: true,
    tags: ['Vegetarian', 'Pork-free', 'Filipino'],
    description: 'Colorful plant-forward plates inspired by Filipino home cooking.',
    menu: [{ category: 'Plant-based', items: [{ id: 'gulay-kare', name: 'Vegetable Kare-Kare', price: 270, description: 'Seasonal vegetables in peanut sauce.', dietaryTags: ['Vegetarian', 'Pork-free'], soldOut: false }] }],
  },
];

const days = Array.from({ length: 7 }, (_, index) => String(index));
const cityCoordinates = {
  'Quezon City': { latitude: 14.6516, longitude: 121.0493 },
  Makati: { latitude: 14.5547, longitude: 121.0244 },
  Taguig: { latitude: 14.5176, longitude: 121.0509 },
  Pasig: { latitude: 14.5764, longitude: 121.0851 },
  'Cebu City': { latitude: 10.3157, longitude: 123.8854 },
  Davao: { latitude: 7.1907, longitude: 125.4553 },
  Pasay: { latitude: 14.5378, longitude: 121.0014 },
  Bacolod: { latitude: 10.6765, longitude: 122.9509 },
  Manila: { latitude: 14.5995, longitude: 120.9842 },
  Mandaluyong: { latitude: 14.5794, longitude: 121.0359 },
};

export const restaurants = restaurantSeeds.map((restaurant, index) => {
  const shifts = index === 1
    ? [{ open: '06:00', close: '14:35' }]
    : index === 2
      ? [{ open: '15:00', close: '23:00' }]
      : index === 3
        ? [{ open: '09:00', close: '10:00' }]
        : index === 4
          ? [{ open: '09:00', close: '22:00' }]
          : [{ open: '09:00', close: '22:00' }];

  return {
    ...restaurant,
    ...cityCoordinates[restaurant.location] || cityCoordinates['Quezon City'],
    priceLevel: restaurant.priceLevel || (index % 3 === 0 ? '₱' : index % 3 === 1 ? '₱₱' : '₱₱₱'),
    distanceKm: restaurant.distanceKm || (1.2 + (index % 6) * 0.6),
    delivery_radius_km: restaurant.delivery_radius_km || 8,
    is_24_7: Boolean(restaurant.is_24_7),
    acceptsDelivery: restaurant.acceptsDelivery !== false,
    acceptsWalkIn: restaurant.acceptsWalkIn !== false,
    promo: restaurant.promo || index === 0,
    paused: index === 4,
    closureDates: restaurant.closureDates || (index === 7 ? ['2026-12-25'] : []),
    operatingHours: Object.fromEntries(days.map((day) => [day, shifts])),
  };
});

export const sampleUser = {
  name: 'Mia Santos',
  email: 'mia@salo.app',
  avatar: 'MS',
};

export const savedAddresses = [
  { id: 'home', label: 'Home', detail: '123 Sampaguita Street, Quezon City', primary: true },
  { id: 'office', label: 'Office', detail: 'BGC Corporate Center, Taguig', primary: false },
  { id: 'school', label: 'School', detail: 'Ateneo de Manila, Quezon City', primary: false },
  { id: 'other', label: 'Other', detail: 'Makati Medical Tower, Makati', primary: false },
];

export const userProfile = {
  name: 'Mia Santos',
  email: 'mia@salo.app',
  phone: '+63 917 111 2222',
  birthday: '1995-07-14',
  city: 'Quezon City',
};

export const orders = [
  { id: 'ORD-1042', restaurant: 'Mang Toma’s Kitchen', status: 'Preparing', total: 1280.5, date: '2026-10-28', items: 'Chicken adobo bowl x2, Halo-halo x1' },
  { id: 'ORD-1039', restaurant: 'Pista at Kape', status: 'On the way', total: 540, date: '2026-10-27', items: 'Kapeng barako x2, Sago’t gulaman x1' },
  { id: 'ORD-1028', restaurant: 'Dagat Kusina', status: 'Delivered', total: 1100, date: '2026-10-21', items: 'Sinigang na bangus x1, Garlic shrimp x1' },
];

export const reservations = [
  { id: 'RES-201', restaurant: 'Bahay ng Hapag', date: '2026-11-08', time: '7:30 PM', guests: 4, status: 'Pending' },
  { id: 'RES-198', restaurant: 'Mang Toma’s Kitchen', date: '2026-11-14', time: '6:00 PM', guests: 6, status: 'Confirmed' },
  { id: 'RES-190', restaurant: 'Harana Grill House', date: '2026-11-02', time: '8:00 PM', guests: 3, status: 'Completed' },
];

export const appSettings = {
  notifications: true,
  promotions: true,
  reservationReminders: true,
  darkMode: false,
  soundAlerts: false,
};
