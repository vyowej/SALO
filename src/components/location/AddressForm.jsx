import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { locationService } from '../../services/locationService';
import { AsyncLocationCombobox } from '../ui/AsyncLocationCombobox';
import { formatAddressPreview } from '../../utils/addressPreview';
import { reverseGeocodeAddress } from '../../utils/reverseGeocodeAddress';
import MapView from './MapView';

const emptyAddress = {
  country_code: 'PH',
  label: 'Home',
  custom_label: '',
  address_type: 'home',
  region: '',
  region_code: '',
  province: '',
  province_code: '',
  province_display: '',
  city_municipality: '',
  city_code: '',
  barangay: '',
  psgc_code: '',
  psgc_full_name: '',
  street: '',
  house_no: '',
  latitude: null,
  longitude: null,
  is_main: true,
  delivery_note: '',
  rider_note: '',
};

const labels = ['Home', 'Work', 'Church', 'School', 'Other'];

const addressTypeForLabel = {
  Home: 'home',
  Work: 'work',
  Church: 'other',
  School: 'other',
  Other: 'other',
};

const isNcrRegion = (region = '') => {
  const normalized = region.toLocaleLowerCase();
  return normalized.includes('ncr') || normalized.includes('national capital');
};

const provinceDisplayFor = (region, cityCode) => {
  if (!cityCode) return '';
  return isNcrRegion(region) ? 'Metro Manila (NCR)' : 'None (independent city)';
};

const normalizedLabel = (label) => (label === 'Office' ? 'Work' : label || 'Home');

