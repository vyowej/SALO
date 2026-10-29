import { Navigate, Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, MapPin, UsersRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FILIPINO_VOICE } from '../../constants/voice';
import { RESERVATION_PROMO_LABELS } from '../../constants/guestExperience';
import './Reserve.css';

const signupHref = '/signup?returnTo=%2Freservations%2Fnew';
const loginHref = '/login?returnTo=%2Freservations%2Fnew';

const stepIcons = [
  MapPin,
  CalendarDays,
  CheckCircle2,
];

export default function ReservePage() {
  const { isLoggedIn, authLoading, authError } = useAuth();

  if (authLoading) {
    return <div className="reserve-promo section-shell"><div className="skeleton skeleton--block" aria-label={RESERVATION_PROMO_LABELS.loading} /></div>;
  }
  if (authError) {
    return <div className="reserve-promo section-shell"><p className="reserve-promo__error" role="alert">{authError}</p></div>;
  }
  if (isLoggedIn) return <Navigate to="/reservations/new" replace />;

  return (
    <div className="reserve-promo section-shell">
      <section className="reserve-promo__hero" aria-labelledby="reserve-promo-title">
        <div className="reserve-promo__intro">
          <span className="eyebrow">{RESERVATION_PROMO_LABELS.heroEyebrow}</span>
          <h1 id="reserve-promo-title">{RESERVATION_PROMO_LABELS.title}</h1>
          <p className="reserve-promo__subhead"><span lang="tl">{FILIPINO_VOICE.saluSaloFriends.phrase}</span></p>
          <p className="reserve-promo__description">{RESERVATION_PROMO_LABELS.description}</p>
          <div className="reserve-promo__actions">
            <Link to={signupHref} className="btn btn--primary btn--lg">{RESERVATION_PROMO_LABELS.primaryAction}<ArrowRight size={17} aria-hidden="true" /></Link>
            <p><Link to={loginHref} className="reserve-promo__login">{RESERVATION_PROMO_LABELS.loginLink}</Link></p>
          </div>
        </div>
        <aside className="reserve-promo__preview" aria-label={RESERVATION_PROMO_LABELS.previewAriaLabel}>
          <div className="reserve-promo__preview-heading">
            <span className="reserve-promo__sample-label">{RESERVATION_PROMO_LABELS.previewLabel}</span>
            <CalendarDays size={22} aria-hidden="true" />
          </div>
          <h2>{RESERVATION_PROMO_LABELS.previewTitle}</h2>
          <div className="reserve-promo__preview-card">
            <span className="reserve-promo__preview-icon"><CalendarDays size={20} aria-hidden="true" /></span>
            <div className="reserve-promo__preview-details">
              <strong>{RESERVATION_PROMO_LABELS.sampleRestaurant}</strong>
              <span><CalendarDays size={14} aria-hidden="true" /> {RESERVATION_PROMO_LABELS.sampleDate}</span>
              <span><Clock3 size={14} aria-hidden="true" /> {RESERVATION_PROMO_LABELS.sampleTime}</span>
              <span><UsersRound size={14} aria-hidden="true" /> {RESERVATION_PROMO_LABELS.sampleGroup}</span>
            </div>
            <span className="reserve-promo__preview-status">{RESERVATION_PROMO_LABELS.sampleStatus}</span>
          </div>
        </aside>
      </section>

      <section className="reserve-promo__steps" aria-labelledby="reserve-steps-title">
        <div className="reserve-promo__section-heading">
          <span className="eyebrow">{RESERVATION_PROMO_LABELS.stepsEyebrow}</span>
          <h2 id="reserve-steps-title">{RESERVATION_PROMO_LABELS.stepsTitle}</h2>
        </div>
        <ol className="reserve-promo__step-list">
          {RESERVATION_PROMO_LABELS.steps.map(({ title, description }, index) => {
            const Icon = stepIcons[index];
            return (
            <li className="reserve-promo__step-card" key={title}>
              <span className="reserve-promo__step-number">{index + 1}</span>
              <span className="reserve-promo__step-icon"><Icon size={22} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
            );
          })}
        </ol>
      </section>

      <section className="reserve-promo__benefits" aria-labelledby="reserve-benefits-title">
        <div>
          <span className="eyebrow">{RESERVATION_PROMO_LABELS.benefitsEyebrow}</span>
          <h2 id="reserve-benefits-title">{RESERVATION_PROMO_LABELS.benefitsTitle}</h2>
        </div>
        <ul>
          {RESERVATION_PROMO_LABELS.benefits.map((benefit) => <li key={benefit}><CheckCircle2 size={18} aria-hidden="true" />{benefit}</li>)}
        </ul>
      </section>

      <section className="reserve-promo__closing" aria-labelledby="reserve-closing-title">
        <div>
          <span className="eyebrow">{RESERVATION_PROMO_LABELS.closingEyebrow}</span>
          <h2 id="reserve-closing-title">{RESERVATION_PROMO_LABELS.closingTitle}</h2>
        </div>
        <Link to={signupHref} className="btn btn--primary btn--lg">{RESERVATION_PROMO_LABELS.primaryAction}<ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
