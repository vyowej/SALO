export function Badge({ children, tone = 'default', className = '', ...props }) {
  return (
    <span className={['badge', `badge--${tone}`, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </span>
  );
}

export default Badge;
