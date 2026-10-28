import { formatPeso } from '../../utils/formatPeso';
import { Sparkline } from './charts';

function formatValue(metric) {
  if (metric.format === 'currency') return formatPeso(metric.value);
  if (metric.format === 'percent') return `${metric.value}%`;
  if (metric.format === 'rating') return Number(metric.value).toFixed(1);
  return Number(metric.value).toLocaleString();
}

export function StatCard({ metric, index = 0 }) {
  return (
    <article className="stat-card dashboard-stat-card">
      <span>{metric.label}</span>
      <strong>{formatValue(metric)}</strong>
      <div className="stat-card__footer"><small>{metric.delta} vs previous period</small><Sparkline values={Array.from({ length: 6 }, (_, point) => 4 + ((point * (index + 2)) % 6))} /></div>
    </article>
  );
}

export default StatCard;
