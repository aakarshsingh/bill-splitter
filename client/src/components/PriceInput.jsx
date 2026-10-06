import React, { useState } from 'react';

// Rupee input backed by a paise value. Keeps the raw text while focused so
// typing isn't reformatted mid-keystroke; shows 2 decimals otherwise.
export default function PriceInput({ paise, onChange, ...props }) {
  const [draft, setDraft] = useState(null);
  const formatted = paise == null ? '' : (paise / 100).toFixed(2);

  return (
    <input
      type="number"
      step="0.01"
      min="0"
      inputMode="decimal"
      {...props}
      value={draft ?? formatted}
      onFocus={(e) => {
        setDraft(formatted);
        e.target.select();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const num = parseFloat(e.target.value);
        onChange(isNaN(num) ? 0 : Math.round(num * 100));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
