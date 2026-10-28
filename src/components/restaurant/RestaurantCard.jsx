import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, MapPin, Star } from 'lucide-react';
import { formatPeso } from '../../utils/formatPeso';
import { getOpenStatus } from '../../utils/getOpenStatus';
import { useLocationContext } from '../../context/LocationContext';
import { locationService } from '../../services/locationService';

export function RestaurantCard({ restaurant }) {
  const openStatus = getOpenStatus(restaurant);
  const isAcceptingOrders = openStatus.status === 'open' || openStatus.status === 'closing-soon';
  const imageTag = restaurant.deliveryFee === 0 ? 'Free delivery' : restaurant.promo ? 'Promo' : restaurant.acceptsReservations ? 'Reserve' : '';
  const { selectedAddress } = useLocationContext();
  const [distanceResult, setDistanceResult] = useState(null);

  useEffect(() => {
    let active = true;
    if (!selectedAddress?.latitude || !restaurant.latitude) return undefined;
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
  const distance = resultMatchesAddress ? distanceResult.distance : restaurant.distanceKm || 2.4;
  const outsideRange = resultMatchesAddress && distance > restaurant.delivery_radius_km;

  return (
    <Link
      to={`/restaurants/${restaurant.id}`}
      className={`restaurant-card ${isAcceptingOrders ? '' : 'restaurant-card--unavailable'}`}
      aria-label={`${restaurant.name}. ${openStatus.label}. ${isAcceptingOrders ? 'Order now or view menu' : 'View menu'}`}
    >
      <div className="restaurant-card__image-wrap">
        <img src={restaurant.image} alt="" className="restaurant-card__image" loading="lazy" />
        <span className={`restaurant-status restaurant-status--${openStatus.status}`}>
          <i aria-hidden="true" />{openStatus.label}
        </span>
        <span className="restaurant-rating"><Star size={12} fill="currentColor" /> {restaurant.rating}</span>
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
          <span><Clock3 size={13} /> {restaurant.deliveryTime}</span>
          <span>{outsideRange ? 'Pick-up available' : restaurant.deliveryFee === 0 ? 'Free delivery' : formatPeso(restaurant.deliveryFee)}</span>
          <span><MapPin size={13} /> {distance.toFixed(1)} km away</span>
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
