import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { addressService } from '../../services/addressService';
import { locationService } from '../../services/locationService';
import AddressForm from './AddressForm';
import MapView from './MapView';

const formatAddress = (address) => address.detail || [
  address.house_no,
  address.street,
  address.barangay,
  address.city_municipality,
].filter(Boolean).join(', ');

export function LocationPicker({ open, onClose, selectedAddress, onSelect }) {
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [pendingAddress, setPendingAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedLoading, setSavedLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualAddress, setManualAddress] = useState({
    label: 'Home',
    custom_label: '',
    address_type: 'home',
    region: '',
    province: '',
    city_municipality: '',
    barangay: '',
    street: '',
    house_no: '',
    latitude: null,
    longitude: null,
    is_main: false,
    rider_note: '',
    psgc_code: '',
    psgc_full_name: '',
  });
  const searchRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const touchStartY = useRef(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const activeAddress = pendingAddress || selectedAddress || null;

  const closePicker = () => {
    setPendingAddress(null);
    setSearch('');
    setSuggestions([]);
    onCloseRef.current();
  };

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closePicker();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
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
    searchRef.current?.focus();
    addressService.getSavedAddresses()
      .then(setSavedAddresses)
      .catch((loadError) => {
        console.error('Unable to load saved addresses.', loadError);
        setError('We couldn’t load your saved addresses.');
      })
      .finally(() => setSavedLoading(false));
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || search.trim().length < 2) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      locationService.searchPlaces(search)
        .then((results) => { if (active) setSuggestions(results); })
        .catch((searchError) => {
          console.error('Unable to search for addresses.', searchError);
          if (active) setError('Address search is unavailable. Try a saved address or current location.');
        })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, search]);

  if (!open) return null;

  const useCurrentLocation = async () => {
    setLocationState('asking');
    setLocationAccuracy(null);
    setError('');
    let result;
    try {
      result = await locationService.getCurrentPosition();
    } catch (locationError) {
      console.error('Unable to access the current location.', locationError);
      setLocationState('unavailable');
      setError('We couldn’t access your location. Choose an address or enter it manually.');
      return;
    }
    if (result.state !== 'granted') {
      setLocationState(result.state);
      return;
    }
    try {
      if (!await locationService.isWithinPhilippines(result.position)) {
        setLocationState('outside');
        return;
      }
      setManualAddress((current) => ({
        ...current,
        latitude: result.position.latitude,
        longitude: result.position.longitude,
      }));
      setLocationAccuracy(result.position.accuracy);
      setManualMode(true);
      setLocationState('granted');
    } catch (locationError) {
      console.error('Unable to use the current location.', locationError);
      setError('We couldn’t use this location. Choose an address or enter it manually.');
      setLocationState('unavailable');
    }
  };

  const chooseAddress = (address) => {
    if (address.psgc_code && !address.street) {
      setManualAddress((current) => ({
        ...current,
        ...address,
        label: current.label || 'Home',
        is_main: !savedAddresses.length,
      }));
      setManualMode(true);
      setPendingAddress(null);
      setSearch('');
      setSuggestions([]);
      return;
    }
    setPendingAddress(address);
    setSearch('');
    setSuggestions([]);
  };

  const confirmAddress = async () => {
    if (!activeAddress) return;
    try {
      let address = activeAddress;
      if (!address.id) address = await addressService.saveAddress({ ...address, is_main: !savedAddresses.length });
      await onSelect(address);
      closePicker();
    } catch (selectError) {
      console.error('Unable to select this address.', selectError);
      setError('We couldn’t save this address. Please try again.');
    }
  };

  const saveManualAddress = async () => {
    if (!manualAddress.psgc_code && !manualAddress.street.trim()) {
      setError('Choose a Philippine location or enter a street address before saving.');
      return;
    }
    try {
      const saved = await addressService.saveAddress({ ...manualAddress, is_main: !savedAddresses.length });
      setSavedAddresses((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)]);
      setPendingAddress(saved);
      setManualMode(false);
      setError('');
    } catch (saveError) {
      console.error('Unable to save the new address.', saveError);
      setError('We couldn’t save this address. Please try again.');
    }
  };

  const deniedMessage = locationState === 'denied'
    ? 'Location permission was denied. Search or choose a saved address instead.'
    : locationState === 'timeout'
      ? 'Finding your location took too long. Try again or choose a saved address.'
      : locationState === 'unavailable'
        ? 'Location services are unavailable. Search or choose a saved address instead.'
        : locationState === 'outside'
          ? 'Your current location is outside the configured Philippines bounds. Choose or enter a Philippine address.'
        : '';

  return (
    <div className="modal-backdrop location-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePicker(); }}>
      <section className="modal location-picker" role="dialog" aria-modal="true" aria-labelledby="location-picker-title" ref={dialogRef} onTouchStart={(event) => { touchStartY.current = event.touches[0].clientY; }} onTouchEnd={(event) => { if (event.changedTouches[0].clientY - touchStartY.current > 100) onCloseRef.current(); }}>
        <div className="location-picker__handle" aria-hidden="true" />
        <header className="modal__header">
          <div><h2 id="location-picker-title">Choose delivery address</h2><p>Search Philippine locations, then add your street or unit manually.</p></div>
          <button type="button" className="icon-button" aria-label="Close address picker" onClick={closePicker}>×</button>
        </header>
        <div className="modal__body location-picker__body">
          <label className="location-picker__search"><Search size={17} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search city, province, or barangay" aria-label="Search Philippine locations" /></label>
          <button type="button" className="location-picker__current" onClick={useCurrentLocation} disabled={locationState === 'asking'}><LocateFixed size={17} />{locationState === 'asking' ? 'Finding your location…' : 'Use current location'}</button>
          {deniedMessage ? <p className="location-picker__message" role="status">{deniedMessage}</p> : null}
          {locationAccuracy !== null ? <p className="location-picker__message" role="status">GPS accuracy: about {Math.round(locationAccuracy)} m. Adjust the pin if needed.</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {manualMode ? (
            <section className="location-picker__manual">
              <div className="location-picker__manual-heading"><strong>Add an address</strong><button type="button" className="text-link" onClick={() => setManualMode(false)}>Back to saved</button></div>
              <AddressForm value={manualAddress} onChange={setManualAddress} showLocationActions={false} />
              <button type="button" className="btn btn--primary btn--full" onClick={saveManualAddress}>Save address</button>
            </section>
          ) : search.trim().length >= 2 ? (
            <div className="location-picker__results" aria-live="polite">
              <strong>Search results</strong>
              {loading ? <div className="skeleton location-picker__skeleton" /> : suggestions.length ? suggestions.map((place, index) => <button key={`${place.detail}-${index}`} type="button" onClick={() => chooseAddress(place)}><MapPin size={16} /><span><strong>{place.label}</strong><small>{formatAddress(place)}</small></span></button>) : <p>No matching places found.</p>}
            </div>
          ) : search ? (
            <p className="location-picker__message" role="status">Type at least 2 characters to search.</p>
          ) : (
            <div className="location-picker__saved">
              <strong>Saved addresses</strong>
              {savedLoading ? <><div className="skeleton location-picker__skeleton" /><div className="skeleton location-picker__skeleton" /></> : savedAddresses.length ? savedAddresses.map((address) => <button key={address.id} type="button" className={activeAddress?.id === address.id ? 'is-selected' : ''} onClick={() => chooseAddress(address)}><MapPin size={16} /><span><strong>{address.label}{address.is_main ? ' · Main' : ''}</strong><small>{formatAddress(address)}</small></span></button>) : <p>No saved addresses yet. Search for a place to add one.</p>}
              <button type="button" className="location-picker__add-address" onClick={() => { setManualMode(true); setError(''); }}>+ Add address manually</button>
            </div>
          )}
          {!manualMode ? (
            <>
              {activeAddress ? <MapView center={activeAddress} pin={activeAddress} /> : null}
              <button type="button" className="btn btn--primary btn--full" disabled={!activeAddress} onClick={confirmAddress}>Deliver to this address</button>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default LocationPicker;
