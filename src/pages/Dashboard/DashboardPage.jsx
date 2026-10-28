import { useEffect, useState } from 'react';
import { restaurantService } from '../../services/restaurantService';
import { Button } from '../../components/ui/Button';
import '../Page.css';

const metrics = [
  { label: 'Gross sales', value: '₱128,420', change: '+12.4%' },
  { label: 'Orders today', value: '342', change: '+18%' },
  { label: 'Reservations', value: '58', change: '+9%' },
  { label: 'Avg. prep time', value: '21 min', change: '-3 min' },
];

const queue = [
  { customer: 'Nina L.', item: 'Family Hapag Platter', eta: '12 mins' },
  { customer: 'Jojo T.', item: 'Chicken Adobo Bowl', eta: '8 mins' },
  { customer: 'Lena R.', item: 'Halo-Halo x2', eta: '5 mins' },
];

export default function DashboardPage() {
  const [restaurants, setRestaurants] = useState([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const data = await restaurantService.getAllRestaurants();
      if (active) setRestaurants(data.slice(0, 4));
    };

    load();
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
        {metrics.map((metric) => (
          <div key={metric.label} className="stat-card">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.change}</small>
          </div>
        ))}
      </div>

      <div className="dashboard-grid dashboard-columns">
        <div className="info-card dashboard-card">
          <div className="card-header-row">
            <h3>Today’s highlights</h3>
            <span className="status-badge status-badge--success">Live</span>
          </div>

          <ul className="list-plain">
            <li>
              <strong>Peak time:</strong>
              <span>7:00 PM - 8:30 PM</span>
            </li>
            <li>
              <strong>Top seller:</strong>
              <span>Chicken adobo bowl</span>
            </li>
            <li>
              <strong>Table occupancy:</strong>
              <span>74% across 18 active tables</span>
            </li>
            <li>
              <strong>Promotion:</strong>
              <span>Lunch combo uplift +22%</span>
            </li>
          </ul>
        </div>

        <div className="summary-card dashboard-card">
          <div className="card-header-row">
            <h3>Order queue</h3>
            <span className="muted-label">12 pending</span>
          </div>
          <div className="activity-list">
            {queue.map((entry) => (
              <div key={entry.customer} className="activity-row">
                <div>
                  <strong>{entry.customer}</strong>
                  <div>{entry.item}</div>
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
