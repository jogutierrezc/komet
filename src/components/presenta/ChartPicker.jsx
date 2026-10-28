import React, { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import ChartThumb from './ChartThumb';
import { groupCatalog, ESSENTIAL_CHART_IDS } from '../../lib/estadistica/chartCatalog';
import { useReveal, usePulse } from './usePresentaMotion';

const KIND_LABEL = { bar: 'Barras', line: 'Línea', table: 'Tabla' };

/** Catálogo de gráficas de Estadística agrupado por tema, con miniatura y selección múltiple. */
export default function ChartPicker({ catalog, selectedIds, onChange, suggestedCount }) {
  const groups = groupCatalog(catalog);
  const [groupId, setGroupId] = useState('todas');
  const gridRef = useRef(null);
  const pulse = usePulse(gridRef);
  const visible = groupId === 'todas' ? catalog : catalog.filter((c) => c.group === groupId);
  useReveal(gridRef, [groupId, catalog.length], { selector: '[data-card]', y: 8, stagger: 0.025 });

  const selected = new Set(selectedIds);
  const toggle = (id, el) => {
    onChange(selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
    pulse(el);
  };
  const essentials = ESSENTIAL_CHART_IDS.filter((id) => catalog.some((c) => c.id === id));
  const suggested = [...essentials, ...catalog.map((c) => c.id).filter((id) => !essentials.includes(id))].slice(0, Math.max(suggestedCount, essentials.length));

  if (!catalog.length) return <p className="text-sm text-ink-2 py-6">No hay datos con estos filtros para armar gráficas.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange(suggested)} className="k-btn-secondary !h-9 !text-[13px]">Usar sugeridas ({suggested.length})</button>
        <button type="button" onClick={() => onChange([])} disabled={!selectedIds.length} className="text-[13px] font-semibold text-ink-2 hover:text-ink disabled:opacity-40">Limpiar</button>
        <span className="font-mono text-xs text-ink-2 sm:ml-auto">{selectedIds.length} DE {catalog.length} ELEGIDAS</span>
      </div>

      <div role="tablist" aria-label="Temas de gráficas" className="flex flex-wrap gap-1.5">
        {[{ id: 'todas', label: 'Todas', charts: catalog }, ...groups].map((g) => {
          const count = g.charts.filter((c) => selected.has(c.id)).length;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={groupId === g.id}
              onClick={() => setGroupId(g.id)}
              className={`h-9 px-3 rounded-full border text-[13px] font-semibold transition-colors ${groupId === g.id ? 'bg-ink border-ink text-white' : 'bg-white border-line-strong text-ink hover:bg-paper'}`}
            >
              {g.label}{count ? <span className="ml-1.5 font-mono text-[11px] opacity-80">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <ul ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
        {visible.map((c) => {
          const on = selected.has(c.id);
          return (
            <li key={c.id} data-card>
              <button
                type="button"
                aria-pressed={on}
                onClick={(e) => toggle(c.id, e.currentTarget)}
                className={`relative w-full text-left rounded-lg border p-3 flex flex-col gap-2 transition-colors ${on ? 'bg-blue-50 border-blue-600' : 'bg-white border-line hover:border-line-strong'}`}
              >
                <div className="h-[72px] border border-line bg-white px-2 py-1.5 overflow-hidden"><ChartThumb spec={c} /></div>
                <span className="block text-sm font-semibold leading-snug pr-6">{c.title}</span>
                <span className="block text-[12px] text-ink-2 leading-snug">{c.subtitle}</span>
                <span className="font-mono text-[11px] text-ink-2 uppercase">{c.groupLabel} · {KIND_LABEL[c.kind]}</span>
                <span aria-hidden="true" className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-line-strong bg-white'}`}>
                  {on ? <Check size={12} strokeWidth={3} /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
