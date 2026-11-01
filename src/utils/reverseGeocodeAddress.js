export function reverseGeocodeAddress(result = {}) {
  const city = result.city || result.city_municipality || '';
  const barangayCode = result.barangay_code || result.psgc_code || '';
  const barangay = result.barangay || '';
  const hierarchy = [
    barangay,
    city,
    result.province || result.province_display,
    result.region,
  ].filter(Boolean);

  return {
    country_code: result.country_code || 'PH',
    region_code: result.region_code || '',
    region: result.region || '',
    province_code: result.province_code || '',
    province: result.province || '',
    province_display: result.province_display || '',
    city_code: result.city_code || '',
    city_municipality: city,
    barangay_code: barangayCode,
    psgc_code: barangayCode,
    psgc_full_name: barangay ? hierarchy.join(', ') : '',
    barangay,
    street: result.street || '',
    house_no: result.house_no || '',
    formatted_address: result.formatted_address || '',
    latitude: result.latitude ?? null,
    longitude: result.longitude ?? null,
    unresolved_components: Array.isArray(result.unresolved_components)
      ? result.unresolved_components
      : [],
  };
}

export default reverseGeocodeAddress;
