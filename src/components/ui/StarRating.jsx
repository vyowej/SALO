import { useState } from 'react';
import { Star } from 'lucide-react';

const clampRating = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.min(5, Math.max(0, numericValue)) : 0;
};

export function StarRating({
  value = 0,
  count,
  onChange,
  label,
  size = 16,
  className = '',
}) {
  const [hoveredValue, setHoveredValue] = useState(0);
  const rating = clampRating(value);
  const previewRating = hoveredValue || rating;
  const interactive = typeof onChange === 'function';
  const reviewCount = count === null || count === undefined || count === ''
    ? null
    : Number.isFinite(Number(count)) ? Number(count) : null;
  const accessibleLabel = label || (rating > 0
    ? `Rated ${rating.toFixed(1)} out of 5${reviewCount === null ? '' : `, ${reviewCount} reviews`}`
    : 'No ratings yet');

  const stars = Array.from({ length: 5 }, (_, index) => {
    const fill = Math.round(Math.min(1, Math.max(0, previewRating - index)) * 100);
    return (
      <span className="star-rating__star" key={index} aria-hidden="true">
        <Star className="star-rating__empty" size={size} strokeWidth={1.8} />
        <span className="star-rating__fill" style={{ '--star-fill': `${fill}%` }}>
          <Star size={size} fill="currentColor" strokeWidth={1.8} />
        </span>
      </span>
    );
  });

  if (interactive) {
    return (
      <span
        className={['star-rating', 'star-rating--interactive', className].filter(Boolean).join(' ')}
        role="group"
        aria-label={label || `Rate ${rating ? `currently ${rating} out of` : ''} 5 stars`}
        onPointerLeave={() => setHoveredValue(0)}
      >
        {stars.map((star, index) => (
          <button
            type="button"
            className="star-rating__button"
            key={index}
            aria-label={`${index + 1} ${index === 0 ? 'star' : 'stars'}`}
            aria-pressed={rating === index + 1}
            onPointerEnter={() => setHoveredValue(index + 1)}
            onFocus={() => setHoveredValue(index + 1)}
            onBlur={(event) => {
              if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setHoveredValue(0);
            }}
            onClick={() => {
              onChange(index + 1);
              setHoveredValue(0);
            }}
          >
            {star}
          </button>
        ))}
      </span>
    );
  }

  if (rating === 0) {
    return <span className={['star-rating__empty-copy', className].filter(Boolean).join(' ')}>{accessibleLabel}</span>;
  }

  return (
    <span className={['star-rating', className].filter(Boolean).join(' ')} aria-label={accessibleLabel}>
      <span className="star-rating__stars" aria-hidden="true">{stars}</span>
      <strong className="star-rating__value">{rating.toFixed(1)}</strong>
      {reviewCount !== null ? <span className="star-rating__count">({reviewCount})</span> : null}
    </span>
  );
}

export default StarRating;
