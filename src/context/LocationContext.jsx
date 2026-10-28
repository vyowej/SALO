/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addressService } from '../services/addressService';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);

  useEffect(() => {
    let active = true;
    addressService.getSelectedAddress()
      .then((address) => { if (active) setSelectedAddress(address); })
      .catch((error) => console.error('Unable to load the selected address.', error))
      .finally(() => { if (active) setLoadingAddress(false); });
    const handleAddressChange = (event) => setSelectedAddress(event.detail);
    window.addEventListener('salo:address-change', handleAddressChange);
    return () => {
      active = false;
      window.removeEventListener('salo:address-change', handleAddressChange);
    };
  }, []);

  const selectAddress = useCallback(async (address) => {
    const selected = await addressService.setSelectedAddress(address);
    setSelectedAddress(selected);
    return selected;
  }, []);

  const value = useMemo(() => ({ selectedAddress, loadingAddress, selectAddress }), [selectedAddress, loadingAddress, selectAddress]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocationContext must be used within LocationProvider');
  return context;
}

export default LocationProvider;
