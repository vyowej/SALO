export function formatAddressPreview(address = {}) {
  const parts = [
    address.house_no,
    address.street,
    address.barangay,
    address.city_municipality,
    address.province || address.province_display,
    address.region,
    'Philippines',
  ];

  return parts
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim())
    .filter((part, index, values) => values.findIndex((value) => value.toLocaleLowerCase() === part.toLocaleLowerCase()) === index)
    .join(', ');
}

export default formatAddressPreview;
