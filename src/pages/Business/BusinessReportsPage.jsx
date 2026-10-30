import { useCallback, useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '../../components/ui/Button';
import { businessService } from '../../services/businessService';
import { formatPeso } from '../../utils/formatPeso';
import './BusinessReportsPage.css';

const SALES_REPORTS = [
  ['sales_summary', 'Sales summary'],
  ['orders_by_status', 'Orders by status'],
  ['popular_items', 'Popular items'],
  ['discount_usage', 'Discount usage'],
];
const RESERVATION_REPORTS = [
  ['reservations', 'Reservations'],
  ['no_show_rate', 'No-show rate'],
];

function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

function daysAgo(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function metricLabel(key) {
  return key.replaceAll('_', ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function metricValue(key, value) {
  if (['sales', 'discounts', 'amount_applied'].includes(key)) return formatPeso(value);
  if (key === 'no_show_rate_percent') return `${Number(value).toFixed(2)}%`;
  return Number.isInteger(Number(value)) ? Number(value).toLocaleString() : Number(value).toFixed(2);
}

function columnLabel(key) {
  return key.replaceAll('_', ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function cellValue(key, value) {
  if (['sales', 'order_value', 'amount_applied'].includes(key)) return formatPeso(value);
  if (key === 'date') return new Date(`${value}T12:00:00+08:00`).toLocaleDateString([], { timeZone: 'Asia/Manila', dateStyle: 'medium' });
  return value ?? '—';
}

export default function BusinessReportsPage({ restaurantId, user, canViewSales, canViewReservations }) {
  const reports = useMemo(() => [
    ...(canViewSales ? SALES_REPORTS : []),
    ...(canViewReservations ? RESERVATION_REPORTS : []),
  ], [canViewReservations, canViewSales]);
  const [report, setReport] = useState(canViewSales ? 'sales_summary' : 'reservations');
  const [range, setRange] = useState(() => {
    const to = manilaToday();
    return { from: daysAgo(to, 29), to };
  });
  const [appliedRange, setAppliedRange] = useState(range);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const canView = canViewSales || canViewReservations;

  useEffect(() => {
    if (!reports.some(([key]) => key === report)) {
      setReport(reports[0]?.[0] || '');
    }
  }, [report, reports]);

  const loadReport = useCallback(async () => {
    if (!report || !appliedRange.from || !appliedRange.to) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await businessService.getBusinessReport(restaurantId, report, appliedRange, user));
    } catch (loadError) {
      setError(loadError.message || 'The report could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [appliedRange, report, restaurantId, user]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const downloadCsv = async () => {
    setDownloading(true);
    setError('');
    try {
      const file = await businessService.downloadBusinessReport(restaurantId, report, appliedRange, user);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report}-${appliedRange.from}-${appliedRange.to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message || 'The report could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };

  const columns = useMemo(() => (result?.columns || []).map((key) => ({
    accessorKey: key,
    header: columnLabel(key),
    cell: ({ getValue }) => cellValue(key, getValue()),
  })), [result?.columns]);
  const rows = result?.rows || [];

  // TanStack Table renders the report rows.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!canView) return <p className="business-error" role="alert">You do not have permission to view reports.</p>;

  return (
    <div className="business-reports">
      <header className="business-page-heading">
        <div>
          <p className="business-eyebrow">Restaurant analytics</p>
          <h2>Reports</h2>
          <p>Review restaurant activity for a date range and export the results.</p>
        </div>
      </header>
      <form className="business-report-filters" onSubmit={(event) => {
        event.preventDefault();
        if (range.to < range.from) {
          setError('The end date must be on or after the start date.');
          return;
        }
        setAppliedRange({ ...range });
      }}>
        <label>Report
          <select value={report} onChange={(event) => setReport(event.target.value)}>
            {reports.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>From
          <input type="date" value={range.from} max={range.to} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} required />
        </label>
        <label>To
          <input type="date" value={range.to} min={range.from} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} required />
        </label>
        <div className="business-report-filter-actions">
          <Button type="submit" disabled={loading}>Run report</Button>
          <Button type="button" variant="secondary" disabled={loading || downloading || !result} onClick={downloadCsv}>
            {downloading ? 'Preparing…' : 'Export CSV'}
          </Button>
        </div>
      </form>
      {error ? <div className="business-error" role="alert"><p>{error}</p><Button variant="secondary" onClick={loadReport} disabled={loading}>Try again</Button></div> : null}
      {loading ? <p className="business-loading" role="status">Loading report…</p> : null}
      {!loading && !error && result ? (
        <>
          <section className="business-metrics" aria-label="Report summary">
            {Object.entries(result.summary || {}).map(([key, value]) => (
              <article className="business-metric-card" key={key}>
                <span>{metricLabel(key)}</span>
                <strong>{metricValue(key, value)}</strong>
                <small>{appliedRange.from} – {appliedRange.to}</small>
              </article>
            ))}
          </section>
          {result.series?.length ? (
            <section className="business-report-chart business-panel" aria-label={`${metricLabel(report)} chart`}>
              <h3>{metricLabel(report)}</h3>
              <div>
                <ResponsiveContainer width="100%" height="100%">
                  {report === 'sales_summary' ? (
                    <LineChart data={result.series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [name === 'sales' ? formatPeso(value) : value, columnLabel(name)]} />
                      <Line type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={3} />
                    </LineChart>
                  ) : (
                    <BarChart data={result.series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey={report === 'popular_items' ? 'item' : report === 'discount_usage' ? 'code' : 'status'} />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [value, columnLabel(name)]} />
                      <Bar dataKey={report === 'popular_items' ? 'quantity' : report === 'discount_usage' ? 'uses' : report === 'orders_by_status' ? 'orders' : 'reservations'} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}
          {rows.length ? (
            <section className="business-report-table-wrap">
              <table className="business-report-table">
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
            </section>
          ) : <div className="business-empty-state"><h3>No report data for this period</h3><p>Choose another date range or check again after activity is recorded.</p></div>}
        </>
      ) : null}
    </div>
  );
}
