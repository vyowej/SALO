import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { DEMO_ACCOUNTS, useAuth } from '../../context/AuthContext';
import '../Page.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!await login(email, password)) {
      setError('Incorrect email or password.');
      return;
    }

    const account = DEMO_ACCOUNTS.find((candidate) => candidate.email === email.trim().toLowerCase());
    const destinations = { admin: '/admin', restaurantOwner: '/dashboard', rider: '/rider', customer: '/' };
    navigate(destinations[account?.role] || '/');
  };

  const selectAccount = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="auth-shell section-shell">
      <div className="auth-card">
        <span className="eyebrow">Welcome back</span>
        <h1>Log in</h1>
        <p className="auth-card__intro">Pick up where you left off with saved favorites and reservations.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email address" required />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <Button variant="primary" size="lg" type="submit">Login</Button>
        </form>

        <div className="demo-accounts">
          <strong>Demo accounts</strong>
          <div className="demo-accounts__list">
            {DEMO_ACCOUNTS.map((account) => (
              <button key={account.role} type="button" className="demo-account" onClick={() => selectAccount(account)}>
                <span>{account.role === 'restaurantOwner' ? 'Business owner' : account.role === 'admin' ? 'Admin' : account.role === 'rider' ? 'Rider' : 'Customer'}</span>
                <small>{account.email} / {account.password}</small>
              </button>
            ))}
          </div>
          <small className="demo-accounts__note">Demo accounts use mock authentication for this frontend preview.</small>
        </div>

        <div className="auth-card__actions">
          <Link to="/forgot-password" className="text-link">Forgot password?</Link>
          <Link to="/register" className="text-link">Create account</Link>
        </div>
      </div>
    </div>
  );
}
