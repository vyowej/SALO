import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, MapPin } from 'lucide-react';
import { formatPeso } from '../../utils/formatPeso';
import { getOpenStatus } from '../../utils/getOpenStatus';
import { useLocationContext } from '../../context/LocationContext';
import { locationService } from '../../services/locationService';
import ImageWithFallback from '../ui/ImageWithFallback';
import StarRating from '../ui/StarRating';

export function RestaurantCard({ restaurant }) {
  const openStatus = getOpenStatus(restaurant);
  const isAcceptingOrders = openStatus.status === 'open' || openStatus.status === 'closing-soon';
  const imageTag = restaurant.acceptsReservations ? 'Reserve' : '';
  const { selectedAddress } = useLocationContext();
  const [distanceResult, setDistanceResult] = useState(null);

  useEffect(() => {
    let active = true;
    if (selectedAddress?.latitude === null || selectedAddress?.latitude === undefined
      || selectedAddress?.longitude === null || selectedAddress?.longitude === undefined
      || restaurant.latitude === null || restaurant.latitude === undefined
      || restaurant.longitude === null || restaurant.longitude === undefined) return undefined;
    locationService.getDistanceKm(selectedAddress, restaurant).then((value) => {
      if (!active) return;
      setDistanceResult({
        restaurantId: restaurant.id,
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
        distance: value,
      });
    }).catch((error) => console.error('Unable to calculate restaurant delivery distance.', error));
    return () => { active = false; };
  }, [restaurant, selectedAddress]);
  const resultMatchesAddress = distanceResult?.restaurantId === restaurant.id
    && distanceResult.latitude === selectedAddress?.latitude
    && distanceResult.longitude === selectedAddress?.longitude;
  const distance = resultMatchesAddress ? distanceResult.distance : restaurant.distanceKm;
  const hasDeliveryRadius = restaurant.delivery_radius_km !== null && restaurant.delivery_radius_km !== undefined;
  const outsideRange = distance !== null && distance !== undefined
    && hasDeliveryRadius && distance > restaurant.delivery_radius_km;
  const deliveryFeeLabel = restaurant.deliveryFee === null || restaurant.deliveryFee === undefined
    ? 'Fee at checkout'
    : restaurant.deliveryFee === 0 ? 'Free delivery' : formatPeso(restaurant.deliveryFee);

  return (
    <Link
      to={`/restaurants/${restaurant.id}`}
      className={`restaurant-card ${isAcceptingOrders ? '' : 'restaurant-card--unavailable'}`}
      aria-label={`${restaurant.name}. ${openStatus.label}. ${isAcceptingOrders ? 'Order now or view menu' : 'View menu'}`}
    >
      <div className="restaurant-card__image-wrap">
        <ImageWithFallback src={restaurant.image} alt="" className="restaurant-card__image" loading="lazy" />
        <span className={`restaurant-status restaurant-status--${openStatus.status}`}>
          <i aria-hidden="true" />{openStatus.label}
        </span>
        <span className="restaurant-rating"><StarRating value={restaurant.rating} count={restaurant.ratingCount} size={12} /></span>
        {imageTag ? <span className="restaurant-image-tag">{imageTag}</span> : null}
        {outsideRange ? <span className="restaurant-range-badge">Outside delivery range</span> : null}
      </div>
      <div className="restaurant-card__content">
        <div className="restaurant-card__header">
          <div>
            <h3>{restaurant.name}</h3>
            <p>{restaurant.cuisine} · {restaurant.priceLevel || '₱₱'}</p>
          </div>
        </div>
        <div className="restaurant-card__meta">
          <span><Clock3 size={13} /> {restaurant.deliveryTime || 'Timing at checkout'}</span>
          <span>{outsideRange ? 'Pick-up available' : deliveryFeeLabel}</span>
          <span><MapPin size={13} /> {distance === null || distance === undefined ? 'Distance unavailable' : `${Number(distance).toFixed(1)} km away`}</span>
        </div>
        <div className="restaurant-card__tags">
          {(restaurant.tags || []).filter((tag) => ['Pork-free', 'Halal Certified', 'Vegetarian'].includes(tag)).slice(0, 2).map((tag) => (
            <span key={tag} className="restaurant-card__tag">{tag}</span>
          ))}
        </div>
        <span className="restaurant-card__action">{isAcceptingOrders ? 'Order now' : 'View menu'} <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  );
}

export default RestaurantCard;
