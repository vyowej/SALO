import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ADMIN_COPY } from '../../constants/admin';
import { resolvePhoto } from '../../mock/admin/photoStore';

export function PhotoViewer({ photoRef, onClose }) {
  const isDirectUrl = typeof photoRef === 'string' && (/^https?:\/\//i.test(photoRef) || photoRef.startsWith('/'));
  const src = photoRef ? (isDirectUrl ? photoRef : resolvePhoto(photoRef)) : null;
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!photoRef) return undefined;
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
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
  }, [photoRef, onClose]);
  if (!photoRef) return null;

  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="admin-photo-viewer" role="dialog" aria-modal="true" aria-label={ADMIN_COPY.photoAlt}>
        <button type="button" className="admin-icon-button admin-photo-viewer__close" onClick={onClose} aria-label={ADMIN_COPY.close}>
          <X aria-hidden="true" />
        </button>
        {src ? <img src={src} alt={ADMIN_COPY.photoAlt} /> : <p role="status">{ADMIN_COPY.photoMissing}</p>}
      </section>
    </div>
  );
}

export default PhotoViewer;
