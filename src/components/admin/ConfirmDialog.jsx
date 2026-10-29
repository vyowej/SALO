import { useEffect, useRef } from 'react';
import { ADMIN_COPY } from '../../constants/admin';

export function ConfirmDialog({
  open,
  title = ADMIN_COPY.confirmTitle,
  message = ADMIN_COPY.confirmMessage,
  confirmLabel = ADMIN_COPY.confirm,
  cancelLabel = ADMIN_COPY.cancel,
  onConfirm,
  onCancel,
  children,
  busy = false,
}) {
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    confirmRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex="0"]')];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section ref={dialogRef} className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
        <h2 id="admin-dialog-title">{title}</h2>
        {message ? <p>{message}</p> : null}
        {children}
        <div className="admin-dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" className="btn btn--primary" onClick={onConfirm} disabled={busy}>{busy ? ADMIN_COPY.loading : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmDialog;
