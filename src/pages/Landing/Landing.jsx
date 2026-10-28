import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar } from 'lucide-react';
import Button from '../../components/ui/Button';
import RestaurantCard from '../../components/restaurant/RestaurantCard';
import RestaurantCardSkeleton from '../../components/restaurant/RestaurantCardSkeleton';
import { restaurantService } from '../../services/restaurantService';
import { useReveal } from '../../hooks/useReveal';
import './Landing.css';

const heroCards = [
  {
    title: 'Bahay ng Hapag',
    subtitle: 'Family feast',
    accent: 'M',
  },
  {
    title: 'Harana Grill',
    subtitle: 'Fire-kissed favorites',
    accent: 'H',
  },
  {
    title: 'Pista at Kape',
    subtitle: 'Coffee and dessert',
    accent: 'P',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [restaurants, setRestaurants] = useState([]);
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
      const data = await restaurantService.getFeaturedRestaurants();

      if (isMounted) {
        setRestaurants(data);
        setIsLoading(false);
      }
    };

    loadRestaurants();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="landing-page">
      <section className="landing-hero section-shell" data-reveal>
        <div className="landing-hero__copy">
          <span className="eyebrow">Mabuhay! Salo for every table</span>
          <h1>
            <span>Order.</span>
            <span>Reserve.</span>
            <span>Gather.</span>
          </h1>
          <p>Filipino favorites, easy reservations, and delivery from the neighborhood’s best tables.</p>

          <div className="landing-hero__actions">
            <Button variant="primary" size="lg" onClick={() => navigate('/register')}>Start ordering</Button>
          </div>
        </div>

        <div className="landing-hero__visual" aria-label="Featured dishes">
          {heroCards.map((card, index) => (
            <div key={card.title} className={['hero-card', `hero-card--${index + 1}`].join(' ')} data-reveal data-reveal-delay={index * 120}>
              <div className="hero-card__image" aria-hidden="true">
                <span>{card.accent}</span>
              </div>
              <div className="hero-card__body">
                <strong>{card.title}</strong>
                <small>{card.subtitle}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-featured section-shell" data-reveal>
        <div className="section-header">
          <div>
            <span className="eyebrow">Crowd favorites</span>
            <h2>Popular restaurants</h2>
          </div>
          <Link to="/restaurants" className="text-link">See all <ArrowRight size={16} /></Link>
        </div>

        {isLoading ? (
          <div className="restaurant-grid">
            {[...Array(3)].map((_, index) => (
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
      </section>

      <section id="how-it-works" className="landing-steps section-shell" data-reveal>
        <div className="section-header section-header--centered">
          <span className="eyebrow">Easy as one, two, three</span>
          <h2>How SALO works</h2>
        </div>

        <div className="steps-rail" aria-label="How SALO works">
          <div className="step-item" data-reveal data-reveal-delay={0}>
            <span className="step-index">01</span>
            <h3>Order</h3>
            <p>Discover local favorites, pick dishes, and track every detail from the kitchen to your table.</p>
          </div>
          <div className="step-item" data-reveal data-reveal-delay={100}>
            <span className="step-index">02</span>
            <h3>Reserve</h3>
            <p>Book a table in seconds for family dinners, birthdays, and catch-ups with friends.</p>
          </div>
          <div className="step-item" data-reveal data-reveal-delay={200}>
            <span className="step-index">03</span>
            <h3>Gather</h3>
            <p>Enjoy the moment while the timing, menu, and space are ready before you arrive.</p>
          </div>
        </div>
      </section>

      <section className="landing-reserve-band section-shell" data-reveal>
        <div className="reserve-band__content">
          <div className="reserve-band__text">
            <span className="eyebrow">Reserve a table</span>
            <h2>Plan your next gathering.</h2>
          </div>

          <form className="booking-form" aria-label="Reservation form">
            <div className="booking-form__row">
              <label>
                <span>Date</span>
                <input type="date" defaultValue="2026-11-08" />
              </label>
              <label>
                <span>Time</span>
                <input type="time" defaultValue="19:30" />
              </label>
            </div>
            <div className="booking-form__guests">
              {[2, 3, 4, 5, 'Custom'].map((guestValue) => (
                <button key={guestValue} type="button" className={['guest-chip', guestValue === 4 ? 'is-selected' : ''].filter(Boolean).join(' ')}>
                  {guestValue}
                </button>
              ))}
            </div>
            <Button variant="primary" size="md" className="booking-form__cta">Check availability</Button>
          </form>
        </div>

        <div className="reserve-band__image" aria-label="Restaurant reservation illustration">
          <div className="reserve-band__image-card">
            <Calendar size={20} />
            <span>Weekend table for 4</span>
          </div>
        </div>
      </section>

      <section className="landing-cta section-shell" data-reveal>
        <div className="cta-card">
          <div>
            <span className="eyebrow">Partner with SALO</span>
            <h2>Add Your Restaurant</h2>
          </div>
          <div className="cta-card__actions">
            <Link to="/partner/apply" className="btn btn--primary">Add Your Restaurant</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
