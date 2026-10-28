import { useCallback, useEffect, useState } from 'react';
import { MapPin, RotateCw } from 'lucide-react';
import { locationService } from '../../services/locationService';
import MapView from './MapView';

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

const labels = ['Home', 'Office', 'School', 'Other'];

export function AddressForm({ value = emptyAddress, onChange, showLocationActions = true }) {
  const address = { ...emptyAddress, ...value };
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState({ region: '', province: '', city: '', barangay: '' });
  const [loading, setLoading] = useState({ regions: true, provinces: false, cities: false, barangays: false });
  const [errors, setErrors] = useState({});
  const [locationState, setLocationState] = useState('');
  const [manualEntry, setManualEntry] = useState(true);

  const setField = (field, fieldValue) => onChange?.({ ...address, [field]: fieldValue });
  const setFields = (fields) => onChange?.({ ...address, ...fields });

  const loadOptions = useCallback(async (key, loader, setter, code) => {
    setLoading((current) => ({ ...current, [key]: true }));
    setErrors((current) => ({ ...current, [key]: '' }));
    try {
      setter(await loader(code));
    } catch (error) {
      console.error(`Unable to load address ${key}.`, error);
      setErrors((current) => ({ ...current, [key]: 'We couldn’t load these locations.' }));
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    locationService.getRegions()
      .then((items) => { if (active) setRegions(items); })
      .catch((error) => {
        console.error('Unable to load address regions.', error);
        if (active) setErrors((current) => ({ ...current, regions: 'We couldn’t load these locations.' }));
      })
      .finally(() => { if (active) setLoading((current) => ({ ...current, regions: false })); });
    return () => { active = false; };
  }, []);

  const chooseLocation = async (position) => {
    const structuredAddress = await locationService.reverseGeocode(position.latitude, position.longitude);
    const resolved = await locationService.resolveMockAddress(structuredAddress);
    setSelectedCodes({
      region: resolved.region?.code || '',
      province: resolved.province?.code || '',
      city: resolved.city?.code || '',
      barangay: resolved.barangay?.code || '',
    });
    setProvinces(await locationService.getProvinces(resolved.region?.code));
    setCities(await locationService.getCities(resolved.province?.code));
    setBarangays(await locationService.getBarangays(resolved.city?.code));
    onChange?.({ ...address, ...structuredAddress, label: address.label, is_main: true });
  };

  const useCurrentLocation = async () => {
    setLocationState('asking');
    const result = await locationService.getCurrentPosition();
    if (result.state === 'granted') {
      try {
        await chooseLocation(result.position);
        setLocationState('granted');
      } catch (error) {
        console.error('Unable to resolve the current location.', error);
        setLocationState('unavailable');
      }
    } else {
      setLocationState(result.state);
      setManualEntry(true);
    }
  };

  const updateHierarchy = async (level, code) => {
    if (level === 'region') {
      const selected = regions.find((entry) => entry.code === code);
      setSelectedCodes({ region: code, province: '', city: '', barangay: '' });
      setCities([]);
      setBarangays([]);
      setFields({ region: selected?.name || '', province: '', city_municipality: '', barangay: '' });
      await loadOptions('provinces', locationService.getProvinces, setProvinces, code);
    }
    if (level === 'province') {
      const selected = provinces.find((entry) => entry.code === code);
      setSelectedCodes((current) => ({ ...current, province: code, city: '', barangay: '' }));
      setBarangays([]);
      setFields({ province: selected?.name || '', city_municipality: '', barangay: '' });
      await loadOptions('cities', locationService.getCities, setCities, code);
    }
    if (level === 'city') {
      const selected = cities.find((entry) => entry.code === code);
      setSelectedCodes((current) => ({ ...current, city: code, barangay: '' }));
      setFields({ city_municipality: selected?.name || '', barangay: '' });
      await loadOptions('barangays', locationService.getBarangays, setBarangays, code);
    }
    if (level === 'barangay') {
      const selected = barangays.find((entry) => entry.code === code);
      setSelectedCodes((current) => ({ ...current, barangay: code }));
      setFields({ barangay: selected?.name || '' });
    }
  };

  const retry = (key) => {
    const actions = {
      regions: () => loadOptions('regions', () => locationService.getRegions(), setRegions),
      provinces: () => loadOptions('provinces', locationService.getProvinces, setProvinces, selectedCodes.region),
      cities: () => loadOptions('cities', locationService.getCities, setCities, selectedCodes.province),
      barangays: () => loadOptions('barangays', locationService.getBarangays, setBarangays, selectedCodes.city),
    };
    actions[key]?.();
  };

  const handlePinChange = (pin) => onChange?.({ ...address, ...pin });

  const locationSelect = (label, level, options, valueCode, disabled) => (
    <div className="field address-form__field" key={level}>
      <label htmlFor={`address-${level}`}>{label}</label>
      {loading[level === 'city' ? 'cities' : `${level}s`] ? (
        <div className="skeleton address-form__select-skeleton" aria-label={`Loading ${label}`} />
      ) : errors[`${level === 'city' ? 'cities' : `${level}s`}`] ? (
        <div className="address-form__load-error"><span>{errors[level === 'city' ? 'cities' : `${level}s`]}</span><button type="button" onClick={() => retry(level === 'city' ? 'cities' : `${level}s`)}><RotateCw size={14} /> Retry</button></div>
      ) : (
        <select id={`address-${level}`} value={valueCode} disabled={disabled} onChange={(event) => updateHierarchy(level, event.target.value)}>
          <option value="">Select {label.toLowerCase()}</option>
          {options.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
        </select>
      )}
    </div>
  );

  return (
    <div className="address-form">
      <div className="address-form__label-group">
        <span className="field-label">Address label</span>
        <div className="option-list">
          {labels.map((label) => <button key={label} type="button" className={`option-button ${address.label === label ? 'is-selected' : ''}`} onClick={() => setField('label', label)}>{label}</button>)}
        </div>
      </div>
      {showLocationActions ? (
        <div className="address-form__location-actions">
          <button type="button" className="btn btn--secondary btn--md" onClick={useCurrentLocation} disabled={locationState === 'asking'}><MapPin size={16} />{locationState === 'asking' ? 'Finding location…' : 'Use my current location'}</button>
          <button type="button" className="text-link" onClick={() => setManualEntry(true)}>Enter manually</button>
        </div>
      ) : null}
      {locationState === 'denied' ? <p className="address-form__location-message" role="status">Location access was declined. Enter your address manually to continue.</p> : null}
      {locationState === 'unavailable' || locationState === 'timeout' ? <p className="address-form__location-message" role="status">We couldn’t get your location. You can enter your address manually.</p> : null}
      {manualEntry || !showLocationActions ? (
        <>
          <div className="form-grid address-form__hierarchy">
            {locationSelect('Region', 'region', regions, selectedCodes.region, false)}
            {locationSelect('Province', 'province', provinces, selectedCodes.province, !selectedCodes.region)}
            {locationSelect('City / Municipality', 'city', cities, selectedCodes.city, !selectedCodes.province)}
            {locationSelect('Barangay', 'barangay', barangays, selectedCodes.barangay, !selectedCodes.city)}
          </div>
          <div className="form-grid address-form__street">
            <div className="field"><label htmlFor="address-street">Street</label><input id="address-street" value={address.street} onChange={(event) => setField('street', event.target.value)} required /></div>
            <div className="field"><label htmlFor="address-house">House / Unit no. (optional)</label><input id="address-house" value={address.house_no} onChange={(event) => setField('house_no', event.target.value)} /></div>
          </div>
        </>
      ) : null}
      <div className="address-form__map-block">
        <div><strong><MapPin size={15} /> Pin my location</strong><span>Help your rider find your doorstep.</span></div>
        <MapView center={address.latitude && address.longitude ? address : undefined} pin={address.latitude && address.longitude ? address : undefined} onPinChange={handlePinChange} />
      </div>
      <div className="field"><label htmlFor="address-rider-note">Rider note (optional)</label><input id="address-rider-note" value={address.rider_note} onChange={(event) => setField('rider_note', event.target.value)} placeholder="Gate code, landmark, or directions" /></div>
    </div>
  );
}

export default AddressForm;
