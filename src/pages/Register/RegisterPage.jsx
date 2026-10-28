import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, MapPin, RotateCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import AddressForm from '../../components/location/AddressForm';
import { authService } from '../../services/authService';
import { DEMO_ACCOUNTS, useAuth } from '../../context/AuthContext';
import '../Page.css';
import './Register.css';

const steps = ['Name', 'Address', 'Email', 'Password'];
const namePattern = /^[\p{L}][\p{L}\s.'-]*$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyAddress = {
  label: 'Home',
  region: '',
  province: '',
  city_municipality: '',
  barangay: '',
  street: '',
  house_no: '',
  latitude: null,
  longitude: null,
  is_main: true,
  rider_note: '',
};

function PasswordRules({ password }) {
  const rules = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'Includes a letter and a number', valid: /[A-Za-z]/.test(password) && /\d/.test(password) },
  ];
  return <ul className="password-rules">{rules.map((rule) => <li key={rule.label} className={rule.valid ? 'is-valid' : ''}><Check size={14} />{rule.label}</li>)}</ul>;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(0);
  const [user, setUser] = useState({ first_name: '', middle_name: '', last_name: '', suffix: '', email: '', password: '' });
  const [address, setAddress] = useState(emptyAddress);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ email: '', state: 'idle', message: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdName, setCreatedName] = useState('');

  useEffect(() => {
    const email = user.email.trim().toLowerCase();
    if (!emailPattern.test(email)) return undefined;

    let active = true;
    const timer = window.setTimeout(async () => {
      if (active) setEmailStatus({ email, state: 'checking', message: 'Checking this email…' });
      try {
        const demoMatch = DEMO_ACCOUNTS.some((account) => account.email === email);
        const registered = demoMatch || await authService.isEmailRegistered(email);
        if (active) setEmailStatus(registered
          ? { email, state: 'taken', message: 'This email is already registered. Try logging in instead.' }
          : { email, state: 'available', message: 'This email is available.' });
      } catch (checkError) {
        console.error('Unable to check whether the email is registered.', checkError);
        if (active) setEmailStatus({ email, state: 'error', message: 'We couldn’t check this email. Please try again.' });
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [user.email]);
  const visibleEmailStatus = emailStatus.email === user.email.trim().toLowerCase()
    ? emailStatus
    : { state: 'idle', message: '' };

  const strength = useMemo(() => {
    const password = user.password;
    return [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  }, [user.password]);

  const updateUser = (field, value) => setUser((current) => ({ ...current, [field]: value }));

  const validateStep = async () => {
    setError('');
    if (step === 0) {
      const requiredNames = [user.first_name, user.last_name];
      if (requiredNames.some((name) => !name.trim())) return 'Please enter your first and last name.';
      if ([user.first_name, user.middle_name, user.last_name].some((name) => name && !namePattern.test(name.trim()))) {
        return 'Use letters, spaces, hyphens, apostrophes, or periods for names.';
      }
    }
    if (step === 1) {
      if (!address.region || !address.province || !address.city_municipality || !address.barangay || !address.street.trim()) {
        return 'Complete your region, province, city, barangay, and street.';
      }
    }
    if (step === 2) {
      if (!emailPattern.test(user.email.trim())) return 'Enter a valid email address.';
      if (visibleEmailStatus.state === 'checking') return 'Please wait while we check this email.';
      if (visibleEmailStatus.state === 'taken') return 'This email is already registered. Try logging in instead.';
      try {
        const registered = DEMO_ACCOUNTS.some((account) => account.email === user.email.trim().toLowerCase())
          || await authService.isEmailRegistered(user.email);
        if (registered) return 'This email is already registered. Try logging in instead.';
      } catch (checkError) {
        console.error('Unable to verify email availability.', checkError);
        return 'We couldn’t check this email. Please try again.';
      }
    }
    if (step === 3) {
      if (user.password.length < 8) return 'Your password must be at least 8 characters.';
      if (!/[A-Za-z]/.test(user.password) || !/\d/.test(user.password)) return 'Include at least one letter and one number.';
      if (user.password !== confirmPassword) return 'Your passwords do not match.';
      if (!consent) return 'Please agree to the privacy notice to create your account.';
    }
    return '';
  };

  const goNext = async () => {
    const validationError = await validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep((current) => Math.min(steps.length - 1, current + 1));
  };

  const createAccount = async (event) => {
    event.preventDefault();
    const validationError = await validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      const name = [user.first_name, user.middle_name, user.last_name, user.suffix].filter(Boolean).join(' ');
      await register({
        user: { ...user, email: user.email.trim().toLowerCase(), name },
        address: { ...address, is_main: true },
        password: user.password,
      });
      setCreatedName(user.first_name);
    } catch (registerError) {
      console.error('Unable to create the account.', registerError);
      setError(registerError.message || 'We couldn’t create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (createdName) {
    return (
      <div className="auth-shell section-shell">
        <section className="auth-card register-success" aria-labelledby="register-success-title">
          <span className="register-success__icon"><Check size={26} /></span>
          <span className="eyebrow">You’re all set</span>
          <h1 id="register-success-title">Mabuhay, {createdName}!</h1>
          <p>Your SALO account is ready. Verify your email before placing your first order.</p>
          <Button variant="primary" size="lg" onClick={() => navigate('/')}>Start ordering</Button>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-shell section-shell">
      <section className="auth-card register-card" aria-labelledby="register-title">
        <span className="eyebrow">Join SALO</span>
        <h1 id="register-title">Create your account</h1>
        <div className="register-progress" aria-label={`Step ${step + 1} of 4: ${steps[step]}`}>
          <div className="register-progress__labels">{steps.map((label, index) => <span key={label} className={index <= step ? 'is-current' : ''}>{label}</span>)}</div>
          <div className="register-progress__track"><span className={`register-progress__fill register-progress__fill--${step + 1}`} /></div>
        </div>

        <form onSubmit={step === 3 ? createAccount : (event) => { event.preventDefault(); goNext(); }}>
          {step === 0 ? (
            <section className="register-step" aria-labelledby="register-name-heading">
              <h2 id="register-name-heading">What’s your name?</h2>
              <div className="register-name-fields">
                <div className="field"><label htmlFor="register-first-name">First name</label><input id="register-first-name" autoComplete="given-name" value={user.first_name} onChange={(event) => updateUser('first_name', event.target.value)} placeholder="Enter your first name" required /></div>
                <div className="field"><label htmlFor="register-middle-name">Middle name <span>(optional)</span></label><input id="register-middle-name" autoComplete="additional-name" value={user.middle_name} onChange={(event) => updateUser('middle_name', event.target.value)} placeholder="Enter your middle name" /></div>
                <div className="field"><label htmlFor="register-last-name">Last name</label><input id="register-last-name" autoComplete="family-name" value={user.last_name} onChange={(event) => updateUser('last_name', event.target.value)} placeholder="Enter your last name" required /></div>
                <div className="field"><label htmlFor="register-suffix">Suffix <span>(optional)</span></label><select id="register-suffix" value={user.suffix} onChange={(event) => updateUser('suffix', event.target.value)}><option value="">None</option>{['Jr.', 'Sr.', 'II', 'III', 'IV'].map((suffix) => <option key={suffix}>{suffix}</option>)}</select></div>
              </div>
              {[user.first_name, user.middle_name, user.last_name].some((name) => name && !namePattern.test(name.trim())) ? <p className="register-inline-validation" role="status">Use letters, spaces, hyphens, apostrophes, or periods for names.</p> : null}
            </section>
          ) : null}
          {step === 1 ? (
            <section className="register-step" aria-labelledby="register-address-heading">
              <h2 id="register-address-heading">Where should we deliver?</h2>
              <p className="register-step__copy">This will be your main delivery address. You can update it later.</p>
              <AddressForm value={address} onChange={setAddress} />
            </section>
          ) : null}
          {step === 2 ? (
            <section className="register-step" aria-labelledby="register-email-heading">
              <h2 id="register-email-heading">What’s your email?</h2>
              <p className="register-step__copy">We’ll use it for sign-in and order updates.</p>
              <div className="field"><label htmlFor="register-email">Email address</label><input id="register-email" type="email" autoComplete="email" value={user.email} onChange={(event) => updateUser('email', event.target.value)} placeholder="Enter your email address" aria-describedby="register-email-status" required /></div>
              {visibleEmailStatus.message ? <p id="register-email-status" className={`register-email-status register-email-status--${visibleEmailStatus.state}`} role="status">{visibleEmailStatus.state === 'checking' ? <RotateCw size={14} /> : null}{visibleEmailStatus.message}{visibleEmailStatus.state === 'taken' ? <Link to="/login">Log in</Link> : null}</p> : null}
            </section>
          ) : null}
          {step === 3 ? (
            <section className="register-step" aria-labelledby="register-password-heading">
              <h2 id="register-password-heading">Create a password</h2>
              <p className="register-step__copy">Choose a password that’s easy for you to remember.</p>
              <div className="field"><label htmlFor="register-password">Password</label><div className="password-input"><input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={user.password} onChange={(event) => updateUser('password', event.target.value)} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
              <div className="password-meter" aria-label={`Password strength: ${strength} of 5`}><span className={`password-meter__fill password-meter__fill--${strength}`} /></div>
              <PasswordRules password={user.password} />
              <div className="field"><label htmlFor="register-confirm-password">Confirm password</label><input id="register-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
              <label className="privacy-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to the Terms and Privacy Notice. We use your location and details only to deliver your orders.</span></label>
            </section>
          ) : null}

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="register-actions">
            {step > 0 ? <Button variant="ghost" type="button" onClick={() => { setError(''); setStep((current) => current - 1); }}>Back</Button> : <span />}
            {step < 3 ? <Button variant="primary" type="submit">Next</Button> : <Button variant="primary" size="lg" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>}
          </div>
        </form>

        <div className="auth-card__actions"><span>Already have an account?</span><Link to="/login" className="text-link">Log in</Link></div>
        <div className="register-address-note"><MapPin size={14} /> Address details are stored in this browser preview.</div>
      </section>
    </div>
  );
}
