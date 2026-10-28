import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Search } from 'lucide-react';
import RestaurantCard from '../../components/restaurant/RestaurantCard';
import RestaurantCardSkeleton from '../../components/restaurant/RestaurantCardSkeleton';
import { restaurantService } from '../../services/restaurantService';
import { useReveal } from '../../hooks/useReveal';
import foodBg from '../../assets/food_bg.png';
import './Landing.css';

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [restaurants, setRestaurants] = useState([]);
  const [landingContent, setLandingContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useReveal();

  useEffect(() => {
    if (location.pathname !== '/') return;
    if (location.hash === '#how-it-works') {
      requestAnimationFrame(() => document.getElementById('how-it-works')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      }));
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    let isMounted = true;

    const loadRestaurants = async () => {
      setIsLoading(true);
      const data = await restaurantService.getAllRestaurants();

      if (isMounted) {
        setRestaurants(data.slice(0, 4));
        setIsLoading(false);
      }
    };

    loadRestaurants();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    restaurantService.getLandingContent().then((content) => {
      if (active) setLandingContent(content);
    }).catch((error) => console.error('Unable to load landing page content.', error));
    return () => { active = false; };
  }, []);

  return (
    <div className="landing-page">
      <section className="landing-hero section-shell" data-reveal>
        <div className="hero-photo-shell">
          <img src={foodBg} alt="" />
          <div className="landing-hero__copy">
            <span className="eyebrow landing-hero__eyebrow">MADE FOR GATHERING</span>
            <h1>
              Good food tastes <span>better together.</span>
            </h1>
            <p>Discover local favorites, order what you love, or save your seat—all in one place.</p>

            <div className="landing-searchbar" aria-label="Search restaurants and dishes">
              <Search size={17} className="search-icon" aria-hidden="true" />
              <input type="text" placeholder="Search restaurants or cravings" aria-label="Search restaurants or cravings" />
              <button type="button" className="search-button">Find food</button>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-discover section-shell" data-reveal>
        <div className="landing-discover__main">
          <div className="mood-block">
            <span className="eyebrow eyebrow--soft">WHAT ARE YOU FEELING?</span>
            <h2>Explore by mood</h2>
            <div className="filter-row" aria-label="Cuisine filters">
              {(landingContent?.filterPills || []).map((pill, index) => (
                <button key={pill} type="button" className={['filter-pill', index === 0 ? 'is-selected' : ''].filter(Boolean).join(' ')}>
                  {pill}
                </button>
              ))}
            </div>
          </div>

          <div className="popular-block">
            <div className="popular-header">
              <span className="eyebrow eyebrow--soft">NEAR YOU</span>
              <h3>Popular right now</h3>
            </div>

            <p className="personal-note">Do not sell or share my personal info</p>

            {isLoading ? (
              <div className="restaurant-grid">
                {[...Array(4)].map((_, index) => (
                  <RestaurantCardSkeleton key={index} />
                ))}
              </div>
            ) : (
              <div className="restaurant-grid">
                {restaurants.map((restaurant) => (
                  <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="landing-discover__side">
          <div className="sidebar-card sidebar-card--reservation">
            <div className="sidebar-card__header">
              <span className="eyebrow eyebrow--soft">COMING UP</span>
              <button type="button" className="mini-icon" aria-label="Open calendar">
                <CalendarDays size={16} />
              </button>
            </div>

            <h3>Your table awaits</h3>

            {landingContent?.reservationPreview ? <div className="reservation-item">
              <div
                className="reservation-item__visual"
                style={{ backgroundImage: `linear-gradient(135deg, rgba(82, 99, 77, 0.55), rgba(51, 43, 38, 0.34)), url(${landingContent.reservationPreview.image})` }}
                aria-hidden="true"
              />
              <div className="reservation-item__content">
                <strong>{landingContent.reservationPreview.restaurant}</strong>
                <small>{landingContent.reservationPreview.dateTime}</small>
                <span>Table for {landingContent.reservationPreview.guests}</span>
              </div>
            </div> : null}

            <div className="reservation-status">
              <span className="status-dot" aria-hidden="true" />
              <strong>{landingContent?.reservationPreview?.status || '—'}</strong>
              <button type="button">View details</button>
            </div>

            <button type="button" className="reserve-button" onClick={() => navigate('/reserve')}>Reserve another table →</button>
          </div>

          <div className="sidebar-card sidebar-card--owner">
            <span className="eyebrow eyebrow--soft">FOR RESTAURANT OWNERS</span>
            <h3>Bring your table to SALO.</h3>
            <p>Reach more diners and manage everything in one place.</p>
            <button type="button" className="cta-owner" onClick={() => navigate('/partner/apply')}>Add your restaurant</button>
          </div>
        </aside>
      </section>
    </div>
  );
}

export default LandingPage;
