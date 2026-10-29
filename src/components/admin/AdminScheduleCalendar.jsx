import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { ADMIN_COPY } from '../../constants/admin';

export function AdminScheduleCalendar({ events }) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,dayGridDay' }}
      buttonText={{ today: ADMIN_COPY.calendarToday, month: ADMIN_COPY.calendarMonth, week: ADMIN_COPY.calendarWeek, day: ADMIN_COPY.calendarDay }}
      events={events}
      height="auto"
      timeZone="Asia/Manila"
    />
  );
}

export default AdminScheduleCalendar;
