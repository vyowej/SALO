import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import AdminShell from '../../components/admin/AdminShell';
import { adminService } from '../../services/admin';
import './RiderSchedulingAdminPage.css';

const emptyZone = {
  name: '',
  psgc_code: '',
  center_lat: '',
  center_lng: '',
  radius_km: '5',
};

const getErrorMessage = (error) => error?.message || 'The rider schedule could not be updated.';

function RiderSchedulingAdminPage() {
  const [overview, setOverview] = useState({ zones: [], shifts: [], max_zone_distance_km: 10 });
  const [assignments, setAssignments] = useState([]);
  const [zoneForm, setZoneForm] = useState(emptyZone);
  const [capacityValues, setCapacityValues] = useState({});
  const [overrideValues, setOverrideValues] = useState({});
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [statusTarget, setStatusTarget] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextOverview, assignmentPage] = await Promise.all([
        adminService.getRiderScheduling(),
        adminService.listRiderAssignments({
          per_page: 100,
          ...(statusFilter ? { status: statusFilter } : {}),
        }),
      ]);
      setOverview(nextOverview);
      setAssignments(assignmentPage.data || []);
    } catch (requestError) {
      console.error('Unable to load rider zones and shifts.', requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadData();
    });
    return () => {
      active = false;
    };
  }, [loadData, retry]);

  const activeZones = useMemo(() => overview.zones.filter((zone) => zone.is_active), [overview.zones]);
  const updateCapacityValue = (key, value) => setCapacityValues((current) => ({ ...current, [key]: value }));
  const updateOverrideValue = (id, key, value) => setOverrideValues((current) => ({
    ...current,
    [id]: { ...current[id], [key]: value },
  }));

  const createZone = async (event) => {
    event.preventDefault();
    setSaving('zone');
    setError('');
    setNotice('');
    try {
      await adminService.createRiderZone({
        ...zoneForm,
        psgc_code: zoneForm.psgc_code.trim() || null,
        center_lat: Number(zoneForm.center_lat),
        center_lng: Number(zoneForm.center_lng),
        radius_km: Number(zoneForm.radius_km),
        is_active: true,
        capacities: overview.shifts.map((shift) => ({
          shift_id: shift.id,
          max_riders: Number(zoneForm[`capacity-${shift.id}`] ?? 10),
        })),
      });
      setZoneForm(emptyZone);
      setNotice('Zone and shift capacities saved.');
      setRetry((value) => value + 1);
    } catch (requestError) {
      console.error('Unable to create the rider delivery zone.', requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setSaving('');
    }
  };

  const saveCapacity = async (zone, capacity) => {
    const key = `${zone.id}:${capacity.shift_id}`;
    setSaving(key);
    setError('');
    setNotice('');
    try {
      await adminService.setRiderZoneCapacity(zone.id, capacity.shift_id, {
        max_riders: Number(capacityValues[key] ?? capacity.max_riders),
      });
      setNotice(`Capacity updated for ${zone.name} — ${capacity.shift_name}.`);
      setRetry((value) => value + 1);
    } catch (requestError) {
      console.error('Unable to update rider zone capacity.', requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setSaving('');
    }
  };

  const toggleZone = async (zone) => {
    setSaving(`zone:${zone.id}`);
    setError('');
    setNotice('');
    try {
      await adminService.updateRiderZone(zone.id, { is_active: !zone.is_active });
      setNotice(`${zone.name} ${zone.is_active ? 'deactivated' : 'activated'}.`);
      setRetry((value) => value + 1);
    } catch (requestError) {
      console.error('Unable to update rider zone status.', requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setSaving('');
    }
  };

  const saveOverride = async (event, assignment) => {
    event.preventDefault();
    const values = overrideValues[assignment.id] || {};
    setSaving(`assignment:${assignment.id}`);
    setError('');
    setNotice('');
    try {
      await adminService.overrideRiderAssignment(assignment.rider_id, assignment.id, {
        zone_id: values.zone_id || assignment.zone_id,
        shift_id: values.shift_id || assignment.shift_id,
        reason: values.reason || '',
      });
      setNotice(`Shift assignment updated for ${assignment.rider_name}.`);
      setRetry((value) => value + 1);
    } catch (requestError) {
      console.error('Unable to override the rider shift assignment.', requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setSaving('');
    }
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    const nextStatus = statusTarget.rider_status === 'suspended' ? 'active' : 'suspended';
    setSaving(`status:${statusTarget.rider_id}`);
    setError('');
    setNotice('');
    try {
      await adminService.setRiderOperatingStatus(statusTarget.rider_id, { status: nextStatus });
      setStatusTarget(null);
      setNotice(`Rider ${nextStatus === 'suspended' ? 'suspended' : 'reinstated'}; shift capacity and waitlist were refreshed.`);
      setRetry((value) => value + 1);
    } catch (requestError) {
      console.error('Unable to change rider operating status.', requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setSaving('');
    }
  };

  return (
    <AdminShell>
      <section className="rider-scheduling-admin" aria-labelledby="rider-scheduling-title">
        <header className="rider-scheduling-admin__heading">
          <div>
            <h2 id="rider-scheduling-title">Rider zones and shifts</h2>
            <p>Manage recurring zone capacity and review automatic assignments. Assignment distance limit: {overview.max_zone_distance_km} km.</p>
          </div>
          <Button variant="secondary" onClick={() => setRetry((value) => value + 1)} disabled={loading}>
            <RefreshCw aria-hidden="true" size={17} /> Refresh
          </Button>
        </header>

        {error ? <p className="rider-scheduling-admin__message rider-scheduling-admin__message--error" role="alert">{error}</p> : null}
        {notice ? <p className="rider-scheduling-admin__message" role="status">{notice}</p> : null}
        {loading ? <div className="skeleton-card" role="status" aria-label="Loading rider zones and shifts" /> : null}

        {!loading && !error ? (
          <>
            <Card className="rider-scheduling-admin__panel">
              <h3>Create a delivery zone</h3>
              <form className="rider-scheduling-admin__zone-form" onSubmit={createZone}>
                <label><span>Zone name</span><input required maxLength={100} value={zoneForm.name} onChange={(event) => setZoneForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label><span>PSGC code (optional)</span><input maxLength={12} value={zoneForm.psgc_code} onChange={(event) => setZoneForm((current) => ({ ...current, psgc_code: event.target.value }))} /></label>
                <label><span>Center latitude</span><input type="number" step="any" min="-90" max="90" required value={zoneForm.center_lat} onChange={(event) => setZoneForm((current) => ({ ...current, center_lat: event.target.value }))} /></label>
                <label><span>Center longitude</span><input type="number" step="any" min="-180" max="180" required value={zoneForm.center_lng} onChange={(event) => setZoneForm((current) => ({ ...current, center_lng: event.target.value }))} /></label>
                <label><span>Radius (km)</span><input type="number" min="0.01" max="999.99" step="0.01" required value={zoneForm.radius_km} onChange={(event) => setZoneForm((current) => ({ ...current, radius_km: event.target.value }))} /></label>
                {overview.shifts.map((shift) => (
                  <label key={shift.id}><span>{shift.name} capacity</span><input type="number" min="1" max="65535" required value={zoneForm[`capacity-${shift.id}`] ?? '10'} onChange={(event) => setZoneForm((current) => ({ ...current, [`capacity-${shift.id}`]: event.target.value }))} /></label>
                ))}
                <Button type="submit" disabled={saving === 'zone' || !overview.shifts.length}>
                  <Save aria-hidden="true" size={17} />{saving === 'zone' ? 'Saving…' : 'Create zone'}
                </Button>
              </form>
            </Card>

            <section className="rider-scheduling-admin__zones" aria-labelledby="rider-zones-title">
              <div className="rider-scheduling-admin__section-heading">
                <h3 id="rider-zones-title">Zone capacity</h3>
                <span>{overview.zones.length} zones · {overview.shifts.length} recurring shifts</span>
              </div>
              {!overview.zones.length ? <EmptyState title="No zones configured" message="Create a zone and set capacity for each recurring shift." /> : null}
              {overview.zones.map((zone) => (
                <Card className="rider-scheduling-admin__zone" key={zone.id}>
                  <div className="rider-scheduling-admin__zone-heading">
                    <div><h4>{zone.name}</h4><p>{zone.center_lat}, {zone.center_lng} · {zone.radius_km} km radius · {zone.is_active ? 'Active' : 'Inactive'}</p></div>
                    <Button variant="secondary" onClick={() => toggleZone(zone)} disabled={saving === `zone:${zone.id}`}>
                      {zone.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                  <div className="rider-scheduling-admin__capacity-grid">
                    {zone.capacities.map((capacity) => {
                      const key = `${zone.id}:${capacity.shift_id}`;
                      return (
                        <form className="rider-scheduling-admin__capacity" key={key} onSubmit={(event) => { event.preventDefault(); saveCapacity(zone, capacity); }}>
                          <div><strong>{capacity.shift_name}</strong><small>{capacity.start_time}–{capacity.end_time}</small></div>
                          <p>{capacity.assigned_riders} assigned · {capacity.available_slots} available</p>
                          <label><span>Maximum riders</span><input type="number" min="1" max="65535" required value={capacityValues[key] ?? capacity.max_riders ?? ''} onChange={(event) => updateCapacityValue(key, event.target.value)} /></label>
                          <Button variant="secondary" type="submit" disabled={saving === key}>
                            {saving === key ? 'Saving…' : 'Save capacity'}
                          </Button>
                          {capacity.max_riders === null ? <small>Set capacity to make this zone eligible for the shift.</small> : null}
                        </form>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </section>

            <section className="rider-scheduling-admin__assignments" aria-labelledby="rider-assignments-title">
              <div className="rider-scheduling-admin__section-heading">
                <div><h3 id="rider-assignments-title">Rider assignments</h3><p>System assignments choose the nearest eligible zone with available capacity; ties use zone ID.</p></div>
                <label><span>Filter</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All</option><option value="assigned">Assigned</option><option value="waitlisted">Waitlisted</option></select></label>
              </div>
              {!assignments.length ? <EmptyState title="No rider assignments" message="Approved riders' preferred shifts appear here after application review." /> : null}
              <div className="rider-scheduling-admin__assignment-list">
                {assignments.map((assignment) => {
                  const values = overrideValues[assignment.id] || {};
                  return (
                    <Card className="rider-scheduling-admin__assignment" key={assignment.id}>
                      <div className="rider-scheduling-admin__assignment-summary">
                        <div><h4>{assignment.rider_name || `Rider ${assignment.rider_id}`}</h4><p>{assignment.shift_name} · {assignment.shift_start_time}–{assignment.shift_end_time}</p></div>
                        <span className={`rider-scheduling-admin__status rider-scheduling-admin__status--${assignment.status}`}>{assignment.status}</span>
                      </div>
                      <p>{assignment.zone_name || 'No zone assigned'}{assignment.reason ? ` · ${assignment.reason}` : ''}</p>
                      {['active', 'suspended'].includes(assignment.rider_status) ? (
                        <Button variant="secondary" onClick={() => setStatusTarget(assignment)} disabled={saving === `status:${assignment.rider_id}`}>
                          {assignment.rider_status === 'suspended' ? 'Reinstate rider' : 'Suspend rider'}
                        </Button>
                      ) : null}
                      <details>
                        <summary>Override assignment</summary>
                        <form className="rider-scheduling-admin__override" onSubmit={(event) => saveOverride(event, assignment)}>
                          <label><span>Zone</span><select required value={values.zone_id ?? assignment.zone_id ?? ''} onChange={(event) => updateOverrideValue(assignment.id, 'zone_id', event.target.value)}><option value="" disabled>Select zone</option>{activeZones.map((zone) => <option value={zone.id} key={zone.id}>{zone.name}</option>)}</select></label>
                          <label><span>Shift</span><select required value={values.shift_id ?? assignment.shift_id} onChange={(event) => updateOverrideValue(assignment.id, 'shift_id', event.target.value)}>{overview.shifts.map((shift) => <option value={shift.id} key={shift.id}>{shift.name}</option>)}</select></label>
                          <label className="rider-scheduling-admin__override-reason"><span>Reason (required)</span><input required minLength={3} maxLength={255} value={values.reason || ''} onChange={(event) => updateOverrideValue(assignment.id, 'reason', event.target.value)} /></label>
                          <Button type="submit" disabled={saving === `assignment:${assignment.id}` || !activeZones.length}>
                            {saving === `assignment:${assignment.id}` ? 'Saving…' : 'Save override'}
                          </Button>
                        </form>
                      </details>
                    </Card>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}
      </section>
      <ConfirmDialog
        open={statusTarget !== null}
        title={statusTarget?.rider_status === 'suspended' ? 'Reinstate rider?' : 'Suspend rider?'}
        message="This changes the rider’s eligibility. Suspension releases assigned shift capacity and triggers a waitlist check."
        confirmLabel={statusTarget?.rider_status === 'suspended' ? 'Reinstate' : 'Suspend'}
        busy={saving.startsWith('status:')}
        onCancel={() => setStatusTarget(null)}
        onConfirm={confirmStatusChange}
      />
    </AdminShell>
  );
}

export default RiderSchedulingAdminPage;
