import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { config } from '../../config';
import { authService } from '../../services/authService';
import '../Page.css';

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (token) {
        if (password !== passwordConfirmation) {
          setError('Your passwords do not match.');
          return;
        }
        if (config.useMock) {
          setError('Password reset is available when the account API is enabled.');
          return;
        }
        await authService.resetPassword({ email, token, password, passwordConfirmation });
      } else if (config.useMock) {
        setSubmitted(true);
        return;
      } else {
        await authService.requestPasswordReset(email);
      }
      setSubmitted(true);
    } catch (requestError) {
      console.error('Unable to complete the password reset request.', requestError);
      setError(requestError.message || 'We couldn’t complete that request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell section-shell">
      <div className="auth-card">
        <span className="eyebrow">Need help?</span>
        <h1>{token ? 'Choose a new password' : 'Reset password'}</h1>
        <p className="auth-card__intro">
          {token
            ? 'Choose a new password for your SALO account.'
            : 'We’ll send a reset link if an account matches this email.'}
        </p>

        {submitted ? (
          <p className="form-success" role="status">
            {token
              ? 'Your password has been reset. You can now sign in.'
              : 'If this email has an account, you’ll receive a reset link shortly.'}
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="reset-email">Email address</label>
              <input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email address" required />
            </div>
            {token ? (
              <>
                <div className="field">
                  <label htmlFor="reset-password">New password</label>
                  <input id="reset-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="reset-password-confirmation">Confirm new password</label>
                  <input id="reset-password-confirmation" type="password" autoComplete="new-password" minLength={8} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required />
                </div>
              </>
            ) : null}
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <Button variant="primary" size="lg" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : token ? 'Reset password' : 'Send reset link'}
            </Button>
          </form>
        )}

        <div className="auth-card__actions">
          <Link to="/login" className="text-link">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
