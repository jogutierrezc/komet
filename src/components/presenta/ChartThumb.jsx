import React from 'react';

// Miniatura de una gráfica del catálogo: barras, línea o filas de tabla, con los datos reales.
export default function ChartThumb({ spec }) {
  if (spec.kind === 'table') {
    return (
      <div aria-hidden="true" className="h-full flex flex-col justify-center gap-1">
        {spec.table.rows.slice(0, 4).map((row, i) => (
          <div key={i} className="flex items-center gap-1.5 border-b border-line pb-0.5 text-[8px] text-ink-2">
            <span className="flex-1 truncate">{row[0]}</span>
            <span className="font-mono">{row[row.length - 1]}</span>
          </div>
        ))}
      </div>
    );
  }

  const values = spec.series[0].values;
  if (spec.kind === 'line') {
    const max = Math.max(...values, spec.scoreScale ? 5 : 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const points = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 96 + 2},${46 - ((v - min) / span) * 42}`).join(' ');
    return (
      <svg aria-hidden="true" viewBox="0 0 100 50" className="w-full h-full text-blue-600" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  const shown = spec.categories.slice(0, 5);
  const max = spec.scoreScale ? 5 : Math.max(...spec.series.flatMap((s) => s.values), 1);
  return (
    <div aria-hidden="true" className="h-full flex flex-col justify-center gap-1">
      {shown.map((cat, i) => (
        <div key={cat} className="flex items-center gap-1.5 text-[8px] text-ink-2">
          <span className="w-12 truncate">{cat}</span>
          <div className="flex-1 flex flex-col gap-px">
            {spec.series.slice(0, 3).map((se, k) => (
              <div key={se.name} className="h-1 bg-paper">
                <div className={`h-1 ${k === 0 ? 'bg-blue-600' : k === 1 ? 'bg-comet' : 'bg-ink-2'}`} style={{ width: `${Math.min(100, ((se.values[i] || 0) / max) * 100)}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
