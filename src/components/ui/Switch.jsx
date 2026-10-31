export function Switch({ checked, onChange, label, id }) {
  return (
    <div className="switch-inline">
      <span id={`${id}-label`} className="switch-inline__label">{label}</span>
      <button
        type="button"
        id={id}
        role="switch"
        aria-labelledby={`${id}-label`}
        aria-checked={checked}
        className={['switch', checked ? 'switch--on' : ''].filter(Boolean).join(' ')}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
    </div>
  );
}

export default Switch;
