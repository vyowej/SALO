const valueAt = (record, path) => path.split('.').reduce((value, part) => value?.[part], record);

export function paginate(items, params = {}) {
  const systemKeys = new Set(['page', 'per_page', 'search', 'sort', 'direction']);
  let filtered = [...items];

  Object.entries(params).forEach(([key, value]) => {
    if (systemKeys.has(key) || value === undefined || value === null || value === '') return;
    filtered = filtered.filter((item) => {
      if (key === 'capability') return item.capabilities?.includes(value);
      if (key === 'restaurant_id' && Array.isArray(item.memberships)) {
        return item.memberships.some((membership) => membership.restaurant_id === value);
      }
      if (key === 'from') return String(item.placed_at || item.reserved_for || item.created_at || '').slice(0, 10) >= value;
      if (key === 'to') return String(item.placed_at || item.reserved_for || item.created_at || '').slice(0, 10) <= value;
      if (key === 'date') return item.shift_date === value;
      if (key === 'city_code') return item.address?.city_code === value || item.city_code === value;
      if (key === 'actor_id') return item.actor?.id === value;
      if (key === 'rider_id') return item.rider_id === value;
      return String(valueAt(item, key) ?? '') === String(value);
    });
  });

  if (params.search) {
    const query = String(params.search).trim().toLocaleLowerCase();
    filtered = filtered.filter((item) => JSON.stringify(item).toLocaleLowerCase().includes(query));
  }

  const sortBy = params.sort || ['orders', 'reservations', 'applications', 'schedules', 'proofs'].includes(params.resource)
    ? params.sort || 'created_at'
    : 'created_at';
  const direction = params.direction === 'asc' ? 1 : -1;
  filtered.sort((left, right) => {
    const a = valueAt(left, sortBy);
    const b = valueAt(right, sortBy);
    const result = typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
    return result * direction;
  });

  const total = filtered.length;
  const perPage = Math.min(100, Math.max(1, Number(params.per_page) || 15));
  const currentPage = Math.max(1, Number(params.page) || 1);
  return {
    data: filtered.slice((currentPage - 1) * perPage, currentPage * perPage),
    meta: {
      current_page: currentPage,
      per_page: perPage,
      total,
      last_page: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}
