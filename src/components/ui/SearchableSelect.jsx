import { useEffect, useId, useMemo, useRef, useState } from 'react';

export function SearchableSelect({
  id,
  label,
  options = [],
  value = '',
  onChange,
  className = '',
  placeholder = 'Type to search',
  noResultsText = 'No results found',
  ...props
}) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const listId = `${controlId}-options`;
  const rootRef = useRef(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedOptions = useMemo(() => options.map((option) => (
    typeof option === 'string'
      ? { value: option, label: option }
      : { ...option, value: String(option.value), label: String(option.label) }
  )), [options]);
  const selectedOption = normalizedOptions.find((option) => option.value === String(value));
  const filteredOptions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term
      ? normalizedOptions.filter((option) => option.label.toLocaleLowerCase().includes(term))
      : [];
  }, [normalizedOptions, query]);
  const showOptions = editing && query.trim().length > 0;

  useEffect(() => {
    const closeOnOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setEditing(false);
        setQuery('');
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  const chooseOption = (option) => {
    onChange?.(option.value, option);
    setQuery('');
    setEditing(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && showOptions && filteredOptions.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filteredOptions.length);
    } else if (event.key === 'ArrowUp' && showOptions && filteredOptions.length) {
      event.preventDefault();
      setActiveIndex((index) => (
        index < 0 || index >= filteredOptions.length || index === 0
          ? filteredOptions.length - 1
          : index - 1
      ));
    } else if (event.key === 'Enter' && showOptions && filteredOptions.length) {
      event.preventDefault();
      chooseOption(filteredOptions[activeIndex >= 0 && activeIndex < filteredOptions.length ? activeIndex : 0]);
    } else if (event.key === 'Escape' && editing) {
      event.preventDefault();
      setQuery('');
      setEditing(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={rootRef} className={['searchable-select', className].filter(Boolean).join(' ')}>
      {label ? <label className="form-field__label" htmlFor={controlId}>{label}</label> : null}
      <input
        {...props}
        id={controlId}
        className="form-field__control searchable-select__input"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showOptions}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        value={editing ? query : selectedOption?.label || ''}
        placeholder={placeholder}
        onFocus={() => {
          setQuery('');
          setActiveIndex(-1);
          setEditing(true);
        }}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget)) {
            setEditing(false);
            setQuery('');
            setActiveIndex(-1);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setEditing(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {showOptions ? (
        <ul id={listId} className="searchable-select__options" role="listbox">
          {filteredOptions.length ? filteredOptions.map((option, index) => (
            <li key={option.value} role="presentation">
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className="searchable-select__option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(option)}
              >
                {option.label}
              </button>
            </li>
          )) : (
            <li className="searchable-select__empty" role="option" aria-disabled="true">{noResultsText}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default SearchableSelect;
