import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

export default function AuthStatusBanner() {
  const { authError, authLoading, checkCurrentUser, dismissAuthError } = useAuth();

  if (!authError || authLoading) return null;

  return (
    <div className="auth-status-banner" role="status" aria-live="polite">
      <span>We couldn't reach SALO right now.</span>
      <Button size="md" className="auth-status-banner__retry" onClick={checkCurrentUser}>Retry</Button>
      <button
        type="button"
        className="btn btn--ghost btn--icon auth-status-banner__dismiss"
        aria-label="Dismiss connection message"
        onClick={dismissAuthError}
      >
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
