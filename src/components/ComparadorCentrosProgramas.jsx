import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Table2, ChevronDown, X, Check, Building2, BookOpen, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calculateCrossMatrix, avg, stdDev } from '../utils/dataHelpers';

// ─── Multi-select dropdown reutilizable ───
function MultiSelect({ label, icon: Icon, options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const allSelected = selected.size === options.length;
  const toggleAll = () => {
    if (allSelected) {
      onChange(new Set());
    } else {
      onChange(new Set(options));
    }
  };

  const toggle = (opt) => {
    const next = new Set(selected);
    if (next.has(opt)) {
      next.delete(opt);
    } else {
      next.add(opt);
    }
    onChange(next);
  };

  const displayText = selected.size === 0
    ? placeholder || 'Ninguno'
    : selected.size === options.length
      ? `Todos (${options.length})`
      : `${selected.size} seleccionados`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
      >
        {Icon && <Icon className="w-4 h-4 text-indigo-500 shrink-0" />}
        <span className="flex-1 text-left truncate text-slate-700">{displayText}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={toggleAll}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border-b border-slate-100 sticky top-0 bg-white"
          >
            {allSelected ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
            {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
          </button>
          {options.map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-3 px-4 py-2 text-sm cursor-pointer transition-colors ${
                selected.has(opt) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => toggle(opt)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Score chip con color según rango ───
function ScoreChip({ score, compact }) {
  const color = score >= 4.0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : score >= 3.5 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';

  const trend = score >= 4.0 ? <TrendingUp className="w-3 h-3" />
    : score >= 3.5 ? <Minus className="w-3 h-3" />
    : <TrendingDown className="w-3 h-3" />;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono font-semibold ${color}`}>
      {!compact && trend}
      {score.toFixed(2)}
    </span>
  );
}

// ─── Componente principal ───
export default function ComparadorCentrosProgramas({ centerAnalysis, loading }) {
  const crossMatrix = useMemo(() => calculateCrossMatrix(centerAnalysis), [centerAnalysis]);

  const [selectedCenters, setSelectedCenters] = useState(
    () => new Set(crossMatrix.allCenters)
  );
  const [selectedPrograms, setSelectedPrograms] = useState(
    () => new Set(crossMatrix.allPrograms)
  );

  // Reset cuando cambian los datos subyacentes — selecciona todo
  useEffect(() => {
    setSelectedCenters(new Set(crossMatrix.allCenters));
    setSelectedPrograms(new Set(crossMatrix.allPrograms));
  }, [crossMatrix.allCenters.length, crossMatrix.allPrograms.length]);

  // Datos filtrados para la matriz
  const matrixData = useMemo(() => {
    const centers = crossMatrix.allCenters.filter(c => selectedCenters.has(c));
    const programs = crossMatrix.allPrograms.filter(p => selectedPrograms.has(p));

    // Puntaje promedio por centro (en los programas seleccionados)
    const centerAvgs = centers.map(cName => {
      const scores = programs
        .map(p => crossMatrix.matrix[cName]?.[p]?.score)
        .filter(s => s !== null && s !== undefined);
      return { name: cName, avg: scores.length ? avg(scores) : null };
    });

    // Puntaje promedio por programa (en los centros seleccionados)
    const programAvgs = programs.map(pName => {
      const scores = centers
        .map(c => crossMatrix.matrix[c]?.[pName]?.score)
        .filter(s => s !== null && s !== undefined);
      return { name: pName, avg: scores.length ? avg(scores) : null };
    });

    return { centers, programs, centerAvgs, programAvgs };
  }, [crossMatrix, selectedCenters, selectedPrograms]);

  // Insights
  const insights = useMemo(() => {
    if (!matrixData.centers.length || !matrixData.programs.length) return null;

    const allScores = [];
    for (const c of matrixData.centers) {
      for (const p of matrixData.programs) {
        const cell = crossMatrix.matrix[c]?.[p];
        if (cell?.score !== null && cell?.score !== undefined) {
          allScores.push({ center: c, program: p, score: cell.score, total: cell.total });
        }
      }
    }

    if (!allScores.length) return null;

    const sorted = [...allScores].sort((a, b) => b.score - a.score);
    const globalAvg = avg(allScores.map(s => s.score));
    const variability = stdDev(allScores.map(s => s.score));

    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      globalAvg,
      variability,
      total: allScores.length
    };
  }, [crossMatrix, matrixData]);

  if (loading) return null;
  if (!centerAnalysis?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Table2 className="w-5 h-5 text-indigo-500" />
          Análisis Comparativo: Centros × Programas
        </h3>
        <p className="text-sm text-slate-400 mt-4">No hay datos de centros disponibles para el análisis comparativo.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
            <Table2 className="w-5 h-5 text-indigo-500" />
            Análisis Comparativo: Centros × Programas
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Matriz de puntajes cruzados entre centros de práctica y programas académicos.
            Selecciona los centros y programas que deseas comparar.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span> ≥4.0</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-300"></span> 3.5–3.99</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300"></span> {'<'}3.5</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-slate-100 border border-slate-300"></span> Sin datos</span>
        </div>
      </div>

      {/* Selectores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Centros de Práctica
          </label>
          <MultiSelect
            icon={Building2}
            options={crossMatrix.allCenters}
            selected={selectedCenters}
            onChange={setSelectedCenters}
            placeholder="Seleccionar centros..."
          />
          <p className="text-xs text-slate-400 mt-1">{crossMatrix.allCenters.length} centros disponibles</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Programas Académicos
          </label>
          <MultiSelect
            icon={BookOpen}
            options={crossMatrix.allPrograms}
            selected={selectedPrograms}
            onChange={setSelectedPrograms}
            placeholder="Seleccionar programas..."
          />
          <p className="text-xs text-slate-400 mt-1">{crossMatrix.allPrograms.length} programas disponibles</p>
        </div>
      </div>

      {/* Matriz */}
      {matrixData.centers.length > 0 && matrixData.programs.length > 0 ? (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 text-left p-2.5 font-semibold text-slate-700 border border-slate-200 min-w-[160px]">
                  Centro / Programa
                </th>
                {matrixData.programs.map(p => (
                  <th key={p} className="text-center p-2.5 font-semibold text-slate-700 border border-slate-200 min-w-[100px] bg-slate-50">
                    <span className="text-xs leading-tight block max-w-[100px] truncate" title={p}>{p}</span>
                  </th>
                ))}
                <th className="text-center p-2.5 font-semibold text-indigo-700 border border-slate-200 bg-indigo-50 min-w-[90px]">
                  Prom. Centro
                </th>
                <th className="text-center p-2.5 font-semibold text-slate-600 border border-slate-200 bg-slate-50 min-w-[70px]">
                  Tot.
                </th>
              </tr>
            </thead>
            <tbody>
              {matrixData.centers.map((cName, cIdx) => {
                const cAvg = matrixData.centerAvgs.find(a => a.name === cName);
                const totalEval = matrixData.programs.reduce((sum, p) => {
                  return sum + (crossMatrix.matrix[cName]?.[p]?.total || 0);
                }, 0);
                return (
                  <tr key={cName} className={cIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="sticky left-0 z-10 p-2.5 border border-slate-200 font-medium text-slate-800 text-xs bg-inherit">
                      {cName}
                    </td>
                    {matrixData.programs.map(p => {
                      const cell = crossMatrix.matrix[cName]?.[p];
                      const score = cell?.score;
                      const total = cell?.total || 0;
                      const bgColor = score === null || score === undefined
                        ? 'bg-slate-50'
                        : score >= 4.0 ? 'bg-emerald-50'
                        : score >= 3.5 ? 'bg-amber-50'
                        : 'bg-red-50';
                      return (
                        <td key={p} className={`text-center p-2 border border-slate-200 ${bgColor}`}>
                          {score !== null && score !== undefined ? (
                            <div className="flex flex-col items-center">
                              <span className="font-mono font-bold text-sm">{score.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-400">({total})</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center p-2.5 border border-slate-200 bg-indigo-50/50 font-semibold">
                      {cAvg?.avg !== null && cAvg?.avg !== undefined ? (
                        <ScoreChip score={cAvg.avg} compact />
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-center p-2.5 border border-slate-200 bg-slate-50 text-xs text-slate-500 font-mono">
                      {totalEval}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50/80">
                <td className="sticky left-0 z-10 p-2.5 border border-slate-200 font-semibold text-indigo-700 text-xs bg-inherit">
                  Promedio Programa
                </td>
                {matrixData.programs.map(p => {
                  const pAvg = matrixData.programAvgs.find(a => a.name === p);
                  return (
                    <td key={p} className="text-center p-2.5 border border-slate-200 font-semibold">
                      {pAvg?.avg !== null && pAvg?.avg !== undefined ? (
                        <ScoreChip score={pAvg.avg} compact />
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-center p-2.5 border border-slate-200 bg-indigo-100 font-semibold text-indigo-800">
                  {insights ? (
                    <ScoreChip score={insights.globalAvg} />
                  ) : '—'}
                </td>
                <td className="text-center p-2.5 border border-slate-200 bg-slate-100 text-xs text-slate-500">
                  —
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 mb-6">
          <Table2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Selecciona al menos un centro y un programa para ver la matriz comparativa.</p>
        </div>
      )}

      {/* Insights */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Mejor combinación</p>
            <p className="text-sm font-bold text-emerald-800 mt-0.5">{insights.best.center}</p>
            <p className="text-xs text-emerald-600">{insights.best.program}: <strong>{insights.best.score.toFixed(2)}</strong> ({insights.best.total} eval.)</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 border border-red-100">
            <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Menor puntaje</p>
            <p className="text-sm font-bold text-red-800 mt-0.5">{insights.worst.center}</p>
            <p className="text-xs text-red-600">{insights.worst.program}: <strong>{insights.worst.score.toFixed(2)}</strong> ({insights.worst.total} eval.)</p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
            <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Promedio global</p>
            <p className="text-sm font-bold text-indigo-800 mt-0.5">{insights.globalAvg.toFixed(2)} / 5,0</p>
            <p className="text-xs text-indigo-600">Desv. est.: {insights.variability.toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Cobertura</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{insights.total} combinaciones</p>
            <p className="text-xs text-slate-500">
              {matrixData.centers.length} centros × {matrixData.programs.length} programas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
