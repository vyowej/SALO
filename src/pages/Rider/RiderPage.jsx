import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { riderService } from '../../services/riderService';
import { formatPeso } from '../../utils/formatPeso';
import { useAuth } from '../../context/AuthContext';
import '../Page.css';

export default function RiderPage() {
  const { user } = useAuth();
  const [online, setOnline] = useState(true);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    let active = true;
    riderService.getOverview().then((data) => {
      if (!active) return;
      setOverview(data);
      setOnline(data.online);
    }).catch((error) => console.error('Unable to load rider dashboard.', error));
    return () => { active = false; };
  }, []);

  const toggleOnline = async () => {
    try {
      setOnline(await riderService.setOnline(!online));
    } catch (error) {
      console.error('Unable to update rider availability.', error);
    }
  };

  return (
    <div className="section-shell rider-shell dashboard-shell">
      <div className="page-header">
        <div><h1>Welcome, {user?.name || 'Rider'}</h1><p>Your route and earnings for today.</p></div>
        <button type="button" className={`online-switch ${online ? 'is-online' : ''}`} role="switch" aria-checked={online} onClick={toggleOnline}>
          <span /> {online ? 'Online' : 'Offline'}
        </button>
      </div>

      <div className="dashboard-grid stat-grid">
        <div className="stat-card"><span>Today’s earnings</span><strong>{overview ? formatPeso(overview.earnings) : '—'}</strong><small>{overview?.earningsChange || 'Loading dashboard data'}</small></div>
        <div className="stat-card"><span>Deliveries done</span><strong>{overview?.deliveries ?? '—'}</strong><small>{overview ? `${overview.averageRating} avg. rating` : ''}</small></div>
        <div className="stat-card"><span>Acceptance rate</span><strong>{overview ? `${overview.acceptanceRate}%` : '—'}</strong><small>Current period</small></div>
        <div className="stat-card"><span>Cash to remit</span><strong>{overview ? formatPeso(overview.cashToRemit) : '—'}</strong><small>{overview ? `Settle by ${overview.settlementDeadline}` : ''}</small></div>
      </div>

      <section className="summary-card dashboard-card rider-deliveries">
        <div className="card-header-row"><h2>{online ? 'Nearby deliveries' : 'You’re offline'}</h2><span className="muted-label">{online ? 'Offers refresh automatically' : 'Go online to receive offers'}</span></div>
        {online ? (overview?.deliveriesList || []).map((delivery) => (
          <article className="rider-delivery" key={delivery.id}>
            <div className="rider-delivery__route"><span className="status-badge status-badge--success">{delivery.status}</span><strong>{delivery.place}</strong><span>{delivery.destination}</span></div>
            <div className="rider-delivery__actions"><strong>{formatPeso(delivery.payout)}</strong><Button variant="primary" size="md">Accept</Button><Button variant="ghost" size="md">Decline</Button></div>
          </article>
        )) : <p className="muted-copy">Turn on your availability when you’re ready to ride.</p>}
      </section>

      <section className="summary-card dashboard-card">
        <div className="card-header-row"><h2>Today’s route</h2><span className="muted-label">{overview?.deliveries ?? '—'} deliveries completed</span></div>
        <ol className="rider-route-steps">{(overview?.completedRoute || []).map((step, index) => <li key={step} className={index < (overview?.completedRoute.length || 0) - 1 ? 'is-complete' : ''}>{step}</li>)}</ol>
        <div className="rider-proof"><label htmlFor="proof-photo">Delivery proof photo</label><input id="proof-photo" type="file" accept="image/*" /><span className="muted-label">Photo proof is required before marking a delivery complete.</span></div>
      </section>
    </div>
  );
}
