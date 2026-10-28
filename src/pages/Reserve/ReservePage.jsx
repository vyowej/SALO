import { useEffect, useState } from 'react';
import { restaurantService } from '../../services/restaurantService';
import { Button } from '../../components/ui/Button';
import '../Page.css';

export default function ReservePage() {
  const [restaurants, setRestaurants] = useState([]);
  const [guests, setGuests] = useState(4);
  const [reservation, setReservation] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const data = await restaurantService.getAllRestaurants();
      if (active) setRestaurants(data.filter((restaurant) => restaurant.acceptsReservations));
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    const date = event.target.elements['reservation-date'].value || '2026-11-08';
    const time = event.target.elements['reservation-time'].value || '19:30';

    setReservation({
      restaurant: restaurants[0]?.name || 'Mang Toma’s Kitchen',
      date,
      time,
      guests,
      status: 'Confirmed',
    });
  };

  if (reservation) {
    return (
      <div className="section-shell reserve-shell">
        <div className="confirmation-card">
          <span className="eyebrow">Table reserved</span>
          <h1>Your reservation is set</h1>
          <p>We’ve saved your booking and sent a confirmation to your email.</p>
          <div className="confirmation-metadata">
            <div><span>Restaurant</span><strong>{reservation.restaurant}</strong></div>
            <div><span>Date</span><strong>{reservation.date}</strong></div>
            <div><span>Time</span><strong>{reservation.time}</strong></div>
            <div><span>Guests</span><strong>{reservation.guests}</strong></div>
          </div>
          <div className="confirmation-actions">
            <button type="button" className="btn btn--primary" onClick={() => setReservation(null)}>Book another table</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-shell reserve-shell">
      <div className="page-header">
        <div>
          <h1>Reserve a Table</h1>
          <p>Plan a warm get-together before the crowd arrives.</p>
        </div>
      </div>

      <div className="reserve-layout">
        <div className="booking-surface">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="reservation-date">Date</label>
                <input id="reservation-date" type="date" defaultValue="2026-11-08" />
              </div>
              <div className="field">
                <label htmlFor="reservation-time">Time</label>
                <input id="reservation-time" type="time" defaultValue="19:30" />
              </div>
            </div>
            <div>
              <label className="reserve-guests-label">Guests</label>
              <div className="option-list">
                {[2, 3, 4, 5, 'Custom'].map((guestValue) => (
                  <button
                    key={guestValue}
                    type="button"
                    className={['option-button', guests === guestValue ? 'is-selected' : ''].filter(Boolean).join(' ')}
                    onClick={() => setGuests(guestValue)}
                  >
                    {guestValue}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="primary" size="lg" type="submit">Check availability</Button>
          </form>
        </div>

        <aside className="timeline-card">
          <h2>Best matches</h2>
          <div className="reserve-match-list">
            {restaurants.slice(0, 3).map((restaurant) => (
              <div key={restaurant.id} className="reservation-item">
                <div className="reservation-meta">
                  <strong>{restaurant.name}</strong>
                  <span className="status-badge status-badge--success">Available</span>
                </div>
                <div className="reserve-restaurant-detail">{restaurant.location} · {restaurant.cuisine}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
