import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import config from '../../config';
import { teamService } from '../../services/teamService';
import '../Page.css';
import './BusinessPage.css';

export default function TeamInvitationPage() {
  const { token, action } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, refreshUser, updateUser, logout } = useAuth();
  const [form, setForm] = useState({ first_name: '', last_name: '', password: '', password_confirmation: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isAcceptFlow = action === 'accept' || (action === 'activate' && isLoggedIn && user?.status === 'active');
  const validAction = action === 'accept' || action === 'activate';

  const signOutForInvitation = async () => {
    setLoading(true);
    setError('');
    try {
      await logout();
      navigate(`${location.pathname}${location.search}`, { replace: true });
    } catch (signOutError) {
      setError(signOutError.message || 'You could not be signed out.');
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (isAcceptFlow) {
        const membership = await teamService.acceptTeamInvitation(token, user);
        if (user && config.useMock) {
          if (membership.restaurant_id) {
            const nextMembership = {
              restaurant_id: String(membership.restaurant_id),
              restaurant_name: membership.restaurant_name,
              role: membership.position,
              status: 'active',
              permissions: membership.permissions || [],
            };
            await updateUser({
              memberships: [
                ...(user.memberships || []).filter((item) => String(item.restaurant_id) !== String(membership.restaurant_id)),
                nextMembership,
              ],
            });
          }
        }
        if (!config.useMock) await refreshUser();
        setNotice(`You joined ${membership.restaurant_name}. Switch to Business mode to continue.`);
      } else {
        const result = await teamService.activateTeamInvitation(token, form);
        setNotice(`Your account for ${result.restaurant_name} is active. Sign in with your invited email to continue.`);
      }
    } catch (submitError) {
      setError(submitError.message || 'This invitation could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-shell">
      <section className="business-empty team-invitation-page">
        <p className="business-eyebrow">SALO team invitation</p>
        <h1>{isAcceptFlow ? 'Accept your invitation' : 'Activate your account'}</h1>
        {!validAction ? <p className="business-error" role="alert">This invitation link is invalid.</p> : notice ? (
          <>
            <p role="status">{notice}</p>
            {isAcceptFlow && isLoggedIn ? <Link className="btn btn--primary btn--md" to="/business">Open Business workspace</Link> : <Link className="btn btn--secondary btn--md" to="/login">Log in</Link>}
          </>
        ) : action === 'activate' && isLoggedIn && user?.status !== 'active' ? (
          <>
            <p>Sign out of {user?.email} before activating this invitation. Activation is only available to a new invited account.</p>
            {error ? <p className="business-error" role="alert">{error}</p> : null}
            <Button type="button" variant="primary" disabled={loading} onClick={signOutForInvitation}>{loading ? 'Signing out…' : 'Sign out to continue'}</Button>
          </>
        ) : isAcceptFlow && !isLoggedIn ? (
          <>
            <p>Sign in with the email address that received this invitation, then return here to accept it.</p>
            <Link className="btn btn--primary btn--md" to={`/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>Log in to accept</Link>
          </>
        ) : isAcceptFlow ? (
          <form onSubmit={submit}>
            {error ? <p className="business-error" role="alert">{error}</p> : null}
            <p>Accept this invitation using the signed-in account: {user?.email}</p>
            <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Accepting…' : 'Accept invitation'}</Button>
            {error ? <Button type="button" variant="secondary" disabled={loading} onClick={signOutForInvitation}>Sign out and use the invited account</Button> : null}
          </form>
        ) : (
          <form className="team-activation-form" onSubmit={submit}>
            {error ? <p className="business-error" role="alert">{error}</p> : null}
            <p>Choose your name and password. The restaurant owner will not see or set your password.</p>
            <label>
              <span>First name</span>
              <input required maxLength={80} autoComplete="given-name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
            </label>
            <label>
              <span>Last name</span>
              <input required maxLength={80} autoComplete="family-name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
            </label>
            <label>
              <span>Password</span>
              <input required minLength={8} autoComplete="new-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </label>
            <label>
              <span>Confirm password</span>
              <input required minLength={8} autoComplete="new-password" type="password" value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} />
            </label>
            <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Activating…' : 'Set name and password'}</Button>
            <p>Already activated this account? <Link to={`/team-invitations/${token}/accept`}>Log in to accept this invitation</Link>.</p>
          </form>
        )}
      </section>
    </div>
  );
}
