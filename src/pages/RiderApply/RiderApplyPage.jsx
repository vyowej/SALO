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
              <input id="rider-name" placeholder="Enter your full name" />
            </div>
            <div className="field">
              <label htmlFor="rider-city">Preferred city</label>
              <input id="rider-city" placeholder="Enter your preferred city" />
            </div>
            <div className="field">
              <label htmlFor="rider-vehicle">Vehicle type</label>
              <select id="rider-vehicle" defaultValue="">
                <option value="" disabled>Select a vehicle type</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="bicycle">Bicycle</option>
                <option value="car">Car</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="rider-schedule">Available hours</label>
              <input id="rider-schedule" placeholder="Enter your available hours" />
            </div>
            <div className="field">
              <label htmlFor="rider-note">Why do you want to ride with SALO?</label>
              <textarea id="rider-note" placeholder="Tell us why you would like to ride with SALO." />
            </div>
            <Button variant="primary" size="lg" type="submit">Submit rider application</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
