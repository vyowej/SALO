export function Chip({ children, selected = false, className = '', ...props }) {
  return (
    <button
      type="button"
      className={['chip', selected ? 'chip--selected' : '', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}

export default Chip;
