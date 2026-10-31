import { useCallback, useEffect, useState } from 'react';
import { MapPin, RotateCw } from 'lucide-react';
import { locationService } from '../../services/locationService';
import MapView from './MapView';

const emptyAddress = {
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
  const [locationQuery, setLocationQuery] = useState(value.psgc_full_name || '');
  const [selectedSearchCode, setSelectedSearchCode] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationAccuracy, setLocationAccuracy] = useState(null);
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

  useEffect(() => {
    if ((selectedSearchCode && locationQuery === value.psgc_full_name) || locationQuery.trim().length < 2) return undefined;

    let active = true;
    const timer = window.setTimeout(() => {
      setLocationSearchLoading(true);
      setLocationSearchError('');
      locationService.searchPsgcLocations(locationQuery)
        .then((results) => { if (active) setLocationResults(results); })
        .catch((error) => {
          console.error('Unable to search PSGC locations.', error);
          if (active) setLocationSearchError('Location search is unavailable. Use the location lists below.');
        })
        .finally(() => { if (active) setLocationSearchLoading(false); });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [locationQuery, selectedSearchCode, value.psgc_full_name]);

  const choosePsgcLocation = async (location) => {
    setSelectedCodes({
      region: location.region_code || '',
      province: location.province_code || '',
      city: location.city_code || '',
      barangay: location.barangay_code || '',
    });
    setFields({
      psgc_code: location.code,
      psgc_full_name: location.full_name,
      region: location.region || '',
      province: location.province || '',
      city_municipality: location.city_municipality || '',
      barangay: location.barangay || '',
    });
    setLocationQuery(location.full_name);
    setSelectedSearchCode(location.code);
    setLocationResults([]);
    setLocationSearchError('');

    try {
      if (location.region_code) setProvinces(await locationService.getProvinces(location.region_code));
      if (location.province_code || location.region_code) {
        setCities(await locationService.getCities(location.province_code || location.region_code));
      }
      if (location.city_code) setBarangays(await locationService.getBarangays(location.city_code));
    } catch (error) {
      console.error('Unable to load the selected PSGC hierarchy.', error);
      setLocationSearchError('The location was selected, but its hierarchy could not be loaded.');
    }
  };

  const useCurrentLocation = async () => {
    setLocationState('asking');
    setLocationAccuracy(null);
    let result;
    try {
      result = await locationService.getCurrentPosition();
    } catch (error) {
      console.error('Unable to access the current location.', error);
      setLocationState('unavailable');
      setManualEntry(true);
      return;
    }
    if (result.state === 'granted') {
      if (!locationService.isWithinPhilippines(result.position)) {
        setLocationState('outside');
        setManualEntry(true);
        return;
      }
      setLocationAccuracy(result.position.accuracy);
      setFields({
        latitude: result.position.latitude,
        longitude: result.position.longitude,
      });
      setManualEntry(true);
      setLocationState('granted');
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
      setFields({ psgc_code: code || null, region: selected?.name || '', province: '', city_municipality: '', barangay: '' });
      if (code) {
        await loadOptions('provinces', locationService.getProvinces, setProvinces, code);
        await loadOptions('cities', locationService.getCities, setCities, code);
      } else {
        setProvinces([]);
        setCities([]);
      }
    }
    if (level === 'province') {
      const selected = provinces.find((entry) => entry.code === code);
      setSelectedCodes((current) => ({ ...current, province: code, city: '', barangay: '' }));
      setBarangays([]);
      setFields({ psgc_code: code || null, province: selected?.name || '', city_municipality: '', barangay: '' });
      if (code) await loadOptions('cities', locationService.getCities, setCities, code);
      else setCities([]);
    }
    if (level === 'city') {
      const selected = cities.find((entry) => entry.code === code);
      setSelectedCodes((current) => ({ ...current, city: code, barangay: '' }));
      setFields({ psgc_code: code || null, city_municipality: selected?.name || '', barangay: '' });
      if (code) await loadOptions('barangays', locationService.getBarangays, setBarangays, code);
      else setBarangays([]);
    }
    if (level === 'barangay') {
      const selected = barangays.find((entry) => entry.code === code);
      setSelectedCodes((current) => ({ ...current, barangay: code }));
      setFields({ psgc_code: code || null, barangay: selected?.name || '' });
    }
  };

  const retry = (key) => {
    const actions = {
      regions: () => loadOptions('regions', () => locationService.getRegions(), setRegions),
      provinces: () => loadOptions('provinces', locationService.getProvinces, setProvinces, selectedCodes.region),
      cities: () => loadOptions('cities', locationService.getCities, setCities, selectedCodes.province || selectedCodes.region),
      barangays: () => loadOptions('barangays', locationService.getBarangays, setBarangays, selectedCodes.city),
    };
    actions[key]?.();
  };

  const handlePinChange = async (pin) => {
    try {
      if (!await locationService.isWithinPhilippines(pin)) {
        setErrors((current) => ({ ...current, pin: 'This pin is outside the configured Philippines bounds. Choose another location.' }));
        return;
      }
    } catch (error) {
      console.error('Unable to validate the map pin.', error);
      setErrors((current) => ({ ...current, pin: 'We couldn’t validate this pin. Try again when location settings are available.' }));
      return;
    }
    setErrors((current) => ({ ...current, pin: '' }));
    onChange?.({ ...address, ...pin });
  };

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
        {address.label === 'Other' ? (
          <div className="field">
            <label htmlFor="address-custom-label">Custom label (optional)</label>
            <input id="address-custom-label" value={address.custom_label || ''} onChange={(event) => setField('custom_label', event.target.value)} maxLength={60} />
          </div>
        ) : null}
      </div>
      {showLocationActions ? (
        <div className="address-form__location-actions">
          <button type="button" className="btn btn--secondary btn--md" onClick={useCurrentLocation} disabled={locationState === 'asking'}><MapPin size={16} />{locationState === 'asking' ? 'Finding location…' : 'Use my current location'}</button>
          <button type="button" className="text-link" onClick={() => setManualEntry(true)}>Enter manually</button>
        </div>
      ) : null}
      {locationState === 'denied' ? <p className="address-form__location-message" role="status">Location access was declined. Enter your address manually to continue.</p> : null}
      {locationState === 'unavailable' || locationState === 'timeout' ? <p className="address-form__location-message" role="status">We couldn’t get your location. You can enter your address manually.</p> : null}
      {locationState === 'outside' ? <p className="address-form__location-message" role="alert">Your current location is outside the configured Philippines bounds. Enter a Philippine address manually.</p> : null}
      {locationAccuracy !== null ? <p className="address-form__location-message" role="status">GPS accuracy: about {Math.round(locationAccuracy)} m. Adjust the pin if needed.</p> : null}
      {manualEntry || !showLocationActions ? (
        <>
          <div className="field address-form__location-search">
            <label htmlFor="address-location-search">Search city, province, or barangay</label>
            <input id="address-location-search" value={locationQuery} onChange={(event) => { setSelectedSearchCode(''); setLocationResults([]); setLocationSearchError(''); setLocationQuery(event.target.value); }} placeholder="Type at least 2 characters" autoComplete="off" />
            {locationSearchLoading ? <span className="address-form__location-hint" role="status">Searching locations…</span> : null}
            {locationSearchError ? <span className="address-form__location-error" role="alert">{locationSearchError}</span> : null}
            {locationResults.length ? (
              <ul className="address-form__location-results" role="listbox" aria-label="PSGC search results">
                {locationResults.map((location) => (
                  <li key={location.code}>
                    <button type="button" role="option" onClick={() => choosePsgcLocation(location)}>
                      <strong>{location.name}</strong><span>{location.full_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {address.psgc_code && address.psgc_full_name ? (
            <div className="address-form__selected-location">
              <span>Selected location: <strong>{address.psgc_full_name}</strong></span>
              <button type="button" className="text-link" onClick={() => {
                setSelectedCodes({ region: '', province: '', city: '', barangay: '' });
                setLocationQuery('');
                setSelectedSearchCode('');
                setFields({ psgc_code: null, psgc_full_name: '', region: '', province: '', city_municipality: '', barangay: '' });
              }}>Change location</button>
            </div>
          ) : (
            <div className="form-grid address-form__hierarchy">
              {locationSelect('Region', 'region', regions, selectedCodes.region, false)}
              {locationSelect('Province', 'province', provinces, selectedCodes.province, !selectedCodes.region)}
              {locationSelect('City / Municipality', 'city', cities, selectedCodes.city, !selectedCodes.province && !selectedCodes.region)}
              {locationSelect('Barangay', 'barangay', barangays, selectedCodes.barangay, !selectedCodes.city)}
            </div>
          )}
          <div className="form-grid address-form__street">
            <div className="field"><label htmlFor="address-street">Street</label><input id="address-street" value={address.street} onChange={(event) => setField('street', event.target.value)} required /></div>
            <div className="field"><label htmlFor="address-house">House / Unit no. (optional)</label><input id="address-house" value={address.house_no} onChange={(event) => setField('house_no', event.target.value)} /></div>
          </div>
        </>
      ) : null}
      <div className="address-form__map-block">
        <div><strong><MapPin size={15} /> Pin my location</strong><span>Help your rider find your doorstep.</span></div>
        {errors.pin ? <p className="form-error" role="alert">{errors.pin}</p> : null}
        <MapView center={address.latitude !== null && address.longitude !== null ? address : undefined} pin={address.latitude !== null && address.longitude !== null ? address : undefined} onPinChange={handlePinChange} />
      </div>
      <div className="field"><label htmlFor="address-rider-note">Rider note (optional)</label><input id="address-rider-note" value={address.rider_note} onChange={(event) => setField('rider_note', event.target.value)} placeholder="Gate code, landmark, or directions" /></div>
    </div>
  );
}

export default AddressForm;
