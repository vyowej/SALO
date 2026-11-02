import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { restaurantService } from '../../services/restaurantService';
import { Button } from '../../components/ui/Button';
import { FILIPINO_VOICE } from '../../constants/voice';
import '../Page.css';

const nextManilaDate = () => {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    tomorrow.getUTCFullYear(),
    String(tomorrow.getUTCMonth() + 1).padStart(2, '0'),
    String(tomorrow.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

const formatSlotTime = (value) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(value));

export default function ReservationBookingPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [restaurantsError, setRestaurantsError] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [date, setDate] = useState(nextManilaDate);
  const [guestCount, setGuestCount] = useState('2');
  const [slotQuery, setSlotQuery] = useState({ key: '', slots: [], error: '' });
  const [retrySlots, setRetrySlots] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reservedForName, setReservedForName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [reservation, setReservation] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    restaurantService.getAllRestaurants()
      .then((data) => {
        if (active) setRestaurants(data.filter((restaurant) => restaurant.acceptsReservations));
      })
      .catch((loadError) => {
        console.error('Unable to load reservation restaurants.', loadError);
        if (active) setRestaurantsError('Restaurants could not be loaded. Please try again.');
      })
      .finally(() => {
        if (active) setRestaurantsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedRestaurantId || !date || !guestCount) return undefined;

    let active = true;
    const key = `${selectedRestaurantId}:${date}:${guestCount}:90:${retrySlots}`;
    restaurantService.getReservationSlots(selectedRestaurantId, {
      date,
      guest_count: Number(guestCount),
      duration_minutes: 90,
    })
      .then((availableSlots) => {
        if (active) setSlotQuery({ key, slots: availableSlots, error: '' });
      })
      .catch((loadError) => {
        console.error('Unable to load reservation times.', loadError);
        if (active) setSlotQuery({ key, slots: [], error: 'Available times could not be loaded. Please retry.' });
      });
    return () => {
      active = false;
    };
  }, [selectedRestaurantId, date, guestCount, retrySlots]);

  const currentSlotQueryKey = `${selectedRestaurantId}:${date}:${guestCount}:90:${retrySlots}`;
  const currentSlotQuery = slotQuery.key === currentSlotQueryKey ? slotQuery : null;
  const slots = currentSlotQuery?.slots || [];
  const slotsError = currentSlotQuery?.error || '';
  const slotsLoading = Boolean(selectedRestaurantId && date && guestCount && !currentSlotQuery);
  const selectedSlotIsAvailable = slots.some((slot) => (
    slot.table_id === selectedSlot?.table_id && slot.start_at === selectedSlot?.start_at
  ));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!selectedSlot) {
      setError('Choose an available time before booking.');
      return;
    }

    setSubmitting(true);
    try {
      const createdReservation = await restaurantService.createReservation({
        restaurant_id: selectedRestaurantId,
        table_id: selectedSlot.table_id,
        start_at: selectedSlot.start_at,
        duration_minutes: selectedSlot.duration_minutes,
        guest_count: Number(guestCount),
        reserved_for_name: reservedForName.trim(),
        contact_phone: contactPhone.trim(),
        special_request: specialRequest.trim() || null,
      });
      setReservation(createdReservation);
    } catch (submitError) {
      console.error('Unable to submit reservation request.', submitError);
      setError(submitError.message || 'We could not submit your reservation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryRestaurants = () => {
    setRestaurantsError('');
    setRestaurantsLoading(true);
    restaurantService.getAllRestaurants()
      .then((data) => setRestaurants(data.filter((restaurant) => restaurant.acceptsReservations)))
      .catch((loadError) => {
        console.error('Unable to reload reservation restaurants.', loadError);
        setRestaurantsError('Restaurants could not be loaded. Please try again.');
      })
      .finally(() => setRestaurantsLoading(false));
  };

  const handleSlotInputChange = (setter) => (event) => {
    setSelectedSlot(null);
    setter(event.target.value);
  };

  if (reservation) {
    return (
      <div className="section-shell reserve-shell">
        <div className="confirmation-card" role="status">
          <span className="eyebrow">Reservation submitted</span>
          <h1>Your table request is in</h1>
          <p><span lang="tl">{FILIPINO_VOICE.masarap.phrase}</span> Check your reservation status in your reservations.</p>
          <div className="confirmation-metadata">
            <div><span>Restaurant</span><strong>{reservation.restaurant}</strong></div>
            <div><span>Date</span><strong>{reservation.date}</strong></div>
            <div><span>Time</span><strong>{reservation.time}</strong></div>
            <div><span>Guests</span><strong>{reservation.guests}</strong></div>
            <div><span>Status</span><strong>{reservation.status}</strong></div>
          </div>
          <div className="confirmation-actions">
            <Link className="btn btn--secondary" to="/reservations">View reservations</Link>
            <Button variant="primary" onClick={() => setReservation(null)}>Book another table</Button>
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
          <p>Choose an available time and send your reservation request.</p>
        </div>
      </div>

      <div className="booking-surface">
        {restaurantsLoading ? <p role="status">Loading restaurants…</p> : null}
        {restaurantsError ? (
          <div role="alert">
            <p className="form-error">{restaurantsError}</p>
            <Button variant="secondary" onClick={handleRetryRestaurants}>Retry</Button>
          </div>
        ) : null}
        {!restaurantsLoading && !restaurantsError && restaurants.length === 0 ? (
          <p className="empty-state">No restaurants are currently accepting reservations.</p>
        ) : null}
        {!restaurantsLoading && !restaurantsError && restaurants.length > 0 ? (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="reservation-restaurant">Restaurant</label>
              <select
                id="reservation-restaurant"
                value={selectedRestaurantId}
                onChange={handleSlotInputChange(setSelectedRestaurantId)}
                required
              >
                <option value="">Select a restaurant</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="reservation-date">Date</label>
                <input id="reservation-date" type="date" min={nextManilaDate()} value={date} onChange={handleSlotInputChange(setDate)} required />
              </div>
              <div className="field">
                <label htmlFor="reservation-guests">Guests</label>
                <input
                  id="reservation-guests"
                  type="number"
                  min="1"
                  max="50"
                  value={guestCount}
                  onChange={handleSlotInputChange(setGuestCount)}
                  required
                />
              </div>
            </div>

            {selectedRestaurantId ? (
              <section aria-labelledby="reservation-times-heading">
                <h2 id="reservation-times-heading">Available times</h2>
                {slotsLoading ? <p role="status">Checking available times…</p> : null}
                {slotsError ? (
                  <div role="alert">
                    <p className="form-error">{slotsError}</p>
                    <Button variant="secondary" onClick={() => setRetrySlots((value) => value + 1)}>Retry</Button>
                  </div>
                ) : null}
                {!slotsLoading && !slotsError && slots.length === 0 ? (
                  <p className="empty-state">No times are available for this date and party size.</p>
                ) : null}
                {slots.length > 0 ? (
                  <div className="option-list" role="radiogroup" aria-label="Available reservation times">
                    {slots.map((slot) => (
                      <label key={`${slot.table_id}-${slot.start_at}`} className={['option-button', selectedSlot?.start_at === slot.start_at ? 'is-selected' : ''].filter(Boolean).join(' ')}>
                        <input
                          type="radio"
                          name="reservation-slot"
                          value={slot.start_at}
                          checked={selectedSlot?.start_at === slot.start_at}
                          onChange={() => setSelectedSlot(slot)}
                        />
                        {formatSlotTime(slot.start_at)} · {slot.table_number} (up to {slot.capacity})
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="field">
              <label htmlFor="reservation-name">Reservation name</label>
              <input id="reservation-name" value={reservedForName} onChange={(event) => setReservedForName(event.target.value)} maxLength="120" required />
            </div>
            <div className="field">
              <label htmlFor="reservation-phone">Contact phone</label>
              <input id="reservation-phone" type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} maxLength="20" required />
            </div>
            <div className="field">
              <label htmlFor="reservation-request">Special request (optional)</label>
              <textarea id="reservation-request" value={specialRequest} onChange={(event) => setSpecialRequest(event.target.value)} maxLength="255" />
            </div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <Button
              variant="primary"
              size="lg"
              type="submit"
              disabled={submitting || slotsLoading || !selectedSlotIsAvailable}
            >
              {submitting ? 'Submitting…' : 'Book reservation'}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
