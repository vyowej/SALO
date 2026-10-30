import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import luxonPlugin from '@fullcalendar/luxon3';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { useCan } from '../../hooks/useCan';
import config from '../../config';
import { businessService } from '../../services/businessService';
import './BusinessReservationsPage.css';

const RESERVATION_STATUSES = [
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
  ['declined', 'Declined'],
  ['expired', 'Expired'],
  ['cancelled', 'Cancelled'],
  ['completed', 'Completed'],
  ['no_show', 'No show'],
];

const EMPTY_SETTINGS = {
  accepts_reservations: false,
  confirm_mode: 'manual',
  review_window_hours: '',
  slot_minutes: '',
  dining_minutes: '',
  min_lead_hours: '',
  max_months_ahead: '',
  max_party_size: '',
  grace_minutes: '',
  cancel_cutoff_hours: '',
  is_configured: false,
};

const SETTING_FIELDS = [
  ['review_window_hours', 'Pending hold (hours)', 1],
  ['slot_minutes', 'Reservation slot interval (minutes)', 1],
  ['dining_minutes', 'Default dining duration (minutes)', 1],
  ['min_lead_hours', 'Minimum lead time (hours)', 0],
  ['max_months_ahead', 'Booking window (months)', 1],
  ['max_party_size', 'Maximum party size', 1],
  ['grace_minutes', 'Arrival grace period (minutes)', 0],
  ['cancel_cutoff_hours', 'Customer cancellation cutoff (hours)', 0],
];

function statusLabel(status) {
  return RESERVATION_STATUSES.find(([value]) => value === status)?.[1] || status;
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleString([], {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }) : '—';
}

function localDateTime(value) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function reservationStart(value) {
  return new Date(`${value}:00+08:00`).toISOString();
}

function tableLabel(table, tableId, tables) {
  const match = table || tables.find((item) => String(item.id) === String(tableId));
  return match ? `Table ${match.table_number}${match.area ? ` · ${match.area}` : ''}` : 'Table not assigned';
}

function activeReservations(reservation) {
  return ['pending', 'confirmed'].includes(reservation.status);
}

