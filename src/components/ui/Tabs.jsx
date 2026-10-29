import { useId } from 'react';

export function Tabs({ items, value, onChange, label, className = '' }) {
  const generatedId = useId();

  return (
    <div className={['tabs', className].filter(Boolean).join(' ')} role="tablist" aria-label={label}>
      {items.map((item, index) => {
        const selected = item.value === value;

        return (
          <button
            key={item.value}
            id={`${generatedId}-tab-${index}`}
            type="button"
            className="tabs__tab"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
