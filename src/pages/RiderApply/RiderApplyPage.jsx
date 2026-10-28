import { Button } from '../../components/ui/Button';
import '../Page.css';

const riderBenefits = [
  'Flexible schedule with route-based matching',
  'Easy digital payouts and rider support',
  'High-demand areas with live order volume updates',
];

export default function RiderApplyPage() {
  return (
    <div className="section-shell application-shell">
      <div className="page-header">
        <div>
          <h1>Ride with SALO</h1>
          <p>Deliver meals with a friendly, reliable network that values rider experience and local coverage.</p>
        </div>
      </div>

      <div className="partner-layout">
        <div className="info-card application-card">
          <h3>Rider perks</h3>
          <ul className="list-plain">
            {riderBenefits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="feature-stack">
            <div className="feature-pill">Fast onboarding</div>
            <div className="feature-pill">Regional route matching</div>
            <div className="feature-pill">Support & payouts</div>
          </div>
        </div>

        <div className="summary-card application-card">
          <h3>Apply to ride</h3>
          <form className="checkout-form">
            <div className="field">
              <label htmlFor="rider-name">Full name</label>
              <input id="rider-name" defaultValue="Rey Cruz" />
            </div>
            <div className="field">
              <label htmlFor="rider-city">Preferred city</label>
              <input id="rider-city" defaultValue="Quezon City" />
            </div>
            <div className="field">
              <label htmlFor="rider-vehicle">Vehicle type</label>
              <select id="rider-vehicle" defaultValue="motorcycle">
                <option value="motorcycle">Motorcycle</option>
                <option value="bicycle">Bicycle</option>
                <option value="car">Car</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="rider-schedule">Available hours</label>
              <input id="rider-schedule" defaultValue="6:00 PM - 12:00 AM" />
            </div>
            <div className="field">
              <label htmlFor="rider-note">Why do you want to ride with SALO?</label>
              <textarea id="rider-note" defaultValue="I love helping local food reach the right homes quickly and safely." />
            </div>
            <Button variant="primary" size="lg" type="submit">Submit rider application</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
