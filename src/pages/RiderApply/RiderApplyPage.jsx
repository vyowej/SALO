import { useState } from 'react';
import { Check, ClipboardList } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import {
  RIDER_APPLICATION_CONSTRAINTS,
  RIDER_APPLICATION_LABELS,
} from '../../constants/riderApplication';
import { riderApplicationVehicles } from '../../mock/riderApplicationData';
import '../Page.css';
import './RiderApplyPage.css';

const initialApplication = {
  fullName: '',
  email: '',
  phone: '',
  city: '',
  vehicle: '',
  availability: '',
  motivation: '',
};

function validateApplication(application) {
  const errors = {};
  const cleanEmail = application.email.trim();
  const phoneDigits = application.phone.replace(/\D/g, '');

  if (!application.fullName.trim()) errors.fullName = RIDER_APPLICATION_LABELS.nameRequired;
  if (!cleanEmail) {
    errors.email = RIDER_APPLICATION_LABELS.emailRequired;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    errors.email = RIDER_APPLICATION_LABELS.emailInvalid;
  }
  if (!application.phone.trim()) {
    errors.phone = RIDER_APPLICATION_LABELS.phoneRequired;
  } else if (
    phoneDigits.length < RIDER_APPLICATION_CONSTRAINTS.phoneMinDigits
    || phoneDigits.length > RIDER_APPLICATION_CONSTRAINTS.phoneMaxDigits
  ) {
    errors.phone = RIDER_APPLICATION_LABELS.phoneInvalid;
  }
  if (!application.city.trim()) errors.city = RIDER_APPLICATION_LABELS.cityRequired;
  if (!application.vehicle) errors.vehicle = RIDER_APPLICATION_LABELS.vehicleRequired;
  if (!application.availability.trim()) errors.availability = RIDER_APPLICATION_LABELS.availabilityRequired;
  if (application.motivation.length > RIDER_APPLICATION_CONSTRAINTS.motivationMaxLength) {
    errors.motivation = RIDER_APPLICATION_LABELS.motivationTooLong;
  }

  return errors;
}

