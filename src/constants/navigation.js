import { USER_ROLES } from '../context/AuthContext';

export const SHELL_LABELS = {
  brand: 'SALO',
  tagline: 'Order. Reserve. Gather.',
  search: 'Search restaurants or dishes',
  searchShortcut: 'Ctrl K',
  closeSidebar: 'Collapse sidebar',
  expandSidebar: 'Expand sidebar',
  openSidebar: 'Open navigation',
  closeSidebarDrawer: 'Close navigation',
  switchMode: 'Switch mode',
  currentMode: 'Current mode',
  profile: 'Profile',
  settings: 'Settings',
  help: 'Help',
  darkMode: 'Dark Mode',
  logout: 'Logout',
  notifications: 'Notifications',
  noNotifications: "You're all caught up.",
  accountMenu: 'Account menu',
  navigationSearch: 'Filter navigation',
  noNavigationResults: 'No matching pages.',
  navigation: 'Main navigation',
  breadcrumbNav: 'Breadcrumbs',
  searchSuggestions: 'Search restaurants or dishes',
  deliverTo: 'Deliver to',
  chooseAddress: 'Choose address',
  shoppingCart: 'Shopping cart',
  items: 'items',
  login: 'Login',
  signUp: 'Sign Up',
  switchView: 'Switch view',
  current: 'Current',
  addRestaurant: 'Add Your Restaurant',
  becomeRider: 'Become a Rider',
  signOutError: 'We couldn’t sign you out. Please try again.',
  menu: 'Menu',
  close: 'Close',
  homeLink: 'SALO - Order. Reserve. Gather.',
  marketingLinks: 'Primary links',
  moreWithSalo: 'More with SALO',
  themeOn: 'On',
  themeOff: 'Off',
  cart: 'Cart',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  mobileSearch: 'Search restaurants or dishes',
  submitSearch: 'Search',
  home: 'Home',
  restaurants: 'Restaurants',
  reserveTable: 'Reserve a Table',
  howItWorks: 'How It Works',
  customer: 'Customer',
  owner: 'My Restaurant',
  rider: 'Rider',
  admin: 'Admin',
  groups: {
    discover: 'Discover',
    activity: 'Your activity',
    workspace: 'Workspace',
    account: 'Account',
  },
  pages: {
    home: 'Home',
    restaurants: 'Restaurants',
    restaurant: 'Restaurant details',
    cart: 'Cart',
    checkout: 'Checkout',
    orders: 'Orders',
    order: 'Order details',
    reservations: 'Reservations',
    newReservation: 'Reserve a Table',
    reserve: 'Reserve a Table',
    profile: 'Profile',
    settings: 'Settings',
    dashboard: 'Restaurant Dashboard',
    rider: 'Rider Dashboard',
    admin: 'Admin Console',
    partner: 'Partner application',
    riderApplication: 'Rider application',
    login: 'Log in',
    register: 'Create account',
    forgotPassword: 'Reset password',
    notFound: 'Page not found',
  },
  breadcrumbGroups: {
    home: 'Home',
    dashboard: 'Workspace',
    rider: 'Delivery',
    admin: 'Administration',
  },
  nav: {
    home: 'Home',
    restaurants: 'Restaurants',
    reservations: 'Reservations',
    orders: 'Orders',
    cart: 'Cart',
    profile: 'Account',
    dashboard: 'Overview',
    rider: 'Overview',
    admin: 'Overview',
    settings: 'Settings',
  },
};

export const PUBLIC_NAV_LINKS = [
  { label: SHELL_LABELS.home, path: '/' },
  { label: SHELL_LABELS.restaurants, path: '/restaurants' },
  { label: SHELL_LABELS.reserveTable, path: '/reserve' },
  { label: SHELL_LABELS.howItWorks, path: '/#how-it-works' },
];

export const ROLE_LABELS = {
  [USER_ROLES.CUSTOMER]: SHELL_LABELS.customer,
  [USER_ROLES.RESTAURANT_OWNER]: SHELL_LABELS.owner,
  [USER_ROLES.RIDER]: SHELL_LABELS.rider,
  [USER_ROLES.ADMIN]: SHELL_LABELS.admin,
};

export const ROLE_PATHS = {
  [USER_ROLES.CUSTOMER]: '/',
  [USER_ROLES.RESTAURANT_OWNER]: '/dashboard',
  [USER_ROLES.RIDER]: '/rider',
  [USER_ROLES.ADMIN]: '/admin',
};

export function getShellRole(pathname, activeRole, capabilities) {
  const routeRoles = {
    '/dashboard': USER_ROLES.RESTAURANT_OWNER,
    '/rider': USER_ROLES.RIDER,
    '/admin': USER_ROLES.ADMIN,
  };
  const routeRole = routeRoles[pathname];
  return routeRole && capabilities.includes(routeRole) ? routeRole : activeRole;
}

