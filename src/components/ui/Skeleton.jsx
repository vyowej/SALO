export function Skeleton({ variant = 'text', className = '' }) {
  const variants = {
    text: 'skeleton skeleton--text',
    card: 'skeleton skeleton--card',
    avatar: 'skeleton skeleton--avatar',
    block: 'skeleton skeleton--block',
  };

  return <div className={[variants[variant] || variants.text, className].join(' ')} />;
}

export function SkeletonCard() {
  return (
    <div className="card skeleton-card">
      <Skeleton variant="card" className="skeleton-card__image" />
      <div className="skeleton-card__body">
        <Skeleton variant="text" className="skeleton-card__line skeleton-card__line--long" />
        <Skeleton variant="text" className="skeleton-card__line" />
        <Skeleton variant="text" className="skeleton-card__line skeleton-card__line--short" />
      </div>
    </div>
  );
}

export default Skeleton;