export default function BusinessReservationsPage({ restaurantId, user, readOnly }) {
  const location = useLocation();
  const canView = useCan('reservations.view', restaurantId);
  const canManage = useCan('reservations.manage', restaurantId) && !readOnly;
  const canAccessTables = useCan('tables.manage', restaurantId);
  const canManageTables = canAccessTables && !readOnly;
  const initialTab = (!canView && canAccessTables)
    || (canAccessTables && (
      location.pathname === '/business/tables'
      || new URLSearchParams(location.search).get('tab') === 'tables'
    ))
    ? 'tables'
    : 'reservations';
  const [tab, setTab] = useState(initialTab);
  const [display, setDisplay] = useState('calendar');
  const [tableSearch, setTableSearch] = useState('');
  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [calendarRange, setCalendarRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('upcoming');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [reasonAction, setReasonAction] = useState('');
  const [reason, setReason] = useState('');
  const [tableForm, setTableForm] = useState({ table_number: '', area: '', capacity: '4', status: 'active' });
  const [editingTable, setEditingTable] = useState(null);
  const [settingsForm, setSettingsForm] = useState(EMPTY_SETTINGS);
  const [rescheduleForm, setRescheduleForm] = useState({ start_at: '', duration_minutes: '', table_id: '' });
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const loadData = useCallback(async () => {
    if (!canView && !canAccessTables) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const filters = calendarRange.from && calendarRange.to
        ? { from: calendarRange.from, to: calendarRange.to, per_page: 100 }
        : { per_page: 100 };
      const result = await businessService.getBusinessReservations(restaurantId, user, filters);
      setReservations(result.reservations || []);
      setTables(result.tables || []);
      setSettings({ ...EMPTY_SETTINGS, ...(result.settings || {}) });
      setSettingsForm({ ...EMPTY_SETTINGS, ...(result.settings || {}) });
    } catch (loadError) {
      setError(loadError.message || 'Restaurant reservations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [calendarRange.from, calendarRange.to, canAccessTables, canView, restaurantId, user]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadData();
    });
    return () => { active = false; };
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    const initialTimer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialTimer);
    };
  }, []);

  const tableNames = useMemo(() => new Map(
    tables.map((table) => [String(table.id), tableLabel(table, table.id, tables)]),
  ), [tables]);

  const visibleReservations = useMemo(() => reservations.filter((reservation) => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') {
      return activeReservations(reservation) && new Date(reservation.start_at) >= new Date();
    }
    return reservation.status === filter;
  }), [filter, reservations]);

  const openReservation = useCallback((reservation) => {
    setSelectedReservation(reservation);
    setReasonAction('');
    setReason('');
    setRescheduleOpen(false);
  }, []);
  const deleteTable = useCallback((table) => setConfirmTarget({ kind: 'delete-table', table }), []);

  const reservationColumns = useMemo(() => [
    { accessorKey: 'reference_code', header: 'Reference' },
    {
      id: 'guest',
      accessorFn: (reservation) => reservation.customer?.name || 'Customer',
      header: 'Guest',
    },
    {
      accessorKey: 'start_at',
      header: 'Start time',
      cell: ({ getValue }) => dateLabel(getValue()),
    },
    {
      id: 'party',
      accessorFn: (reservation) => `${reservation.guest_count} guests`,
      header: 'Party',
    },
    {
      id: 'table',
      accessorFn: (reservation) => tableNames.get(String(reservation.table_id)) || 'Table not assigned',
      header: 'Table',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <span className={`business-reservation-status business-reservation-status--${getValue()}`}>
          {statusLabel(getValue())}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button variant="secondary" size="sm" onClick={() => openReservation(row.original)}>
          Review reservation
        </Button>
      ),
    },
  ], [openReservation, tableNames]);

  // TanStack Table is required for this data-heavy view.
  // eslint-disable-next-line react-hooks/incompatible-library
  const reservationTable = useReactTable({
    data: visibleReservations,
    columns: reservationColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const tableColumns = useMemo(() => [
    { accessorKey: 'table_number', header: 'Table' },
    { accessorKey: 'capacity', header: 'Capacity', cell: ({ getValue }) => `${getValue()} guests` },
    { accessorKey: 'area', header: 'Area', cell: ({ getValue }) => getValue() || '—' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <span className={`business-reservation-status business-reservation-status--${getValue()}`}>
          {getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'attention_count',
      header: 'Needs attention',
      cell: ({ getValue }) => {
        const count = Number(getValue() || 0);
        return count ? <span className="business-table-attention">{count} reservation(s)</span> : '—';
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => canManageTables ? (
        <div className="business-table-actions">
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={() => {
              const table = row.original;
              setEditingTable(table);
              setTableForm({
                table_number: table.table_number,
                area: table.area || '',
                capacity: String(table.capacity),
                status: table.status,
              });
            }}
          >
            Edit
          </Button>
          <Button variant="danger" size="sm" disabled={saving} onClick={() => deleteTable(row.original)}>Remove</Button>
        </div>
      ) : '—',
    },
  ], [canManageTables, deleteTable, saving]);

  // TanStack Table provides filtering and pagination for the table inventory.
  const tableInventory = useReactTable({
    data: tables,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, value) => [
      row.original.table_number,
      row.original.area,
      row.original.status,
      row.original.capacity,
    ].some((field) => String(field ?? '').toLocaleLowerCase().includes(String(value).toLocaleLowerCase())),
    state: { globalFilter: tableSearch },
    onGlobalFilterChange: setTableSearch,
    initialState: { pagination: { pageSize: 10 } },
  });

  const calendarEvents = useMemo(() => visibleReservations.map((reservation) => ({
    id: String(reservation.id),
    title: `${reservation.reference_code} · ${tableNames.get(String(reservation.table_id)) || 'Unassigned'}`,
    start: reservation.start_at,
    end: reservation.end_at,
    classNames: [`business-reservation-event--${reservation.status}`],
    extendedProps: { reservation },
  })), [tableNames, visibleReservations]);

  const setCalendarDates = useCallback((info) => {
    setCalendarRange((current) => (
      current.from === info.startStr && current.to === info.endStr
        ? current
        : { from: info.startStr, to: info.endStr }
    ));
  }, []);

  const confirmReservationAction = (reservation, status, statusReason = null) => {
    setConfirmTarget({
      kind: 'reservation-status',
      reservation,
      status,
      reason: statusReason,
    });
  };

  const submitReason = (event) => {
    event.preventDefault();
    if (!selectedReservation || !reason.trim()) return;
    confirmReservationAction(selectedReservation, reasonAction, reason.trim());
  };

  const saveTable = async (event) => {
    event.preventDefault();
    const data = {
      ...tableForm,
      capacity: Number(tableForm.capacity),
    };
    if (editingTable && editingTable.status !== data.status) {
      setConfirmTarget({ kind: 'save-table', data, table: editingTable });
      return;
    }
    await persistTable(data);
  };

  const persistTable = async (data, table = editingTable) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await businessService.saveBusinessTable(restaurantId, { ...data, id: table?.id }, user);
      setTableForm({ table_number: '', area: '', capacity: '4', status: 'active' });
      setEditingTable(null);
      const affected = Number(updated?.affected_reservations || 0);
      setNotice(`${table ? 'Table updated.' : 'Table added.'}${affected ? ` ${affected} future reservation(s) need attention.` : ''}`);
      await loadData();
    } catch (saveError) {
      setError(saveError.message || 'Table could not be saved.');
    } finally {
      setSaving(false);
      setConfirmTarget(null);
    }
  };

  const saveSettings = (event) => {
    event.preventDefault();
    const data = {
      ...settingsForm,
      accepts_reservations: Boolean(settingsForm.accepts_reservations),
    };
    for (const [key] of SETTING_FIELDS) data[key] = Number(data[key]);
    if (settings.accepts_reservations !== data.accepts_reservations) {
      setConfirmTarget({ kind: 'save-settings', data });
      return;
    }
    persistSettings(data);
  };

  const persistSettings = async (data) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await businessService.updateBusinessReservationSettings(restaurantId, data, user);
      setSettings({ ...EMPTY_SETTINGS, ...result });
      setSettingsForm({ ...EMPTY_SETTINGS, ...result });
      setNotice('Reservation settings saved.');
    } catch (saveError) {
      setError(saveError.message || 'Reservation settings could not be saved.');
    } finally {
      setSaving(false);
      setConfirmTarget(null);
    }
  };

  const saveReschedule = (event) => {
    event.preventDefault();
    if (!selectedReservation || !rescheduleForm.start_at) return;
    setConfirmTarget({
      kind: 'reschedule',
      reservation: selectedReservation,
      data: {
        start_at: reservationStart(rescheduleForm.start_at),
        duration_minutes: Number(rescheduleForm.duration_minutes || selectedReservation.duration_minutes),
        ...(rescheduleForm.table_id ? { table_id: Number(rescheduleForm.table_id) } : {}),
      },
    });
  };

  const performConfirmation = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    if (target.kind === 'save-table') {
      await persistTable(target.data, target.table);
      return;
    }
    if (target.kind === 'save-settings') {
      await persistSettings(target.data);
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (target.kind === 'delete-table') {
        await businessService.deleteBusinessTable(restaurantId, target.table.id, user);
        setNotice(`Table ${target.table.table_number} removed.`);
        if (String(editingTable?.id) === String(target.table.id)) {
          setEditingTable(null);
          setTableForm({ table_number: '', area: '', capacity: '4', status: 'active' });
        }
      } else if (target.kind === 'reschedule') {
        const updated = await businessService.rescheduleBusinessReservation(
          restaurantId,
          target.reservation.id,
          target.data,
          user,
        );
        setSelectedReservation(updated);
        setRescheduleOpen(false);
        setNotice(`${updated.reference_code} rescheduled.`);
      } else {
        const updated = await businessService.updateBusinessReservationStatus(
          restaurantId,
          target.reservation.id,
          target.status,
          target.reason,
          user,
        );
        setSelectedReservation(updated);
        setReasonAction('');
        setReason('');
        setNotice(`${updated.reference_code} updated to ${statusLabel(target.status)}.`);
      }
      await loadData();
    } catch (actionError) {
      setError(actionError.message || 'The requested change could not be completed.');
    } finally {
      setSaving(false);
      setConfirmTarget(null);
    }
  };

  const openReschedule = () => {
    setRescheduleForm({
      start_at: localDateTime(selectedReservation?.start_at),
      duration_minutes: String(selectedReservation?.duration_minutes || settings.dining_minutes || ''),
      table_id: String(selectedReservation?.table_id || ''),
    });
    setRescheduleOpen(true);
  };

  const markNoShowAllowed = (reservation) => {
    const graceMinutes = Number(settings.grace_minutes || 0);
    return currentTime > 0
      && currentTime >= new Date(reservation.start_at).getTime() + graceMinutes * 60_000;
  };

  if (!canView && !canManageTables) {
    return <p className="business-error" role="alert">You do not have permission to view reservations or tables.</p>;
  }

  return (
    <div className="business-reservations">
      <header className="business-page-heading">
        <div>
          <p className="business-eyebrow">Restaurant operations</p>
          <h2>Reservations and tables</h2>
          <p>Manage guest bookings, table availability, and reservation policy.</p>
        </div>
        {config.useMock ? <span className="business-demo-badge">Demo data</span> : null}
      </header>
      {readOnly ? <p className="business-readonly" role="status">This restaurant is suspended. Reservation and table actions are disabled.</p> : null}
      {error ? <div className="business-error" role="alert"><p>{error}</p><Button variant="secondary" onClick={loadData} disabled={loading}>Try again</Button></div> : null}
      {notice ? <p className="business-success" role="status">{notice}</p> : null}

      <nav className="business-reservation-tabs" aria-label="Reservation management">
        {canView ? <button type="button" aria-pressed={tab === 'reservations'} className={tab === 'reservations' ? 'is-selected' : ''} onClick={() => setTab('reservations')}>Reservations</button> : null}
        {canAccessTables ? <button type="button" aria-pressed={tab === 'tables'} className={tab === 'tables' ? 'is-selected' : ''} onClick={() => setTab('tables')}>Tables <span>{tables.length}</span></button> : null}
        {canView ? <button type="button" aria-pressed={tab === 'settings'} className={tab === 'settings' ? 'is-selected' : ''} onClick={() => setTab('settings')}>Reservation settings</button> : null}
      </nav>

      {loading ? <p className="business-loading" role="status">Loading reservations and tables…</p> : null}

      {!loading && tab === 'reservations' && canView ? (
        <section className="business-reservation-section">
          <div className="business-reservation-toolbar">
            <label>Status
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="upcoming">Upcoming and active</option>
                <option value="all">All statuses</option>
                {RESERVATION_STATUSES.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
              </select>
            </label>
            <div className="business-reservation-view-switch" aria-label="Reservation view">
              <button type="button" aria-pressed={display === 'calendar'} onClick={() => setDisplay('calendar')}>Calendar</button>
              <button type="button" aria-pressed={display === 'list'} onClick={() => setDisplay('list')}>List</button>
            </div>
            <span>{visibleReservations.length} reservation(s)</span>
          </div>
          {display === 'calendar' ? (
            <div className="business-reservation-calendar">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, luxonPlugin]}
                initialView="timeGridWeek"
                timeZone="Asia/Manila"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                events={calendarEvents}
                datesSet={setCalendarDates}
                eventClick={(info) => openReservation(info.event.extendedProps.reservation)}
                eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
                height="auto"
                noEventsContent="No reservations in this period."
              />
            </div>
          ) : (
            visibleReservations.length ? (
              <div className="business-reservation-table-wrap">
                <table className="business-reservation-table">
                  <thead>
                    {reservationTable.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th key={header.id} scope="col">
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {reservationTable.getRowModel().rows.map((row) => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="business-reservation-pagination" aria-label="Reservation list pagination">
                  <span>{reservationTable.getState().pagination.pageIndex + 1} of {reservationTable.getPageCount()}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!reservationTable.getCanPreviousPage()}
                    onClick={() => reservationTable.previousPage()}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!reservationTable.getCanNextPage()}
                    onClick={() => reservationTable.nextPage()}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : <div className="business-reservation-empty"><h3>No reservations in this view</h3><p>Bookings will appear here as customers reserve tables.</p></div>
          )}
        </section>
      ) : null}

      {!loading && tab === 'tables' && canAccessTables ? (
        <section className="business-reservation-section">
          <div className="business-panel-heading"><div><h3>Restaurant tables</h3><p>Active, maintenance, and inactive table inventory.</p></div></div>
          {canManageTables ? (
            <form className="business-table-form" onSubmit={saveTable}>
              <label>Table number<input value={tableForm.table_number} maxLength="80" onChange={(event) => setTableForm((current) => ({ ...current, table_number: event.target.value }))} required /></label>
              <label>Guest capacity<input type="number" min="1" value={tableForm.capacity} onChange={(event) => setTableForm((current) => ({ ...current, capacity: event.target.value }))} required /></label>
              <label>Area (optional)<input value={tableForm.area} maxLength="120" onChange={(event) => setTableForm((current) => ({ ...current, area: event.target.value }))} /></label>
              {editingTable ? <label>Status<select value={tableForm.status} onChange={(event) => setTableForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></select></label> : null}
              <div>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingTable ? 'Save table' : 'Add table'}</Button>
                {editingTable ? <Button type="button" variant="secondary" disabled={saving} onClick={() => { setEditingTable(null); setTableForm({ table_number: '', area: '', capacity: '4', status: 'active' }); }}>Cancel edit</Button> : null}
              </div>
            </form>
          ) : null}
          {tables.length ? (
            <div className="business-reservation-table-inventory">
              <label>
                Search tables
                <input
                  type="search"
                  value={tableSearch ?? ''}
                  onChange={(event) => {
                    setTableSearch(event.target.value);
                    tableInventory.setPageIndex(0);
                  }}
                  placeholder="Table, area, status, or capacity"
                />
              </label>
              {tableInventory.getRowModel().rows.length ? (
                <>
                  <div className="business-reservation-table-wrap">
                    <table className="business-reservation-table business-reservation-table--inventory">
                      <thead>
                        {tableInventory.getHeaderGroups().map((headerGroup) => (
                          <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <th key={header.id} scope="col">
                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {tableInventory.getRowModel().rows.map((row) => (
                          <tr key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="business-reservation-pagination" aria-label="Table inventory pagination">
                    <span>{tableInventory.getState().pagination.pageIndex + 1} of {tableInventory.getPageCount()}</span>
                    <Button variant="secondary" size="sm" disabled={!tableInventory.getCanPreviousPage()} onClick={() => tableInventory.previousPage()}>Previous</Button>
                    <Button variant="secondary" size="sm" disabled={!tableInventory.getCanNextPage()} onClick={() => tableInventory.nextPage()}>Next</Button>
                  </div>
                </>
              ) : <div className="business-reservation-empty"><h3>No matching tables</h3><p>Try a different search term.</p></div>}
            </div>
          ) : <div className="business-reservation-empty"><h3>No tables yet</h3><p>Add restaurant tables before enabling reservations.</p></div>}
        </section>
      ) : null}

      {!loading && tab === 'settings' && canView ? (
        <section className="business-reservation-section">
          <div className="business-panel-heading"><div><h3>Reservation policy</h3><p>Set booking windows, confirmation, and guest arrival rules.</p></div></div>
          {!settings.is_configured ? <p className="business-data-note" role="status">Complete and save the policy before reservation booking can be enabled.</p> : null}
          {!canManage ? <p className="business-readonly">You can view reservation settings but cannot change them.</p> : (
            <form className="business-settings-form" onSubmit={saveSettings}>
              <label className="business-setting-toggle">
                <input type="checkbox" checked={Boolean(settingsForm.accepts_reservations)} onChange={(event) => setSettingsForm((current) => ({ ...current, accepts_reservations: event.target.checked }))} />
                Accept reservations
              </label>
              <label>Confirmation mode
                <select value={settingsForm.confirm_mode} onChange={(event) => setSettingsForm((current) => ({ ...current, confirm_mode: event.target.value }))}>
                  <option value="manual">Manual review</option>
                  <option value="automatic">Automatic confirmation</option>
                </select>
              </label>
              <div className="business-settings-grid">
                {SETTING_FIELDS.map(([key, label, min]) => (
                  <label key={key}>{label}
                    <input type="number" min={min} max="65535" step="1" value={settingsForm[key] ?? ''} required onChange={(event) => setSettingsForm((current) => ({ ...current, [key]: event.target.value }))} />
                  </label>
                ))}
              </div>
              <p className="business-data-note">Cancellation cutoff bounds are awaiting an Admin-configured policy range; the saved value is not applied to customer cancellation until that rule is defined.</p>
              <div><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save reservation settings'}</Button></div>
            </form>
          )}
        </section>
      ) : null}

      <Modal
        open={Boolean(selectedReservation)}
        title={selectedReservation ? `Reservation ${selectedReservation.reference_code}` : 'Reservation'}
        onClose={() => !saving && setSelectedReservation(null)}
      >
        {selectedReservation ? (
          <div className="business-reservation-detail">
            <span className={`business-reservation-status business-reservation-status--${selectedReservation.status}`}>{statusLabel(selectedReservation.status)}</span>
            <p><strong>{selectedReservation.customer?.name || 'Customer'}</strong> · {selectedReservation.customer?.phone || 'No phone provided'}</p>
            <p>{dateLabel(selectedReservation.start_at)} – {dateLabel(selectedReservation.end_at)} · Party of {selectedReservation.guest_count}</p>
            <p>{tableLabel(selectedReservation.table, selectedReservation.table_id, tables)}</p>
            {selectedReservation.expires_at ? <p>Pending hold expires {dateLabel(selectedReservation.expires_at)}.</p> : null}
            {selectedReservation.special_request ? <p><strong>Special request:</strong> {selectedReservation.special_request}</p> : null}
            {selectedReservation.response_reason ? <p><strong>Response note:</strong> {selectedReservation.response_reason}</p> : null}
            {selectedReservation.cancel_reason ? <p><strong>Cancellation reason:</strong> {selectedReservation.cancel_reason}</p> : null}

            {rescheduleOpen && canManage ? (
              <form className="business-reschedule-form" onSubmit={saveReschedule}>
                <label>New start time<input type="datetime-local" value={rescheduleForm.start_at} onChange={(event) => setRescheduleForm((current) => ({ ...current, start_at: event.target.value }))} required /></label>
                <label>Duration (minutes)<input type="number" min="1" max="1440" value={rescheduleForm.duration_minutes} onChange={(event) => setRescheduleForm((current) => ({ ...current, duration_minutes: event.target.value }))} required /></label>
                <label>Table
                  <select value={rescheduleForm.table_id} onChange={(event) => setRescheduleForm((current) => ({ ...current, table_id: event.target.value }))}>
                    <option value="">Choose the best-fit available table</option>
                    {tables.filter((table) => table.status === 'active' && table.capacity >= selectedReservation.guest_count).map((table) => (
                      <option key={table.id} value={table.id}>Table {table.table_number}{table.area ? ` · ${table.area}` : ''}</option>
                    ))}
                  </select>
                </label>
                <div><Button type="button" variant="secondary" onClick={() => setRescheduleOpen(false)}>Back</Button><Button type="submit" disabled={saving}>Review reschedule</Button></div>
              </form>
            ) : null}

            {reasonAction && canManage ? (
              <form className="business-reservation-reason" onSubmit={submitReason}>
                <label htmlFor="reservation-reason">Reason for {statusLabel(reasonAction).toLowerCase()}</label>
                <textarea id="reservation-reason" value={reason} maxLength="500" rows="3" onChange={(event) => setReason(event.target.value)} required />
                <div><Button type="button" variant="secondary" onClick={() => setReasonAction('')}>Back</Button><Button type="submit" disabled={saving || !reason.trim()}>Review action</Button></div>
              </form>
            ) : null}

            {!reasonAction && !rescheduleOpen && canManage ? (
              <div className="business-reservation-actions">
                {selectedReservation.status === 'pending' ? <>
                  <Button variant="secondary" disabled={saving} onClick={() => confirmReservationAction(selectedReservation, 'confirmed')}>Confirm reservation</Button>
                  <Button variant="secondary" disabled={saving} onClick={() => setReasonAction('declined')}>Decline</Button>
                  <Button variant="secondary" disabled={saving} onClick={() => setReasonAction('cancelled')}>Cancel</Button>
                  <Button variant="secondary" disabled={saving} onClick={openReschedule}>Reschedule</Button>
                </> : null}
                {selectedReservation.status === 'confirmed' ? <>
                  <Button variant="secondary" disabled={saving} onClick={() => confirmReservationAction(selectedReservation, 'completed')}>Complete visit</Button>
                  <Button variant="secondary" disabled={saving} onClick={() => setReasonAction('cancelled')}>Cancel</Button>
                  <Button variant="secondary" disabled={saving} onClick={openReschedule}>Reschedule</Button>
                  {markNoShowAllowed(selectedReservation) ? <Button variant="secondary" disabled={saving} onClick={() => confirmReservationAction(selectedReservation, 'no_show')}>Mark No Show</Button> : null}
                </> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={
          confirmTarget?.kind === 'delete-table' ? 'Remove this table?'
            : confirmTarget?.kind === 'save-table' ? 'Change table status?'
              : confirmTarget?.kind === 'save-settings' ? 'Change reservation availability?'
                : confirmTarget?.kind === 'reschedule' ? 'Reschedule this reservation?'
                  : `Update reservation to ${statusLabel(confirmTarget?.status || '')}?`
        }
        message={
          confirmTarget?.kind === 'delete-table'
            ? 'A table with reservation history cannot be deleted. This action will be blocked if bookings exist.'
            : confirmTarget?.kind === 'save-table'
              ? 'Changing a table to Maintenance or Inactive may affect future bookings. Those reservations will remain visible for follow-up.'
              : confirmTarget?.kind === 'save-settings'
                ? 'Changing whether customers can book affects new reservations. Existing reservations are unchanged.'
                : confirmTarget?.kind === 'reschedule'
                  ? 'The new time and table will be checked against hours, closures, capacity, and current reservations before saving.'
                  : 'This reservation status change will be recorded in the restaurant audit history.'
        }
        confirmLabel={
          confirmTarget?.kind === 'delete-table' ? 'Remove table'
            : confirmTarget?.kind === 'save-table' ? 'Save table'
              : confirmTarget?.kind === 'save-settings' ? 'Save settings'
                : confirmTarget?.kind === 'reschedule' ? 'Reschedule'
                  : statusLabel(confirmTarget?.status || 'Confirm')
        }
        busy={saving}
        onCancel={() => !saving && setConfirmTarget(null)}
        onConfirm={performConfirmation}
      />
    </div>
  );
}
