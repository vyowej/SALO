export function Toast({ message, visible }) {
  if (!visible) return null;

  return <div className="toast" role="status" aria-live="polite" aria-atomic="true">{message}</div>;
}

export default Toast;
