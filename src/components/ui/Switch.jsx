export function Switch({ checked, onChange, label, id }) {
  return (
    <label htmlFor={id} className="switch-inline" aria-label={label}>
      <span className="switch-inline__label">{label}</span>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        className={['switch', checked ? 'switch--on' : ''].filter(Boolean).join(' ')}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
    </label>
  );
}

export default Switch;