export const NAVIGATION_GROUPS = {
  [USER_ROLES.CUSTOMER]: [
    {
      label: SHELL_LABELS.groups.discover,
      items: [
        { label: SHELL_LABELS.nav.home, path: '/', icon: 'home' },
        { label: SHELL_LABELS.nav.restaurants, path: '/restaurants', icon: 'store' },
      ],
    },
    {
      label: SHELL_LABELS.groups.activity,
      items: [
        { label: SHELL_LABELS.nav.reservations, path: '/reservations', icon: 'calendar' },
        { label: SHELL_LABELS.nav.orders, path: '/orders', icon: 'orders' },
        { label: SHELL_LABELS.nav.cart, path: '/cart', icon: 'cart' },
      ],
    },
    {
      label: SHELL_LABELS.groups.account,
      items: [{ label: SHELL_LABELS.nav.profile, path: '/profile', icon: 'account' }],
    },
  ],
  [USER_ROLES.RESTAURANT_OWNER]: [
    {
      label: SHELL_LABELS.groups.workspace,
      items: [{ label: SHELL_LABELS.nav.dashboard, path: '/dashboard', icon: 'store' }],
    },
    {
      label: SHELL_LABELS.groups.activity,
      items: [
        { label: SHELL_LABELS.nav.orders, path: '/orders', icon: 'orders' },
        { label: SHELL_LABELS.nav.reservations, path: '/reservations', icon: 'calendar' },
      ],
    },
  ],
  [USER_ROLES.RIDER]: [
    {
      label: SHELL_LABELS.groups.workspace,
      items: [{ label: SHELL_LABELS.nav.rider, path: '/rider', icon: 'rider' }],
    },
    {
      label: SHELL_LABELS.groups.account,
      items: [
        { label: SHELL_LABELS.nav.profile, path: '/profile', icon: 'account' },
        { label: SHELL_LABELS.nav.settings, path: '/settings', icon: 'settings' },
      ],
    },
  ],
  [USER_ROLES.ADMIN]: [
    {
      label: SHELL_LABELS.groups.workspace,
      items: [{ label: SHELL_LABELS.nav.admin, path: '/admin', icon: 'admin' }],
    },
    {
      label: SHELL_LABELS.groups.account,
      items: [
        { label: SHELL_LABELS.nav.profile, path: '/profile', icon: 'account' },
        { label: SHELL_LABELS.nav.settings, path: '/settings', icon: 'settings' },
      ],
    },
  ],
};

export const CUSTOMER_BOTTOM_NAV = [
  { label: SHELL_LABELS.nav.home, path: '/', icon: 'home' },
  { label: SHELL_LABELS.nav.restaurants, path: '/restaurants', icon: 'store' },
  { label: SHELL_LABELS.nav.reservations, path: '/reservations', icon: 'calendar' },
  { label: SHELL_LABELS.nav.orders, path: '/orders', icon: 'orders' },
  { label: SHELL_LABELS.nav.profile, path: '/profile', icon: 'account' },
];

export const PAGE_TITLES = [
  { path: '/restaurants/', title: SHELL_LABELS.pages.restaurant },
  { path: '/orders/', title: SHELL_LABELS.pages.order },
  { path: '/partner/apply', title: SHELL_LABELS.pages.partner },
  { path: '/rider/apply', title: SHELL_LABELS.pages.riderApplication },
  { path: '/forgot-password', title: SHELL_LABELS.pages.forgotPassword },
  { path: '/register', title: SHELL_LABELS.pages.register },
  { path: '/signup', title: SHELL_LABELS.pages.register },
  { path: '/login', title: SHELL_LABELS.pages.login },
  { path: '/restaurants', title: SHELL_LABELS.pages.restaurants },
  { path: '/reservations', title: SHELL_LABELS.pages.reservations },
  { path: '/reservations/new', title: SHELL_LABELS.pages.newReservation },
  { path: '/reserve', title: SHELL_LABELS.pages.reserve },
  { path: '/checkout', title: SHELL_LABELS.pages.checkout },
  { path: '/orders', title: SHELL_LABELS.pages.orders },
  { path: '/cart', title: SHELL_LABELS.pages.cart },
  { path: '/profile', title: SHELL_LABELS.pages.profile },
  { path: '/settings', title: SHELL_LABELS.pages.settings },
  { path: '/dashboard', title: SHELL_LABELS.pages.dashboard },
  { path: '/rider', title: SHELL_LABELS.pages.rider },
  { path: '/admin', title: SHELL_LABELS.pages.admin },
  { path: '/', title: SHELL_LABELS.pages.home },
];

export function getPageTitle(pathname) {
  return PAGE_TITLES.find((page) => page.path === pathname)?.title
    || PAGE_TITLES.find((page) => page.path.endsWith('/') && pathname.startsWith(page.path))?.title
    || SHELL_LABELS.pages.notFound;
}
