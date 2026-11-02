import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { restaurantService } from '../../services/restaurantService';
import { Button } from '../../components/ui/Button';
import '../Page.css';

const reservationStartTime = (reservation) => {
  if (reservation.start_at) return new Date(reservation.start_at);
  const match = String(reservation.time || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match || !reservation.date) return new Date(Number.NaN);
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return new Date(`${reservation.date}T${String(hour).padStart(2, '0')}:${match[2]}:00+08:00`);
};

const isUpcomingReservation = (reservation) => {
  if (!['pending', 'confirmed'].includes(reservation.statusCode)) return false;
  if (reservation.statusCode === 'pending' && reservation.expires_at && new Date(reservation.expires_at) <= new Date()) {
    return false;
  }
  return reservationStartTime(reservation) >= new Date();
};

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');
  const [reservationToCancel, setReservationToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [reservationDetails, setReservationDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const upcomingReservations = reservations.filter(isUpcomingReservation);
  const pastReservations = reservations.filter((reservation) => !isUpcomingReservation(reservation));

  useEffect(() => {
    let active = true;
    restaurantService.getReservations(1)
      .then((result) => {
        if (active) {
          setReservations(result.items);
          setCurrentPage(result.meta.current_page);
          setHasMore(result.meta.current_page < result.meta.last_page);
        }
      })
      .catch((loadError) => {
        console.error('Unable to load customer reservations.', loadError);
        if (active) setError(loadError.message || 'Your reservations could not be loaded. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  const handleCancel = async () => {
    if (!reservationToCancel) return;
    setCancelling(true);
    setError('');
    try {
      const updated = await restaurantService.cancelReservation(reservationToCancel.id);
      if (!updated) {
        setError('This reservation can no longer be cancelled.');
      } else {
        setReservations((current) => current.map((item) => item.id === updated.id ? updated : item));
        setReservationToCancel(null);
      }
    } catch (cancelError) {
      console.error('Unable to cancel customer reservation.', cancelError);
      setError(cancelError.message || 'The reservation could not be cancelled. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const handleToggleDetails = async (reservation) => {
    if (reservationDetails?.id === reservation.id) {
      setReservationDetails(null);
      setDetailsError('');
      return;
    }

    setDetailsLoading(true);
    setDetailsError('');
    try {
      setReservationDetails(await restaurantService.getReservation(reservation.id));
    } catch (detailsLoadError) {
      console.error('Unable to load reservation details.', detailsLoadError);
      setDetailsError(detailsLoadError.message || 'Reservation details could not be loaded.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    setLoadMoreError('');
    try {
      const result = await restaurantService.getReservations(currentPage + 1);
      setReservations((current) => [...current, ...result.items]);
      setCurrentPage(result.meta.current_page);
      setHasMore(result.meta.current_page < result.meta.last_page);
    } catch (loadError) {
      console.error('Unable to load more customer reservations.', loadError);
      setLoadMoreError(loadError.message || 'More reservations could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  };

  const renderReservation = (reservation) => (
    <article key={reservation.id} className="reservation-card reservation-card--list">
      <div className="reservation-meta">
        <div>
          <strong>{reservation.restaurant}</strong>
          <div className="reservation-date-meta">{reservation.date} · {reservation.time}</div>
        </div>
        <span className={[
          'status-badge',
          reservation.statusCode === 'confirmed' || reservation.statusCode === 'completed'
            ? 'status-badge--success'
            : reservation.statusCode === 'pending'
              ? 'status-badge--pending'
              : 'status-badge--danger',
        ].join(' ')}
        >
          {reservation.status}
        </span>
      </div>
      <div className="reservation-date-meta">Guests: {reservation.guests}</div>
      {reservation.reference_code ? <div className="reservation-date-meta">Reference: {reservation.reference_code}</div> : null}
      {reservation.table?.table_number ? <div className="reservation-date-meta">Table: {reservation.table.table_number}</div> : null}
      {reservation.special_request ? <p>{reservation.special_request}</p> : null}
      <Button variant="secondary" onClick={() => handleToggleDetails(reservation)}>
        {reservationDetails?.id === reservation.id ? 'Hide details' : 'View details'}
      </Button>
      {detailsLoading && reservationDetails?.id !== reservation.id ? <p role="status">Loading reservation details…</p> : null}
      {detailsError ? <p className="form-error" role="alert">{detailsError}</p> : null}
      {reservationDetails?.id === reservation.id ? (
        <div className="reservation-date-meta">
          <div>Reserved for: {reservationDetails.reserved_for_name || 'Not provided'}</div>
          <div>Contact: {reservationDetails.contact_phone || 'Not provided'}</div>
          {reservationDetails.restaurant?.formatted_address ? <div>{reservationDetails.restaurant.formatted_address}</div> : null}
          {reservationDetails.table?.area ? <div>Area: {reservationDetails.table.area}</div> : null}
        </div>
      ) : null}
      {reservation.can_cancel ? (
        <Button variant="secondary" onClick={() => setReservationToCancel(reservation)}>Cancel reservation</Button>
      ) : null}
    </article>
  );

  return (
    <div className="section-shell data-page">
      <div className="page-header">
        <div>
          <h1>Reservations</h1>
          <p>Review your reservation details and status.</p>
        </div>
        <Link className="btn btn--primary" to="/reservations/new">Book a table</Link>
      </div>

      {loading ? <p role="status">Loading reservations…</p> : null}
      {error ? (
        <div role="alert">
          <p className="form-error">{error}</p>
          {!loading ? (
            <Button
              variant="secondary"
              onClick={() => {
                setError('');
                setLoading(true);
                setRetry((value) => value + 1);
              }}
            >
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && reservations.length === 0 ? (
        <div className="empty-state">
          <p>You have no reservations yet.</p>
          <Link className="btn btn--secondary" to="/reservations/new">Find a table</Link>
        </div>
      ) : null}
      {!loading && !error && reservations.length > 0 ? (
        <div className="reservation-list">
          {upcomingReservations.length > 0 ? (
            <section aria-labelledby="upcoming-reservations-heading">
              <h2 id="upcoming-reservations-heading">Upcoming</h2>
              {upcomingReservations.map(renderReservation)}
            </section>
          ) : null}
          {pastReservations.length > 0 ? (
            <section aria-labelledby="past-reservations-heading">
              <h2 id="past-reservations-heading">Past</h2>
              {pastReservations.map(renderReservation)}
            </section>
          ) : null}
          {loadMoreError ? <p className="form-error" role="alert">{loadMoreError}</p> : null}
          {hasMore ? (
            <Button variant="secondary" disabled={loadingMore} onClick={handleLoadMore}>
              {loadingMore ? 'Loading…' : 'Load more reservations'}
            </Button>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(reservationToCancel)}
        title="Cancel this reservation?"
        message="This action cannot be undone. The restaurant’s cancellation cutoff applies."
        confirmLabel="Cancel reservation"
        busy={cancelling}
        onCancel={() => setReservationToCancel(null)}
        onConfirm={handleCancel}
      />
    </div>
  );
}
