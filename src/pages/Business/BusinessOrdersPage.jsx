import { useCallback, useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { useCan } from '../../hooks/useCan';
import config from '../../config';
import { businessService } from '../../services/businessService';
import './BusinessOrdersPage.css';

const ORDER_STATUSES = [
  ['placed', 'Placed'],
  ['confirmed', 'Confirmed'],
  ['preparing', 'Preparing'],
  ['ready', 'Ready'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['completed', 'Completed'],
  ['rejected', 'Rejected'],
  ['cancelled', 'Cancelled'],
  ['delivery_failed', 'Delivery failed'],
];

function statusLabel(status) {
  return ORDER_STATUSES.find(([value]) => value === status)?.[1] || status.replaceAll('_', ' ');
}

function orderTypeLabel(type) {
  return type === 'pick_up' ? 'Pick-up' : 'Delivery';
}

function money(value) {
  return `₱${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function BusinessOrdersPage({ restaurantId, restaurantName = 'your restaurant', user, readOnly, onAccessDenied }) {
  const canView = useCan('orders.view', restaurantId);
  const canUpdate = useCan('orders.status.update', restaurantId) && !readOnly;
  const canCancel = useCan('orders.cancel', restaurantId) && !readOnly;
  const canViewActors = useCan('audit.view', restaurantId);
  const [orders, setOrders] = useState({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } });
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '', page: 1, per_page: 15 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reasonTarget, setReasonTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);

  const loadOrders = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      setOrders(await businessService.getBusinessOrders(restaurantId, nextFilters, user));
    } catch (loadError) {
      if (await onAccessDenied?.(loadError)) return;
      setError(loadError.message || 'Orders could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [filters, onAccessDenied, restaurantId, user]);

  useEffect(() => {
    if (canView) loadOrders();
  }, [canView, loadOrders]);

  useEffect(() => {
    const timer = window.setInterval(() => loadOrders(), 12_000);
    return () => window.clearInterval(timer);
  }, [loadOrders]);

  const updateFilter = (key, value) => {
    const nextFilters = { ...filters, [key]: value, page: 1 };
    setFilters(nextFilters);
  };

  const openOrder = useCallback(async (orderId) => {
    setError('');
    try {
      setSelectedOrder(await businessService.getBusinessOrder(restaurantId, orderId, user));
    } catch (loadError) {
      if (await onAccessDenied?.(loadError)) return;
      setError(loadError.message || 'Order details could not be loaded.');
    }
  }, [onAccessDenied, restaurantId, user]);

  const transitionOrder = async (order, status, statusReason = null) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await businessService.updateBusinessOrderStatus(restaurantId, order.id, status, statusReason, user);
      setNotice(`Order ${order.reference_code} updated to ${statusLabel(status)}.`);
      await loadOrders();
      if (selectedOrder?.id === order.id) await openOrder(order.id);
      return true;
    } catch (actionError) {
      if (await onAccessDenied?.(actionError)) return false;
      setError(actionError.message || 'Order status could not be updated.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitReason = async (event) => {
    event.preventDefault();
    if (!reasonTarget || !reason.trim()) return;
    const updated = await transitionOrder(reasonTarget.order, reasonTarget.status, reason);
    if (updated) {
      setReasonTarget(null);
      setReason('');
    }
  };

  const columns = useMemo(() => [
    { accessorKey: 'reference_code', header: 'Order' },
    { accessorKey: 'placed_at', header: 'Placed', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'order_type', header: 'Mode', cell: ({ getValue }) => orderTypeLabel(getValue()) },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <span className={`business-order-status business-order-status--${getValue()}`}>{statusLabel(getValue())}</span>,
    },
    {
      id: 'items',
      header: 'Items',
      cell: ({ row }) => row.original.items.map((item) => `${item.quantity} × ${item.name}`).join(', '),
    },
    { accessorFn: (row) => row.totals.total, id: 'total', header: 'Total', cell: ({ getValue }) => money(getValue()) },
    {
      id: 'details',
      header: '',
      cell: ({ row }) => <Button variant="secondary" size="sm" onClick={() => openOrder(row.original.id)}>View details</Button>,
    },
  ], [openOrder]);

  // TanStack Table is required for this data-heavy view and is intentionally not compiler-memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: orders.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const statusActions = (order) => {
    if (!canUpdate) return null;
    if (order.status === 'placed') {
      return (
        <>
          <Button disabled={saving} onClick={() => transitionOrder(order, 'confirmed')}>Accept order</Button>
          {canCancel ? <Button variant="secondary" disabled={saving} onClick={() => { setReasonTarget({ order, status: 'rejected' }); setReason(''); }}>Reject</Button> : null}
        </>
      );
    }
    if (order.status === 'confirmed') {
      return (
        <>
          <Button disabled={saving} onClick={() => transitionOrder(order, 'preparing')}>Start preparing</Button>
          {canCancel ? <Button variant="secondary" disabled={saving} onClick={() => { setReasonTarget({ order, status: 'cancelled' }); setReason(''); }}>Cancel order</Button> : null}
        </>
      );
    }
    if (order.status === 'preparing') {
      return (
        <>
          <Button disabled={saving} onClick={() => transitionOrder(order, 'ready')}>Mark ready</Button>
          {canCancel ? <Button variant="secondary" disabled={saving} onClick={() => { setReasonTarget({ order, status: 'cancelled' }); setReason(''); }}>Cancel order</Button> : null}
        </>
      );
    }
    if (order.status === 'ready' && order.order_type === 'pick_up') {
      return (
        <>
          <Button disabled={saving} onClick={() => setConfirmTarget(order)}>Mark collected</Button>
          {canCancel ? <Button variant="secondary" disabled={saving} onClick={() => { setReasonTarget({ order, status: 'cancelled' }); setReason(''); }}>Cancel order</Button> : null}
        </>
      );
    }
    if (order.status === 'ready' && order.order_type === 'delivery') {
      return <p className="business-order-waiting">Waiting for rider assignment</p>;
    }
    return null;
  };
  const selectedOrderActions = selectedOrder ? statusActions(selectedOrder) : null;

  if (!canView) return <p className="business-error" role="alert">You do not have permission to view orders.</p>;

  return (
    <div className="business-orders">
      <header className="business-orders__heading">
        <div>
          <p className="business-eyebrow">Restaurant operations</p>
          <h2>Customer orders</h2>
          <p>Orders customers placed at {restaurantName}.</p>
        </div>
        <span className="business-orders__live-label">Received by your restaurant</span>
      </header>
      {readOnly ? <p className="business-readonly" role="status">This restaurant is suspended. Order actions are disabled.</p> : null}
      {config.useMock ? (
        <p className="business-orders__demo" role="status">Sample customer orders placed at this restaurant. Demo data only; no real customer order was received.</p>
      ) : null}
      {error ? (
        <div className="business-error" role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={() => loadOrders()} disabled={loading}>Try again</Button>
        </div>
      ) : null}
      {notice ? <p className="business-orders__notice" role="status">{notice}</p> : null}

      <section className="business-orders__filters" aria-label="Order filters">
        <label>Search orders
          <input type="search" value={filters.search} placeholder="Reference or recipient" onChange={(event) => updateFilter('search', event.target.value)} />
        </label>
        <label>Status
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>From
          <input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} />
        </label>
        <label>To
          <input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} />
        </label>
        <Button variant="secondary" disabled={loading} onClick={() => loadOrders()}>Refresh</Button>
      </section>

      {loading ? <p className="business-loading" role="status">Loading orders…</p> : (
        <>
          <div className="business-orders__table-wrap">
            <table className="business-orders__table">
              <caption className="sr-only">Restaurant orders</caption>
              <thead>{table.getHeaderGroups().map((group) => (
                <tr key={group.id}>{group.headers.map((header) => (
                  <th key={header.id} scope="col">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>
                ))}</tr>
              ))}</thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>{row.getVisibleCells().map((cell) => {
                    const header = cell.column.columnDef.header;
                    const label = typeof header === 'string' && header ? header : cell.column.id === 'details' ? 'Actions' : cell.column.id;
                    return <td key={cell.id} data-label={label}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                  })}</tr>
                ))}
                {!orders.data?.length ? <tr><td colSpan={columns.length}>No orders match these filters.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="business-orders__pagination">
            <Button variant="secondary" disabled={filters.page <= 1 || loading} onClick={() => updateFilter('page', filters.page - 1)}>Previous</Button>
            <span>Page {orders.meta?.current_page || 1} of {orders.meta?.last_page || 1} · {orders.meta?.total || 0} order(s)</span>
            <Button variant="secondary" disabled={filters.page >= (orders.meta?.last_page || 1) || loading} onClick={() => updateFilter('page', filters.page + 1)}>Next</Button>
          </div>
        </>
      )}

      <Modal open={Boolean(selectedOrder)} title={selectedOrder ? `Order ${selectedOrder.reference_code}` : 'Order details'} onClose={() => setSelectedOrder(null)}>
        {selectedOrder ? (
          <div className="business-order-detail">
            <div className="business-order-detail__summary">
              <span className={`business-order-status business-order-status--${selectedOrder.status}`}>{statusLabel(selectedOrder.status)}</span>
              <span>{orderTypeLabel(selectedOrder.order_type)}</span>
              <span>Placed {formatDate(selectedOrder.placed_at)}</span>
            </div>
            <section>
              <h3>Recipient</h3>
              <p>{selectedOrder.recipient.name} · {selectedOrder.recipient.phone}</p>
              {selectedOrder.delivery?.address ? <p>{selectedOrder.delivery.address}</p> : null}
            </section>
            <section>
              <h3>Items</h3>
              <ul>
                {selectedOrder.items.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    <span>{item.quantity} × {item.name}{item.note ? <small>{item.note}</small> : null}</span>
                    <strong>{money(item.line_total)}</strong>
                  </li>
                ))}
              </ul>
            </section>
            <section className="business-order-detail__totals">
              <h3>Payment and total</h3>
              <p>{selectedOrder.payment ? `${selectedOrder.payment.method.replaceAll('_', ' ')} · ${selectedOrder.payment.status}` : 'Payment details unavailable'}</p>
              <p>Subtotal <strong>{money(selectedOrder.totals.subtotal)}</strong></p>
              {selectedOrder.order_type === 'delivery' ? <p>Delivery <strong>{money(selectedOrder.totals.delivery_fee)}</strong></p> : null}
              <p>Service fee <strong>{money(selectedOrder.totals.service_fee)}</strong></p>
              <p>Discount <strong>−{money(selectedOrder.totals.discount_amount)}</strong></p>
              <p className="business-order-detail__grand-total">Total <strong>{money(selectedOrder.totals.total)}</strong></p>
            </section>
            {selectedOrder.cancel_reason ? <p className="business-orders__reason">Reason: {selectedOrder.cancel_reason}</p> : null}
            <section>
              <h3>Activity</h3>
              <ol className="business-order-timeline">
                {selectedOrder.status_history.map((event, index) => (
                  <li key={`${event.to_status}-${event.changed_at}-${index}`}>
                    <strong>{statusLabel(event.to_status)}</strong>
                    <time dateTime={event.changed_at}>{formatDate(event.changed_at)}</time>
                    {canViewActors && event.actor?.name ? <span>By {event.actor.name}</span> : null}
                    {event.reason ? <span>{event.reason}</span> : null}
                  </li>
                ))}
              </ol>
            </section>
            {selectedOrderActions ? <div className="business-order-detail__actions">{selectedOrderActions}</div> : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(reasonTarget)} title={reasonTarget?.status === 'rejected' ? 'Reject order' : 'Cancel order'} onClose={() => !saving && setReasonTarget(null)}>
        <form className="business-order-reason" onSubmit={submitReason}>
          <p>A reason is required and will be included in the order activity.</p>
          <label htmlFor="business-order-reason">Reason</label>
          <textarea id="business-order-reason" value={reason} maxLength="500" required rows="4" onChange={(event) => setReason(event.target.value)} />
          <div>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setReasonTarget(null)}>Keep order</Button>
            <Button type="submit" disabled={saving || !reason.trim()}>{saving ? 'Saving…' : reasonTarget?.status === 'rejected' ? 'Reject order' : 'Cancel order'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title="Mark Pick-up as collected?"
        message="This completes the order and cannot be undone."
        confirmLabel="Mark collected"
        busy={saving}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={async () => {
          if (!confirmTarget) return;
          const updated = await transitionOrder(confirmTarget, 'completed');
          if (updated) setConfirmTarget(null);
        }}
      />
    </div>
  );
}
