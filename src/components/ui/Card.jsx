export function Card({ children, variant = 'default', className = '', ...props }) {
  const variantClass = variant === 'glass' ? 'glass-card' : variant === 'data' ? 'glass-data' : '';

  return (
    <article className={['card', variantClass, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </article>
  );
}

export default Card;
