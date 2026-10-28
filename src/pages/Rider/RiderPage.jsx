import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import '../Page.css';

const deliveries = [
  { place: 'Mang Toma’s Kitchen', destination: 'Sampaguita Street, Quezon City', amount: '₱185', status: 'Pickup ready' },
  { place: 'Pista at Kape', destination: 'BGC Corporate Center, Taguig', amount: '₱220', status: 'Offer · 00:28' },
];

export default function RiderPage() {
  const [online, setOnline] = useState(true);

  return (
    <div className="section-shell rider-shell dashboard-shell">
      <div className="page-header">
        <div><h1>Good afternoon, Rey</h1><p>Your route and earnings for today.</p></div>
        <button type="button" className={`online-switch ${online ? 'is-online' : ''}`} role="switch" aria-checked={online} onClick={() => setOnline(!online)}>
          <span /> {online ? 'Online' : 'Offline'}
        </button>
      </div>

      <div className="dashboard-grid stat-grid">
        <div className="stat-card"><span>Today’s earnings</span><strong>₱2,480</strong><small>+8.2% vs yesterday</small></div>
        <div className="stat-card"><span>Deliveries done</span><strong>12</strong><small>4.8 avg. rating</small></div>
        <div className="stat-card"><span>Acceptance rate</span><strong>94%</strong><small>Top rider this week</small></div>
        <div className="stat-card"><span>Cash to remit</span><strong>₱640</strong><small>Settle by 10:00 PM</small></div>
      </div>

      <section className="summary-card dashboard-card rider-deliveries">
        <div className="card-header-row"><h2>{online ? 'Nearby deliveries' : 'You’re offline'}</h2><span className="muted-label">{online ? 'Offers refresh automatically' : 'Go online to receive offers'}</span></div>
        {online ? deliveries.map((delivery) => (
          <article className="rider-delivery" key={delivery.place}>
            <div className="rider-delivery__route"><span className="status-badge status-badge--success">{delivery.status}</span><strong>{delivery.place}</strong><span>{delivery.destination}</span></div>
            <div className="rider-delivery__actions"><strong>{delivery.amount}</strong><Button variant="primary" size="md">Accept</Button><Button variant="ghost" size="md">Decline</Button></div>
          </article>
        )) : <p className="muted-copy">Turn on your availability when you’re ready to ride.</p>}
      </section>

      <section className="summary-card dashboard-card">
        <div className="card-header-row"><h2>Today’s route</h2><span className="muted-label">12 deliveries completed</span></div>
        <ol className="rider-route-steps"><li className="is-complete">Accepted</li><li className="is-complete">Picked up</li><li>Delivered</li></ol>
        <div className="rider-proof"><label htmlFor="proof-photo">Delivery proof photo</label><input id="proof-photo" type="file" accept="image/*" /><span className="muted-label">Photo proof is required before marking a delivery complete.</span></div>
      </section>
    </div>
  );
}
