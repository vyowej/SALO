import { Button } from '../../components/ui/Button';
import '../Page.css';

const alerts = [
  { label: 'Restaurant onboarding', detail: '3 vendors have incomplete documents', tone: 'warning' },
  { label: 'Rider coverage', detail: 'Metro Manila coverage stable but Cebu needs 2 more riders', tone: 'info' },
  { label: 'Payment reconciliation', detail: '1 settlement is pending review', tone: 'danger' },
];

const vendors = [
  { name: 'Mang Toma’s Kitchen', status: 'Healthy', score: '96%' },
  { name: 'Harana Grill House', status: 'Review', score: '84%' },
  { name: 'Dagat Kusina', status: 'Healthy', score: '92%' },
];

export default function AdminPage() {
  return (
    <div className="section-shell admin-shell">
      <div className="page-header">
        <div>
          <h1>Admin Console</h1>
          <p>Watch network health, partner quality, and operational risk at a glance.</p>
        </div>
        <Button variant="secondary" size="md">Open audit</Button>
      </div>

      <div className="dashboard-grid stat-grid">
        <div className="stat-card">
          <span>Restaurants</span>
          <strong>248</strong>
          <small>+14 this month</small>
        </div>
        <div className="stat-card">
          <span>Active riders</span>
          <strong>318</strong>
          <small>92% availability</small>
        </div>
        <div className="stat-card">
          <span>Disputes</span>
          <strong>8</strong>
          <small>Down 6%</small>
        </div>
        <div className="stat-card">
          <span>GMV</span>
          <strong>₱4.2M</strong>
          <small>+17.8% MoM</small>
        </div>
      </div>

      <div className="dashboard-grid dashboard-columns">
        <div className="info-card dashboard-card">
          <div className="card-header-row">
            <h3>Operational alerts</h3>
            <span className="muted-label">Needs action</span>
          </div>
          <div className="alert-list">
            {alerts.map((alert) => (
              <div key={alert.label} className={['alert-item', `alert-item--${alert.tone}`].join(' ')}>
                <strong>{alert.label}</strong>
                <span>{alert.detail}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="summary-card dashboard-card">
          <div className="card-header-row">
            <h3>Partner health</h3>
            <span className="muted-label">Updated 3m ago</span>
          </div>
          <div className="activity-list">
            {vendors.map((vendor) => (
              <div key={vendor.name} className="activity-row">
                <div>
                  <strong>{vendor.name}</strong>
                  <div>{vendor.status}</div>
                </div>
                <span>{vendor.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
