export function Card({ children, className = '', ...props }) {
  return (
    <article className={['card', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </article>
  );
}

export default Card;
