import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { adminService } from '../../services/adminService';
import { formatPeso } from '../../utils/formatPeso';
import '../Page.css';

export default function AdminPage() {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    let active = true;
    adminService.getOverview().then((data) => {
      if (active) setOverview(data);
    }).catch((error) => console.error('Unable to load admin dashboard.', error));
    return () => { active = false; };
  }, []);

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
        {(overview?.workspaceStats || []).map((stat) => (
          <div className="stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.format === 'currency' ? formatPeso(stat.value) : stat.value}</strong>
            <small>{stat.detail}</small>
          </div>
        ))}
      </div>

      <div className="dashboard-grid dashboard-columns">
        <div className="info-card dashboard-card">
          <div className="card-header-row">
            <h3>Operational alerts</h3>
            <span className="muted-label">Needs action</span>
          </div>
          <div className="alert-list">
            {(overview?.operations || []).map((alert) => (
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
            <span className="muted-label">Preview data</span>
          </div>
          <div className="activity-list">
            {(overview?.vendorHealth || []).map((vendor) => (
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
