import { useAuth } from '../context/AuthContext';

export function useCan(permission, restaurantId) {
  const { user } = useAuth();
  const selectedRestaurantId = restaurantId ?? user?.selected_restaurant_id;

  return Boolean(user?.memberships?.some((membership) => (
    membership.restaurant_id === String(selectedRestaurantId)
    && membership.status === 'active'
    && membership.permissions?.includes(permission)
  )));
}
