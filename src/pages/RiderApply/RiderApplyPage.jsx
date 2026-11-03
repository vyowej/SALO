import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { config } from '../../config';
import { RIDER_APPLICATION_VEHICLES } from '../../constants/riderApplication';
import { riderApplicationService } from '../../services/riderApplicationService';
import { prepareRiderImage } from '../../utils/prepareRiderImage';
import '../Page.css';
import './RiderApplyPage.css';

const AddressForm = lazy(() => import('../../components/location/AddressForm'));
const STEPS = ['Vehicle', 'About you', 'Home location', 'Photos and documents', 'Payout and terms', 'Review'];
const PHOTO_TYPES = ['profile_photo', 'id_photo'];
const DOCUMENT_TYPES = [
  { key: 'profile_photo', title: 'Profile photo', description: 'A clear, recent face photo. This stays private.', image: true },
  { key: 'id_photo', title: 'Valid ID photo', description: 'A readable photo of a valid government-issued ID.', image: true },
  { key: 'drivers_license', title: 'Professional driver’s license', description: 'Motorcycle riders only. JPG, PNG, WebP, or PDF.', image: false },
  { key: 'or_cr', title: 'OR/CR', description: 'Motorcycle riders only. JPG, PNG, WebP, or PDF.', image: false },
];

const emptyAddress = {
  country_code: 'PH',
  label: 'Home',
  address_type: 'home',
  region: '',
  region_code: '',
  province: '',
  province_code: '',
  city_municipality: '',
  city_code: '',
  barangay: '',
  psgc_code: '',
  psgc_full_name: '',
  street: '',
  house_no: '',
  latitude: null,
  longitude: null,
};

const emptyForm = {
  vehicle_type: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix: '',
  birthday: '',
  mobile: '',
  preferred_shift_ids: [],
  address: emptyAddress,
  plate_number: '',
  ewallet_account_name: '',
  declared_clearance_tin: false,
};

const ageLimit = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

function formFromProfile(profile) {
  const applicant = profile.applicant || {};
  const address = profile.address || {};
  return {
    vehicle_type: profile.vehicle_type || '',
    first_name: applicant.first_name || '',
    middle_name: applicant.middle_name || '',
    last_name: applicant.last_name || '',
    suffix: applicant.suffix || '',
    birthday: applicant.birthday || '',
    mobile: applicant.mobile || '',
    preferred_shift_ids: (profile.preferred_shifts || []).map((shift) => String(shift.id)),
    address: {
      ...emptyAddress,
      country_code: address.country_code || 'PH',
      psgc_code: address.psgc_code || '',
      psgc_full_name: address.psgc_full_name || '',
      region: address.region || '',
      region_code: address.region_code || '',
      province: address.province || '',
      province_code: address.province_code || '',
      city_municipality: address.city_municipality || '',
      city_code: address.city_code || '',
      barangay: address.barangay || '',
      street: address.street || '',
      house_no: address.house_no || '',
      latitude: address.latitude === null ? null : Number(address.latitude),
      longitude: address.longitude === null ? null : Number(address.longitude),
    },
    plate_number: profile.plate_number || '',
    ewallet_account_name: profile.ewallet_account_name || '',
    declared_clearance_tin: Boolean(profile.declared_clearance_tin),
  };
}

function resumeStep(profile, form) {
  if (!form.vehicle_type) return 0;
  if (!form.first_name || !form.last_name || !form.birthday || !form.mobile || !form.preferred_shift_ids.length) return 1;
  if (!form.address.psgc_code || !form.address.street) return 2;
  const requiredDocuments = ['profile_photo', 'id_photo'];
  if (form.vehicle_type === 'motorcycle') requiredDocuments.push('drivers_license', 'or_cr');
  if (form.vehicle_type === 'motorcycle' && !form.plate_number) return 3;
  if (requiredDocuments.some((type) => !(profile.documents || []).some((document) => document.doc_type === type))) return 3;
  if (!form.ewallet_account_name || !form.declared_clearance_tin) return 4;
  return 4;
}

function firstError(fields) {
  if (!fields || typeof fields !== 'object') return {};
  return Object.fromEntries(Object.entries(fields).map(([key, messages]) => [
    key,
    Array.isArray(messages) ? messages[0] : String(messages),
  ]));
}

