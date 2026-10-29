import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bike,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Store,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import AdminShell from '../../components/admin/AdminShell';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminStatCard from '../../components/admin/AdminStatCard';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import PhotoViewer from '../../components/admin/PhotoViewer';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  ADMIN_COPY,
  ADMIN_FORM_FIELDS,
  ADMIN_RESOURCE_FIELDS,
} from '../../constants/admin';
import { adminService } from '../../services/admin';
import { locationService } from '../../services/locationService';
import '../Page.css';
import './AdminPage.css';

const AdminChartCard = lazy(() => import('../../components/admin/AdminChartCard'));
const AdminScheduleCalendar = lazy(() => import('../../components/admin/AdminScheduleCalendar'));

const resourceForPage = {
  users: 'users',
  restaurants: 'restaurants',
  applications: 'applications',
  riders: 'riders',
  orders: 'orders',
  reservations: 'reservations',
  history: 'history',
};

const listMethodForResource = {
  users: 'listUsers',
  restaurants: 'listRestaurants',
  applications: 'listApplications',
  riders: 'listRiders',
  orders: 'listOrders',
  reservations: 'listReservations',
  history: 'listHistory',
  'service-areas': 'listServiceAreas',
  schedules: 'listSchedules',
};

const detailMethodForResource = {
  users: 'getUser',
  restaurants: 'getRestaurant',
  applications: 'getApplication',
  riders: 'getRider',
  orders: 'getOrder',
  reservations: 'getReservation',
};

