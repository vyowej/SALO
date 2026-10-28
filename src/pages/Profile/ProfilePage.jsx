import { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus, UserCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLocationContext } from '../../context/LocationContext';
import { addressService } from '../../services/addressService';
import { restaurantService } from '../../services/restaurantService';
import AddressForm from '../../components/location/AddressForm';
import LocationPicker from '../../components/location/LocationPicker';
import { Button } from '../../components/ui/Button';
import '../Page.css';
import './Profile.css';

const emptyAddress = { label: 'Home', region: '', province: '', city_municipality: '', barangay: '', street: '', house_no: '', latitude: null, longitude: null, is_main: true, rider_note: '' };

export default function ProfilePage() {
  const { user } = useAuth();
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

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileData, addressData] = await Promise.all([
        restaurantService.getProfile(),
        addressService.getSavedAddresses(),
      ]);
      setProfile(profileData);
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
          <div className="profile-meta"><span>Birthday</span><strong>{profile.birthday}</strong></div>
          <div className="profile-meta"><span>City</span><strong>{user?.address?.city_municipality || selectedAddress?.city_municipality || profile.city}</strong></div>
        </section>

        <section className="profile-address-panel">
          <div className="profile-address-panel__header"><div><h2>Saved addresses</h2><p>Choose your main delivery destination.</p></div><button type="button" className="text-link" onClick={() => setAddressPickerOpen(true)}>Manage</button></div>
          {addresses.length ? <div className="profile-address-list">{addresses.map((address) => <button key={address.id} type="button" className={`profile-address-item ${selectedAddress?.id === address.id ? 'is-selected' : ''}`} onClick={() => selectAddress(address)}><MapPin size={17} /><span><strong>{address.label}{address.is_main ? ' · Main' : ''}</strong><small>{address.detail}</small></span></button>)}</div> : <div className="empty-state"><p>No saved addresses yet. Add your first delivery address.</p></div>}
          <button type="button" className="profile-add-address" onClick={() => { setAddressDraft(selectedAddress ? { ...emptyAddress, ...selectedAddress } : emptyAddress); setEditingAddress((current) => !current); setSaveError(''); }}><Plus size={16} />{editingAddress ? 'Close address form' : 'Add or edit main address'}</button>
          {editingAddress ? <div className="profile-address-editor"><AddressForm value={addressDraft} onChange={setAddressDraft} /><p className="profile-address-editor__note">Saving this address makes it your main delivery address.</p>{saveError ? <p className="form-error" role="alert">{saveError}</p> : null}<Button variant="primary" onClick={saveMainAddress}>Save main address</Button></div> : null}
        </section>
      </div>
      <LocationPicker open={addressPickerOpen} onClose={() => setAddressPickerOpen(false)} selectedAddress={selectedAddress} onSelect={selectAddress} />
    </div>
  );
}
