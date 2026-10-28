export function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal__header">
          <h3 id="modal-title">{title}</h3>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
