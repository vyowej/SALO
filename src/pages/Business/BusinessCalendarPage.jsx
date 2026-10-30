import { useCallback, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import luxonPlugin from '@fullcalendar/luxon3';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useCan } from '../../hooks/useCan';
import { businessService } from '../../services/businessService';
import './BusinessCalendarPage.css';

function dateLabel(value) {
  if (!value) return 'All day';
  return new Date(value).toLocaleString([], {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function BusinessCalendarPage({ restaurantId, user }) {
  const canViewRestaurant = useCan('restaurant.view', restaurantId);
  const canViewReservations = useCan('reservations.view', restaurantId);
  const [range, setRange] = useState(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [calendarResult, setCalendarResult] = useState({ key: '', events: [], error: '' });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const requestKey = range ? `${restaurantId}:${range.start}:${range.end}:${reloadVersion}` : '';
  const loading = Boolean(requestKey && calendarResult.key !== requestKey);
  const events = calendarResult.key === requestKey ? calendarResult.events : [];
  const error = calendarResult.key === requestKey ? calendarResult.error : '';

  useEffect(() => {
    if (!range) return undefined;
    let active = true;
    businessService.getBusinessCalendar(restaurantId, range, user)
      .then((result) => {
        if (active) setCalendarResult({ key: requestKey, events: result.data || [], error: '' });
      })
      .catch((loadError) => {
        if (active) {
          setCalendarResult({
            key: requestKey,
            events: [],
            error: loadError.message || 'The restaurant calendar could not be loaded.',
          });
        }
      });

    return () => { active = false; };
  }, [range, requestKey, restaurantId, user]);

  const setCalendarRange = useCallback((info) => {
    setRange((current) => (
      current?.start === info.startStr && current?.end === info.endStr
        ? current
        : { start: info.startStr, end: info.endStr }
    ));
  }, []);

  if (!canViewRestaurant && !canViewReservations) {
    return <p className="business-error" role="alert">You do not have permission to view this calendar.</p>;
  }

  return (
    <div className="business-calendar">
      <header className="business-page-heading">
        <div>
          <p className="business-eyebrow">Restaurant schedule</p>
          <h2>Calendar</h2>
          <p>Opening hours, closure dates{canViewReservations ? ', and reservations' : ''} in Asia/Manila time.</p>
        </div>
      </header>
      {error ? <div className="business-error" role="alert"><p>{error}</p><Button variant="secondary" onClick={() => setReloadVersion((version) => version + 1)} disabled={loading}>Try again</Button></div> : null}
      {loading ? <p className="business-loading" role="status">Loading calendar…</p> : null}
      <section className="business-calendar-panel" aria-label="Restaurant hours and reservations calendar">
        <div className="business-calendar-legend" aria-label="Calendar event types">
          <span><i className="business-calendar-legend__hours" />Opening hours</span>
          <span><i className="business-calendar-legend__closure" />Closure dates</span>
          {canViewReservations ? <span><i className="business-calendar-legend__reservation" />Reservations</span> : null}
        </div>
        <div className="business-calendar__fullcalendar">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, luxonPlugin]}
            initialView="timeGridWeek"
            timeZone="Asia/Manila"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            events={events}
            datesSet={setCalendarRange}
            eventClick={(info) => {
              const { type, status, table_number: tableNumber, guest_count: guestCount } = info.event.extendedProps;
              setSelectedEvent({
                title: info.event.title,
                type,
                status,
                tableNumber,
                guestCount,
                start: info.event.start,
                end: info.event.end,
              });
            }}
            eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
            height="auto"
            noEventsContent="No scheduled events in this period."
          />
        </div>
        {!loading && !events.length ? <p className="business-empty-state">No hours, closures, or reservations are scheduled in this date range.</p> : null}
      </section>
      <Modal open={Boolean(selectedEvent)} title={selectedEvent?.title || 'Calendar event'} onClose={() => setSelectedEvent(null)}>
        {selectedEvent ? (
          <div className="business-calendar-event-details">
            <p><strong>Type:</strong> {selectedEvent.type?.replaceAll('_', ' ') || 'Schedule'}</p>
            <p><strong>Start:</strong> {dateLabel(selectedEvent.start)}</p>
            {selectedEvent.end ? <p><strong>End:</strong> {dateLabel(selectedEvent.end)}</p> : null}
            {selectedEvent.status ? <p><strong>Status:</strong> {selectedEvent.status.replaceAll('_', ' ')}</p> : null}
            {selectedEvent.tableNumber ? <p><strong>Table:</strong> {selectedEvent.tableNumber}</p> : null}
            {selectedEvent.guestCount ? <p><strong>Guests:</strong> {selectedEvent.guestCount}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
