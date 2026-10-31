import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapView } from '../../components/location/MapView';
import { Button } from '../../components/ui/Button';
import { useAuth, USER_ROLES } from '../../context/AuthContext';
import { locationService } from '../../services/locationService';
import { restaurantApplicationService } from '../../services/restaurantApplicationService';
import { config } from '../../config';
import '../Page.css';
import './PartnerApplyPage.css';

const STEPS = ['About', 'Location and hours', 'Documents', 'Photos', 'Review and submit'];
const DAYS = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
];
const DOCUMENTS = [
  ['business_permit', "Business or mayor's permit"],
  ['dti_sec_registration', 'DTI or SEC registration'],
  ['owner_valid_id', "Owner's valid ID"],
];
const blankHours = () => Object.fromEntries(DAYS.map(([day]) => [day, []]));
const userIdFor = (user) => String(user?.id || '');
const emailIsVerified = (details) => (
  details?.business_email_verified === true
  && details.business_email_verified_email === details.business_email?.trim().toLowerCase()
);

function InlineAlert({ children, success = false }) {
  if (!children) return null;
  return <p className={success ? 'application-alert application-alert--success' : 'application-alert'} role={success ? 'status' : 'alert'}>{children}</p>;
}

function Field({ label, htmlFor, error, children }) {
  return (
    <div className="application-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="application-field__error">{error}</span> : null}
    </div>
  );
}

function ApplicationStatus({ application }) {
  const isApproved = application.status === 'approved';
  return (
    <section className="application-status-card" aria-live="polite">
      <span className={`application-status application-status--${application.status.replaceAll('_', '-')}`}>
        {application.status.replaceAll('_', ' ')}
      </span>
      <h2>{isApproved ? 'Your restaurant is approved' : 'Application received'}</h2>
      <p>
        {isApproved
          ? 'Your Business workspace is ready. The restaurant is approved but is not published yet.'
          : 'You can return to this page to check the review status and any notes from SALO.'}
      </p>
      {application.review_notes ? <div className="application-review-note"><strong>Review note</strong><p>{application.review_notes}</p></div> : null}
      {application.submitted_at ? <p className="application-muted">Submitted {new Date(application.submitted_at).toLocaleString()}</p> : null}
      {isApproved ? <Link className="btn btn--primary btn--md" to="/business">Open Business workspace</Link> : null}
    </section>
  );
}

