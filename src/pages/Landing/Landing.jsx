import { useEffect, useState } from 'react';
import { ArrowRight, Search, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  LANDING_LABELS,
  GUEST_POPULAR_CARDS_OPEN_GATE,
} from '../../constants/guestExperience';
import { FILIPINO_VOICE } from '../../constants/voice';
import { landingFeatureCards, landingFilterPills } from '../../mock/landingData';
import { restaurantService } from '../../services/restaurantService';
import { getOpenStatus } from '../../utils/getOpenStatus';
import foodBg from '../../assets/food_bg.png';
import foodPlaceholder from '../../assets/food-placeholder.svg';
import './Landing.css';

const featureActions = {
  order: { title: 'orderTitle', description: 'orderDescription', action: 'orderAction', path: '/restaurants' },
  reserve: { title: 'reserveTitle', description: 'reserveDescription', action: 'reserveAction', path: '/reserve' },
  gather: { title: 'gatherTitle', description: 'gatherDescription', action: 'gatherAction', path: '/#how-it-works' },
};

export function LandingPage() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    restaurantService.getPopularRestaurants()
      .then((items) => {
        if (active) setRestaurants(items);
      })
      .catch((error) => {
        console.error('Unable to load public popular restaurants.', error);
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const openRestaurants = (value = '', key = 'q') => {
    const params = new URLSearchParams();
    if (value.trim()) params.set(key, value.trim());
    const path = `/restaurants${params.size ? `?${params}` : ''}`;
    navigate(path, { state: { gateTarget: path } });
  };

  const openHowItWorks = () => navigate('/#how-it-works');

  return (
    <div className="guest-landing">
      <section className="guest-hero section-shell" aria-labelledby="guest-hero-title">
        <div className="guest-hero__image">
          <img src={foodBg} alt="" />
          <div className="guest-hero__copy">
            <div className="guest-hero__content">
              <span className="eyebrow" lang="tl">{FILIPINO_VOICE.kainTayo.phrase}</span>
              <h1 id="guest-hero-title">{LANDING_LABELS.heroTitleBefore}<span>{LANDING_LABELS.heroTitleAccent}</span></h1>
              <p>{LANDING_LABELS.heroDescription}</p>
              <form className="guest-search" aria-label={LANDING_LABELS.searchLabel} onSubmit={(event) => {
                event.preventDefault();
                openRestaurants(query);
              }}>
                <Search size={19} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={LANDING_LABELS.searchPlaceholder}
                  aria-label={LANDING_LABELS.searchLabel}
                />
                <button type="submit" className="btn btn--primary">{LANDING_LABELS.searchAction}</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="guest-categories section-shell" aria-labelledby="guest-categories-title">
        <div className="guest-section-heading">
          <span className="eyebrow">{LANDING_LABELS.categoriesEyebrow}</span>
          <h2 id="guest-categories-title">{LANDING_LABELS.categoriesTitle}</h2>
        </div>
        <div className="guest-category-list">
          {landingFilterPills.map((category, index) => (
            <button
              type="button"
              className="guest-category"
              key={category}
              onClick={() => openRestaurants(
                category === 'All' ? '' : category,
                'cuisine',
              )}
            >
              <span className="guest-category__image">
                <img src={restaurants[index % restaurants.length]?.image || foodPlaceholder} alt="" />
              </span>
              <span>{category}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="guest-features section-shell" aria-label={LANDING_LABELS.heroEyebrow}>
        {landingFeatureCards.map((card) => {
          const feature = featureActions[card.id];
          return (
            <article className={`guest-feature-card guest-feature-card--${card.id}`} key={card.id}>
              <div className="guest-feature-card__content">
                <span className="eyebrow">{LANDING_LABELS[feature.title]}</span>
                <h2>{LANDING_LABELS[feature.description]}</h2>
                <button
                  type="button"
                  className="guest-text-action"
                  onClick={() => navigate(feature.path, { state: { gateTarget: feature.path } })}
                >
                  {LANDING_LABELS[feature.action]}<ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
        <button type="button" className="guest-how-it-works" onClick={openHowItWorks}>
          {LANDING_LABELS.howItWorks}<ArrowRight size={17} aria-hidden="true" />
        </button>
      </section>

      <section className="guest-popular section-shell" aria-labelledby="guest-popular-title">
        <div className="guest-popular__heading">
          <div className="guest-section-heading">
            <span className="eyebrow">{LANDING_LABELS.popularEyebrow}</span>
            <h2 id="guest-popular-title">{LANDING_LABELS.popularTitle}</h2>
          </div>
          <button type="button" className="guest-text-action" onClick={() => openRestaurants()}>
            {LANDING_LABELS.viewAll}<ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>

        {isLoading ? (
          <p className="guest-popular__message" role="status">{LANDING_LABELS.loadingRestaurants}</p>
        ) : loadError ? (
          <p className="guest-popular__message" role="alert">{LANDING_LABELS.restaurantsUnavailable}</p>
        ) : restaurants.length ? (
          <div className="guest-restaurant-grid">
            {restaurants.map((restaurant) => {
              const openStatus = getOpenStatus(restaurant);
              return (
                <button
                  type="button"
                  className="guest-restaurant-card"
                  key={restaurant.id}
                  aria-label={`${LANDING_LABELS.restaurantCardAction}: ${restaurant.name}`}
                  disabled={!GUEST_POPULAR_CARDS_OPEN_GATE}
                  onClick={() => navigate(`/restaurants/${restaurant.id}`)}
                >
                  <span className="guest-restaurant-card__image">
                    <img src={restaurant.image || foodPlaceholder} alt="" loading="lazy" />
                    <span className="guest-restaurant-card__rating"><Star size={13} fill="currentColor" aria-hidden="true" />{restaurant.rating}</span>
                  </span>
                  <span className="guest-restaurant-card__details">
                    <strong>{restaurant.name}</strong>
                    <span className="guest-restaurant-card__cuisine">{restaurant.cuisine} · {restaurant.location}</span>
                    <span className="guest-restaurant-card__badges">
                      {restaurant.is_24_7 ? <span className="guest-restaurant-card__badge">{LANDING_LABELS.open247}</span> : null}
                      {restaurant.acceptsDelivery ? <span className="guest-restaurant-card__badge">{LANDING_LABELS.delivery}</span> : null}
                      {restaurant.acceptsWalkIn ? <span className="guest-restaurant-card__badge">{LANDING_LABELS.walkIn}</span> : null}
                    </span>
                    <span className={`guest-restaurant-card__status guest-restaurant-card__status--${openStatus.status}`}>{openStatus.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="guest-popular__message">{LANDING_LABELS.emptyRestaurants}</p>
        )}
      </section>

      <section className="guest-final-cta section-shell" aria-label={LANDING_LABELS.closingTitle}>
        <h2>{LANDING_LABELS.closingTitle}</h2>
        <button type="button" className="btn btn--primary" onClick={openHowItWorks}>
          {LANDING_LABELS.howItWorks}<ArrowRight size={17} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}

export default LandingPage;
