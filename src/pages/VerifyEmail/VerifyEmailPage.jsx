import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { config } from '../../config';
import '../Page.css';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { isLoggedIn, authLoading, verifyEmail } = useAuth();
  const [status, setStatus] = useState('pending');
  const attempted = useRef(false);

  useEffect(() => {
    if (authLoading || attempted.current) return;
    if (!token || config.useMock || !isLoggedIn) return;

    attempted.current = true;
    verifyEmail(token)
      .then((verified) => setStatus(verified ? 'verified' : 'invalid'))
      .catch((error) => {
        console.error('Unable to verify the account email.', error);
        setStatus('invalid');
      });
  }, [authLoading, isLoggedIn, token, verifyEmail]);

  const visibleStatus = authLoading
    ? 'checking'
    : !token || config.useMock
      ? 'invalid'
      : !isLoggedIn
        ? 'sign-in'
        : status === 'pending'
          ? 'checking'
          : status;

  return (
    <div className="auth-shell section-shell">
      <div className="auth-card">
        <span className="eyebrow">SALO account</span>
        <h1>Email verification</h1>
        {visibleStatus === 'checking' ? <p role="status">Checking your verification link…</p> : null}
        {visibleStatus === 'verified' ? <p className="form-success" role="status">Your email is verified.</p> : null}
        {visibleStatus === 'sign-in' ? <p role="alert">Sign in in this browser to verify your email address.</p> : null}
        {visibleStatus === 'invalid' ? <p className="form-error" role="alert">This verification link is invalid, expired, or unavailable in preview mode.</p> : null}
        <div className="auth-card__actions">
          <Link to={isLoggedIn ? '/profile' : '/login'} className="text-link">{isLoggedIn ? 'Back to profile' : 'Sign in'}</Link>
        </div>
      </div>
    </div>
  );
}
