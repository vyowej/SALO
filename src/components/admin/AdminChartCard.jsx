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
import { ADMIN_COPY } from '../../constants/admin';

export function AdminChartCard({ title, data, dataKey, type = 'bar', valueFormatter }) {
  const Chart = type === 'line' ? LineChart : BarChart;
  const Mark = type === 'line' ? Line : Bar;
  return (
    <section className="admin-chart-card">
      <h2>{title}</h2>
      <div className="admin-chart-card__plot">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <Chart data={data}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="var(--muted)" tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} />
              <Tooltip formatter={valueFormatter} />
              <Mark type="monotone" dataKey={dataKey} stroke="var(--action)" fill="var(--action)" strokeWidth={2} name={title || ADMIN_COPY.chartRevenue} />
            </Chart>
          </ResponsiveContainer>
        ) : <p className="admin-chart-card__empty">{ADMIN_COPY.chartNoData}</p>}
      </div>
    </section>
  );
}

export default AdminChartCard;
