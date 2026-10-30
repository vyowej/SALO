import { useCallback, useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { useCan } from '../../hooks/useCan';
import { businessService } from '../../services/businessService';
import './BusinessDiscountsPage.css';

const DISCOUNT_TYPES = [
  ['percentage', 'Percentage'],
  ['fixed', 'Fixed amount'],
  ['free_delivery', 'Free delivery'],
];

function manilaDateTime(value) {
  const date = value ? new Date(value) : new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function asManilaIso(value) {
  return new Date(`${value}:00+08:00`).toISOString();
}

function emptyDiscount() {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    code: '',
    name: '',
    description: '',
    type: 'percentage',
    first_order_only: false,
    value: '10',
    min_order_amount: '0',
    max_discount: '',
    starts_at: manilaDateTime(now),
    ends_at: manilaDateTime(end),
    usage_limit: '',
    per_customer_limit: '1',
    is_active: true,
  };
}

function dateLabel(value) {
  return new Date(value).toLocaleString([], {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function typeLabel(value) {
  return DISCOUNT_TYPES.find(([key]) => key === value)?.[1] || value;
}

function statusOf(discount) {
  const now = Date.now();
  if (!discount.is_active) return 'Inactive';
  if (new Date(discount.starts_at).getTime() > now) return 'Scheduled';
  if (new Date(discount.ends_at).getTime() < now) return 'Expired';
  if (discount.usage_limit !== null && Number(discount.usage_count) >= Number(discount.usage_limit)) return 'Fully claimed';
  return 'Active';
}

export default function BusinessDiscountsPage({ restaurantId, user, readOnly }) {
  const canAccessDiscounts = useCan('discounts.manage', restaurantId);
  const canManage = canAccessDiscounts && !readOnly;
  const [discounts, setDiscounts] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, per_page: 25, total: 0, last_page: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyDiscount);
  const [editing, setEditing] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await businessService.getBusinessDiscounts(restaurantId, {
        page,
        per_page: meta.per_page,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(activeFilter !== '' ? { is_active: activeFilter } : {}),
      }, user);
      setDiscounts(result.data || []);
      setMeta(result.meta || { current_page: 1, per_page: 25, total: 0, last_page: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Discounts could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, meta.per_page, page, restaurantId, search, user]);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  const beginCreate = () => {
    setEditing(null);
    setForm(emptyDiscount());
    setFormOpen(true);
    setError('');
  };

  const beginEdit = (discount) => {
    setEditing(discount);
    setForm({
      code: discount.code,
      name: discount.name,
      description: discount.description || '',
      type: discount.type,
      first_order_only: Boolean(discount.first_order_only),
      value: String(discount.value),
      min_order_amount: String(discount.min_order_amount),
      max_discount: discount.max_discount === null ? '' : String(discount.max_discount),
      starts_at: manilaDateTime(discount.starts_at),
      ends_at: manilaDateTime(discount.ends_at),
      usage_limit: discount.usage_limit === null ? '' : String(discount.usage_limit),
      per_customer_limit: String(discount.per_customer_limit || 1),
      is_active: Boolean(discount.is_active),
    });
    setFormOpen(true);
    setError('');
  };

  const persistDiscount = async (targetForm = form) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await businessService.saveBusinessDiscount(restaurantId, {
        ...targetForm,
        ...(editing ? { id: editing.id } : {}),
        code: targetForm.code.trim().toUpperCase(),
        value: Number(targetForm.value),
        min_order_amount: Number(targetForm.min_order_amount),
        max_discount: targetForm.max_discount === '' ? null : Number(targetForm.max_discount),
        starts_at: asManilaIso(targetForm.starts_at),
        ends_at: asManilaIso(targetForm.ends_at),
        usage_limit: targetForm.usage_limit === '' ? null : Number(targetForm.usage_limit),
        per_customer_limit: Number(targetForm.per_customer_limit),
      }, user);
      setFormOpen(false);
      setEditing(null);
      setNotice(editing ? 'Discount updated.' : 'Discount created.');
      await loadDiscounts();
    } catch (saveError) {
      setError(saveError.message || 'Discount could not be saved.');
    } finally {
      setSaving(false);
      setConfirmTarget(null);
    }
  };

  const save = (event) => {
    event.preventDefault();
    if (form.ends_at <= form.starts_at) {
      setError('The end date must be after the start date.');
      return;
    }
    if (editing && editing.is_active !== form.is_active) {
      setConfirmTarget({ kind: 'save' });
      return;
    }
    persistDiscount();
  };

  const deactivate = (discount) => setConfirmTarget({ kind: 'deactivate', discount });

  const performConfirmation = async () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === 'save') {
      await persistDiscount();
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await businessService.deactivateBusinessDiscount(restaurantId, confirmTarget.discount.id, user);
      setNotice(`${confirmTarget.discount.code} deactivated.`);
      await loadDiscounts();
    } catch (actionError) {
      setError(actionError.message || 'The discount could not be deactivated.');
    } finally {
      setSaving(false);
      setConfirmTarget(null);
    }
  };

  const columns = useMemo(() => [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Name' },
    {
      id: 'offer',
      header: 'Offer',
      cell: ({ row }) => `${typeLabel(row.original.type)}${row.original.type === 'percentage' ? ` · ${row.original.value}%` : row.original.type === 'fixed' ? ` · ₱${row.original.value}` : ''}${row.original.first_order_only ? ' · First order only' : ''}`,
    },
    {
      id: 'dates',
      header: 'Validity',
      cell: ({ row }) => `${dateLabel(row.original.starts_at)} – ${dateLabel(row.original.ends_at)}`,
    },
    {
      id: 'usage',
      header: 'Usage',
      cell: ({ row }) => `${row.original.usage_count}${row.original.usage_limit === null ? '' : ` / ${row.original.usage_limit}`}`,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => statusOf(row.original),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="business-discount-actions">
          <Button variant="secondary" size="sm" disabled={!canManage} onClick={() => beginEdit(row.original)}>Edit</Button>
          {row.original.is_active ? (
            <Button variant="danger" size="sm" disabled={!canManage} onClick={() => deactivate(row.original)}>Deactivate</Button>
          ) : null}
        </div>
      ),
    },
  ], [canManage]);

  // TanStack Table provides the server-paginated discount grid.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: discounts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: meta.last_page,
    state: { pagination: { pageIndex: page - 1, pageSize: meta.per_page } },
  });

  if (!canAccessDiscounts) {
    return <p className="business-error" role="alert">You do not have permission to manage discounts.</p>;
  }

  return (
    <div className="business-discounts">
      <header className="business-page-heading">
        <div>
          <p className="business-eyebrow">Restaurant offers</p>
          <h2>Discounts</h2>
          <p>Create restaurant-funded offers and track their applied redemptions.</p>
        </div>
        <Button onClick={beginCreate} disabled={!canManage}>Create discount</Button>
      </header>
      {readOnly ? <p className="business-readonly" role="status">This restaurant is suspended. Discount changes are disabled.</p> : null}
      {error ? <div className="business-error" role="alert"><p>{error}</p><Button variant="secondary" onClick={loadDiscounts} disabled={loading}>Try again</Button></div> : null}
      {notice ? <p className="business-success" role="status">{notice}</p> : null}
      <section className="business-discount-section">
        <div className="business-discount-filters">
          <label>Search discounts
            <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Code or name" />
          </label>
          <label>Status
            <select value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }}>
              <option value="">All discounts</option>
              <option value="true">Active flag on</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <span>{meta.total} discount(s)</span>
        </div>
        {loading ? <p className="business-loading" role="status">Loading discounts…</p> : null}
        {!loading && discounts.length ? (
          <div className="business-discount-table-wrap">
            <table className="business-discount-table">
              <thead>{table.getHeaderGroups().map((group) => (
                <tr key={group.id}>{group.headers.map((header) => (
                  <th key={header.id} scope="col">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>
                ))}</tr>
              ))}</thead>
              <tbody>{table.getRowModel().rows.map((row) => (
                <tr key={row.id}>{row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}</tr>
              ))}</tbody>
            </table>
            <div className="business-discount-pagination">
              <span>Page {page} of {meta.last_page}</span>
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= meta.last_page} onClick={() => setPage((current) => current + 1)}>Next</Button>
            </div>
          </div>
        ) : null}
        {!loading && !discounts.length ? (
          <div className="business-empty-state"><h3>No discounts yet</h3><p>Create a restaurant-funded code to offer customers a promotion.</p></div>
        ) : null}
      </section>

      <Modal open={formOpen} title={editing ? 'Edit discount' : 'Create discount'} onClose={() => { if (!saving) setFormOpen(false); }}>
        <form className="business-discount-form" onSubmit={save}>
          <label>Code
            <input value={form.code} maxLength="64" onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} required />
          </label>
          <label>Name
            <input value={form.name} maxLength="120" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label>Description (optional)
            <textarea rows="3" maxLength="2000" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="business-discount-form-grid">
            <label>Discount type
              <select value={form.type} onChange={(event) => setForm((current) => ({
                ...current,
                type: event.target.value,
                value: event.target.value === 'free_delivery' ? '0' : Number(current.value) > 0 ? current.value : '10',
                max_discount: event.target.value === 'percentage' ? current.max_discount : '',
              }))}>
                {DISCOUNT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Value {form.type === 'percentage' ? '(1–100%)' : form.type === 'fixed' ? '(₱)' : '(not used; enter 0)'}
              <input type="number" min={form.type === 'percentage' || form.type === 'fixed' ? '0.01' : '0'} max={form.type === 'percentage' ? '100' : undefined} step="0.01" value={form.value} disabled={form.type === 'free_delivery'} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} required />
            </label>
            <label>Minimum order (₱)
              <input type="number" min="0" step="0.01" value={form.min_order_amount} onChange={(event) => setForm((current) => ({ ...current, min_order_amount: event.target.value }))} required />
            </label>
            {form.type === 'percentage' ? <label>Maximum discount (₱, optional)
              <input type="number" min="0.01" step="0.01" value={form.max_discount} onChange={(event) => setForm((current) => ({ ...current, max_discount: event.target.value }))} />
            </label> : null}
            <label>Starts (Asia/Manila)
              <input type="datetime-local" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} required />
            </label>
            <label>Ends (Asia/Manila)
              <input type="datetime-local" value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} required />
            </label>
            <label>Total uses (optional)
              <input type="number" min="1" value={form.usage_limit} onChange={(event) => setForm((current) => ({ ...current, usage_limit: event.target.value }))} />
            </label>
            <label>Uses per customer
              <input type="number" min="1" value={form.per_customer_limit} onChange={(event) => setForm((current) => ({ ...current, per_customer_limit: event.target.value }))} required />
            </label>
          </div>
          <label className="business-discount-toggle">
            <input type="checkbox" checked={form.first_order_only} onChange={(event) => setForm((current) => ({ ...current, first_order_only: event.target.checked }))} />
            First order only (customer has no prior non-cancelled order at this restaurant)
          </label>
          <label className="business-discount-toggle">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
            Active
          </label>
          {error ? <p className="business-error" role="alert">{error}</p> : null}
          <div className="business-discount-form-actions">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !canManage}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create discount'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={confirmTarget?.kind === 'deactivate' ? 'Deactivate discount?' : 'Change discount status?'}
        message={confirmTarget?.kind === 'deactivate'
          ? `${confirmTarget.discount.code} will stop being available to customers. Redemption history will be kept.`
          : 'This discount’s active status will change.'}
        confirmLabel={confirmTarget?.kind === 'deactivate' ? 'Deactivate' : 'Save status'}
        onCancel={() => { if (!saving) setConfirmTarget(null); }}
        onConfirm={performConfirmation}
        busy={saving}
      />
    </div>
  );
}
