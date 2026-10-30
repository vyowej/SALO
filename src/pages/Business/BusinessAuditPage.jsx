import { useCallback, useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from '../../components/ui/Button';
import { useCan } from '../../hooks/useCan';
import { teamService } from '../../services/teamService';

function EventValues({ before, after }) {
  if (!before && !after) return '—';
  return (
    <details className="team-audit-values">
      <summary>View change</summary>
      <div>
        <strong>Before</strong>
        <pre>{JSON.stringify(before, null, 2) || '—'}</pre>
        <strong>After</strong>
        <pre>{JSON.stringify(after, null, 2) || '—'}</pre>
      </div>
    </details>
  );
}

export default function BusinessAuditPage({ restaurantId, onAccessDenied }) {
  const canView = useCan('audit.view', restaurantId);
  const [logs, setLogs] = useState({ data: [], meta: { current_page: 1, last_page: 1 } });
  const [filters, setFilters] = useState({ search: '', action: '', from: '', to: '', page: 1, per_page: 15 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      setLogs(await teamService.getAuditLogs(restaurantId, nextFilters));
    } catch (loadError) {
      if (await onAccessDenied?.(loadError)) return;
      setError(loadError.message || 'Audit history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [filters, onAccessDenied, restaurantId]);

  useEffect(() => {
    if (canView) loadLogs();
  }, [canView, loadLogs]);

  const updateFilter = (key, value) => {
    const next = { ...filters, [key]: value, page: 1 };
    setFilters(next);
  };

  const columns = useMemo(() => [
    { accessorKey: 'created_at', header: 'When', cell: ({ getValue }) => new Date(getValue()).toLocaleString() },
    { accessorFn: (row) => row.actor?.name || 'System', id: 'actor', header: 'Who' },
    { accessorKey: 'action', header: 'Action' },
    {
      id: 'entity',
      header: 'What',
      cell: ({ row }) => `${row.original.entity_type} · ${row.original.entity_id}`,
    },
    {
      id: 'values',
      header: 'Before / after',
      enableSorting: false,
      cell: ({ row }) => <EventValues before={row.original.before} after={row.original.after} />,
    },
  ], []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: logs.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  if (!canView) return <p className="business-error" role="alert">You do not have permission to view this history.</p>;

  return (
    <div className="business-team">
      <header className="business-team__heading">
        <div>
          <p className="business-eyebrow">Owner only</p>
          <h2>Audit history</h2>
          <p>Restaurant actions are retained for 90 days.</p>
        </div>
      </header>
      {error ? <p className="business-error" role="alert">{error}</p> : null}
      <section className="business-team__card">
        <div className="team-filters">
          <label><span>Search</span><input type="search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} /></label>
          <label><span>Action</span><input value={filters.action} onChange={(event) => updateFilter('action', event.target.value)} placeholder="Any action" /></label>
          <label><span>From</span><input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} /></label>
          <label><span>To</span><input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} /></label>
        </div>
        {loading ? <p role="status">Loading audit history…</p> : (
          <>
            <div className="team-table-scroll">
              <table className="team-table">
                <caption className="sr-only">Restaurant audit history</caption>
                <thead>{table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>{group.headers.map((header) => <th key={header.id} scope="col">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
                ))}</thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
                  ))}
                  {!logs.data?.length ? <tr><td colSpan={columns.length}>No audit events match these filters.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="team-pagination">
              <Button variant="secondary" size="sm" disabled={filters.page <= 1 || loading} onClick={() => updateFilter('page', filters.page - 1)}>Previous</Button>
              <span>Page {logs.meta?.current_page || 1} of {logs.meta?.last_page || 1}</span>
              <Button variant="secondary" size="sm" disabled={filters.page >= (logs.meta?.last_page || 1) || loading} onClick={() => updateFilter('page', filters.page + 1)}>Next</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
