import React from 'react';

export default function PresentaSelect({ id, label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="k-label block">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="k-input !h-10 !text-sm">
        {options.map((opt) => {
          const [val, text] = Array.isArray(opt) ? opt : [opt, opt];
          return <option key={val} value={val}>{text}</option>;
        })}
      </select>
    </div>
  );
}