export default function PartnerApplyPage() {
  const { user, isLoggedIn, authLoading, activeView, switchView, refreshUser } = useAuth();
  const userId = userIdFor(user);
  const [applicationState, setApplicationState] = useState({ userId: null, value: null });
  const application = applicationState.userId === userId ? applicationState.value : null;
  const [draft, setDraft] = useState({});
  const [step, setStep] = useState(0);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const loading = !authLoading
    && isLoggedIn
    && activeView === USER_ROLES.CUSTOMER
    && loadedUserId !== userId;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [locationError, setLocationError] = useState('');
  const [photoPreviews, setPhotoPreviews] = useState({});

  const loadApplication = useCallback(async () => {
    if (!userId || activeView !== USER_ROLES.CUSTOMER) return;
    try {
      const current = await restaurantApplicationService.getOrCreate(userId);
      setApplicationState({ userId, value: current });
      setDraft({ hours: blankHours(), ...(current.details || {}) });
      setStep(Math.min(STEPS.length - 1, Math.max(0, Number(current.details?.current_step) || 0)));
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load your restaurant application.');
    }
    setLoadedUserId(userId);
  }, [activeView, userId]);

  useEffect(() => {
    if (authLoading || !isLoggedIn || activeView !== USER_ROLES.CUSTOMER || !userId) return undefined;
    let active = true;
    restaurantApplicationService.getOrCreate(userId)
      .then((current) => {
        if (!active) return;
        setApplicationState({ userId, value: current });
        setDraft({ hours: blankHours(), ...(current.details || {}) });
        setStep(Math.min(STEPS.length - 1, Math.max(0, Number(current.details?.current_step) || 0)));
        setError('');
        setLoadedUserId(userId);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || 'Unable to load your restaurant application.');
        setLoadedUserId(userId);
      });
    return () => { active = false; };
  }, [activeView, authLoading, isLoggedIn, userId]);

  useEffect(() => {
    if (application?.status !== 'approved' || config.useMock) return;
    refreshUser().catch((refreshError) => setError(refreshError.message || 'Unable to refresh your Business access.'));
  }, [application?.status, refreshUser]);

  useEffect(() => {
    if (activeView !== USER_ROLES.CUSTOMER) return undefined;
    let active = true;
    locationService.getRegions()
      .then((items) => { if (active) setRegions(items); })
      .catch((loadError) => {
        if (active) setLocationError(loadError.message || 'Unable to load PSGC regions.');
      });
    return () => { active = false; };
  }, [activeView]);

  useEffect(() => {
    if (!draft.region_code) {
      return undefined;
    }
    let active = true;
    locationService.getProvinces(draft.region_code)
      .then((items) => { if (active) setProvinces(items); })
      .catch((loadError) => { if (active) setLocationError(loadError.message || 'Unable to load provinces.'); });
    return () => { active = false; };
  }, [draft.region_code]);

  useEffect(() => {
    const parentCode = draft.province_code || draft.region_code;
    if (!parentCode) {
      return undefined;
    }
    let active = true;
    locationService.getCities(parentCode)
      .then((items) => { if (active) setCities(items); })
      .catch((loadError) => { if (active) setLocationError(loadError.message || 'Unable to load cities.'); });
    return () => { active = false; };
  }, [draft.province_code, draft.region_code]);

  useEffect(() => {
    if (!draft.city_code) {
      return undefined;
    }
    let active = true;
    locationService.getBarangays(draft.city_code)
      .then((items) => { if (active) setBarangays(items); })
      .catch((loadError) => { if (active) setLocationError(loadError.message || 'Unable to load barangays.'); });
    return () => { active = false; };
  }, [draft.city_code]);

  useEffect(() => () => {
    Object.values(photoPreviews).forEach((url) => URL.revokeObjectURL(url));
  }, [photoPreviews]);

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: '' }));
    setError('');
  };

  const syncApplication = (next) => {
    setApplicationState({ userId, value: next });
    setDraft((current) => ({ ...current, ...(next.details || {}) }));
  };

  const saveDraft = async (updates = draft) => {
    if (!application) return null;
    const next = await restaurantApplicationService.update(userId, application.id, updates);
    syncApplication(next);
    return next;
  };

  const validateStep = () => {
    const errors = {};
    if (step === 0) {
      if (!draft.restaurant_name?.trim()) errors.restaurant_name = 'Enter the restaurant name.';
      if (!draft.category?.trim()) errors.category = 'Choose a category.';
      if (!draft.description?.trim()) errors.description = 'Add a short description.';
      if (!draft.contact_number?.trim()) errors.contact_number = 'Enter a contact number.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.business_email || '')) errors.business_email = 'Enter a valid business email.';
      if (draft.business_email && !emailIsVerified(draft)) errors.business_email = 'Verify this business email before continuing.';
    }
    if (step === 1) {
      if (!draft.barangay_code) errors.psgc_code = 'Select a region, city, and barangay.';
      if (!draft.street?.trim()) errors.street = 'Enter the street address.';
      if (!Number.isFinite(Number(draft.latitude)) || !Number.isFinite(Number(draft.longitude)) || !draft.pin_confirmed) {
        errors.pin = 'Set and confirm the restaurant pin on the map.';
      }
      if (!draft.is_24_7) {
        const openDays = Object.entries(draft.hours || {}).filter(([, shifts]) => shifts.length > 0);
        if (openDays.length < 5) errors.hours = 'Add hours for at least five days, or select Open 24/7.';
        openDays.forEach(([day, shifts]) => {
          const minutes = shifts.reduce((total, shift) => {
            const [openHour, openMinute] = (shift.open_time || '').split(':').map(Number);
            const [closeHour, closeMinute] = (shift.close_time || '').split(':').map(Number);
            if (![openHour, openMinute, closeHour, closeMinute].every(Number.isFinite)) return total;
            let duration = (closeHour * 60 + closeMinute) - (openHour * 60 + openMinute);
            if (shift.crosses_midnight) duration += 1440;
            return total + Math.max(0, duration);
          }, 0);
          if (minutes < 240) errors[`hours.${day}`] = 'Each open day must include at least four hours.';
        });
      }
    }
    if (step === 2) {
      const types = application?.documents?.map((document) => document.doc_type) || [];
      if (DOCUMENTS.some(([type]) => !types.includes(type))) errors.documents = 'Upload all three required documents.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const continueStep = async () => {
    setError('');
    setSuccess('');
    if (!validateStep()) return;
    setSaving(true);
    try {
      await saveDraft({ ...draft, current_step: step + 1 });
      setStep((current) => Math.min(STEPS.length - 1, current + 1));
      setSuccess('Draft saved.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this step.');
      setFieldErrors(saveError.fields || {});
    } finally {
      setSaving(false);
    }
  };

  const previousStep = () => {
    setError('');
    setSuccess('');
    setStep((current) => Math.max(0, current - 1));
  };

  const sendOtp = async () => {
    if (!draft.business_email?.trim()) {
      setFieldErrors((current) => ({ ...current, business_email: 'Enter the business email first.' }));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveDraft({ ...draft, business_email: draft.business_email.trim().toLowerCase() });
      await restaurantApplicationService.sendBusinessEmailOtp(userId, application.id);
      setOtpSent(true);
      setSuccess(config.useMock ? 'Mock code sent: use 123456.' : 'Verification code sent to the business email.');
    } catch (sendError) {
      setError(sendError.message || 'Unable to send a verification code.');
      setFieldErrors(sendError.fields || {});
    } finally {
      setSaving(false);
    }
  };

  const verifyOtp = async () => {
    setSaving(true);
    setError('');
    try {
      const next = await restaurantApplicationService.verifyBusinessEmail(userId, application.id, otp);
      syncApplication(next);
      setOtp('');
      setSuccess('Business email verified.');
    } catch (verifyError) {
      setError(verifyError.message || 'Unable to verify this business email.');
      setFieldErrors(verifyError.fields || {});
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (docType, file) => {
    setError('');
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFieldErrors((current) => ({ ...current, documents: 'Each document must be 2 MB or smaller.' }));
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setFieldErrors((current) => ({ ...current, documents: 'Use a PDF, JPG, PNG, or WebP document.' }));
      return;
    }
    const existing = application.documents?.find((document) => document.doc_type === docType);
    if (existing && !window.confirm('Replace this uploaded document?')) return;
    setSaving(true);
    try {
      const next = await restaurantApplicationService.uploadDocument(userId, application.id, docType, file);
      syncApplication(next);
      setFieldErrors((current) => ({ ...current, documents: '' }));
      setSuccess('Document uploaded.');
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload this document.');
      setFieldErrors(uploadError.fields || {});
    } finally {
      setSaving(false);
    }
  };

  const removeDocument = async (document) => {
    if (!window.confirm(`Remove ${document.doc_type.replaceAll('_', ' ')}?`)) return;
    setSaving(true);
    setError('');
    try {
      await restaurantApplicationService.removeDocument(userId, application.id, document.id);
      const next = await restaurantApplicationService.getMine(userId);
      syncApplication(next);
      setSuccess('Document removed.');
    } catch (removeError) {
      setError(removeError.message || 'Unable to remove this document.');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (kind, file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Photos must be 2 MB or smaller.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Upload a JPG, PNG, or WebP image.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const next = await restaurantApplicationService.uploadPhoto(userId, application.id, kind, file);
      syncApplication(next);
      setPhotoPreviews((current) => {
        if (current[kind]) URL.revokeObjectURL(current[kind]);
        return { ...current, [kind]: URL.createObjectURL(file) };
      });
      setSuccess(`${kind === 'logo' ? 'Logo' : 'Cover photo'} uploaded.`);
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload this photo.');
    } finally {
      setSaving(false);
    }
  };

  const setDayShifts = (day, shifts) => {
    updateDraft('hours', { ...blankHours(), ...(draft.hours || {}), [day]: shifts });
  };

  const selectLocation = (field, value) => {
    const resets = {
      region_code: { province_code: '', city_code: '', barangay_code: '', psgc_code: '' },
      province_code: { city_code: '', barangay_code: '', psgc_code: '' },
      city_code: { barangay_code: '', psgc_code: '' },
      barangay_code: { psgc_code: value },
    };
    if (field === 'region_code') {
      setProvinces([]);
      setCities([]);
      setBarangays([]);
    } else if (field === 'province_code') {
      setCities([]);
      setBarangays([]);
    } else if (field === 'city_code') {
      setBarangays([]);
    }
    setDraft((current) => ({ ...current, ...resets[field], [field]: value }));
    setFieldErrors((current) => ({ ...current, psgc_code: '' }));
  };

  const useCurrentLocation = async () => {
    const result = await locationService.getCurrentPosition();
    if (result.state !== 'granted') {
      setLocationError(result.state === 'denied' ? 'Location permission was denied. Adjust the pin manually.' : 'Current location is unavailable. Adjust the pin manually.');
      return;
    }
    updateDraft('latitude', result.position.latitude);
    updateDraft('longitude', result.position.longitude);
    updateDraft('pin_confirmed', true);
    setLocationError('');
  };

  const submitApplication = async () => {
    if (!validateStep()) return;
    setSaving(true);
    setError('');
    try {
      await saveDraft(draft);
      const submitted = await restaurantApplicationService.submit(userId, application.id, Boolean(draft.declared_bir_2303));
      syncApplication(submitted);
      setSuccess('Your application has been submitted.');
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit your application.');
      setFieldErrors(submitError.fields || {});
    } finally {
      setSaving(false);
    }
  };

  const pin = useMemo(() => ({
    latitude: Number(draft.latitude) || locationService.getDefaultMapCenter().latitude,
    longitude: Number(draft.longitude) || locationService.getDefaultMapCenter().longitude,
  }), [draft.latitude, draft.longitude]);

  if (authLoading || (isLoggedIn && activeView === USER_ROLES.CUSTOMER && loading)) {
    return <div className="section-shell"><div className="skeleton-card" role="status">Loading your application…</div></div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="section-shell">
        <section className="application-status-card">
          <h1>Partner with SALO</h1>
          <p>Sign in in Customer mode to start or resume your restaurant application.</p>
          <Link className="btn btn--primary btn--md" to="/login?returnTo=%2Fpartner%2Fapply">Sign in to continue</Link>
        </section>
      </div>
    );
  }

  if (activeView !== USER_ROLES.CUSTOMER) {
    return (
      <div className="section-shell">
        <section className="application-status-card">
          <h1>Partner with SALO</h1>
          <p>Restaurant applications start in Customer mode. Switch modes to continue.</p>
          <Button variant="primary" onClick={() => switchView(USER_ROLES.CUSTOMER).catch((switchError) => setError(switchError.message))}>
            Switch to Customer mode
          </Button>
          <InlineAlert>{error}</InlineAlert>
        </section>
      </div>
    );
  }

  if (error && !application) {
    return <div className="section-shell"><InlineAlert>{error}</InlineAlert><Button variant="secondary" onClick={() => { setLoadedUserId(null); setError(''); loadApplication(); }}>Try again</Button></div>;
  }

  if (!application) return null;
  if (!['draft', 'needs_revision'].includes(application.status)) {
    return <div className="section-shell"><ApplicationStatus application={application} /></div>;
  }

  return (
    <div className="section-shell application-shell">
      <div className="page-header">
        <div>
          <h1>Partner with SALO</h1>
          <p>Save your progress at each step. Your documents stay private and are only shared with authorized reviewers.</p>
        </div>
        <span className={`application-status application-status--${application.status.replaceAll('_', '-')}`}>
          {application.status.replaceAll('_', ' ')}
        </span>
      </div>

      <div className="application-layout">
        <aside className="application-steps" aria-label="Application steps">
          <ol>
            {STEPS.map((label, index) => (
              <li key={label} className={index === step ? 'is-current' : index < step ? 'is-complete' : ''}>
                <span>{index + 1}</span><strong>{label}</strong>
              </li>
            ))}
          </ol>
        </aside>

        <section className="application-card" aria-labelledby="application-step-title">
          {application.status === 'needs_revision' && application.review_notes ? (
            <div className="application-review-note"><strong>Requested changes</strong><p>{application.review_notes}</p></div>
          ) : null}
          <InlineAlert>{error}</InlineAlert>
          <InlineAlert success>{success}</InlineAlert>

          {step === 0 ? (
            <>
              <h2 id="application-step-title">About your restaurant</h2>
              <div className="application-form-grid">
                <Field label="Restaurant name" htmlFor="application-name" error={fieldErrors.restaurant_name}>
                  <input id="application-name" value={draft.restaurant_name || ''} maxLength="160" onChange={(event) => updateDraft('restaurant_name', event.target.value)} />
                </Field>
                <Field label="Category" htmlFor="application-category" error={fieldErrors.category}>
                  <input id="application-category" value={draft.category || ''} placeholder="e.g. Café, Bakery, Filipino" maxLength="60" onChange={(event) => updateDraft('category', event.target.value)} />
                </Field>
                <Field label="Cuisine" htmlFor="application-cuisine">
                  <input id="application-cuisine" value={draft.cuisine || ''} maxLength="100" onChange={(event) => updateDraft('cuisine', event.target.value)} />
                </Field>
                <Field label="Contact number" htmlFor="application-contact" error={fieldErrors.contact_number}>
                  <input id="application-contact" type="tel" value={draft.contact_number || ''} maxLength="40" onChange={(event) => updateDraft('contact_number', event.target.value)} />
                </Field>
                <Field label="Business email" htmlFor="application-email" error={fieldErrors.business_email}>
                  <input id="application-email" type="email" value={draft.business_email || ''} maxLength="254" onChange={(event) => {
                    updateDraft('business_email', event.target.value);
                    setDraft((current) => ({ ...current, business_email_verified: false }));
                    setOtpSent(false);
                  }} />
                </Field>
                <div className="application-otp">
                  {emailIsVerified(draft)
                    ? <InlineAlert success>Business email verified.</InlineAlert>
                    : (
                      <>
                        <Button variant="secondary" size="sm" disabled={saving || !draft.business_email} onClick={sendOtp}>
                          {otpSent ? 'Resend code' : 'Send verification code'}
                        </Button>
                        {otpSent ? (
                          <div className="application-otp__verify">
                            <label htmlFor="business-email-code">Six-digit code</label>
                            <input id="business-email-code" inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                            <Button variant="secondary" size="sm" disabled={saving || otp.length !== 6} onClick={verifyOtp}>Verify email</Button>
                          </div>
                        ) : null}
                      </>
                    )}
                </div>
                <Field label="Short description" htmlFor="application-description" error={fieldErrors.description}>
                  <textarea id="application-description" rows="4" maxLength="2000" value={draft.description || ''} onChange={(event) => updateDraft('description', event.target.value)} />
                </Field>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h2 id="application-step-title">Location and hours</h2>
              <div className="application-form-grid">
                <Field label="Region" htmlFor="application-region">
                  <select id="application-region" value={draft.region_code || ''} onChange={(event) => selectLocation('region_code', event.target.value)}>
                    <option value="">Select a region</option>
                    {regions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Province" htmlFor="application-province">
                  <select id="application-province" value={draft.province_code || ''} onChange={(event) => selectLocation('province_code', event.target.value)} disabled={!draft.region_code || provinces.length === 0}>
                    <option value="">Select a province (if applicable)</option>
                    {provinces.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="City or municipality" htmlFor="application-city" error={fieldErrors.psgc_code}>
                  <select id="application-city" value={draft.city_code || ''} onChange={(event) => selectLocation('city_code', event.target.value)} disabled={!draft.region_code}>
                    <option value="">Select a city or municipality</option>
                    {cities.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Barangay" htmlFor="application-barangay" error={fieldErrors.psgc_code}>
                  <select id="application-barangay" value={draft.barangay_code || ''} onChange={(event) => selectLocation('barangay_code', event.target.value)} disabled={!draft.city_code}>
                    <option value="">Select a barangay</option>
                    {barangays.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Street address" htmlFor="application-street" error={fieldErrors.street}>
                  <input id="application-street" value={draft.street || ''} maxLength="255" onChange={(event) => updateDraft('street', event.target.value)} />
                </Field>
              </div>
              <InlineAlert>{locationError}</InlineAlert>
              <div className="application-map-heading">
                <div><h3>Restaurant pin</h3><p>Click or drag the pin to set the restaurant location.</p></div>
                <Button variant="secondary" size="sm" onClick={useCurrentLocation}>Use my location</Button>
              </div>
              <MapView
                pin={pin}
                onPinChange={(coordinates) => setDraft((current) => ({
                  ...current,
                  ...coordinates,
                  pin_confirmed: true,
                }))}
              />
              {fieldErrors.pin ? <span className="application-field__error">{fieldErrors.pin}</span> : null}
              <label className="application-check">
                <input type="checkbox" checked={Boolean(draft.is_24_7)} onChange={(event) => updateDraft('is_24_7', event.target.checked)} />
                <span>Open 24/7</span>
              </label>
              {!draft.is_24_7 ? (
                <div className="application-hours">
                  <h3>Weekly operating hours</h3>
                  <p>At least five days per week and four hours each open day. Mark overnight shifts when closing after midnight.</p>
                  {DAYS.map(([day, label]) => {
                    const shifts = draft.hours?.[day] || [];
                    return (
                      <div className="application-hours__day" key={day}>
                        <strong>{label}</strong>
                        <div className="application-hours__shifts">
                          {shifts.map((shift, index) => (
                            <div className="application-hours__shift" key={`${day}-${index}`}>
                              <label>
                                <span>Opens</span>
                                <input type="time" value={shift.open_time || ''} onChange={(event) => setDayShifts(day, shifts.map((item, current) => current === index ? { ...item, open_time: event.target.value } : item))} />
                              </label>
                              <label>
                                <span>Closes</span>
                                <input type="time" value={shift.close_time || ''} onChange={(event) => setDayShifts(day, shifts.map((item, current) => current === index ? { ...item, close_time: event.target.value } : item))} />
                              </label>
                              <label className="application-hours__overnight">
                                <input type="checkbox" checked={Boolean(shift.crosses_midnight)} onChange={(event) => setDayShifts(day, shifts.map((item, current) => current === index ? { ...item, crosses_midnight: event.target.checked } : item))} />
                                <span>Overnight</span>
                              </label>
                              <Button variant="ghost" size="sm" aria-label={`Remove ${label} shift ${index + 1}`} onClick={() => setDayShifts(day, shifts.filter((_, current) => current !== index))}>Remove</Button>
                            </div>
                          ))}
                          <Button variant="secondary" size="sm" onClick={() => setDayShifts(day, [...shifts, { open_time: '09:00', close_time: '17:00', crosses_midnight: false }])}>Add shift</Button>
                        </div>
                      </div>
                    );
                  })}
                  {fieldErrors.hours ? <span className="application-field__error">{fieldErrors.hours}</span> : null}
                  {Object.entries(fieldErrors).filter(([key]) => key.startsWith('hours.')).map(([key, value]) => <span className="application-field__error" key={key}>{value}</span>)}
                </div>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2 id="application-step-title">Required documents</h2>
              <p className="application-muted">PDF, JPG, PNG, or WebP; maximum 2 MB per file. SALO checks actual file content when uploaded.</p>
              <div className="application-documents">
                {DOCUMENTS.map(([type, label]) => {
                  const document = application.documents?.find((item) => item.doc_type === type);
                  return (
                    <div className="application-document" key={type}>
                      <div><strong>{label}</strong><span>{document ? 'Uploaded and stored privately' : 'Required'}</span></div>
                      {document ? <Button variant="ghost" size="sm" disabled={saving} onClick={() => removeDocument(document)}>Remove</Button> : null}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => {
                        uploadDocument(type, event.target.files?.[0]);
                        event.target.value = '';
                      }} />
                    </div>
                  );
                })}
              </div>
              {fieldErrors.documents ? <span className="application-field__error">{fieldErrors.documents}</span> : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h2 id="application-step-title">Restaurant photos</h2>
              <p className="application-muted">Add a logo and cover photo. These are public if your restaurant is later published.</p>
              <div className="application-photo-grid">
                {['logo', 'cover'].map((kind) => {
                  const preview = photoPreviews[kind] || application.photos?.[`${kind}_url`];
                  return (
                    <label className="application-photo" key={kind}>
                      <span>{kind === 'logo' ? 'Logo' : 'Cover photo'}</span>
                      {preview ? <img src={preview} alt={`${kind} preview`} /> : <span className="application-photo__empty">No photo selected</span>}
                      {draft[`${kind}_name`] ? <small>{draft[`${kind}_name`]}</small> : null}
                      <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => {
                        uploadPhoto(kind, event.target.files?.[0]);
                        event.target.value = '';
                      }} />
                    </label>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h2 id="application-step-title">Review and submit</h2>
              <dl className="application-review">
                <div><dt>Restaurant</dt><dd>{draft.restaurant_name}</dd></div>
                <div><dt>Category and cuisine</dt><dd>{[draft.category, draft.cuisine].filter(Boolean).join(' · ')}</dd></div>
                <div><dt>Business email</dt><dd>{draft.business_email} {emailIsVerified(draft) ? '(verified)' : '(not verified)'}</dd></div>
                <div><dt>Location</dt><dd>{[draft.street, barangays.find((item) => item.code === draft.barangay_code)?.name, cities.find((item) => item.code === draft.city_code)?.name].filter(Boolean).join(', ')}</dd></div>
                <div><dt>Operating hours</dt><dd>{draft.is_24_7 ? 'Open 24/7' : `${Object.values(draft.hours || {}).filter((shifts) => shifts.length > 0).length} days with hours`}</dd></div>
                <div><dt>Documents</dt><dd>{application.documents?.length || 0} uploaded</dd></div>
              </dl>
              <label className="application-check">
                <input type="checkbox" checked={Boolean(draft.declared_bir_2303)} onChange={(event) => updateDraft('declared_bir_2303', event.target.checked)} />
                <span>I confirm my BIR 2303 status as a self-declaration.</span>
              </label>
              <p className="application-muted">By submitting, you confirm that the information is accurate. An approved restaurant remains unpublished until its Owner completes setup and chooses to publish.</p>
            </>
          ) : null}

          <div className="application-actions">
            {step > 0 ? <Button variant="secondary" disabled={saving} onClick={previousStep}>Back</Button> : null}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" disabled={saving} onClick={continueStep}>{saving ? 'Saving…' : 'Save and continue'}</Button>
            ) : (
              <Button variant="primary" disabled={saving || !draft.declared_bir_2303} onClick={submitApplication}>
                {saving ? 'Submitting…' : 'Submit application'}
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