export function AddressForm({ value = emptyAddress, onChange, showLocationActions = true }) {
  const address = { ...emptyAddress, ...value, country_code: 'PH' };
  const [selectedCodes, setSelectedCodes] = useState({
    region: address.region_code || '',
    province: address.province_code || '',
    city: address.city_code || '',
    barangay: address.psgc_code || '',
  });
  const [errors, setErrors] = useState({});
  const [locationState, setLocationState] = useState('');
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [manualEntry, setManualEntry] = useState(true);
  const reverseRequestId = useRef(0);

  const setField = (field, fieldValue) => {
    const fields = { [field]: fieldValue };
    if (field === 'delivery_note') fields.rider_note = fieldValue;
    if (field === 'rider_note') fields.delivery_note = fieldValue;
    setFields(fields);
  };
  const setFields = (fields) => {
    const updatedAddress = { ...address, ...fields };
    onChange?.({
      ...updatedAddress,
      formatted_address: fields.formatted_address || formatAddressPreview(updatedAddress),
    });
  };
  const regionCode = address.region_code || '';
  const provinceCode = address.province_code || '';
  const cityCode = address.city_code || '';
  const barangayCode = address.psgc_code || '';
  const cityName = address.city_municipality;
  const provinceName = address.province;
  const regionName = address.region;

  useEffect(() => {
    let active = true;
    if (regionCode || (provinceCode && cityCode) || !cityName) return () => { active = false; };

    locationService.searchPsgcLocations(cityName, 'city')
      .then(async (locations) => {
        if (!active) return;
        const selected = locations.find((location) => location.code === cityCode)
          || locations.find((location) => location.name.toLocaleLowerCase() === cityName.toLocaleLowerCase());
        if (!selected) {
          setErrors((current) => ({ ...current, hierarchy: 'This saved city could not be matched. Search for its province or city to continue.' }));
          return;
        }
        let resolvedRegionCode = selected.region_code || '';
        if (!resolvedRegionCode && selected.province_code) {
          const provinceOptions = await locationService.searchPsgcLocations(
            provinceName || selected.province || '',
            'province',
          );
          const selectedProvince = provinceOptions.find((province) => province.code === selected.province_code);
          resolvedRegionCode = selectedProvince?.region_code || selectedProvince?.parent_code || '';
        }
        if (!resolvedRegionCode && !selected.province_code) resolvedRegionCode = selected.parent_code || '';
        if (!active) return;
        setSelectedCodes({
          region: resolvedRegionCode || '',
          province: selected.province_code || '',
          city: selected.code,
          barangay: barangayCode,
        });
        onChange?.({
          ...value,
          region: regionName || selected.region || '',
          region_code: resolvedRegionCode || '',
          province: provinceName || selected.province || '',
          province_code: selected.province_code || '',
          province_display: provinceDisplayFor(
            regionName || selected.region,
            selected.province_code ? '' : selected.code,
          ),
          city_code: selected.code,
        });
      })
      .catch((error) => {
        console.error('Unable to initialize the saved address hierarchy.', error);
        if (active) setErrors((current) => ({ ...current, hierarchy: 'Saved location details could not be resolved. Search for the city again.' }));
      });

    return () => { active = false; };
  }, [
    barangayCode,
    cityCode,
    cityName,
    onChange,
    provinceName,
    provinceCode,
    regionCode,
    regionName,
    value,
  ]);

  const loadProvinceOptions = useCallback(async (query) => {
    const results = await locationService.searchPsgcLocations(query);
    return results.filter((location) => location.level === 'province' || location.level === 'city');
  }, []);

  const loadCityOptions = useCallback((query) => (
    locationService.getCities(selectedCodes.province || selectedCodes.region, query)
  ), [selectedCodes.province, selectedCodes.region]);

  const loadBarangayOptions = useCallback((query) => (
    locationService.getBarangays(selectedCodes.city, query)
  ), [selectedCodes.city]);

  const clearLowerThanProvince = () => {
    setSelectedCodes({ region: '', province: '', city: '', barangay: '' });
    setFields({
      region: '',
      region_code: '',
      province: '',
      province_code: '',
      province_display: '',
      city_municipality: '',
      city_code: '',
      barangay: '',
      psgc_code: '',
      psgc_full_name: '',
    });
    setErrors((current) => ({ ...current, hierarchy: '' }));
  };

  const clearLowerThanCity = () => {
    setSelectedCodes((current) => ({ ...current, city: '', barangay: '' }));
    setFields({
      city_municipality: '',
      city_code: '',
      barangay: '',
      psgc_code: '',
      psgc_full_name: '',
    });
    setErrors((current) => ({ ...current, hierarchy: '' }));
  };

  const clearBarangay = () => {
    setSelectedCodes((current) => ({ ...current, barangay: '' }));
    setFields({ barangay: '', psgc_code: '', psgc_full_name: '' });
  };

  const chooseProvinceOrCity = (location) => {
    if (!location) {
      clearLowerThanProvince();
      return;
    }

    if (location.level === 'city') {
      const regionCode = location.region_code || (
        location.province_code ? selectedCodes.region : location.parent_code
      );
      const provinceDisplay = provinceDisplayFor(location.region, location.province_code ? '' : location.code);
      setSelectedCodes({
        region: regionCode || '',
        province: location.province_code || '',
        city: location.code,
        barangay: '',
      });
      setFields({
        region: location.region || '',
        region_code: regionCode || '',
        province: location.province || '',
        province_code: location.province_code || '',
        province_display: provinceDisplay,
        city_municipality: location.city_municipality || location.name,
        city_code: location.code,
        barangay: '',
        psgc_code: '',
        psgc_full_name: '',
      });
      return;
    }

    setSelectedCodes({
      region: location.region_code || location.parent_code || '',
      province: location.code,
      city: '',
      barangay: '',
    });
    setFields({
      region: location.region || '',
      region_code: location.region_code || location.parent_code || '',
      province: location.name,
      province_code: location.code,
      province_display: '',
      city_municipality: '',
      city_code: '',
      barangay: '',
      psgc_code: '',
      psgc_full_name: '',
    });
  };

  const chooseCity = (location) => {
    if (!location) {
      clearLowerThanCity();
      return;
    }
    const provinceDisplay = provinceDisplayFor(address.region, selectedCodes.province ? '' : location.code);
    setSelectedCodes((current) => ({ ...current, city: location.code, barangay: '' }));
    setFields({
      city_municipality: location.name,
      city_code: location.code,
      province_display: provinceDisplay,
      barangay: '',
      psgc_code: '',
      psgc_full_name: '',
    });
  };

  const chooseBarangay = (location) => {
    if (!location) {
      clearBarangay();
      return;
    }
    setSelectedCodes((current) => ({ ...current, barangay: location.code }));
    setFields({
      barangay: location.name,
      psgc_code: location.code,
      psgc_full_name: location.full_name || location.name,
    });
  };

  const chooseLabel = (label) => setFields({
    label,
    address_type: addressTypeForLabel[label],
    custom_label: label === 'Other' ? address.custom_label : '',
  });

  const reverseAtPosition = async (position) => {
    const requestId = ++reverseRequestId.current;
    const coordinates = {
      latitude: Number(position.latitude),
      longitude: Number(position.longitude),
    };
    setLocationState('geocoding');
    setErrors((current) => ({ ...current, reverse: '', pin: '' }));

    try {
      if (!await locationService.isWithinPhilippines(coordinates)) {
        if (requestId === reverseRequestId.current) setLocationState('outside');
        return false;
      }

      const result = await locationService.reverseGeocode(coordinates.latitude, coordinates.longitude);
      if (requestId !== reverseRequestId.current) return false;

      const resolvedAddress = reverseGeocodeAddress({ ...result, ...coordinates });
      setSelectedCodes({
        region: resolvedAddress.region_code,
        province: resolvedAddress.province_code,
        city: resolvedAddress.city_code,
        barangay: resolvedAddress.psgc_code,
      });
      setFields(resolvedAddress);
      setLocationState(resolvedAddress.unresolved_components.length ? 'partial' : 'geocoded');
      return true;
    } catch (error) {
      console.error('Unable to reverse-geocode the selected coordinates.', error);
      if (requestId !== reverseRequestId.current) return false;
      setFields(coordinates);
      setErrors((current) => ({
        ...current,
        reverse: 'We couldn’t look up this location. The pin and address fields remain editable.',
      }));
      setLocationState('geocode-unavailable');
      return true;
    }
  };

  const useCurrentLocation = async () => {
    setLocationState('asking');
    setLocationAccuracy(null);
    setErrors((current) => ({ ...current, reverse: '', pin: '' }));
    let result;
    try {
      result = await locationService.getCurrentPosition();
    } catch (error) {
      console.error('Unable to access the current location.', error);
      setLocationState('unavailable');
      setManualEntry(true);
      return;
    }

    if (result.state !== 'granted') {
      setLocationState(result.state);
      setManualEntry(true);
      return;
    }

    setLocationAccuracy(result.position.accuracy);
    setManualEntry(true);
    await reverseAtPosition(result.position);
  };

  const handlePinChange = (pin) => reverseAtPosition(pin);

  const handleReverseGeocodeRetry = () => {
    if (address.latitude === null || address.longitude === null) return;
    reverseAtPosition({ latitude: address.latitude, longitude: address.longitude });
  };

  const currentLabel = normalizedLabel(address.label);
  const provinceDisplay = address.province_display
    || provinceDisplayFor(address.region, selectedCodes.city && !selectedCodes.province ? selectedCodes.city : '');
  const cityParentCode = selectedCodes.province || selectedCodes.region;
  const formattedPreview = formatAddressPreview({ ...address, province_display: provinceDisplay });

  return (
    <div className="address-form">
      <div className="field">
        <label htmlFor="address-country">Country</label>
        <input id="address-country" value="Philippines" readOnly aria-readonly="true" />
      </div>
      {showLocationActions ? (
        <div className="address-form__location-actions">
          <button type="button" className="btn btn--secondary btn--md" onClick={useCurrentLocation} disabled={locationState === 'asking' || locationState === 'geocoding'}>
            <MapPin size={16} aria-hidden="true" />{locationState === 'asking' ? 'Finding location…' : 'Use my current location'}
          </button>
          <button type="button" className="text-link" onClick={() => setManualEntry(true)}>Enter manually</button>
        </div>
      ) : null}
      {locationState === 'denied' ? <p className="address-form__location-message" role="status">Location access was declined. Enter your address manually to continue.</p> : null}
      {locationState === 'unavailable' || locationState === 'timeout' ? <p className="address-form__location-message" role="status">We couldn’t get your location. You can enter your address manually.</p> : null}
      {locationState === 'outside' ? <p className="address-form__location-message" role="alert">The selected location is outside the configured Philippines bounds. Enter a Philippine address manually.</p> : null}
      {locationState === 'geocoding' ? <p className="address-form__location-message" role="status">Looking up the address for this pin…</p> : null}
      {locationState === 'geocoded' ? <p className="address-form__location-message" role="status">Location details filled. Review and edit the address fields.</p> : null}
      {locationState === 'partial' ? (
        <p className="address-form__location-message" role="status">
          Some location details could not be matched to PSGC ({address.unresolved_components.join(', ')}). Search for those fields; the address remains editable.
        </p>
      ) : null}
      {locationState === 'geocode-unavailable' ? (
        <p className="address-form__location-message" role="alert">
          {errors.reverse}
          <button type="button" className="text-link" onClick={handleReverseGeocodeRetry}>Retry lookup</button>
        </p>
      ) : null}
      {locationAccuracy !== null ? <p className="address-form__location-message" role="status">GPS accuracy: about {Math.round(locationAccuracy)} m. Adjust the pin if needed.</p> : null}
      {manualEntry || !showLocationActions ? (
        <>
          <div className="form-grid address-form__hierarchy">
            {provinceDisplay ? (
              <div className="field">
                <label htmlFor="address-province-display">Province</label>
                <input id="address-province-display" value={provinceDisplay} readOnly aria-readonly="true" />
                <button type="button" className="text-link" onClick={clearLowerThanProvince}>Choose a different location</button>
              </div>
            ) : (
              <div className="field">
                <AsyncLocationCombobox
                  id="address-province"
                  label="Province"
                  value={address.province}
                  onSelect={chooseProvinceOrCity}
                  loadOptions={loadProvinceOptions}
                  hint=""
                  placeholder="Search provinces or cities"
                />
              </div>
            )}
            <div className="field">
              <AsyncLocationCombobox
                id="address-city"
                label="City or Municipality"
                value={address.city_municipality}
                onSelect={chooseCity}
                loadOptions={loadCityOptions}
                disabled={!cityParentCode}
                hint="Select a province or region first."
                placeholder="Search cities or municipalities"
              />
            </div>
            <div className="field">
              <AsyncLocationCombobox
                id="address-barangay"
                label="Barangay"
                value={address.barangay}
                onSelect={chooseBarangay}
                loadOptions={loadBarangayOptions}
                disabled={!selectedCodes.city}
                hint="Select a city or municipality first."
                placeholder="Search barangays"
              />
            </div>
          </div>
          {errors.hierarchy ? <p className="form-error" role="alert">{errors.hierarchy}</p> : null}
          <div className="form-grid address-form__street">
            <div className="field">
              <label htmlFor="address-street">Street</label>
              <input id="address-street" value={address.street} onChange={(event) => setField('street', event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="address-house">House number (optional)</label>
              <input id="address-house" value={address.house_no} onChange={(event) => setField('house_no', event.target.value)} />
            </div>
          </div>
          <div className="address-form__label-group">
            <span className="field-label">Address label</span>
            <div className="option-list" role="group" aria-label="Address label">
              {labels.map((label) => (
                <button
                  key={label}
                  type="button"
                  className={`option-button ${currentLabel === label ? 'is-selected' : ''}`}
                  aria-pressed={currentLabel === label}
                  onClick={() => chooseLabel(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            {currentLabel === 'Other' ? (
              <div className="field">
                <label htmlFor="address-custom-label">Custom label</label>
                <input
                  id="address-custom-label"
                  value={address.custom_label || ''}
                  onChange={(event) => setField('custom_label', event.target.value)}
                  maxLength={60}
                  required
                />
              </div>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="address-delivery-note">Delivery note (optional)</label>
            <input
              id="address-delivery-note"
              value={address.delivery_note || address.rider_note || ''}
              onChange={(event) => setField('delivery_note', event.target.value)}
              placeholder="Gate code, landmark, or directions"
            />
          </div>
          <p className="address-form__preview" aria-live="polite">
            <span>Address preview</span>
            <strong>{formattedPreview || 'Your address will appear here.'}</strong>
          </p>
        </>
      ) : null}
      <div className="address-form__map-block">
        <div>
          <strong><MapPin size={15} aria-hidden="true" /> Pin my location</strong>
          <span>Help your rider find your doorstep.</span>
        </div>
        {errors.pin ? <p className="form-error" role="alert">{errors.pin}</p> : null}
        <MapView
          center={address.latitude !== null && address.longitude !== null ? address : undefined}
          pin={address.latitude !== null && address.longitude !== null ? address : undefined}
          onPinChange={handlePinChange}
        />
      </div>
    </div>
  );
}

export default AddressForm;
