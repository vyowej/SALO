import { config } from '../config';
import { apiRequest } from './apiClient';

const mockChecklist = [
  { key: 'profile', label: 'Complete restaurant profile', complete: false, href: '/business/profile' },
  { key: 'hours', label: 'Confirm opening hours', complete: false, href: '/business/hours' },
  { key: 'menu', label: 'Add and publish menu items', complete: false, href: '/business/menu' },
  { key: 'tables', label: 'Set up reservation tables', complete: false, href: '/business/tables' },
  { key: 'publish', label: 'Review publish checklist', complete: false, href: '/business/publish' },
];

export const businessService = {
  async getWorkspace(restaurantId, user) {
    if (!restaurantId) throw new Error('Select an active restaurant to open the Business workspace.');
    if (!config.useMock) {
      return apiRequest(`/manage/restaurants/${encodeURIComponent(restaurantId)}/business`);
    }

    await new Promise((resolve) => setTimeout(resolve, config.mockDelay));
    const membership = user?.memberships?.find((item) => item.restaurant_id === String(restaurantId));
    return {
      restaurant: {
        id: String(restaurantId),
        name: membership?.restaurant_name || 'Mang Toma Kitchen',
        status: 'approved',
        is_published: false,
        is_read_only: false,
        role: membership?.role || 'owner',
        permissions: membership?.permissions || [],
      },
      setup_checklist: mockChecklist,
    };
  },
};

export default businessService;
