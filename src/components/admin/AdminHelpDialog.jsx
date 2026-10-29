import { useEffect, useRef } from 'react';
import { ADMIN_COPY } from '../../constants/admin';

export function AdminHelpDialog({ onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const closeButton = dialogRef.current.querySelector('button');
      if (closeButton) {
        event.preventDefault();
        closeButton.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-help-title">
        <h2 id="admin-help-title">{ADMIN_COPY.helpTitle}</h2>
        <p>{ADMIN_COPY.helpMessage}</p>
        <div className="admin-dialog__actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>{ADMIN_COPY.close}</button>
        </div>
      </section>
    </div>
  );
}

export default AdminHelpDialog;
