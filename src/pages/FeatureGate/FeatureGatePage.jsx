import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import { FEATURE_GATE_LABELS } from '../../constants/guestExperience';
import { guestFeatureGateContent } from '../../mock/landingData';
import './FeatureGatePage.css';

export default function FeatureGatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const returnTo = location.state?.gateTarget
    || `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') navigate('/', { replace: true });
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('a[href], button:not(:disabled)')];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const authState = { from: returnTo };

  return (
    <div className="feature-gate" role="presentation">
      <div className="feature-gate__preview" aria-hidden="true">
        <div className="feature-gate__preview-heading">
          <span>{FEATURE_GATE_LABELS.previewLabel}</span>
          <h2>{guestFeatureGateContent.previewHeading}</h2>
          <p>{guestFeatureGateContent.previewSubheading}</p>
        </div>
        <div className="feature-gate__preview-cards">
          {guestFeatureGateContent.previewCards.map((card) => (
            <div className="feature-gate__preview-card" key={card.id}>
              <span className="feature-gate__preview-image" />
              <strong>{card.name}</strong>
              <small>{card.detail}</small>
            </div>
          ))}
        </div>
      </div>

      <section ref={dialogRef} className="feature-gate__dialog glass-card" role="dialog" aria-modal="true" aria-labelledby="feature-gate-title" aria-describedby="feature-gate-description">
        <button ref={closeButtonRef} type="button" className="feature-gate__close" aria-label={FEATURE_GATE_LABELS.close} onClick={() => navigate('/', { replace: true })}>
          <X size={18} />
        </button>
        <span className="feature-gate__eyebrow">{FEATURE_GATE_LABELS.eyebrow}</span>
        <h1 id="feature-gate-title">{FEATURE_GATE_LABELS.title}</h1>
        <p id="feature-gate-description">{guestFeatureGateContent.description}</p>
        <div className="feature-gate__benefits">
          <strong>{FEATURE_GATE_LABELS.benefitsHeading}</strong>
          <ul>
            {guestFeatureGateContent.benefits.map((benefit) => (
              <li key={benefit}><Check size={16} aria-hidden="true" />{benefit}</li>
            ))}
          </ul>
        </div>
        <Link className="btn btn--primary feature-gate__signup" to="/register" state={authState}>
          {FEATURE_GATE_LABELS.signUp}<ArrowRight size={17} />
        </Link>
        <p className="feature-gate__login">
          {FEATURE_GATE_LABELS.loginPrompt}
          <Link to="/login" state={authState}>{FEATURE_GATE_LABELS.login}</Link>
        </p>
        <button type="button" className="feature-gate__later" onClick={() => navigate('/', { replace: true })}>
          {FEATURE_GATE_LABELS.continueBrowsing}
        </button>
      </section>
    </div>
  );
}