function statusTitle(profile) {
  if (profile.status === 'active') return 'Rider account activated';
  if (profile.status === 'pending_activation') return 'Application approved';
  return {
    submitted: 'Application submitted',
    under_review: 'Application under review',
    approved: 'Application approved',
    rejected: 'Application rejected',
  }[profile.application_status] || 'Rider application';
}

export default function RiderApplyPage() {
  const { isLoggedIn } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [previews, setPreviews] = useState({});
  const [savedFileLinks, setSavedFileLinks] = useState({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [localCopyCode, setLocalCopyCode] = useState('');
  const [activationMessage, setActivationMessage] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [clock, setClock] = useState(Date.now());
  const previewUrls = useRef(new Map());

  const copyLocalActivationCode = async () => {
    try {
      await navigator.clipboard.writeText(localCopyCode);
      setActivationMessage('The local development code was copied.');
    } catch (clipboardError) {
      console.error('Unable to copy the local rider activation code.', clipboardError);
      setActivationMessage('Copy is unavailable in this browser. You can select the code shown here.');
    }
  };

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return undefined;
    }
    if (config.useMock) {
      setError('Rider applications require API mode. Disable mock mode for this feature.');
      setLoading(false);
      return undefined;
    }

    let active = true;
    riderApplicationService.startOrResume()
      .then((application) => {
        if (!active) return;
        setProfile(application);
        setResendAvailableAt(application.approved_at
          ? new Date(application.approved_at).getTime() + 60_000
          : 0);
        const draft = formFromProfile(application);
        setForm(draft);
        setStep(resumeStep(application, draft));
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.status === 403
          ? 'Switch to Customer mode before starting a rider application.'
          : requestError.message || 'The rider application could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [isLoggedIn]);

  const selectedShifts = useMemo(() => new Set(form.preferred_shift_ids), [form.preferred_shift_ids]);
  const documentsByType = useMemo(
    () => new Map((profile?.documents || []).map((document) => [document.doc_type, document])),
    [profile?.documents],
  );
  const isMotorcycle = form.vehicle_type === 'motorcycle';
  const isEditable = profile && ['draft', 'needs_revision'].includes(profile.application_status);
  const visibleDocuments = DOCUMENT_TYPES.filter(({ key }) => !['drivers_license', 'or_cr'].includes(key) || isMotorcycle);
  const secondsUntilResend = Math.max(0, Math.ceil((resendAvailableAt - clock) / 1000));

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const saveProfile = (updated) => {
    setProfile(updated);
    setForm(formFromProfile(updated));
  };

  const payloadForStep = () => {
    if (step === 0) return { vehicle_type: form.vehicle_type };
    if (step === 1) {
      return {
        first_name: form.first_name,
        middle_name: form.middle_name,
        last_name: form.last_name,
        suffix: form.suffix,
        birthday: form.birthday,
        mobile: form.mobile,
        preferred_shift_ids: form.preferred_shift_ids,
      };
    }
    if (step === 2) {
      return {
        psgc_code: form.address.psgc_code,
        street: form.address.street,
        house_no: form.address.house_no,
        home_lat: form.address.latitude,
        home_lng: form.address.longitude,
      };
    }
    if (step === 3) return { plate_number: isMotorcycle ? form.plate_number : null };
    if (step === 4) {
      return {
        ewallet_account_name: form.ewallet_account_name,
        declared_clearance_tin: form.declared_clearance_tin,
      };
    }
    return {};
  };

  const validateStep = () => {
    const next = {};
    if (step === 0 && !form.vehicle_type) next.vehicle_type = 'Choose a vehicle type.';
    if (step === 1) {
      if (!form.first_name.trim()) next.first_name = 'Enter your first name.';
      if (!form.last_name.trim()) next.last_name = 'Enter your last name.';
      if (!form.birthday) next.birthday = 'Enter your birthday.';
      else if (form.birthday > ageLimit()) next.birthday = 'You must be at least 18 years old.';
      if (!form.mobile.trim()) next.mobile = 'Enter your phone number.';
      if (!form.preferred_shift_ids.length) next.preferred_shift_ids = 'Choose at least one preferred shift.';
    }
    if (step === 2) {
      if (!form.address.psgc_code) next.psgc_code = 'Choose a barangay from the location search.';
      if (!form.address.street.trim()) next.street = 'Enter your street or house location.';
    }
    if (step === 3) {
      if (isMotorcycle && !form.plate_number.trim()) next.plate_number = 'Enter the motorcycle plate number.';
      for (const key of visibleDocuments.map((document) => document.key)) {
        if (!documentsByType.has(key)) next[key] = 'Upload this file before continuing.';
      }
    }
    if (step === 4) {
      if (!form.ewallet_account_name.trim()) next.ewallet_account_name = 'Enter the account holder name.';
      if (!form.declared_clearance_tin) next.declared_clearance_tin = 'Confirm that you have a valid clearance and TIN.';
      if (!termsAccepted) next.terms_accepted = 'Accept the rider terms to continue.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const continueStep = async () => {
    setError('');
    if (!validateStep() || !profile) return;
    setBusy(true);
    try {
      const updated = await riderApplicationService.updateDraft(profile.id, payloadForStep());
      saveProfile(updated);
      setStep((current) => Math.min(STEPS.length - 1, current + 1));
    } catch (requestError) {
      setFieldErrors(firstError(requestError.fields));
      setError(requestError.message || 'Your draft could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    setError('');
    setFieldErrors({});
    setStep((current) => Math.max(0, current - 1));
  };

  const changeAddress = (address) => {
    setForm((current) => ({
      ...current,
      address: {
        ...current.address,
        ...address,
        country_code: 'PH',
      },
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.psgc_code;
      delete next.street;
      return next;
    });
  };

  const uploadDocument = async (docType, file) => {
    if (!file || !profile) return;
    setUploadErrors((current) => ({ ...current, [docType]: '' }));
    setError('');
    let uploadFile = file;
    try {
      if (file.type === 'application/pdf') {
        if (!['drivers_license', 'or_cr'].includes(docType)) {
          throw new Error('Photos must be JPG, PNG, or WebP images.');
        }
        if (file.size > 2 * 1024 * 1024) throw new Error('Files must be no larger than 2 MB.');
      } else {
        uploadFile = await prepareRiderImage(file);
      }
      if (uploadFile.type.startsWith('image/')) {
        const objectUrl = URL.createObjectURL(uploadFile);
        const previous = previewUrls.current.get(docType);
        if (previous) URL.revokeObjectURL(previous);
        previewUrls.current.set(docType, objectUrl);
        setPreviews((current) => ({ ...current, [docType]: objectUrl }));
      }
      setUploadProgress((current) => ({ ...current, [docType]: 0 }));
      const updated = await riderApplicationService.uploadDocument(
        profile.id,
        docType,
        uploadFile,
        (progress) => setUploadProgress((current) => ({ ...current, [docType]: progress })),
      );
      setProfile(updated);
      setUploadProgress((current) => ({ ...current, [docType]: 100 }));
    } catch (uploadError) {
      setUploadErrors((current) => ({ ...current, [docType]: uploadError.message || 'The file could not be uploaded.' }));
    }
  };

  const removeDocument = async (docType) => {
    const document = documentsByType.get(docType);
    if (!document || !profile) return;
    setBusy(true);
    setUploadErrors((current) => ({ ...current, [docType]: '' }));
    try {
      await riderApplicationService.deleteDocument(profile.id, document.id);
      setProfile((current) => ({
        ...current,
        documents: current.documents.filter((item) => item.id !== document.id),
      }));
      setSavedFileLinks((current) => {
        const next = { ...current };
        delete next[document.id];
        return next;
      });
    } catch (requestError) {
      setUploadErrors((current) => ({ ...current, [docType]: requestError.message || 'The file could not be removed.' }));
    } finally {
      setBusy(false);
    }
  };

  const openSavedDocument = async (document) => {
    try {
      const { url } = await riderApplicationService.getApplicantDocumentUrl(profile.id, document.id);
      setSavedFileLinks((current) => ({ ...current, [document.id]: url }));
    } catch (requestError) {
      setError(requestError.message || 'The private file link could not be created.');
    }
  };

  const submitApplication = async () => {
    setError('');
    setFieldErrors({});
    setBusy(true);
    try {
      const updated = await riderApplicationService.submit(profile.id);
      saveProfile(updated);
    } catch (requestError) {
      setFieldErrors(firstError(requestError.fields));
      setError(requestError.message || 'The application could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  const requestActivationCode = async () => {
    setBusy(true);
    setActivationMessage('');
    setLocalCopyCode('');
    try {
      const result = await riderApplicationService.sendActivationOtp(profile.id);
      setActivationMessage(result.message);
      setLocalCopyCode(result.local_copy_code || '');
      setResendAvailableAt(Date.now() + 60_000);
    } catch (requestError) {
      setActivationMessage(requestError.message || 'The activation code could not be sent.');
      if (requestError.status === 422) setResendAvailableAt(Date.now() + 60_000);
    } finally {
      setBusy(false);
    }
  };

  const verifyActivationCode = async () => {
    setBusy(true);
    setActivationMessage('');
    try {
      const updated = await riderApplicationService.verifyActivation(profile.id, activationCode);
      saveProfile(updated);
      setActivationCode('');
    } catch (requestError) {
      setActivationMessage(requestError.message || 'The activation code is invalid or expired.');
    } finally {
      setBusy(false);
    }
  };

  const setShiftSelected = (shiftId, checked) => {
    const next = checked
      ? [...new Set([...form.preferred_shift_ids, String(shiftId)])]
      : form.preferred_shift_ids.filter((id) => id !== String(shiftId));
    updateForm('preferred_shift_ids', next);
  };

  if (loading) {
    return <main className="section-shell rider-application"><div className="skeleton-card" role="status" aria-label="Loading rider application" /></main>;
  }

  if (!isLoggedIn) {
    return (
      <main className="section-shell rider-application">
        <EmptyState title="Sign in to apply" description="Your rider application is saved to your SALO account, so you can continue on another visit." />
        <Link className="rider-application__sign-in" to="/login?returnTo=%2Frider%2Fapply">Sign in to continue</Link>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="section-shell rider-application">
        <Card className="rider-application__message-card">
          <h1>Rider application unavailable</h1>
          <p role="alert">{error || 'The application could not be loaded.'}</p>
          {error.includes('Business') || error.includes('Customer mode') ? <p>Switch to Customer mode and try again.</p> : null}
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </Card>
      </main>
    );
  }

  if (profile.status === 'pending_activation') {
    return (
      <main className="section-shell rider-application rider-application--status">
        {!online ? <p className="rider-application__offline" role="status">You’re offline. Check your connection before verifying your code.</p> : null}
        <Card className="rider-application__status-card">
          <CheckCircle2 className="rider-application__status-icon" aria-hidden="true" />
          <p className="rider-application__eyebrow">Approved</p>
          <h1>{statusTitle(profile)}</h1>
          <p>Your application is approved. Verify the six-digit code sent to <strong>{profile.applicant.email}</strong> to activate Driver mode.</p>
          <div className="rider-application__activation">
            <Input
              id="rider-activation-code"
              label="Activation code"
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="done"
              maxLength={6}
              value={activationCode}
              onChange={(event) => setActivationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              error={fieldErrors.code}
            />
            <Button onClick={verifyActivationCode} disabled={busy || activationCode.length !== 6}>Verify code</Button>
          </div>
          <div className="rider-application__activation-resend">
            <Button variant="ghost" onClick={requestActivationCode} disabled={busy || secondsUntilResend > 0}>
              {secondsUntilResend > 0 ? `Resend code in ${secondsUntilResend}s` : 'Send a new code'}
            </Button>
          </div>
          {activationMessage ? <p className="rider-application__inline-message" role="status">{activationMessage}</p> : null}
          {localCopyCode ? (
            <div className="rider-application__local-code" role="status">
              <p>Local development code: <strong>{localCopyCode}</strong></p>
              <Button variant="ghost" onClick={copyLocalActivationCode}>Copy code</Button>
            </div>
          ) : null}
        </Card>
      </main>
    );
  }

  if (profile.status === 'active') {
    return (
      <main className="section-shell rider-application rider-application--status">
        <Card className="rider-application__status-card">
          <CheckCircle2 className="rider-application__status-icon" aria-hidden="true" />
          <p className="rider-application__eyebrow">Activated</p>
          <h1>{statusTitle(profile)}</h1>
          <p>Your rider profile is active. The rider dashboard will be available when your rider setup is complete.</p>
          <Link className="rider-application__sign-in" to="/rider">Continue</Link>
        </Card>
      </main>
    );
  }

  if (!isEditable) {
    return (
      <main className="section-shell rider-application rider-application--status">
        <Card className="rider-application__status-card">
          <FileCheck2 className="rider-application__status-icon" aria-hidden="true" />
          <p className="rider-application__eyebrow">{profile.application_status.replaceAll('_', ' ')}</p>
          <h1>{statusTitle(profile)}</h1>
          <p>{profile.application_status === 'submitted'
            ? 'Your application is in the review queue. We’ll update you when its status changes.'
            : 'Your application is being reviewed. You can check back here for updates.'}</p>
          {profile.review_notes ? <p className="rider-application__review-note"><strong>Admin note:</strong> {profile.review_notes}</p> : null}
        </Card>
      </main>
    );
  }

  const renderStep = () => {
    if (step === 0) {
      return (
        <fieldset className="rider-application__vehicle-set">
          <legend>What vehicle will you use?</legend>
          <p className="rider-application__help">This determines which documents you’ll need later.</p>
          <div className="rider-application__vehicle-grid">
            {RIDER_APPLICATION_VEHICLES.map((vehicle) => (
              <label className={`rider-application__choice${form.vehicle_type === vehicle.value ? ' is-selected' : ''}`} key={vehicle.value}>
                <input
                  type="radio"
                  name="vehicle_type"
                  value={vehicle.value}
                  checked={form.vehicle_type === vehicle.value}
                  onChange={() => updateForm('vehicle_type', vehicle.value)}
                />
                <span>{vehicle.label}</span>
              </label>
            ))}
          </div>
          {fieldErrors.vehicle_type ? <p className="rider-application__field-error" role="alert">{fieldErrors.vehicle_type}</p> : null}
        </fieldset>
      );
    }

    if (step === 1) {
      return (
        <div className="rider-application__fields">
          <Input id="rider-first-name" label="First name" autoComplete="given-name" enterKeyHint="next" value={form.first_name} onChange={(event) => updateForm('first_name', event.target.value)} error={fieldErrors.first_name} required />
          <Input id="rider-middle-name" label="Middle name" autoComplete="additional-name" enterKeyHint="next" value={form.middle_name} onChange={(event) => updateForm('middle_name', event.target.value)} error={fieldErrors.middle_name} />
          <Input id="rider-last-name" label="Last name" autoComplete="family-name" enterKeyHint="next" value={form.last_name} onChange={(event) => updateForm('last_name', event.target.value)} error={fieldErrors.last_name} required />
          <Input id="rider-suffix" label="Suffix" autoComplete="honorific-suffix" enterKeyHint="next" value={form.suffix} onChange={(event) => updateForm('suffix', event.target.value)} error={fieldErrors.suffix} />
          <Input id="rider-birthday" label="Birthday" type="date" autoComplete="bday" max={ageLimit()} value={form.birthday} onChange={(event) => updateForm('birthday', event.target.value)} error={fieldErrors.birthday} required />
          <Input id="rider-mobile" label="Phone number" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" value={form.mobile} onChange={(event) => updateForm('mobile', event.target.value)} error={fieldErrors.mobile} required />
          <fieldset className="rider-application__shift-set">
            <legend>Preferred recurring shifts</legend>
            <p className="rider-application__help">Choose one or more shifts. Assignment is handled after approval.</p>
            {profile.available_shifts?.length ? (
              <div className="rider-application__shift-list">
                {profile.available_shifts.map((shift) => (
                  <label className="rider-application__shift-choice" key={shift.id}>
                    <input type="checkbox" checked={selectedShifts.has(String(shift.id))} onChange={(event) => setShiftSelected(shift.id, event.target.checked)} />
                    <span><strong>{shift.name}</strong><small>{shift.start_time}–{shift.end_time}</small></span>
                  </label>
                ))}
              </div>
            ) : <p className="rider-application__field-error" role="alert">No shifts are currently available. Contact SALO support before submitting.</p>}
            {fieldErrors.preferred_shift_ids ? <p className="rider-application__field-error" role="alert">{fieldErrors.preferred_shift_ids}</p> : null}
          </fieldset>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="rider-application__address">
          <p className="rider-application__help">Choose a barangay from the PSGC results, then enter your street and house number. You can use your current location and adjust the pin.</p>
          <Suspense fallback={<div className="skeleton-card" role="status">Loading address tools…</div>}>
            <AddressForm value={form.address} onChange={changeAddress} />
          </Suspense>
          {fieldErrors.psgc_code ? <p className="rider-application__field-error" role="alert">{fieldErrors.psgc_code}</p> : null}
          {fieldErrors.street ? <p className="rider-application__field-error" role="alert">{fieldErrors.street}</p> : null}
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="rider-application__documents">
          <p className="rider-application__privacy"><ShieldCheck aria-hidden="true" size={18} /> Rider photos and documents are private and stored on the machine running SALO.</p>
          {isMotorcycle ? <Input id="rider-plate" label="Motorcycle plate number" autoComplete="off" maxLength={20} value={form.plate_number} onChange={(event) => updateForm('plate_number', event.target.value)} error={fieldErrors.plate_number} required /> : null}
          {visibleDocuments.map(({ key, title, description, image }) => {
            const existing = documentsByType.get(key);
            const progress = uploadProgress[key];
            return (
              <Card className="rider-application__document" key={key}>
                <div className="rider-application__document-heading">
                  <div><h3>{title}</h3><p>{description}</p></div>
                  {existing ? <span className="rider-application__saved"><CheckCircle2 size={16} aria-hidden="true" /> Saved privately</span> : null}
                </div>
                {previews[key] && PHOTO_TYPES.includes(key) ? <img className="rider-application__preview" src={previews[key]} alt={`${title} preview`} /> : null}
                {existing ? (
                  <div className="rider-application__document-actions">
                    <Button variant="ghost" onClick={() => openSavedDocument(existing)}>View saved file</Button>
                    <Button variant="ghost" onClick={() => removeDocument(key)} disabled={busy}>Remove</Button>
                    {savedFileLinks[existing.id] ? <a href={savedFileLinks[existing.id]} target="_blank" rel="noreferrer">Open private file</a> : null}
                  </div>
                ) : null}
                <div className="rider-application__upload-actions">
                  <label className="btn btn--secondary btn--md rider-application__file-label">
                    {previews[key] ? 'Retake photo' : 'Take photo'}
                    <input
                      type="file"
                      accept={image ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'}
                      capture={image ? 'environment' : undefined}
                      onChange={(event) => {
                        uploadDocument(key, event.target.files?.[0]);
                        event.target.value = '';
                      }}
                      aria-label={`${previews[key] ? 'Retake' : 'Take'} ${title.toLowerCase()}`}
                    />
                  </label>
                  <label className="btn btn--secondary btn--md rider-application__file-label">
                    {existing || previews[key] ? 'Replace file' : 'Choose file'}
                    <input
                      type="file"
                      accept={image ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'}
                      onChange={(event) => {
                        uploadDocument(key, event.target.files?.[0]);
                        event.target.value = '';
                      }}
                      aria-label={`${existing ? 'Replace' : 'Choose'} ${title.toLowerCase()}`}
                    />
                  </label>
                </div>
                {Number.isFinite(progress) ? <progress className="rider-application__progress" value={progress} max="100" aria-label={`${title} upload progress`} /> : null}
                {uploadErrors[key] ? <p className="rider-application__field-error" role="alert">{uploadErrors[key]}</p> : null}
                {fieldErrors[key] ? <p className="rider-application__field-error" role="alert">{fieldErrors[key]}</p> : null}
              </Card>
            );
          })}
        </div>
      );
    }

    if (step === 4) {
      return (
        <div className="rider-application__fields rider-application__payout">
          <Input id="rider-ewallet-name" label="E-wallet account name" autoComplete="name" hint="Name only. Never enter an account number, password, or PIN." value={form.ewallet_account_name} onChange={(event) => updateForm('ewallet_account_name', event.target.value)} error={fieldErrors.ewallet_account_name} required />
          <label className="rider-application__check">
            <input type="checkbox" checked={form.declared_clearance_tin} onChange={(event) => updateForm('declared_clearance_tin', event.target.checked)} />
            <span>I confirm that I have a valid NBI or police clearance and a TIN.</span>
          </label>
          {fieldErrors.declared_clearance_tin ? <p className="rider-application__field-error" role="alert">{fieldErrors.declared_clearance_tin}</p> : null}
          <label className="rider-application__check">
            <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
            <span>I agree to the SALO rider terms and understand that my application details will be reviewed.</span>
          </label>
          {fieldErrors.terms_accepted ? <p className="rider-application__field-error" role="alert">{fieldErrors.terms_accepted}</p> : null}
        </div>
      );
    }

    return (
      <div className="rider-application__review">
        <h3>Applicant</h3>
        <p>{[form.first_name, form.middle_name, form.last_name, form.suffix].filter(Boolean).join(' ')}</p>
        <p>{form.birthday} · {form.mobile}</p>
        <h3>Vehicle</h3>
        <p>{RIDER_APPLICATION_VEHICLES.find((vehicle) => vehicle.value === form.vehicle_type)?.label || 'Not selected'}{isMotorcycle ? ` · ${form.plate_number}` : ''}</p>
        <h3>Home address</h3>
        <p>{[form.address.house_no, form.address.street, form.address.psgc_full_name].filter(Boolean).join(', ') || 'Address not complete'}</p>
        <h3>Preferred shifts</h3>
        <p>{profile.available_shifts?.filter((shift) => selectedShifts.has(String(shift.id))).map((shift) => shift.name).join(', ') || 'None selected'}</p>
        <h3>Files</h3>
        <p>{visibleDocuments.map(({ key, title }) => `${title}: ${documentsByType.has(key) ? 'ready' : 'missing'}`).join(' · ')}</p>
        <h3>Payout</h3>
        <p>{form.ewallet_account_name || 'Account holder name not entered'}</p>
        <p className="rider-application__privacy"><ShieldCheck aria-hidden="true" size={18} /> Your identity images remain private; the browser does not save uploaded images.</p>
      </div>
    );
  };

  return (
    <main className="section-shell rider-application">
      {!online ? <p className="rider-application__offline" role="status">You’re offline. Draft changes need a connection to save.</p> : null}
      <header className="rider-application__progress-header">
        <div className="rider-application__heading">
          <div><p className="rider-application__eyebrow">Rider application</p><h1>Become a SALO rider</h1></div>
          <span>{step + 1} of {STEPS.length}</span>
        </div>
        <progress className="rider-application__step-progress" value={step + 1} max={STEPS.length} aria-label={`Step ${step + 1} of ${STEPS.length}`} />
        <ol className="rider-application__step-list" aria-label="Application steps">
          {STEPS.map((title, index) => <li className={index === step ? 'is-current' : index < step ? 'is-complete' : ''} key={title}><span>{index < step ? '✓' : index + 1}</span><small>{title}</small></li>)}
        </ol>
      </header>

      <div className="rider-application__body">
        <Card className="rider-application__form-card">
          {profile.application_status === 'needs_revision' && profile.review_notes ? (
            <p className="rider-application__review-note"><strong>Admin note:</strong> {profile.review_notes}</p>
          ) : null}
          <div className="rider-application__step-title">
            <p className="rider-application__eyebrow">Step {step + 1}</p>
            <h2>{STEPS[step]}</h2>
          </div>
          {error ? <p className="rider-application__alert" role="alert">{error}</p> : null}
          {renderStep()}
        </Card>
      </div>

      <footer className="rider-application__sticky-footer">
        <div className="rider-application__footer-inner">
          {step > 0 ? <Button variant="ghost" onClick={goBack} disabled={busy}><ArrowLeft size={18} aria-hidden="true" /> Back</Button> : <span />}
          {step < STEPS.length - 1 ? (
            <Button onClick={continueStep} disabled={busy || !online}>
              {busy ? 'Saving…' : step === 0 ? 'Continue' : 'Save and continue'} <ArrowRight size={18} aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={submitApplication} disabled={busy || !online}>
              {busy ? 'Submitting…' : 'Submit application'}
            </Button>
          )}
        </div>
      </footer>
    </main>
  );
}
