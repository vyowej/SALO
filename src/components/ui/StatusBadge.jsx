const STATUS_TONES = new Set(['success', 'warning', 'danger', 'info', 'neutral']);

export function StatusBadge({ icon: Icon, label, tone = 'neutral', className = '', ...props }) {
  if (!Icon || !label) {
    throw new Error('StatusBadge requires both an icon and a label.');
  }
  if (!STATUS_TONES.has(tone)) {
    throw new Error(`Unsupported status tone: ${tone}`);
  }

  return (
    <span className={['status-badge', `status-badge--${tone}`, className].filter(Boolean).join(' ')} {...props}>
      <Icon aria-hidden="true" focusable="false" />
      <span>{label}</span>
    </span>
  );
}

export default StatusBadge;
