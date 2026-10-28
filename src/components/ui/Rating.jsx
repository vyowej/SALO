import { Star } from 'lucide-react';

export function Rating({ value = 0 }) {
  return (
    <span className="rating-inline" aria-label={`Rated ${value} out of 5`}>
      <Star size={14} fill="currentColor" strokeWidth={1.8} />
      <strong>{value.toFixed(1)}</strong>
    </span>
  );
}

export default Rating;
