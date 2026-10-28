import { useEffect, useState } from 'react';
import { restaurantService } from '../../services/restaurantService';
import '../Page.css';

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const data = await restaurantService.getReservations();
      if (active) setReservations(data);
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="section-shell data-page">
      <div className="page-header">
        <div>
          <h1>Reservations</h1>
          <p>Manage your upcoming dates and see if your table is confirmed.</p>
        </div>
      </div>

      <div className="reservation-list">
        {reservations.map((reservation) => (
          <div key={reservation.id} className="reservation-card reservation-card--list">
            <div className="reservation-meta">
              <div>
                <strong>{reservation.restaurant}</strong>
                <div className="reservation-date-meta">{reservation.date} · {reservation.time}</div>
              </div>
              <span className={['status-badge', reservation.status === 'Confirmed' ? 'status-badge--success' : reservation.status === 'Pending' ? 'status-badge--pending' : 'status-badge--danger'].filter(Boolean).join(' ')}>{reservation.status}</span>
            </div>
            <div className="reservation-date-meta">Guests: {reservation.guests}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
