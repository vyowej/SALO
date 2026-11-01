import { useEffect, useState } from 'react';
import { restaurantService } from '../../services/restaurantService';
import { Button } from '../../components/ui/Button';
import { FILIPINO_VOICE } from '../../constants/voice';
import '../Page.css';

export default function ReservationBookingPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [guests, setGuests] = useState(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [reservation, setReservation] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const restaurant = restaurants.find((item) => item.id === selectedRestaurantId);
    if (!restaurant || !guests) {
      setError('Select a restaurant and party size to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const createdReservation = await restaurantService.createReservation({
        restaurant: restaurant.name,
        restaurantId: restaurant.id,
        date: event.target.elements['reservation-date'].value,
        time: event.target.elements['reservation-time'].value,
        guests,
      });
      setReservation(createdReservation);
    } catch (submitError) {
      console.error('Unable to submit reservation request.', submitError);
      setError('We couldn’t submit your reservation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (reservation) {
    return (
      <div className="section-shell reserve-shell">
        <div className="confirmation-card">
          <span className="eyebrow">Table reserved</span>
          <h1>Your reservation is set</h1>
          <p><span lang="tl">{FILIPINO_VOICE.masarap.phrase}</span> Your reservation request has been submitted.</p>
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
            <div className="field">
              <label htmlFor="reservation-restaurant">Restaurant</label>
              <select id="reservation-restaurant" value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)} required>
                <option value="">Select a restaurant</option>
                {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="reservation-date">Date</label>
                <input id="reservation-date" type="date" required />
              </div>
              <div className="field">
                <label htmlFor="reservation-time">Time</label>
                <input id="reservation-time" type="time" required />
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
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <Button variant="primary" size="lg" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Check availability'}</Button>
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
