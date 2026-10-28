import { Skeleton } from '../ui/Skeleton';

export function RestaurantCardSkeleton() {
  return (
    <div className="restaurant-card skeleton-card">
      <Skeleton variant="card" className="restaurant-card__image skeleton-card__image" />
      <div className="restaurant-card__content">
        <Skeleton variant="text" className="skeleton-card__line skeleton-card__line--long" />
        <Skeleton variant="text" className="skeleton-card__line" />
        <Skeleton variant="text" className="skeleton-card__line skeleton-card__line--short" />
      </div>
    </div>
  );
}

export default RestaurantCardSkeleton;
