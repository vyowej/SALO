const WEEKDAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'];

function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(value) {
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function shiftsFor(restaurant, day) {
  const weeklyHours = restaurant.operatingHours || {};
  return weeklyHours[WEEKDAY_KEYS[day]] || weeklyHours[day] || [];
}

function nextOpening(restaurant, now) {
  const currentDay = now.getDay();
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = (currentDay + offset) % 7;
    const shifts = shiftsFor(restaurant, day).slice().sort((a, b) => a.open.localeCompare(b.open));
    for (const shift of shifts) {
      const openAt = toMinutes(shift.open);
      if (offset > 0 || openAt > now.getHours() * 60 + now.getMinutes()) {
        return { shift, offset };
      }
    }
  }
  return null;
}

export function getOpenStatus(restaurant, now = new Date()) {
  if (restaurant.paused) return { status: 'paused', label: 'Not accepting orders right now' };

  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if ((restaurant.closureDates || []).includes(dateKey)) return { status: 'closed', label: 'Closed today' };

  const day = now.getDay();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const activeShifts = shiftsFor(restaurant, day).filter((shift) => {
    const openMinute = toMinutes(shift.open);
    const closeMinute = toMinutes(shift.close);
    if (closeMinute <= openMinute) {
      return currentMinute >= openMinute || currentMinute < closeMinute;
    }
    return currentMinute >= openMinute && currentMinute < closeMinute;
  });

  if (activeShifts.length) {
    const shift = activeShifts.sort((a, b) => toMinutes(a.close) - toMinutes(b.close))[0];
    const closeMinute = toMinutes(shift.close);
    const remaining = closeMinute <= toMinutes(shift.open)
      ? closeMinute + 24 * 60 - currentMinute
      : closeMinute - currentMinute;
    if (remaining < 30) return { status: 'closing-soon', label: `Closing in ${Math.max(1, Math.ceil(remaining))} min` };
    return { status: 'open', label: `Open · closes ${formatTime(shift.close)}` };
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const previousDay = (day - offset + 7) % 7;
    const previousShifts = shiftsFor(restaurant, previousDay);
    const overnight = previousShifts.find((shift) => toMinutes(shift.close) <= toMinutes(shift.open));
    if (overnight && currentMinute < toMinutes(overnight.close)) {
      const remaining = toMinutes(overnight.close) - currentMinute;
      if (remaining < 30) return { status: 'closing-soon', label: `Closing in ${Math.max(1, Math.ceil(remaining))} min` };
      return { status: 'open', label: `Open · closes ${formatTime(overnight.close)}` };
    }
  }

  const upcoming = nextOpening(restaurant, now);
  if (!upcoming) return { status: 'closed', label: 'Closed · hours unavailable' };
  const minutesUntil = upcoming.offset * 24 * 60 + toMinutes(upcoming.shift.open) - currentMinute;
  if (minutesUntil >= 0 && minutesUntil < 60) {
    return { status: 'opening-soon', label: `Opens ${formatTime(upcoming.shift.open)}` };
  }
  const dayLabel = upcoming.offset === 1 ? 'tomorrow' : upcoming.offset === 0 ? 'today' : 'later';
  return { status: 'closed', label: `Closed · opens ${dayLabel} ${formatTime(upcoming.shift.open)}` };
}

export default getOpenStatus;
