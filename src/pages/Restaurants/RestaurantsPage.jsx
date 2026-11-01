import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCw, Search, SlidersHorizontal } from 'lucide-react';
import RestaurantCard from '../../components/restaurant/RestaurantCard';
import { restaurantService } from '../../services/restaurantService';
import { useLocationContext } from '../../context/LocationContext';
import '../Page.css';

const availableFilters = [
  'Open now',
  'Open 24/7',
  'Featured',
  'Filipino only',
  'Halal-certified',
  'Vegetarian',
  'Vegan',
  'Reservations',
];

const queryFor = (filters, selectedFilters, serviceMode, selectedAddress, sortBy) => {
  const query = {
    ...filters,
    service_mode: serviceMode,
    sort: sortBy === 'Nearest' ? 'nearest' : sortBy === 'Rating' ? 'rating' : 'popularity',
    per_page: 12,
  };
  if (selectedAddress?.latitude !== null && selectedAddress?.latitude !== undefined
    && selectedAddress?.longitude !== null && selectedAddress?.longitude !== undefined) {
    query.latitude = selectedAddress.latitude;
    query.longitude = selectedAddress.longitude;
  }
  selectedFilters.forEach((filter) => {
    if (filter === 'Open now') query.open_now = true;
    if (filter === 'Open 24/7') query.open_24_7 = true;
    if (filter === 'Featured') query.featured = true;
    if (filter === 'Filipino only') query.filipino_only = true;
    if (filter === 'Halal-certified') query.dietary = ['halal_certified'];
    if (filter === 'Vegetarian') query.dietary = ['vegetarian'];
    if (filter === 'Vegan') query.dietary = ['vegan'];
    if (filter === 'Reservations') query.accepts_reservations = true;
  });
  if (sortBy === 'Nearest' && (!query.latitude || !query.longitude)) query.sort = 'popularity';
  return query;
};

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const loadRequestId = useRef(0);
  const [pagination, setPagination] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedAddress } = useLocationContext();
  const query = searchParams.get('q') || '';
  const selectedCuisine = searchParams.get('cuisine') || 'All';
  const sortBy = searchParams.get('sort') || 'Popularity';
  const selectedFiltersValue = searchParams.get('filters') || '';
  const selectedFilters = useMemo(() => selectedFiltersValue.split(',').filter(Boolean), [selectedFiltersValue]);
  const serviceMode = searchParams.get('service_mode') || 'delivery';
  const requestFilters = useMemo(() => {
    const request = queryFor({
      q: query.trim(),
      cuisine: selectedCuisine === 'All' ? '' : selectedCuisine,
    }, selectedFilters, serviceMode, selectedAddress, sortBy);
    return request;
  }, [query, selectedAddress, selectedCuisine, selectedFilters, serviceMode, sortBy]);

  const loadRestaurants = useCallback(async (page = 1, append = false) => {
    const requestId = ++loadRequestId.current;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setLoadingMore(false);
      setError('');
    }

    try {
      const result = await restaurantService.getCustomerRestaurants({ ...requestFilters, page });
      if (requestId !== loadRequestId.current) return;
      setRestaurants((current) => append ? [...current, ...result.items] : result.items);
      setPagination(result.meta);
    } catch (loadError) {
      console.error('Unable to load restaurants.', loadError);
      if (requestId === loadRequestId.current) setError('We couldn’t load restaurants right now.');
    } finally {
      if (requestId === loadRequestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [requestFilters]);

  useEffect(() => {
    let active = true;
    restaurantService.getCategories()
      .then((items) => { if (active) setCategories(items); })
      .catch((categoryError) => {
        console.error('Unable to load restaurant categories.', categoryError);
        if (active) setError('We couldn’t load restaurant categories right now.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadRestaurants(1), 250);
    return () => window.clearTimeout(timer);
  }, [loadRestaurants]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'All') next.delete(key);
    else next.set(key, value);
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const toggleFilter = (filter) => {
    const dietaryFilters = ['Halal-certified', 'Vegetarian', 'Vegan'];
    const nextFilters = selectedFilters.includes(filter)
      ? selectedFilters.filter((item) => item !== filter)
      : [...selectedFilters.filter((item) => !dietaryFilters.includes(item) || !dietaryFilters.includes(filter)), filter];
    setParam('filters', nextFilters.join(','));
  };

  const chooseServiceMode = (mode) => setParam('service_mode', mode === 'delivery' ? '' : mode);

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
          {['All', ...categories].map((cuisine) => <button type="button" key={cuisine} className={['chip', selectedCuisine === cuisine ? 'chip--selected' : ''].filter(Boolean).join(' ')} onClick={() => setParam('cuisine', cuisine)}>{cuisine}</button>)}
        </div>
        <div className="filter-row" role="group" aria-label="Choose service mode">
          {['delivery', 'pickup'].map((mode) => <button type="button" key={mode} className={['chip', serviceMode === mode ? 'chip--selected' : ''].filter(Boolean).join(' ')} onClick={() => chooseServiceMode(mode)}>{mode === 'delivery' ? 'Delivery' : 'Pick-up'}</button>)}
        </div>
        <div className="filter-row">
          {availableFilters.map((filter) => <button type="button" key={filter} className={['chip', selectedFilters.includes(filter) ? 'chip--selected' : ''].filter(Boolean).join(' ')} onClick={() => toggleFilter(filter)}>{filter}</button>)}
          <label className="sort-control">Sort by
            <select value={sortBy} onChange={(event) => setParam('sort', event.target.value)}>
              {['Popularity', 'Rating', 'Nearest'].map((option) => <option key={option} disabled={option === 'Nearest' && !selectedAddress?.latitude}>{option}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="empty-state"><h3>Restaurants unavailable</h3><p>{error}</p><button className="btn btn--secondary" type="button" onClick={() => loadRestaurants(1)}><RotateCw size={15} /> Try again</button></div>
      ) : loading && !restaurants.length ? (
        <div className="restaurant-list">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton-card" aria-label="Loading restaurants"><div className="skeleton skeleton-card__image" /><div className="skeleton-card__body"><div className="skeleton skeleton--text skeleton-card__line--long" /><div className="skeleton skeleton--text" /><div className="skeleton skeleton--text skeleton-card__line--short" /></div></div>)}</div>
      ) : restaurants.length ? (
        <>
          <div className="restaurant-list">{restaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} />)}</div>
          {pagination && pagination.current_page < pagination.last_page ? (
            <div className="page-toolbar">
              <button type="button" className="btn btn--secondary" disabled={loadingMore} onClick={() => loadRestaurants(pagination.current_page + 1, true)}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-state"><h3>No restaurants found</h3><p>Try a broader keyword or clear some filters.</p><button type="button" className="btn btn--secondary" onClick={() => setSearchParams({})}>Clear filters</button></div>
      )}
    </div>
  );
}
