import { useEffect, useState } from 'react';
import { restaurantService } from '../../services/restaurantService';
import { ownerService } from '../../services/ownerService';
import { Button } from '../../components/ui/Button';
import '../Page.css';

export default function DashboardPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [data, dashboardData] = await Promise.all([
        restaurantService.getAllRestaurants(),
        ownerService.getOverview('Today'),
      ]);
      if (active) {
        setRestaurants(data.slice(0, 4));
        setOverview(dashboardData);
      }
    };

    load().catch((error) => console.error('Unable to load restaurant dashboard.', error));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="section-shell dashboard-shell">
      <div className="page-header">
        <div>
          <h1>Restaurant Dashboard</h1>
          <p>Monitor demand, staffing, and table flow in one warm daily view.</p>
        </div>
        <Button variant="primary" size="md">Export report</Button>
      </div>

      <div className="dashboard-grid stat-grid">
        {(overview?.metrics || []).map((metric) => (
          <div key={metric.label} className="stat-card">
            <span>{metric.label}</span>
            <strong>{metric.format === 'currency' ? `₱${Number(metric.value).toLocaleString('en-PH')}` : metric.value}</strong>
            <small>{metric.delta}</small>
          </div>
        ))}
      </div>

      <div className="dashboard-grid dashboard-columns">
        <div className="info-card dashboard-card">
          <div className="card-header-row">
            <h3>Today’s highlights</h3>
            <span className="status-badge status-badge--success">Preview</span>
          </div>

          <ul className="list-plain">
            {(overview?.highlights || []).map((highlight) => (
              <li key={highlight.label}><strong>{highlight.label}:</strong><span>{highlight.value}</span></li>
            ))}
          </ul>
        </div>

        <div className="summary-card dashboard-card">
          <div className="card-header-row">
            <h3>Order queue</h3>
            <span className="muted-label">{overview?.metrics.find((metric) => metric.label === 'Pending orders')?.value ?? '—'} pending</span>
          </div>
          <div className="activity-list">
            {(overview?.activityQueue || []).map((entry) => (
              <div key={entry.id} className="activity-row">
                <div>
                  <strong>{entry.customer}</strong>
                  <div>{entry.items}</div>
                </div>
                <span>{entry.eta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="summary-card dashboard-card dashboard-card--spaced">
        <div className="card-header-row">
          <h3>Top restaurants</h3>
          <span className="muted-label">This week</span>
        </div>

        <div className="restaurant-mini-list">
          {restaurants.map((restaurant) => (
            <div key={restaurant.id} className="mini-restaurant">
              <div>
                <strong>{restaurant.name}</strong>
                <div>{restaurant.location}</div>
              </div>
              <div className="mini-restaurant__meta">
                <span>⭐ {restaurant.rating}</span>
                <span>{restaurant.deliveryTime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
