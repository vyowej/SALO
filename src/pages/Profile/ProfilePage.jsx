import { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus, UserCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLocationContext } from '../../context/LocationContext';
import { addressService } from '../../services/addressService';
import { restaurantService } from '../../services/restaurantService';
import AddressForm from '../../components/location/AddressForm';
import LocationPicker from '../../components/location/LocationPicker';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { config } from '../../config';
import '../Page.css';
import './Profile.css';

const emptyAddress = { label: 'Home', region: '', province: '', city_municipality: '', barangay: '', street: '', house_no: '', latitude: null, longitude: null, is_main: true, rider_note: '' };

export default function ProfilePage() {
  const { user, updateUser, deactivateAccount, emailVerified, sendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const { selectedAddress, selectAddress } = useLocationContext();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState(emptyAddress);
  const [saveError, setSaveError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: '', phone: '' });
  const [profileBusy, setProfileBusy] = useState(false);
  const [deactivationOpen, setDeactivationOpen] = useState(false);
  const [deactivationDraft, setDeactivationDraft] = useState({ password: '', reason: '' });
  const [verificationMessage, setVerificationMessage] = useState('');
  const [pendingAddressRemoval, setPendingAddressRemoval] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileData, addressData] = await Promise.all([
        restaurantService.getProfile(),
        addressService.getSavedAddresses(),
      ]);
      setProfile(profileData);
      setProfileDraft({ name: profileData.name || '', phone: profileData.phone || '' });
      setAddresses(addressData);
      const primary = addressData.find((address) => address.is_main) || addressData[0];
      setAddressDraft(primary ? { ...emptyAddress, ...primary } : emptyAddress);
    } catch (loadError) {
      console.error('Unable to load profile.', loadError);
      setError('We couldn’t load your profile and saved addresses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([restaurantService.getProfile(), addressService.getSavedAddresses()])
      .then(([profileData, addressData]) => {
        if (!active) return;
        setProfile(profileData);
        setProfileDraft({ name: profileData.name || '', phone: profileData.phone || '' });
        setAddresses(addressData);
        const primary = addressData.find((address) => address.is_main) || addressData[0];
        setAddressDraft(primary ? { ...emptyAddress, ...primary } : emptyAddress);
      })
      .catch((loadError) => {
        console.error('Unable to load profile.', loadError);
        if (active) setError('We couldn’t load your profile and saved addresses.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saveMainAddress = async () => {
    setSaveError('');
    setSavedMessage('');
    if (!addressDraft.region || !addressDraft.province || !addressDraft.city_municipality || !addressDraft.barangay || !addressDraft.street.trim()) {
      setSaveError('Complete the address fields before saving.');
      return;
    }
    try {
      const saved = await addressService.saveAddress({ ...addressDraft, is_main: true });
      await selectAddress(saved);
      setAddresses(await addressService.getSavedAddresses());
      setEditingAddress(false);
      setSavedMessage('Main address saved.');
    } catch (saveFailure) {
      console.error('Unable to save the profile address.', saveFailure);
      setSaveError('We couldn’t save this address. Please try again.');
    }
  };

  const makeAddressPrimary = async (address) => {
    setSaveError('');
    setSavedMessage('');
    try {
      const primary = await addressService.setPrimaryAddress(address);
      setAddresses(await addressService.getSavedAddresses());
      await selectAddress(primary);
      setSavedMessage('Primary address updated.');
    } catch (addressError) {
      console.error('Unable to set the primary address.', addressError);
      setSaveError('We couldn’t update the primary address. Please try again.');
    }
  };

  const removeAddress = async (address) => {
    setSaveError('');
    setSavedMessage('');
    try {
      await addressService.deleteAddress(address);
      const remaining = await addressService.getSavedAddresses();
      setAddresses(remaining);
      if (selectedAddress?.id === address.id) {
        await selectAddress(remaining.find((entry) => entry.is_main) || remaining[0] || null);
      }
      setPendingAddressRemoval('');
      setSavedMessage('Address removed.');
    } catch (addressError) {
      console.error('Unable to remove the saved address.', addressError);
      setSaveError('We couldn’t remove this address. Please try again.');
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileBusy(true);
    setSaveError('');
    setSavedMessage('');
    try {
      const updated = await updateUser({
        name: profileDraft.name.trim(),
        phone: profileDraft.phone.trim() || null,
      });
      setProfile(updated);
      setProfileDraft({ name: updated.name || '', phone: updated.phone || '' });
      setEditingProfile(false);
      setSavedMessage('Profile updated.');
    } catch (saveFailure) {
      console.error('Unable to update the profile.', saveFailure);
      setSaveError(saveFailure.message || 'We couldn’t update your profile. Please try again.');
    } finally {
      setProfileBusy(false);
    }
  };

  const confirmDeactivation = async (event) => {
    event.preventDefault();
    setSaveError('');
    setProfileBusy(true);
    try {
      await deactivateAccount(deactivationDraft);
      navigate('/', { replace: true });
    } catch (deactivationError) {
      console.error('Unable to deactivate the account.', deactivationError);
      setSaveError(deactivationError.message || 'We couldn’t deactivate your account. Please try again.');
    } finally {
      setProfileBusy(false);
    }
  };

  const requestEmailVerification = async () => {
    setVerificationMessage('');
    try {
      await sendVerificationEmail();
      setVerificationMessage('If verification is needed, a link will be sent to your email.');
    } catch (verificationError) {
      console.error('Unable to request email verification.', verificationError);
      setVerificationMessage('We couldn’t send a verification link. Please try again.');
    }
  };

  if (loading) return <div className="section-shell profile-shell"><div className="skeleton skeleton--block profile-skeleton" /></div>;
  if (error) return <div className="section-shell profile-shell"><div className="empty-state empty-state--error"><h2>Profile unavailable</h2><p>{error}</p><Button variant="secondary" onClick={loadProfile}>Try again</Button></div></div>;
  if (!profile) return <div className="section-shell profile-shell"><div className="empty-state"><h2>No profile found</h2><p>Sign in or create an account to see your profile.</p></div></div>;

  const fullName = user?.name || profile.name;
  const email = user?.email || profile.email;
  const phone = user?.phone || profile.phone || 'Add at checkout';

  return (
    <div className="section-shell profile-shell">
      <div className="page-header"><div><h1>Profile</h1><p>Keep your account and delivery details up to date.</p></div></div>
      {savedMessage ? <p className="form-success profile-message" role="status">{savedMessage}</p> : null}
      <div className="profile-grid">
        <section className="profile-card profile-card--account">
          <div className="profile-card__header"><div className="avatar-badge"><UserCircle2 size={22} /></div><div><h2>{fullName}</h2><p className="profile-email">{email}</p></div></div>
          <div className="profile-meta"><span>Phone</span><strong>{phone}</strong></div>
          <div className="profile-meta profile-verification">
            <span>Email status</span>
            <strong>{emailVerified ? 'Verified' : 'Not verified'}</strong>
            {!emailVerified && !config.useMock ? <Button variant="secondary" onClick={requestEmailVerification}>Send verification link</Button> : null}
            {verificationMessage ? <small role="status">{verificationMessage}</small> : null}
          </div>
          {profile.birthday ? <div className="profile-meta"><span>Birthday</span><strong>{profile.birthday}</strong></div> : null}
          <div className="profile-meta"><span>City</span><strong>{user?.address?.city_municipality || selectedAddress?.city_municipality || profile.city || 'Add a saved address'}</strong></div>
          <Button variant="secondary" onClick={() => { setEditingProfile((current) => !current); setProfileDraft({ name: fullName || '', phone: user?.phone || profile.phone || '' }); setSaveError(''); }}>
            {editingProfile ? 'Cancel editing' : 'Edit profile'}
          </Button>
          {editingProfile ? <form className="profile-account-form" onSubmit={saveProfile}>
            <label className="field"><span>Full name</span><input value={profileDraft.name} maxLength={120} required onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="field"><span>Phone</span><input type="tel" value={profileDraft.phone} maxLength={40} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
            <Button variant="primary" type="submit" disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save profile'}</Button>
          </form> : null}
          <div className="profile-deactivate">
            <button type="button" className="text-link" onClick={() => { setDeactivationOpen((open) => !open); setSaveError(''); }}>Deactivate account</button>
            {deactivationOpen ? <form className="profile-account-form" onSubmit={confirmDeactivation}>
              <p>This signs you out and deactivates your account. Confirm your password to continue.</p>
              <label className="field"><span>Password</span><input type="password" autoComplete="current-password" required value={deactivationDraft.password} onChange={(event) => setDeactivationDraft((current) => ({ ...current, password: event.target.value }))} /></label>
              <label className="field"><span>Reason (optional)</span><textarea maxLength={1000} value={deactivationDraft.reason} onChange={(event) => setDeactivationDraft((current) => ({ ...current, reason: event.target.value }))} /></label>
              <Button variant="secondary" type="submit" disabled={profileBusy}>{profileBusy ? 'Deactivating…' : 'Confirm deactivation'}</Button>
            </form> : null}
          </div>
          {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
        </section>

        <section className="profile-address-panel">
          <div className="profile-address-panel__header"><div><h2>Saved addresses</h2><p>Choose your main delivery destination.</p></div><button type="button" className="text-link" onClick={() => setAddressPickerOpen(true)}>Manage</button></div>
          {addresses.length ? <div className="profile-address-list">{addresses.map((address) => <div key={address.id} className="profile-address-row">
            <button type="button" className={`profile-address-item ${selectedAddress?.id === address.id ? 'is-selected' : ''}`} onClick={() => selectAddress(address)}>
              <MapPin size={17} /><span><strong>{address.label}{address.is_main ? ' · Main' : ''}</strong><small>{address.detail}</small></span>
            </button>
            <div className="profile-address-actions">
              {!address.is_main ? <button type="button" className="text-link" onClick={() => makeAddressPrimary(address)}>Make main</button> : null}
              {pendingAddressRemoval === address.id ? (
                <span className="profile-address-confirm" role="group" aria-label={`Remove ${address.label} address`}>
                  <span>Remove this address?</span>
                  <button type="button" className="text-link" onClick={() => removeAddress(address)}>Confirm</button>
                  <button type="button" className="text-link" onClick={() => setPendingAddressRemoval('')}>Cancel</button>
                </span>
              ) : <button type="button" className="text-link" onClick={() => setPendingAddressRemoval(address.id)}>Remove</button>}
            </div>
          </div>)}</div> : <div className="empty-state"><p>No saved addresses yet. Add your first delivery address.</p></div>}
          <button type="button" className="profile-add-address" onClick={() => { const primary = addresses.find((address) => address.is_main) || addresses[0]; setAddressDraft(primary ? { ...emptyAddress, ...primary } : emptyAddress); setEditingAddress((current) => !current); setSaveError(''); }}><Plus size={16} />{editingAddress ? 'Close address form' : 'Add or edit main address'}</button>
          {editingAddress ? <div className="profile-address-editor"><AddressForm value={addressDraft} onChange={setAddressDraft} /><p className="profile-address-editor__note">Saving this address makes it your main delivery address.</p>{saveError ? <p className="form-error" role="alert">{saveError}</p> : null}<Button variant="primary" onClick={saveMainAddress}>Save main address</Button></div> : null}
        </section>
      </div>
      <LocationPicker open={addressPickerOpen} onClose={() => setAddressPickerOpen(false)} selectedAddress={selectedAddress} onSelect={selectAddress} />
    </div>
  );
}
