import { useEffect, useId, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY_MS = 300;

export function AsyncLocationCombobox({
  id,
  label,
  value = '',
  onSelect,
  loadOptions,
  disabled = false,
  hint = '',
  placeholder = 'Type to search',
}) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const listId = `${controlId}-options`;
  const inputRef = useRef(null);
  const requestId = useRef(0);
  const [query, setQuery] = useState(value);
  const [editing, setEditing] = useState(false);
  const [resultSet, setResultSet] = useState({ query: '', loadOptions: null, options: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const queryText = editing ? query : value;
  const options = resultSet.query === query && resultSet.loadOptions === loadOptions
    ? resultSet.options
    : [];

  useEffect(() => {
    const currentRequest = ++requestId.current;
    if (disabled || !editing || query.trim().length < MIN_QUERY_LENGTH) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      setActiveIndex(-1);
      try {
        const results = await loadOptions(query.trim());
        if (requestId.current === currentRequest) {
          setResultSet({ query, loadOptions, options: results });
        }
      } catch (searchError) {
        console.error('Unable to search PSGC locations.', searchError);
        if (requestId.current === currentRequest) {
          setResultSet({ query, loadOptions, options: [] });
          setError('We couldn’t load these locations.');
        }
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      if (requestId.current === currentRequest) requestId.current += 1;
    };
  }, [disabled, editing, loadOptions, query]);

  const chooseOption = (option) => {
    setQuery(option.full_name || option.name);
    setEditing(false);
    setActiveIndex(-1);
    onSelect(option);
  };

  const retry = async () => {
    const currentRequest = ++requestId.current;
    setEditing(true);
    setLoading(true);
    setError('');
    try {
      const results = await loadOptions(query.trim());
      if (requestId.current === currentRequest) setResultSet({ query, loadOptions, options: results });
    } catch (searchError) {
      console.error('Unable to retry PSGC location search.', searchError);
      if (requestId.current === currentRequest) {
        setResultSet({ query, loadOptions, options: [] });
        setError('We couldn’t load these locations.');
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
    } else if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault();
      setActiveIndex((index) => (
        index <= 0 ? options.length - 1 : index - 1
      ));
    } else if (event.key === 'Enter' && activeIndex >= 0 && options[activeIndex]) {
      event.preventDefault();
      chooseOption(options[activeIndex]);
    } else if (event.key === 'Escape' && editing) {
      event.preventDefault();
      setEditing(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    } else if (event.key === 'Tab') {
      setEditing(false);
      setActiveIndex(-1);
    }
  };

  const showList = editing && !disabled && query.trim().length >= MIN_QUERY_LENGTH;
  const messageId = `${controlId}-message`;

  return (
    <div className="async-location-combobox">
      {label ? <label className="form-field__label" htmlFor={controlId}>{label}</label> : null}
      <input
        ref={inputRef}
        id={controlId}
        className="form-field__control"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-describedby={disabled && hint ? messageId : error || (showList && !loading && !options.length) ? messageId : undefined}
        disabled={disabled}
        value={queryText}
        placeholder={disabled ? 'Select a parent location first' : placeholder}
        onFocus={() => {
          setQuery(value);
          setEditing(true);
          setActiveIndex(-1);
        }}
        onBlur={() => {
          setEditing(false);
          setActiveIndex(-1);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setEditing(true);
          setActiveIndex(-1);
          setError('');
          onSelect(null);
        }}
        onKeyDown={handleKeyDown}
      />
      {hint && disabled ? <span className="form-field__hint" id={messageId}>{hint}</span> : null}
      {error ? (
        <div className="async-location-combobox__status" id={messageId} role="alert">
          <span>{error}</span>
          <button type="button" className="text-link" onMouseDown={(event) => event.preventDefault()} onClick={retry} disabled={loading}>
            <RotateCw size={14} aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}
      {showList ? (
        <div className="async-location-combobox__popover">
          {loading ? <span className="async-location-combobox__status" role="status">Searching locations…</span> : null}
          {!loading && !error && options.length === 0 ? (
            <span className="async-location-combobox__status" id={messageId} role="status">No matches</span>
          ) : null}
          {!loading && !error && options.length > 0 ? (
            <ul className="async-location-combobox__options" id={listId} role="listbox" aria-label={`${label} matches`}>
              {options.map((option, index) => (
                <li
                  key={option.code}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? 'is-active' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseOption(option)}
                >
                  {option.full_name || option.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default AsyncLocationCombobox;
