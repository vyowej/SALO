import { Button } from '../../components/ui/Button';
import '../Page.css';

const benefits = [
  'Feature your menu to a high-intent local audience',
  'Convert more diners with table reservations and pickup orders',
  'Get tools for inventory, timing, and menu optimization',
];

export default function PartnerApplyPage() {
  return (
    <div className="section-shell application-shell">
      <div className="page-header">
        <div>
          <h1>Partner with SALO</h1>
          <p>Bring a restaurant, café, or food brand to diners who already love discovering local favorites.</p>
        </div>
      </div>

      <div className="partner-layout">
        <div className="info-card application-card">
          <h3>Why join</h3>
          <ul className="list-plain">
            {benefits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="feature-stack">
            <div className="feature-pill">Live menu management</div>
            <div className="feature-pill">Reservation-ready customers</div>
            <div className="feature-pill">Operational insights</div>
          </div>
        </div>

        <div className="summary-card application-card">
          <h3>Apply in minutes</h3>
          <form className="checkout-form">
            <div className="field">
              <label htmlFor="partner-name">Restaurant name</label>
              <input id="partner-name" defaultValue="Salu-salo sa Nayon" />
            </div>
            <div className="field">
              <label htmlFor="partner-city">Primary city</label>
              <input id="partner-city" defaultValue="Makati" />
            </div>
            <div className="field">
              <label htmlFor="partner-cuisine">Cuisine</label>
              <input id="partner-cuisine" defaultValue="Filipino / Bicolano" />
            </div>
            <div className="field">
              <label htmlFor="partner-email">Contact email</label>
              <input id="partner-email" type="email" defaultValue="hello@salusalo.ph" />
            </div>
            <div className="field">
              <label htmlFor="partner-notes">What makes your brand special?</label>
              <textarea id="partner-notes" defaultValue="We serve home-style dishes and celebratory Filipino meals for families and gatherings." />
            </div>
            <Button variant="primary" size="lg" type="submit">Submit application</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
