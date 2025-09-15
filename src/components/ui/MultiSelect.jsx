import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function MultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = 'Select...',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (opt) => {
    const has = value.includes(opt);
    const next = has ? value.filter((v) => v !== opt) : [...value, opt];
    onChange && onChange(next);
  };

  const clearAll = () => onChange && onChange([]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o).toLowerCase().includes(q));
  }, [options, query]);

  const selectedPreview = useMemo(() => {
    if (!value?.length) return placeholder;
    if (value.length <= 2) return value.join(', ');
    return `${value.slice(0, 2).join(', ')} +${value.length - 2}`;
  }, [value, placeholder]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        className="border rounded-md text-sm px-2 py-1 bg-white hover:bg-gray-50"
        onClick={() => setOpen(!open)}
      >
        {selectedPreview}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-64 max-h-64 overflow-auto bg-white border rounded-md shadow-lg p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full mb-2 border rounded px-2 py-1 text-sm"
          />
          <ul className="space-y-1">
            {filtered.map((opt) => (
              <li key={opt}>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value.includes(opt)}
                    onChange={() => toggle(opt)}
                  />
                  <span>{opt}</span>
                </label>
              </li>
            ))}
            {!filtered.length && (
              <li className="text-xs text-gray-500 px-1">No options</li>
            )}
          </ul>
          <div className="flex justify-between items-center mt-2 pt-2 border-t">
            <button className="text-xs text-gray-600 hover:underline" onClick={clearAll}>Clear</button>
            <button
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

