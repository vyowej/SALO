import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useCan } from '../../hooks/useCan';
import config from '../../config';
import { businessService } from '../../services/businessService';
import './BusinessReservationsPage.css';

const RESERVATION_STATUSES = [
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
  ['seated', 'Seated'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['rejected', 'Rejected'],
  ['no_show', 'No-show'],
];

function statusLabel(status) {
  return RESERVATION_STATUSES.find(([value]) => value === status)?.[1] || status;
}

function dateLabel(value) {
  return new Date(value).toLocaleString([], {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function BusinessReservationsPage({ restaurantId, user, readOnly }) {
  const location = useLocation();
  const canView = useCan('reservations.view', restaurantId);
  const canManage = useCan('reservations.manage', restaurantId) && !readOnly;
  const canAccessTables = useCan('tables.manage', restaurantId);
  const canManageTables = canAccessTables && !readOnly;
  const [tab, setTab] = useState(
    (!canView && canAccessTables)
      || (canAccessTables && (
        location.pathname === '/business/tables'
        || new URLSearchParams(location.search).get('tab') === 'tables'
      ))
      ? 'tables'
      : 'reservations',
  );
  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('active');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [reasonAction, setReasonAction] = useState('');
  const [reason, setReason] = useState('');
  const [tableForm, setTableForm] = useState({ name: '', capacity: '4', status: 'active' });
  const [editingTable, setEditingTable] = useState(null);

  const loadData = useCallback(async () => {
    setError('');
    if (!canView && !canAccessTables) {
      setLoading(false);
      return;
    }
    if (!config.useMock) {
      setReservations([]);
      setTables([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await businessService.getBusinessReservations(restaurantId, user);
      setReservations(result.reservations || []);
      setTables(result.tables || []);
    } catch (loadError) {
      setError(loadError.message || 'Restaurant reservations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [canAccessTables, canView, restaurantId, user]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadData();
    });
    return () => { active = false; };
  }, [loadData]);

  const tableNames = useMemo(() => new Map(tables.map((table) => [String(table.id), table.name])), [tables]);
  const visibleReservations = useMemo(() => reservations.filter((reservation) => (
    filter === 'all' || (filter === 'active'
      ? ['pending', 'confirmed', 'seated'].includes(reservation.status)
      : reservation.status === filter)
  )), [filter, reservations]);

  const updateReservation = async (status, statusReason = '') => {
    if (!selectedReservation) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await businessService.updateBusinessReservationStatus(
        restaurantId,
        selectedReservation.id,
        status,
        statusReason,
        user,
      );
      setNotice(`${selectedReservation.reference_code} updated to ${statusLabel(status)}.`);
      setSelectedReservation(null);
      setReasonAction('');
      setReason('');
      await loadData();
    } catch (actionError) {
      setError(actionError.message || 'Reservation status could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const submitReason = (event) => {
    event.preventDefault();
    if (!reason.trim()) return;
    updateReservation(reasonAction, reason.trim());
  };

  const saveTable = async (event) => {
    event.preventDefault();
    if (!tableForm.name.trim() || Number(tableForm.capacity) < 1) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await businessService.saveBusinessTable(restaurantId, {
        ...tableForm,
        id: editingTable?.id,
        capacity: Number(tableForm.capacity),
      }, user);
      setTableForm({ name: '', capacity: '4', status: 'active' });
      setEditingTable(null);
      setNotice(editingTable ? 'Table updated.' : 'Table added.');
      await loadData();
    } catch (actionError) {
      setError(actionError.message || 'Table could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTable = async (table) => {
    if (!window.confirm(`Remove ${table.name}?`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await businessService.deleteBusinessTable(restaurantId, table.id, user);
      setNotice(`${table.name} removed.`);
      await loadData();
    } catch (actionError) {
      setError(actionError.message || 'Table could not be removed.');
    } finally {
      setSaving(false);
    }
  };

  if (!canView && !canManageTables) {
    return <p className="business-error" role="alert">You do not have permission to view reservations or tables.</p>;
  }

  return (
    <div className="business-reservations">
      <header className="business-page-heading">
        <div><p className="business-eyebrow">Restaurant operations</p><h2>Reservations</h2><p>Manage guests and the tables at your restaurant.</p></div>
        {config.useMock ? <span className="business-demo-badge">Demo data</span> : null}
      </header>
      {readOnly ? <p className="business-readonly" role="status">This restaurant is suspended. Reservation and table actions are disabled.</p> : null}
      {!config.useMock ? <p className="business-data-note" role="note">Business reservation and table APIs are not connected yet. Customer reservations are not shown here.</p> : null}
      {error ? <p className="business-error" role="alert">{error}</p> : null}
      {notice ? <p className="business-success" role="status">{notice}</p> : null}

      <div className="business-reservation-tabs" role="tablist" aria-label="Reservation management">
        {canView ? <button type="button" role="tab" aria-selected={tab === 'reservations'} className={tab === 'reservations' ? 'is-selected' : ''} onClick={() => setTab('reservations')}>Reservations</button> : null}
        {canAccessTables ? <button type="button" role="tab" aria-selected={tab === 'tables'} className={tab === 'tables' ? 'is-selected' : ''} onClick={() => setTab('tables')}>Tables <span>{tables.length}</span></button> : null}
      </div>

      {loading ? <p className="business-loading" role="status">Loading restaurant reservations…</p> : null}

      {!loading && tab === 'reservations' && canView ? (
        <section className="business-reservation-section">
          <div className="business-reservation-toolbar">
            <label>Status
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="active">Needs attention / upcoming</option>
                <option value="all">All reservations</option>
                {RESERVATION_STATUSES.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
              </select>
            </label>
            <span>{visibleReservations.length} reservation(s)</span>
          </div>
          {!config.useMock ? <div className="business-reservation-empty"><h3>No live reservation connection</h3><p>This page will only show restaurant bookings once the Business reservation API is available.</p></div> : null}
          {config.useMock && visibleReservations.length ? (
            <div className="business-reservation-list">
              {visibleReservations.map((reservation) => (
                <article className="business-reservation-card" key={reservation.id}>
                  <div className="business-reservation-card__main">
                    <div className="business-reservation-card__heading">
                      <span className={`business-reservation-status business-reservation-status--${reservation.status}`}>{statusLabel(reservation.status)}</span>
                      <strong>{reservation.reference_code}</strong>
                    </div>
                    <h3>{reservation.customer?.name || 'Customer'}</h3>
                    <p>{dateLabel(reservation.reserved_for)} · {reservation.party_size} guests</p>
                    <p>{tableNames.get(String(reservation.table_id)) || 'Table not assigned'} · {reservation.customer?.phone || 'No phone provided'}</p>
                    {reservation.special_request ? <p className="business-reservation-note"><strong>Request:</strong> {reservation.special_request}</p> : null}
                  </div>
                  <Button variant="secondary" onClick={() => { setSelectedReservation(reservation); setReasonAction(''); setReason(''); }}>Review reservation</Button>
                </article>
              ))}
            </div>
          ) : null}
          {config.useMock && !visibleReservations.length ? <div className="business-reservation-empty"><h3>No reservations in this view</h3><p>New customer bookings at this restaurant will appear here.</p></div> : null}
        </section>
      ) : null}

      {!loading && tab === 'tables' && canAccessTables ? (
        <section className="business-reservation-section">
          <div className="business-panel-heading"><div><h3>Restaurant tables</h3><p>Tables used for reservations at this restaurant.</p></div></div>
          {canManageTables ? (
            <form className="business-table-form" onSubmit={saveTable}>
              <label>Table name<input value={tableForm.name} maxLength="80" onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))} required /></label>
              <label>Guest capacity<input type="number" min="1" max="40" value={tableForm.capacity} onChange={(event) => setTableForm((current) => ({ ...current, capacity: event.target.value }))} required /></label>
              {editingTable ? <label>Status<select value={tableForm.status} onChange={(event) => setTableForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label> : null}
              <div><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingTable ? 'Save table' : 'Add table'}</Button>{editingTable ? <Button variant="secondary" disabled={saving} onClick={() => { setEditingTable(null); setTableForm({ name: '', capacity: '4', status: 'active' }); }}>Cancel edit</Button> : null}</div>
            </form>
          ) : null}
          {!config.useMock ? <div className="business-reservation-empty"><h3>Table API unavailable</h3><p>Tables will be shown here when restaurant table management is connected.</p></div> : null}
          {config.useMock && tables.length ? (
            <div className="business-table-grid">
              {tables.map((table) => (
                <article className="business-table-card" key={table.id}>
                  <div><span className={`business-reservation-status business-reservation-status--${table.status}`}>{table.status}</span><h3>{table.name}</h3><p>Seats up to {table.capacity} guests</p></div>
                  {canManageTables ? <div><Button variant="secondary" size="sm" disabled={saving} onClick={() => { setEditingTable(table); setTableForm({ name: table.name, capacity: String(table.capacity), status: table.status }); }}>Edit</Button><Button variant="danger" size="sm" disabled={saving} onClick={() => deleteTable(table)}>Remove</Button></div> : null}
                </article>
              ))}
            </div>
          ) : null}
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
            <p>{dateLabel(selectedReservation.reserved_for)} · Party of {selectedReservation.party_size}</p>
            <p>{tableNames.get(String(selectedReservation.table_id)) || 'Table not assigned'}</p>
            {selectedReservation.special_request ? <p><strong>Special request:</strong> {selectedReservation.special_request}</p> : null}
            {reasonAction ? (
              <form className="business-reservation-reason" onSubmit={submitReason}>
                <label htmlFor="reservation-reason">Reason for {statusLabel(reasonAction).toLowerCase()}</label>
                <textarea id="reservation-reason" value={reason} maxLength="500" rows="3" onChange={(event) => setReason(event.target.value)} required />
                <div><Button type="button" variant="secondary" onClick={() => setReasonAction('')}>Back</Button><Button type="submit" disabled={saving || !reason.trim()}>{saving ? 'Saving…' : statusLabel(reasonAction)}</Button></div>
              </form>
            ) : null}
            {!reasonAction && canManage ? (
              <div className="business-reservation-actions">
                {selectedReservation.status === 'pending' ? <>
                  <Button disabled={saving} onClick={() => updateReservation('confirmed')}>Confirm reservation</Button>
                  <Button variant="secondary" disabled={saving} onClick={() => setReasonAction('rejected')}>Reject</Button>
                </> : null}
                {selectedReservation.status === 'confirmed' ? <>
                  <Button disabled={saving} onClick={() => updateReservation('seated')}>Mark seated</Button>
                  <Button variant="secondary" disabled={saving} onClick={() => setReasonAction('cancelled')}>Cancel</Button>
                  <Button variant="secondary" disabled={saving} onClick={() => setReasonAction('no_show')}>No-show</Button>
                </> : null}
                {selectedReservation.status === 'seated' ? <Button disabled={saving} onClick={() => updateReservation('completed')}>Complete visit</Button> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