const columnValue = (record, path) => path.split('.').reduce((value, key) => value?.[key], record);
const setPath = (object, path, value) => {
  const keys = path.split('.');
  let current = object;
  keys.slice(0, -1).forEach((key) => {
    current[key] ||= {};
    current = current[key];
  });
  current[keys[keys.length - 1]] = value;
};
const readPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(date);
};
const formatMoney = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);
const todayInManila = () => {
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${part.year}-${part.month}-${part.day}`;
};
const humanize = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};
const getErrorMessage = (error) => error?.message || ADMIN_COPY.requestFailed;

function StatusBadge({ value }) {
  const key = String(value || '').toLowerCase();
  return <span className={`admin-status admin-status--${key.replaceAll('_', '-')}`}>{ADMIN_COPY.statusOptions[key] || humanize(value)}</span>;
}

function InlineAlert({ children }) {
  if (!children) return null;
  return <p className="admin-alert" role="alert">{children}</p>;
}

function LocationSearchField({ onSelect }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    if (!query.trim() || selected) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      locationService.searchPlaces(query)
        .then((places) => { if (active) setSuggestions(places); })
        .catch((searchError) => {
          console.error('Unable to search locations for an admin form.', searchError);
          if (active) setError(ADMIN_COPY.locationSearchError);
        })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, selected]);

  return (
    <div className="admin-location-search">
      <label className="admin-form-field">
        <span>{ADMIN_COPY.locationSearch}</span>
        <input type="search" value={query} onChange={(event) => { setSelected(false); setQuery(event.target.value); }} />
      </label>
      <p className="admin-form-hint">{ADMIN_COPY.locationSelectHint}</p>
      {loading ? <p role="status">{ADMIN_COPY.locationSearchLoading}</p> : null}
      <InlineAlert>{error}</InlineAlert>
      {query.trim() && !selected && suggestions.length ? (
        <ul className="admin-location-results">
          {suggestions.map((place, index) => (
            <li key={`${place.detail}-${index}`}>
              <button type="button" onClick={() => {
                onSelect(place);
                setSelected(true);
                setQuery(place.detail || place.label || '');
                setSuggestions([]);
              }}>
                <strong>{place.label}</strong><span>{place.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FormFields({ resource, values, onChange, errors = {}, editing }) {
  const fields = ADMIN_FORM_FIELDS[resource] || [];
  return (
    <div className="admin-form-grid">
      {resource === 'restaurants' || resource === 'service-areas' ? (
        <div className="admin-form-field admin-form-field--wide">
          <LocationSearchField onSelect={(place) => {
            if (resource === 'restaurants') {
              const streetLine = [place.house_no, place.street, place.barangay].filter(Boolean).join(', ') || place.detail;
              onChange('address.street_line', streetLine);
              onChange('address.city_name', place.city_municipality || '');
              onChange('address.latitude', place.latitude);
              onChange('address.longitude', place.longitude);
            } else {
              onChange('latitude', place.latitude);
              onChange('longitude', place.longitude);
            }
          }} />
        </div>
      ) : null}
      {fields.map((field) => {
        const value = readPath(values, field.key) ?? '';
        const fieldError = errors[field.key]?.[0] || errors[field.key];
        const required = field.required || (!editing && field.requiredOnCreate);
        const controlId = `admin-field-${field.key.replaceAll('.', '-')}`;
        return (
          <label className="admin-form-field" key={field.key} htmlFor={controlId}>
            <span>{field.label}{required ? <em aria-hidden="true"> *</em> : null}</span>
            {field.type === 'textarea' ? (
              <textarea id={controlId} value={value} onChange={(event) => onChange(field.key, event.target.value)} aria-invalid={Boolean(fieldError)} required={required} />
            ) : (
              <input
                id={controlId}
                type={field.type || 'text'}
                value={value}
                onChange={(event) => onChange(field.key, field.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)}
                aria-invalid={Boolean(fieldError)}
                required={required}
                autoComplete={field.key === 'email' ? 'email' : undefined}
              />
            )}
            {fieldError ? <small className="admin-field-error">{Array.isArray(fieldError) ? fieldError[0] : fieldError}</small> : null}
          </label>
        );
      })}
      {resource === 'users' ? (
        <fieldset className="admin-form-field admin-form-field--wide">
          <legend>{ADMIN_COPY.userFields.capabilities}</legend>
          <div className="admin-checkbox-row">
            {Object.entries(ADMIN_COPY.capabilityOptions).map(([key, label]) => (
              <label key={key}>
                <input type="checkbox" checked={(values.capabilities || []).includes(key)} onChange={(event) => {
                  const current = values.capabilities || [];
                  onChange('capabilities', event.target.checked ? [...current, key] : current.filter((value) => value !== key));
                }} />
                {label}
              </label>
            ))}
          </div>
          {errors.capabilities ? <small className="admin-field-error">{errors.capabilities[0]}</small> : null}
        </fieldset>
      ) : null}
    </div>
  );
}

function RecordDetails({ record, resource, onPhoto }) {
  const photoReferences = [];
  const entries = [];
  const visit = (value, prefix = '') => {
    if (value === null || value === undefined || typeof value !== 'object') {
      if (prefix && !prefix.toLowerCase().includes('password')) entries.push([prefix.replaceAll('.', ' / '), value]);
      return;
    }
    if (Array.isArray(value)) {
      if (value.every((item) => typeof item !== 'object' || item === null)) {
        entries.push([prefix.replaceAll('.', ' / '), value.join(', ')]);
      } else {
        value.forEach((item, index) => visit(item, `${prefix} ${index + 1}`.trim()));
      }
      return;
    }
    Object.entries(value).forEach(([key, child]) => {
      if (['photo_ref', 'logo_ref', 'cover_ref'].includes(key) && typeof child === 'string') {
        photoReferences.push(child);
      } else {
        visit(child, prefix ? `${prefix}.${key}` : key);
      }
    });
  };
  visit(record);

  return (
    <div className="admin-record-details">
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}><dt>{humanize(key)}</dt><dd>{typeof value === 'boolean' ? (value ? ADMIN_COPY.yes : ADMIN_COPY.no) : String(value ?? '—')}</dd></div>
        ))}
      </dl>
      {record.documents?.length ? (
        <section className="admin-detail-section">
          <h3>{ADMIN_COPY.documents}</h3>
          <div className="admin-photo-list">
            {record.documents.map((document) => (
              <button type="button" className="btn btn--secondary btn--sm" key={document.id} onClick={() => onPhoto(document.photo_ref)}>
                <Eye aria-hidden="true" size={16} />{humanize(document.doc_type)}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {record.proofs?.length ? (
        <section className="admin-detail-section">
          <h3>{ADMIN_COPY.deliveryProofs}</h3>
          <div className="admin-photo-list">
            {record.proofs.map((proof) => (
              <button type="button" className="btn btn--secondary btn--sm" key={proof.id} onClick={() => onPhoto(proof.photo_ref)}>
                <Eye aria-hidden="true" size={16} />{`${proof.order_number} · ${humanize(proof.stage)}`}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {photoReferences.length ? (
        <section className="admin-detail-section">
          <h3>{ADMIN_COPY.photos}</h3>
          <div className="admin-photo-list">
            {photoReferences.map((photoRef) => (
              <button type="button" className="btn btn--secondary btn--sm" key={photoRef} onClick={() => onPhoto(photoRef)}>
                <Eye aria-hidden="true" size={16} />{ADMIN_COPY.openPhoto}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {resource === 'applications' && record.status === 'pending' ? <p className="admin-detail-hint">{ADMIN_COPY.applicationReviewHint}</p> : null}
    </div>
  );
}

function AdminPage() {
  const location = useLocation();
  const pageKey = location.pathname === '/admin' ? 'dashboard' : location.pathname.split('/')[2] || 'dashboard';
  return <AdminWorkspace key={pageKey} pageKey={pageKey} />;
}

function AdminWorkspace({ pageKey }) {
  const resource = resourceForPage[pageKey];
  const [data, setData] = useState([]);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [reportKey, setReportKey] = useState('sales');
  const [reportDates, setReportDates] = useState({ from: '', to: '' });
  const [detail, setDetail] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [dialogValues, setDialogValues] = useState({});
  const [dialogError, setDialogError] = useState('');
  const [dialogBusy, setDialogBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [photoRef, setPhotoRef] = useState('');
  const [scheduleResult, setScheduleResult] = useState(null);
  const [flash, setFlash] = useState('');
  const [scheduleDate, setScheduleDate] = useState(todayInManila);
  const detailDialogRef = useRef(null);
  const loadRequestSequence = useRef(0);

  const requestParams = useMemo(() => ({
    page,
    per_page: 15,
    ...(search ? { search } : {}),
    ...(sorting[0] ? { sort: sorting[0].id, direction: sorting[0].desc ? 'desc' : 'asc' } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(pageKey === 'applications' && typeFilter ? { type: typeFilter } : {}),
  }), [page, search, sorting, statusFilter, typeFilter, pageKey]);

  const loadPage = useCallback(async () => {
    const requestId = ++loadRequestSequence.current;
    setLoading(true);
    setError('');
    try {
      if (pageKey === 'dashboard') {
        const dashboard = await adminService.getDashboard();
        if (requestId !== loadRequestSequence.current) return;
        setResult(dashboard);
      } else if (pageKey === 'reports') {
        const report = await adminService.getReport(reportKey, reportDates);
        if (requestId !== loadRequestSequence.current) return;
        setResult(report);
      } else if (pageKey === 'settings') {
        const settings = await adminService.getSettings();
        if (requestId !== loadRequestSequence.current) return;
        setResult(settings);
      } else if (pageKey === 'schedule') {
        const [events, areas, scheduleList] = await Promise.all([
          adminService.getCalendar(),
          adminService.listServiceAreas({ page: 1, per_page: 100 }),
          adminService.listSchedules({ page: 1, per_page: 100 }),
        ]);
        if (requestId !== loadRequestSequence.current) return;
        setResult({ events, areas: areas.data || [], scheduleList: scheduleList.data || [] });
      } else if (resource) {
        const method = adminService[listMethodForResource[resource]];
        const response = await method(requestParams);
        if (requestId !== loadRequestSequence.current) return;
        setData(response?.data || []);
        setMeta(response?.meta || { current_page: 1, last_page: 1, total: response?.data?.length || 0 });
        setResult(response);
        if (requestParams.page > (response?.meta?.last_page || 1)) setPage(response.meta.last_page || 1);
      } else {
        setResult(null);
      }
    } catch (requestError) {
      if (requestId !== loadRequestSequence.current) return;
      console.error(`Unable to load admin ${pageKey}.`, requestError);
      setError(getErrorMessage(requestError));
    } finally {
      if (requestId === loadRequestSequence.current) setLoading(false);
    }
  }, [pageKey, reportKey, reportDates, resource, requestParams]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) return loadPage(); });
    return () => { active = false; };
  }, [loadPage, retry]);
  useEffect(() => () => { loadRequestSequence.current += 1; }, []);
  useEffect(() => {
    if (!detail || dialog || photoRef) return undefined;
    const previousFocus = document.activeElement;
    const dialogElement = detailDialogRef.current;
    dialogElement?.querySelector('button')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setDetail(null);
      if (event.key !== 'Tab' || !dialogElement) return;
      const focusable = [...dialogElement.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex="0"]')];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [detail, dialog, photoRef]);

  const reload = () => setRetry((value) => value + 1);
  const closePhoto = useCallback(() => setPhotoRef(''), []);
  const cancelConfirmation = useCallback(() => setDialog(null), []);
  const showFlash = (message) => {
    setFlash(message);
    window.setTimeout(() => setFlash(''), 4000);
  };
  const updateFormField = (key, value) => {
    setFormValues((current) => {
      const next = structuredClone(current);
      setPath(next, key, value);
      return next;
    });
    setFormErrors((current) => ({ ...current, [key]: undefined }));
  };

  const openForm = (formResource, record = null) => {
    const values = record ? structuredClone(record) : {};
    if (formResource === 'users') values.capabilities = record?.capabilities || ['customer'];
    setForm({ resource: formResource, record });
    setFormValues(values);
    setFormErrors({});
    setFormError('');
  };

  const saveForm = async () => {
    setFormBusy(true);
    setFormErrors({});
    setFormError('');
    try {
      const formResource = form.resource;
      const editing = Boolean(form.record);
      const requiredErrors = {};
      (ADMIN_FORM_FIELDS[formResource] || []).forEach((field) => {
        if ((field.required || (!editing && field.requiredOnCreate)) && !String(readPath(formValues, field.key) ?? '').trim()) {
          requiredErrors[field.key] = [ADMIN_COPY.inputRequired];
        }
      });
      if (Object.keys(requiredErrors).length) {
        setFormErrors(requiredErrors);
        setFormError(ADMIN_COPY.formError);
        return;
      }
      const body = {};
      (ADMIN_FORM_FIELDS[formResource] || []).forEach((field) => {
        const value = readPath(formValues, field.key);
        if (value !== undefined && !(field.key === 'password' && editing && value === '')) setPath(body, field.key, value);
      });
      if (formResource === 'users') body.capabilities = formValues.capabilities || ['customer'];
      if (formResource === 'users') {
        if (editing) await adminService.updateUser(form.record.id, body);
        else await adminService.createUser(body);
      } else if (formResource === 'restaurants') {
        if (editing) await adminService.updateRestaurant(form.record.id, body);
        else await adminService.createRestaurant(body);
      } else if (formResource === 'service-areas') {
        if (editing) await adminService.updateServiceArea(form.record.id, body);
        else await adminService.createServiceArea(body);
      } else if (formResource === 'settings') {
        await adminService.updateSettings(body);
      }
      setForm(null);
      showFlash(ADMIN_COPY.saved);
      reload();
    } catch (saveError) {
      console.error('Unable to save admin form.', saveError);
      setFormErrors(saveError.fields || {});
      setFormError(getErrorMessage(saveError));
    } finally {
      setFormBusy(false);
    }
  };

  const openConfirmation = (options) => {
    setDialog(options);
    setDialogValues(options.initialValues || {});
    setDialogError('');
  };

  const confirmDialog = async () => {
    if (!dialog?.onConfirm) return;
    const missingRequired = dialog.fields?.some((field) => field.required && !String(dialogValues[field.key] || '').trim());
    if (missingRequired) {
      setDialogError(ADMIN_COPY.requiredInputs);
      return;
    }
    setDialogBusy(true);
    setDialogError('');
    try {
      await dialog.onConfirm(dialogValues);
      setDialog(null);
      setDetail(null);
      showFlash(dialog.success || ADMIN_COPY.statusChanged);
      reload();
    } catch (actionError) {
      console.error('Unable to complete admin action.', actionError);
      setDialogError(getErrorMessage(actionError));
    } finally {
      setDialogBusy(false);
    }
  };

  const loadDetail = async (targetResource, record) => {
    try {
      const method = adminService[detailMethodForResource[targetResource]];
      const fullRecord = targetResource === 'applications'
        ? await method(record.type, record.id)
        : await method(record.id);
      const enriched = { ...fullRecord };
      if (targetResource === 'riders') {
        const proofResult = await adminService.listRiderProofs(record.id, { page: 1, per_page: 100 });
        enriched.proofs = proofResult.data || [];
      }
      setDetail({ resource: targetResource, record: enriched });
    } catch (detailError) {
      console.error(`Unable to load ${targetResource} details.`, detailError);
      setError(getErrorMessage(detailError));
    }
  };

  const actionColumn = {
    id: 'actions',
    header: ADMIN_COPY.actions,
    enableSorting: false,
    cell: ({ row }) => {
      const record = row.original;
      const target = resource;
      return (
        <div className="admin-row-actions">
          {detailMethodForResource[target] ? (
            <button type="button" className="admin-icon-button" onClick={() => loadDetail(target, record)} aria-label={`${ADMIN_COPY.view}: ${record.name || record.code || record.order_number || record.id}`} title={ADMIN_COPY.view}>
              <Eye aria-hidden="true" size={17} />
            </button>
          ) : null}
          {target === 'users' || target === 'restaurants' ? (
            <button type="button" className="admin-icon-button" onClick={() => openForm(target, record)} aria-label={`${ADMIN_COPY.edit}: ${record.name}`} title={ADMIN_COPY.edit}><Pencil aria-hidden="true" size={16} /></button>
          ) : null}
          {target === 'users' && record.status !== 'suspended' ? (
            <button type="button" className="admin-icon-button admin-icon-button--danger" onClick={() => openConfirmation({
              title: ADMIN_COPY.suspendUserTitle,
              message: ADMIN_COPY.confirmMessage,
              confirmLabel: ADMIN_COPY.suspend,
              fields: [{ key: 'reason', label: ADMIN_COPY.reason, type: 'text', required: true }],
              onConfirm: (values) => adminService.suspendUser(record.id, { reason: values.reason }),
            })} aria-label={`${ADMIN_COPY.suspend}: ${record.name}`} title={ADMIN_COPY.suspend}><RefreshCw aria-hidden="true" size={16} /></button>
          ) : null}
          {target === 'users' && record.status === 'suspended' ? (
            <button type="button" className="admin-icon-button" onClick={() => openConfirmation({
              title: ADMIN_COPY.reactivateUserTitle,
              message: ADMIN_COPY.confirmMessage,
              confirmLabel: ADMIN_COPY.reactivate,
              onConfirm: () => adminService.reactivateUser(record.id),
            })} aria-label={`${ADMIN_COPY.reactivate}: ${record.name}`} title={ADMIN_COPY.reactivate}><RefreshCw aria-hidden="true" size={16} /></button>
          ) : null}
          {target === 'users' ? (
            <button type="button" className="admin-icon-button admin-icon-button--danger" onClick={() => openConfirmation({
              title: ADMIN_COPY.deleteTitle.replace('{resource}', ADMIN_COPY.pageLabels.users),
              message: ADMIN_COPY.confirmMessage,
              confirmLabel: ADMIN_COPY.delete,
              onConfirm: () => adminService.deleteUser(record.id),
              success: ADMIN_COPY.deleted,
            })} aria-label={`${ADMIN_COPY.delete}: ${record.name}`} title={ADMIN_COPY.delete}><Trash2 aria-hidden="true" size={16} /></button>
          ) : null}
          {target === 'restaurants' ? (
            <button type="button" className="admin-icon-button admin-icon-button--danger" onClick={() => openConfirmation({
              title: ADMIN_COPY.deleteTitle.replace('{resource}', ADMIN_COPY.pageLabels.restaurants),
              message: ADMIN_COPY.confirmMessage,
              confirmLabel: ADMIN_COPY.delete,
              onConfirm: () => adminService.deleteRestaurant(record.id),
              success: ADMIN_COPY.deleted,
            })} aria-label={`${ADMIN_COPY.delete}: ${record.name}`} title={ADMIN_COPY.delete}><Trash2 aria-hidden="true" size={16} /></button>
          ) : null}
          {target === 'applications' && record.status === 'pending' ? (
            <>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => openConfirmation({
                title: ADMIN_COPY.reviewTitle,
                message: ADMIN_COPY.approveApplicationMessage,
                confirmLabel: ADMIN_COPY.approve,
                fields: [{ key: 'note', label: ADMIN_COPY.applicationNote, type: 'textarea' }],
                onConfirm: (values) => adminService.approveApplication(record.type, record.id, { note: values.note || '' }),
              })}>{ADMIN_COPY.approve}</button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => openConfirmation({
                title: ADMIN_COPY.reviewTitle,
                message: ADMIN_COPY.rejectApplicationMessage,
                confirmLabel: ADMIN_COPY.reject,
                fields: [{ key: 'note', label: ADMIN_COPY.applicationNote, type: 'textarea', required: true }],
                onConfirm: (values) => adminService.rejectApplication(record.type, record.id, { note: values.note }),
              })}>{ADMIN_COPY.reject}</button>
            </>
          ) : null}
          {target === 'riders' ? (
            <button type="button" className="admin-icon-button" onClick={() => openConfirmation({
              title: ADMIN_COPY.changeRiderStatusTitle,
              message: ADMIN_COPY.confirmMessage,
              confirmLabel: ADMIN_COPY.save,
              initialValues: { status: record.status },
              fields: [{ key: 'status', label: ADMIN_COPY.status, type: 'select', options: ADMIN_COPY.riderStatusOptions }],
              onConfirm: (values) => adminService.setRiderStatus(record.id, { status: values.status }),
            })} aria-label={ADMIN_COPY.chooseStatus} title={ADMIN_COPY.chooseStatus}><RefreshCw aria-hidden="true" size={16} /></button>
          ) : null}
        </div>
      );
    },
  };

  const columns = [
    ...(ADMIN_RESOURCE_FIELDS[resource] || []).map((field) => ({
      id: field.key,
      accessorFn: (record) => columnValue(record, field.key),
      header: field.label,
      cell: ({ getValue }) => {
        const value = getValue();
        if (field.format === 'money') return formatMoney(value);
        if (field.format === 'date') return formatDate(value);
        if (field.format === 'list') return Array.isArray(value) ? value.map(humanize).join(', ') : '—';
        if (field.key === 'status') return <StatusBadge value={value} />;
        if (field.key === 'is_active') return value ? ADMIN_COPY.yes : ADMIN_COPY.no;
        return value === null || value === undefined || value === '' ? '—' : String(value);
      },
    })),
    actionColumn,
  ];

  const listControls = (statusOptions = ADMIN_COPY.statusFilterOptions) => (
    <div className="admin-list-filters">
      {pageKey === 'applications' ? (
        <div className="admin-filter-tabs" role="group" aria-label={ADMIN_COPY.applicationStatusFilter}>
          <button type="button" className={statusFilter ? '' : 'is-active'} aria-pressed={!statusFilter} onClick={() => { setStatusFilter(''); setPage(1); }}>{ADMIN_COPY.allStatuses}</button>
          {(ADMIN_COPY.applicationStatusOptions || []).map((status) => (
            <button type="button" key={status} className={statusFilter === status ? 'is-active' : ''} aria-pressed={statusFilter === status} onClick={() => { setStatusFilter(status); setPage(1); }}>
              {ADMIN_COPY.statusOptions[status] || humanize(status)}
            </button>
          ))}
        </div>
      ) : statusOptions?.length ? (
        <label className="admin-select-control">
          <span>{ADMIN_COPY.filterStatus}</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
            <option value="">{ADMIN_COPY.allStatuses}</option>
            {statusOptions.map((status) => <option value={status} key={status}>{ADMIN_COPY.statusOptions[status] || humanize(status)}</option>)}
          </select>
        </label>
      ) : null}
      {pageKey === 'applications' ? (
        <label className="admin-select-control">
          <span>{ADMIN_COPY.filterType}</span>
          <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
            <option value="">{ADMIN_COPY.allTypes}</option>
            <option value="partner">{ADMIN_COPY.partnerApplication}</option>
            <option value="rider">{ADMIN_COPY.riderApplication}</option>
          </select>
        </label>
      ) : null}
      {pageKey === 'users' || pageKey === 'restaurants' ? (
        <button type="button" className="btn btn--primary" onClick={() => openForm(resource)}>
          <Plus aria-hidden="true" size={18} />{pageKey === 'users' ? ADMIN_COPY.addUser : ADMIN_COPY.addRestaurant}
        </button>
      ) : null}
    </div>
  );

  const openScheduleGeneration = () => openConfirmation({
    title: ADMIN_COPY.generateSchedule,
    message: ADMIN_COPY.scheduleGenerationPrompt,
    confirmLabel: ADMIN_COPY.generateSchedule,
    initialValues: { date: scheduleDate },
    fields: [{ key: 'date', label: ADMIN_COPY.calendarDate, type: 'date', required: true }],
    onConfirm: async (values) => {
      const response = await adminService.generateSchedule({ date: values.date });
      setScheduleDate(values.date);
      setScheduleResult({ ...response, date: values.date });
    },
    success: ADMIN_COPY.scheduleSuccess,
  });

  const reportRows = result?.rows || [];
  const reportColumns = result?.columns || [];
  const reportTableColumns = reportColumns.map((column) => ({
    id: column.key,
    accessorFn: (record) => record[column.key],
    header: column.label,
    cell: ({ getValue }) => column.type === 'money'
      ? formatMoney(getValue())
      : column.type === 'date' ? formatDate(getValue()) : String(getValue() ?? '—'),
  }));
  const handleReportExport = () => {
    if (!reportRows.length || !reportColumns.length) return;
    const csvRows = [reportColumns.map((column) => column.label), ...reportRows.map((row) => reportColumns.map((column) => row[column.key] ?? ''))];
    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${reportKey}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const dataForDetail = detail?.record;
  const changeDetailStatus = (options) => openConfirmation({
    title: options.title,
    message: ADMIN_COPY.confirmMessage,
    confirmLabel: options.confirmLabel || ADMIN_COPY.save,
    initialValues: options.initialValues,
    fields: options.fields,
    onConfirm: options.onConfirm,
  });

  return (
    <AdminShell>
      <InlineAlert>{flash}</InlineAlert>
      {error ? (
        <div className="admin-error-state">
          <EmptyState title={ADMIN_COPY.errorTitle} message={error} action={<button type="button" className="btn btn--secondary" onClick={reload}>{ADMIN_COPY.retry}</button>} />
        </div>
      ) : loading ? (
        <div className="admin-loading-grid" role="status" aria-label={ADMIN_COPY.loading}>
          <span /><span /><span /><span /><span /><span />
        </div>
      ) : pageKey === 'dashboard' ? (
        <Dashboard result={result} />
      ) : pageKey === 'reports' ? (
        <section className="admin-screen-stack">
          <div className="admin-report-toolbar">
            <label className="admin-select-control">
              <span>{ADMIN_COPY.reportName}</span>
              <select value={reportKey} onChange={(event) => setReportKey(event.target.value)}>
                {Object.entries(ADMIN_COPY.reportOptions).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label className="admin-select-control"><span>{ADMIN_COPY.reportFrom}</span><input type="date" value={reportDates.from} onChange={(event) => setReportDates((value) => ({ ...value, from: event.target.value }))} /></label>
            <label className="admin-select-control"><span>{ADMIN_COPY.reportTo}</span><input type="date" value={reportDates.to} onChange={(event) => setReportDates((value) => ({ ...value, to: event.target.value }))} /></label>
            <button type="button" className="btn btn--primary" onClick={handleReportExport} disabled={!reportRows.length}><ClipboardList aria-hidden="true" size={17} />{ADMIN_COPY.exportCsv}</button>
          </div>
          <div className="admin-report-summary">
            <h2>{result?.title}</h2>
            {result?.totals ? <p>{Object.entries(result.totals).map(([key, value]) => `${humanize(key)}: ${key.includes('revenue') ? formatMoney(value) : value}`).join(' · ')}</p> : null}
          </div>
          {reportRows.length ? (
            <AdminDataTable data={reportRows} columns={reportTableColumns} page={1} lastPage={1} caption={result?.title || ADMIN_COPY.dataTable} />
          ) : <EmptyState title={ADMIN_COPY.emptyTitle} message={ADMIN_COPY.noReportRows} />}
        </section>
      ) : pageKey === 'settings' ? (
        <section className="admin-form-card">
          <div className="admin-card-heading"><div><h2>{ADMIN_COPY.pageLabels.settings}</h2><p>{ADMIN_COPY.settingsDescription}</p></div></div>
          <FormFields resource="settings" values={form?.resource === 'settings' ? formValues : result || {}} onChange={updateFormField} errors={formErrors} editing />
          {formError ? <InlineAlert>{formError}</InlineAlert> : null}
          <div className="admin-form-actions"><button type="button" className="btn btn--primary" onClick={() => { setForm({ resource: 'settings' }); setFormValues(result || {}); setFormError(''); setFormErrors({}); }}><Pencil aria-hidden="true" size={16} />{ADMIN_COPY.editSettings}</button></div>
        </section>
      ) : pageKey === 'schedule' ? (
        <section className="admin-screen-stack">
          <div className="admin-schedule-toolbar">
            <label className="admin-select-control"><span>{ADMIN_COPY.calendarDate}</span><input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} /></label>
            <button type="button" className="btn btn--primary" onClick={openScheduleGeneration}><CalendarDays aria-hidden="true" size={17} />{ADMIN_COPY.generateSchedule}</button>
            <button type="button" className="btn btn--secondary" onClick={() => openForm('service-areas')}><Plus aria-hidden="true" size={17} />{ADMIN_COPY.addServiceArea}</button>
          </div>
          <section className="admin-calendar-card" aria-label={ADMIN_COPY.calendar}>
            <Suspense fallback={<div className="admin-calendar-loading" role="status">{ADMIN_COPY.loading}</div>}>
              <AdminScheduleCalendar events={result?.events || []} />
            </Suspense>
          </section>
          <div className="admin-schedule-grid">
            <section className="admin-calendar-card">
              <div className="admin-card-heading"><div><h2>{ADMIN_COPY.serviceAreas}</h2><p>{ADMIN_COPY.serviceAreaDescription}</p></div></div>
              <AdminDataTable
                data={result?.areas || []}
                columns={serviceAreaColumns((record) => openForm('service-areas', record), (record) => openConfirmation({
                  title: ADMIN_COPY.deleteTitle.replace('{resource}', ADMIN_COPY.serviceAreas),
                  message: ADMIN_COPY.confirmMessage,
                  confirmLabel: ADMIN_COPY.delete,
                  onConfirm: () => adminService.deleteServiceArea(record.id),
                  success: ADMIN_COPY.deleted,
                }))}
                search=""
                page={1}
                lastPage={1}
                caption={ADMIN_COPY.serviceAreas}
              />
            </section>
            <section className="admin-calendar-card">
              <div className="admin-card-heading"><div><h2>{ADMIN_COPY.scheduleList}</h2><p>{ADMIN_COPY.scheduleListDescription}</p></div></div>
              <AdminDataTable data={result?.scheduleList || []} columns={ADMIN_RESOURCE_FIELDS.schedules.map((field) => ({
                id: field.key, accessorFn: (record) => columnValue(record, field.key), header: field.label,
                cell: ({ getValue }) => field.format === 'date' ? formatDate(getValue()) : String(getValue() ?? '—'),
              }))} caption={ADMIN_COPY.scheduleList} />
            </section>
          </div>
          {scheduleResult ? (
            <section className="admin-schedule-result" aria-live="polite">
              <h2>{ADMIN_COPY.scheduleResultTitle}</h2>
              <p>{ADMIN_COPY.scheduleGeneratedOn.replace('{date}', formatDate(scheduleResult.date))}</p>
              <p>{ADMIN_COPY.assignedSummary.replace('{assigned}', scheduleResult.assigned?.length || 0).replace('{unassigned}', scheduleResult.unassigned?.length || 0)}</p>
              {scheduleResult.unassigned?.length ? <ul>{scheduleResult.unassigned.map((rider) => <li key={rider.id}>{rider.name}</li>)}</ul> : null}
            </section>
          ) : null}
        </section>
      ) : resource ? (
        <section className="admin-screen-stack">
          {listControls(ADMIN_COPY.statusOptionsForResource?.[resource] || [])}
          <AdminDataTable
            data={data}
            columns={columns}
            search={search}
            onSearch={(value) => { setSearch(value); setPage(1); }}
            page={meta.current_page || page}
            lastPage={meta.last_page || 1}
            onPageChange={setPage}
            sorting={sorting}
            onSortingChange={(updater) => { setSorting(updater); setPage(1); }}
            caption={ADMIN_COPY.tableCaption.replace('{resource}', ADMIN_COPY.pageLabels[pageKey] || ADMIN_COPY.dataTable)}
          />
        </section>
      ) : (
        <EmptyState title={ADMIN_COPY.notFound} message={ADMIN_COPY.emptyMessage} />
      )}

      {form ? (
        <ConfirmDialog
          open
          title={form.record ? ADMIN_COPY.updateTitle : form.resource === 'settings' ? ADMIN_COPY.pageLabels.settings : ADMIN_COPY.createTitle}
          message={null}
          confirmLabel={formBusy ? ADMIN_COPY.loading : ADMIN_COPY.save}
          cancelLabel={ADMIN_COPY.cancel}
          onCancel={() => { if (!formBusy) setForm(null); }}
          onConfirm={saveForm}
          busy={formBusy}
        >
          <FormFields resource={form.resource} values={formValues} onChange={updateFormField} errors={formErrors} editing={Boolean(form.record)} />
          <InlineAlert>{formError}</InlineAlert>
        </ConfirmDialog>
      ) : null}

      {dataForDetail ? (
        <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
          <section ref={detailDialogRef} className="admin-dialog admin-dialog--wide" role="dialog" aria-modal="true" aria-labelledby="admin-detail-title">
            <div className="admin-dialog__heading">
              <div><h2 id="admin-detail-title">{ADMIN_COPY.detailsTitle}</h2><p>{ADMIN_COPY.resourceLabels[detail.resource]}</p></div>
              <button type="button" className="admin-icon-button" aria-label={ADMIN_COPY.close} onClick={() => setDetail(null)}><X aria-hidden="true" size={18} /></button>
            </div>
            <RecordDetails record={dataForDetail} resource={detail.resource} onPhoto={setPhotoRef} />
            {detail.resource === 'restaurants' ? (
              <div className="admin-detail-action-row">
                <button type="button" className="btn btn--secondary" onClick={() => changeDetailStatus({
                  title: ADMIN_COPY.changeRestaurantStatusTitle,
                  confirmLabel: ADMIN_COPY.save,
                  initialValues: { status: dataForDetail.status, note: '' },
                  fields: [
                    { key: 'status', label: ADMIN_COPY.status, type: 'select', options: ADMIN_COPY.restaurantStatusOptions },
                    { key: 'note', label: ADMIN_COPY.statusNote, type: 'text' },
                  ],
                  onConfirm: (values) => adminService.setRestaurantStatus(dataForDetail.id, values),
                })}>{ADMIN_COPY.chooseStatus}</button>
              </div>
            ) : null}
            {detail.resource === 'applications' && dataForDetail.status === 'pending' ? (
              <div className="admin-detail-action-row">
                <button type="button" className="btn btn--secondary" onClick={() => openConfirmation({
                  title: ADMIN_COPY.reviewTitle,
                  message: ADMIN_COPY.approveApplicationMessage,
                  confirmLabel: ADMIN_COPY.approve,
                  fields: [{ key: 'note', label: ADMIN_COPY.applicationNote, type: 'textarea' }],
                  onConfirm: (values) => adminService.approveApplication(dataForDetail.type, dataForDetail.id, { note: values.note || '' }),
                })}>{ADMIN_COPY.approve}</button>
                <button type="button" className="btn btn--secondary" onClick={() => openConfirmation({
                  title: ADMIN_COPY.reviewTitle,
                  message: ADMIN_COPY.rejectApplicationMessage,
                  confirmLabel: ADMIN_COPY.reject,
                  fields: [{ key: 'note', label: ADMIN_COPY.applicationNote, type: 'textarea', required: true }],
                  onConfirm: (values) => adminService.rejectApplication(dataForDetail.type, dataForDetail.id, { note: values.note }),
                })}>{ADMIN_COPY.reject}</button>
              </div>
            ) : null}
            <div className="admin-dialog__actions"><button type="button" className="btn btn--secondary" onClick={() => setDetail(null)}>{ADMIN_COPY.close}</button></div>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        onCancel={cancelConfirmation}
        onConfirm={confirmDialog}
        busy={dialogBusy}
      >
        {dialog?.fields?.length ? (
          <div className="admin-dialog-fields">
            {dialog.fields.map((field) => (
              <label className="admin-form-field" key={field.key}>
                <span>{field.label}{field.required ? <em aria-hidden="true"> *</em> : null}</span>
                {field.type === 'select' ? (
                  <select value={dialogValues[field.key] || ''} onChange={(event) => setDialogValues((values) => ({ ...values, [field.key]: event.target.value }))}>
                    {field.options.map((value) => <option key={value} value={value}>{ADMIN_COPY.statusOptions[value] || humanize(value)}</option>)}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea value={dialogValues[field.key] || ''} onChange={(event) => setDialogValues((values) => ({ ...values, [field.key]: event.target.value }))} required={field.required} />
                ) : (
                  <input type={field.type || 'text'} value={dialogValues[field.key] || ''} onChange={(event) => setDialogValues((values) => ({ ...values, [field.key]: event.target.value }))} required={field.required} />
                )}
              </label>
            ))}
          </div>
        ) : null}
        <InlineAlert>{dialogError}</InlineAlert>
      </ConfirmDialog>
      <PhotoViewer photoRef={photoRef} onClose={closePhoto} />
    </AdminShell>
  );
}

function Dashboard({ result }) {
  const totals = result?.totals || {};
  const orderData = (result?.orders_per_day || []).map((item) => ({
    label: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(`${item.date}T12:00:00+08:00`)),
    orders: item.orders,
    revenue: item.revenue,
  }));
  const statusData = (result?.orders_by_status || []).map((item) => ({ label: humanize(item.status), orders: item.count }));
  const restaurantData = (result?.top_restaurants || []).map((item) => ({ label: item.name, orders: item.orders }));
  const userData = (result?.new_users_per_week || []).map((item) => ({
    label: formatDate(item.week_start),
    users: item.count,
  }));

  return (
    <section className="admin-screen-stack">
      <div className="admin-stat-grid">
        <AdminStatCard label={ADMIN_COPY.totalUsers} value={totals.users ?? '—'} icon={Users} />
        <AdminStatCard label={ADMIN_COPY.totalRestaurants} value={totals.restaurants ?? '—'} icon={Store} />
        <AdminStatCard label={ADMIN_COPY.totalRiders} value={totals.riders ?? '—'} icon={Bike} />
        <AdminStatCard label={ADMIN_COPY.totalOrders} value={totals.orders ?? '—'} icon={ClipboardList} />
        <AdminStatCard label={ADMIN_COPY.totalRevenue} value={formatMoney(totals.revenue)} icon={CircleDollarSign} />
      </div>
      <div className="admin-chart-grid">
        <Suspense fallback={<div className="admin-chart-loading" role="status">{ADMIN_COPY.loading}</div>}>
          <AdminChartCard title={ADMIN_COPY.orderTrend} data={orderData} dataKey="orders" type="line" />
          <AdminChartCard title={ADMIN_COPY.chartStatus} data={statusData} dataKey="orders" />
          <AdminChartCard title={ADMIN_COPY.topRestaurants} data={restaurantData} dataKey="orders" />
          <AdminChartCard title={ADMIN_COPY.newUsers} data={userData} dataKey="users" type="line" />
        </Suspense>
      </div>
      <div className="admin-dashboard-note">
        <Activity aria-hidden="true" size={18} />
        <p>{ADMIN_COPY.dashboardFixtureNote}</p>
      </div>
    </section>
  );
}

function serviceAreaColumns(onEdit, onDelete) {
  return [
    { id: 'name', accessorKey: 'name', header: ADMIN_RESOURCE_FIELDS['service-areas'][0].label },
    { id: 'city_code', accessorKey: 'city_code', header: ADMIN_RESOURCE_FIELDS['service-areas'][1].label },
    { id: 'max_riders', accessorKey: 'max_riders', header: ADMIN_RESOURCE_FIELDS['service-areas'][2].label },
    { id: 'is_active', accessorKey: 'is_active', header: ADMIN_RESOURCE_FIELDS['service-areas'][3].label, cell: ({ getValue }) => getValue() ? ADMIN_COPY.yes : ADMIN_COPY.no },
    {
      id: 'actions',
      header: ADMIN_COPY.actions,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="admin-row-actions">
          <button type="button" className="admin-icon-button" onClick={() => onEdit(row.original)} aria-label={`${ADMIN_COPY.edit}: ${row.original.name}`} title={ADMIN_COPY.edit}><Pencil aria-hidden="true" size={16} /></button>
          <button type="button" className="admin-icon-button admin-icon-button--danger" onClick={() => onDelete(row.original)} aria-label={`${ADMIN_COPY.delete}: ${row.original.name}`} title={ADMIN_COPY.delete}><Trash2 aria-hidden="true" size={16} /></button>
        </div>
      ),
    },
  ];
}

export default AdminPage;
