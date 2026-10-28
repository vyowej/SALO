export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

export default Button;
