import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCw, Search, SlidersHorizontal } from 'lucide-react';
import RestaurantCard from '../../components/restaurant/RestaurantCard';
import { restaurantService } from '../../services/restaurantService';
import { getOpenStatus } from '../../utils/getOpenStatus';
import '../Page.css';

const availableFilters = ['Open now', 'Filipino only', 'Pork-free', 'Halal-certified', 'Vegetarian', 'Reservations', 'Free delivery'];

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const selectedCuisine = searchParams.get('cuisine') || 'All';
  const sortBy = searchParams.get('sort') || 'Recommended';
  const selectedFiltersValue = searchParams.get('filters') || '';
  const selectedFilters = useMemo(() => selectedFiltersValue.split(',').filter(Boolean), [selectedFiltersValue]);

  const loadRestaurants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRestaurants(await restaurantService.getAllRestaurants());
    } catch (loadError) {
      console.error('Unable to load restaurants.', loadError);
      setError('We couldn’t load restaurants right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    restaurantService.getAllRestaurants()
      .then((items) => { if (active) setRestaurants(items); })
      .catch((loadError) => {
        console.error('Unable to load restaurants.', loadError);
        if (active) setError('We couldn’t load restaurants right now.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'All') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const toggleFilter = (filter) => {
    const nextFilters = selectedFilters.includes(filter)
      ? selectedFilters.filter((item) => item !== filter)
      : [...selectedFilters, filter];
    setParam('filters', nextFilters.join(','));
  };

  const cuisines = useMemo(() => ['All', ...new Set(restaurants.map((restaurant) => restaurant.cuisine))], [restaurants]);

  const filteredRestaurants = (() => {
    const cleanSearch = query.trim().toLowerCase();
    const results = restaurants.filter((restaurant) => {
      const dishes = restaurant.menu.flatMap((group) => group.items.map((item) => item.name)).join(' ');
      const text = `${restaurant.name} ${restaurant.cuisine} ${restaurant.tags.join(' ')} ${dishes}`.toLowerCase();
      const status = getOpenStatus(restaurant).status;
      const tags = restaurant.tags.join(' ').toLowerCase();
      const filterMatches = selectedFilters.every((filter) => {
        if (filter === 'Open now') return status === 'open' || status === 'closing-soon';
        if (filter === 'Filipino only') return restaurant.filipinoOnly;
        if (filter === 'Pork-free') return tags.includes('pork-free');
        if (filter === 'Halal-certified') return tags.includes('halal');
        if (filter === 'Vegetarian') return tags.includes('vegetarian');
        if (filter === 'Reservations') return restaurant.acceptsReservations;
        if (filter === 'Free delivery') return restaurant.deliveryFee === 0;
        return true;
      });

      return (selectedCuisine === 'All' || restaurant.cuisine === selectedCuisine)
        && (!cleanSearch || text.includes(cleanSearch))
        && filterMatches;
    });

    return results.sort((first, second) => {
      const firstOpen = ['open', 'closing-soon'].includes(getOpenStatus(first).status);
      const secondOpen = ['open', 'closing-soon'].includes(getOpenStatus(second).status);
      if (firstOpen !== secondOpen) return Number(secondOpen) - Number(firstOpen);
      if (sortBy === 'Fastest') return parseInt(first.deliveryTime, 10) - parseInt(second.deliveryTime, 10);
      if (sortBy === 'Rating') return second.rating - first.rating;
      if (sortBy === 'Nearest') return first.distanceKm - second.distanceKm;
      return 0;
    });
  })();

  return (
    <div className="data-page section-shell">
      <div className="page-header">
        <div><h1>Restaurants</h1><p>Find a table, a favorite meal, and a place that feels like home.</p></div>
        <div className="page-toolbar">
          <div className="search-box"><Search size={16} /><input type="search" value={query} onChange={(event) => setParam('q', event.target.value)} placeholder="Search restaurants or dishes" aria-label="Search restaurants" /></div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-row">
          <SlidersHorizontal size={16} />
          {cuisines.map((cuisine) => <button type="button" key={cuisine} className={['chip', selectedCuisine === cuisine ? 'chip--selected' : ''].filter(Boolean).join(' ')} onClick={() => setParam('cuisine', cuisine)}>{cuisine}</button>)}
        </div>
        <div className="filter-row">
          {availableFilters.map((filter) => <button type="button" key={filter} className={['chip', selectedFilters.includes(filter) ? 'chip--selected' : ''].filter(Boolean).join(' ')} onClick={() => toggleFilter(filter)}>{filter}</button>)}
          <label className="sort-control">Sort by
            <select value={sortBy} onChange={(event) => setParam('sort', event.target.value)}>
              {['Recommended', 'Fastest', 'Rating', 'Nearest'].map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="empty-state"><h3>Restaurants unavailable</h3><p>{error}</p><button className="btn btn--secondary" type="button" onClick={loadRestaurants}><RotateCw size={15} /> Try again</button></div>
      ) : loading ? (
        <div className="restaurant-list">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton-card" aria-label="Loading restaurants"><div className="skeleton skeleton-card__image" /><div className="skeleton-card__body"><div className="skeleton skeleton--text skeleton-card__line--long" /><div className="skeleton skeleton--text" /><div className="skeleton skeleton--text skeleton-card__line--short" /></div></div>)}</div>
      ) : filteredRestaurants.length ? (
        <div className="restaurant-list">{filteredRestaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} />)}</div>
      ) : (
        <div className="empty-state"><h3>No restaurants found</h3><p>Try a broader keyword or clear some filters.</p><button type="button" className="btn btn--secondary" onClick={() => setSearchParams({})}>Clear filters</button></div>
      )}
    </div>
  );
}
