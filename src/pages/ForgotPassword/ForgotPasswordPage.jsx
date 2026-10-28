import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import '../Page.css';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="auth-shell section-shell">
      <div className="auth-card">
        <span className="eyebrow">Need help?</span>
        <h1>Reset password</h1>
        <p className="auth-card__intro">We’ll send a reset link to your email so you can get back to ordering and reserving.</p>

        <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
          <div className="field">
            <label htmlFor="reset-email">Email address</label>
            <input id="reset-email" type="email" autoComplete="email" placeholder="Enter your email address" required />
          </div>
          {submitted ? <p className="form-success" role="status">If this email has an account, you’ll receive a reset link shortly.</p> : null}
          <Button variant="primary" size="lg" type="submit">Send reset link</Button>
        </form>

        <div className="auth-card__actions">
          <Link to="/login" className="text-link">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
