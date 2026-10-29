import { useId } from 'react';

export function Select({ id, label, hint, error, className = '', children, 'aria-describedby': describedBy, ...props }) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const descriptionIds = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="form-field">
      {label && <label className="form-field__label" htmlFor={controlId}>{label}</label>}
      <select
        id={controlId}
        className={['form-field__control', 'form-field__select', className].filter(Boolean).join(' ')}
        {...props}
        aria-describedby={descriptionIds}
        aria-invalid={error ? true : props['aria-invalid']}
      >
        {children}
      </select>
      {hint && <span className="form-field__hint" id={hintId}>{hint}</span>}
      {error && <span className="form-field__error" id={errorId} role="alert">{error}</span>}
    </div>
  );
}

export default Select;