export default function RiderApplyPage() {
  const [application, setApplication] = useState(initialApplication);
  const [errors, setErrors] = useState({});
  const [showPreview, setShowPreview] = useState(false);

  const updateApplication = (field) => (event) => {
    const { value } = event.target;
    setApplication((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submitApplication = (event) => {
    event.preventDefault();
    const nextErrors = validateApplication(application);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    setShowPreview(true);
  };

  const resetApplication = () => {
    setApplication(initialApplication);
    setErrors({});
    setShowPreview(false);
  };

  const selectedVehicle = riderApplicationVehicles.find((vehicle) => vehicle.value === application.vehicle);

  return (
    <div className="section-shell application-shell rider-application">
      <div className="page-header">
        <div>
          <h1>{RIDER_APPLICATION_LABELS.pageTitle}</h1>
          <p>{RIDER_APPLICATION_LABELS.pageDescription}</p>
        </div>
      </div>

      <div className="partner-layout">
        <section className="info-card application-card" aria-labelledby="rider-benefits-title">
          <h2 id="rider-benefits-title">{RIDER_APPLICATION_LABELS.benefitsTitle}</h2>
          <ul className="list-plain">
            {RIDER_APPLICATION_LABELS.perks.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>

          <div className="feature-stack">
            {RIDER_APPLICATION_LABELS.featureChips.map((feature) => (
              <span className="feature-pill" key={feature}>{feature}</span>
            ))}
          </div>
        </section>

        <section className="summary-card application-card" aria-labelledby="rider-application-title">
          {showPreview ? (
            <div className="rider-application__preview" aria-live="polite">
              <span className="rider-application__preview-icon"><Check size={23} aria-hidden="true" /></span>
              <span className="eyebrow">{RIDER_APPLICATION_LABELS.previewEyebrow}</span>
              <h2 id="rider-application-title">{RIDER_APPLICATION_LABELS.previewTitle}</h2>
              <p className="rider-application__preview-note">{RIDER_APPLICATION_LABELS.previewDescription}</p>
              <dl className="rider-application__summary">
                <div><dt>{RIDER_APPLICATION_LABELS.previewName}</dt><dd>{application.fullName.trim()}</dd></div>
                <div><dt>{RIDER_APPLICATION_LABELS.previewEmail}</dt><dd>{application.email.trim()}</dd></div>
                <div><dt>{RIDER_APPLICATION_LABELS.previewPhone}</dt><dd>{application.phone.trim()}</dd></div>
                <div><dt>{RIDER_APPLICATION_LABELS.previewCity}</dt><dd>{application.city.trim()}</dd></div>
                <div><dt>{RIDER_APPLICATION_LABELS.previewVehicle}</dt><dd>{selectedVehicle?.label}</dd></div>
                <div><dt>{RIDER_APPLICATION_LABELS.previewAvailability}</dt><dd>{application.availability.trim()}</dd></div>
                <div><dt>{RIDER_APPLICATION_LABELS.previewMotivation}</dt><dd>{application.motivation.trim() || RIDER_APPLICATION_LABELS.previewEmpty}</dd></div>
              </dl>
              <div className="rider-application__preview-actions">
                <Button variant="ghost" onClick={() => setShowPreview(false)}>{RIDER_APPLICATION_LABELS.edit}</Button>
                <Button variant="primary" onClick={resetApplication}>{RIDER_APPLICATION_LABELS.startOver}</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="rider-application__form-heading">
                <ClipboardList size={20} aria-hidden="true" />
                <div>
                  <h2 id="rider-application-title">{RIDER_APPLICATION_LABELS.formTitle}</h2>
                  <p>{RIDER_APPLICATION_LABELS.formDescription}</p>
                </div>
              </div>
              <p className="rider-application__privacy-note">{RIDER_APPLICATION_LABELS.privacyNote}</p>
              <form className="checkout-form" noValidate onSubmit={submitApplication}>
                {Object.keys(errors).length ? (
                  <p className="form-error" role="alert">{RIDER_APPLICATION_LABELS.validationSummary}</p>
                ) : null}
                <div className="rider-application__fields">
                  <Input
                    id="fullName"
                    label={RIDER_APPLICATION_LABELS.fullName}
                    autoComplete="name"
                    maxLength={RIDER_APPLICATION_CONSTRAINTS.nameMaxLength}
                    value={application.fullName}
                    onChange={updateApplication('fullName')}
                    error={errors.fullName}
                    placeholder={RIDER_APPLICATION_LABELS.fullNamePlaceholder}
                    required
                  />
                  <Input
                    id="email"
                    label={RIDER_APPLICATION_LABELS.email}
                    type="email"
                    autoComplete="email"
                    maxLength={RIDER_APPLICATION_CONSTRAINTS.emailMaxLength}
                    value={application.email}
                    onChange={updateApplication('email')}
                    error={errors.email}
                    placeholder={RIDER_APPLICATION_LABELS.emailPlaceholder}
                    required
                  />
                  <Input
                    id="phone"
                    label={RIDER_APPLICATION_LABELS.phone}
                    type="tel"
                    autoComplete="tel"
                    maxLength={RIDER_APPLICATION_CONSTRAINTS.phoneMaxLength}
                    value={application.phone}
                    onChange={updateApplication('phone')}
                    error={errors.phone}
                    placeholder={RIDER_APPLICATION_LABELS.phonePlaceholder}
                    required
                  />
                  <Input
                    id="city"
                    label={RIDER_APPLICATION_LABELS.city}
                    autoComplete="address-level2"
                    maxLength={RIDER_APPLICATION_CONSTRAINTS.cityMaxLength}
                    value={application.city}
                    onChange={updateApplication('city')}
                    error={errors.city}
                    placeholder={RIDER_APPLICATION_LABELS.cityPlaceholder}
                    required
                  />
                  <Select
                    id="vehicle"
                    label={RIDER_APPLICATION_LABELS.vehicle}
                    value={application.vehicle}
                    onChange={updateApplication('vehicle')}
                    error={errors.vehicle}
                    required
                  >
                    <option value="">{RIDER_APPLICATION_LABELS.vehiclePlaceholder}</option>
                    {riderApplicationVehicles.map((vehicle) => (
                      <option key={vehicle.value} value={vehicle.value}>{vehicle.label}</option>
                    ))}
                  </Select>
                  <Input
                    id="availability"
                    label={RIDER_APPLICATION_LABELS.availability}
                    maxLength={RIDER_APPLICATION_CONSTRAINTS.availabilityMaxLength}
                    value={application.availability}
                    onChange={updateApplication('availability')}
                    error={errors.availability}
                    placeholder={RIDER_APPLICATION_LABELS.availabilityPlaceholder}
                    required
                  />
                </div>
                <Textarea
                  id="motivation"
                  label={RIDER_APPLICATION_LABELS.motivation}
                  hint={RIDER_APPLICATION_LABELS.motivationHint}
                  maxLength={RIDER_APPLICATION_CONSTRAINTS.motivationMaxLength}
                  rows={4}
                  value={application.motivation}
                  onChange={updateApplication('motivation')}
                  error={errors.motivation}
                  placeholder={RIDER_APPLICATION_LABELS.motivationPlaceholder}
                />
                <Button variant="primary" size="lg" type="submit">{RIDER_APPLICATION_LABELS.submit}</Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
