import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, CalendarRange, Check, Loader2, Lock, Plus, X } from 'lucide-react';
import { closePeriod, getPeriods, getSurveys, openPeriod } from '../lib/data';
import { parseDescription } from './evaluaciones/surveyModel';
import { PERIOD_FILTER_KEY } from '../lib/periodFilter';

const fmtDate = (value) => {
  if (!value) return '–';
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Siguiente código: 2026-A → 2026-B → 2027-A.
function suggestCode(current) {
  const match = /^(\d{4})-([AB])$/.exec(current?.code || '');
  if (match) return match[2] === 'A' ? `${match[1]}-B` : `${Number(match[1]) + 1}-A`;
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() < 6 ? 'A' : 'B'}`;
}

function suggestDates(code) {
  const match = /^(\d{4})-([AB])$/.exec(code);
  if (!match) return { start: new Date().toISOString().slice(0, 10), end: '' };
  const year = match[1];
  return match[2] === 'A' ? { start: `${year}-01-15`, end: `${year}-06-30` } : { start: `${year}-07-15`, end: `${year}-12-15` };
}

const pct = (part, whole) => (whole ? Math.round((Number(part) / Number(whole)) * 100) : 0);

export default function Periodos({ onNavigate }) {
  const [state, setState] = useState({ loading: true, available: true, periods: [], stats: {}, surveys: [], error: '' });
  const [notice, setNotice] = useState('');
  const [wizard, setWizard] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ available, periods, stats }, surveys] = await Promise.all([getPeriods(), getSurveys().catch(() => [])]);
      setState({ loading: false, available, periods, stats, surveys, error: '' });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error?.message || 'No se pudieron cargar los períodos.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const { loading, available, periods, stats, surveys, error } = state;
  const current = periods.find((p) => p.status === 'abierto') || null;
  const history = periods.filter((p) => p.status === 'cerrado');

  const openAnalysis = (code, target) => {
    try { sessionStorage.setItem(PERIOD_FILTER_KEY, code); } catch { /* sin almacenamiento */ }
    onNavigate?.(target);
  };

  if (loading) {
    return <p className="py-24 text-center text-sm text-ink-2 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Cargando períodos…</p>;
  }

  if (!available) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="k-card p-6 space-y-3 max-w-2xl">
          <p className="font-display text-xl font-bold">Falta preparar la base de datos</p>
          <p className="text-sm text-ink-2 leading-relaxed">Los períodos necesitan nuevas tablas. Ejecuta el archivo <span className="font-mono text-[13px] text-ink">db/evaluation_periods.sql</span> completo en el SQL Editor de Supabase y recarga esta página. Mientras tanto, el resto de la aplicación funciona como siempre.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader action={<button type="button" onClick={() => setWizard(true)} className="k-btn"><Plus size={18} /> Abrir nuevo período</button>} />

      {notice ? <div role="status" className="rounded-lg bg-score-high-bg text-score-high-fg px-4 py-3 text-sm font-medium">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-lg bg-score-low-bg text-score-low-fg px-4 py-3 text-sm font-medium">{error}</div> : null}

      {current ? (
        <CurrentCard period={current} stats={stats[current.id]} onClose={() => setClosing(true)} onForms={() => onNavigate?.('evaluaciones')} onAnalysis={() => openAnalysis(current.code, 'estadistica')} />
      ) : (
        <div className="k-card p-8 space-y-3">
          <p className="font-display text-2xl font-bold">No hay un período abierto</p>
          <p className="text-sm text-ink-2 max-w-xl">Los enlaces públicos no reciben respuestas hasta que abras uno. Los formularios del período anterior se pueden traer como copias.</p>
          <button type="button" onClick={() => setWizard(true)} className="k-btn"><Plus size={16} /> Abrir un período</button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">Histórico</h2>
          <span className="k-label">{history.length} {history.length === 1 ? 'período cerrado' : 'períodos cerrados'}</span>
        </div>
        {history.length === 0 ? (
          <p className="k-card p-6 text-sm text-ink-2">Cuando cierres un período aparecerá aquí con sus formularios y respuestas, que quedan intactos para consultarlos.</p>
        ) : (
          <div className="k-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-paper/60">
                    <th className="k-label px-4 py-3">Período</th>
                    <th className="k-label px-4 py-3">Fechas</th>
                    <th className="k-label px-4 py-3 text-right">Formularios</th>
                    <th className="k-label px-4 py-3 text-right">Evaluaciones</th>
                    <th className="k-label px-4 py-3 text-right">Completadas</th>
                    <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {history.map((p) => {
                    const st = stats[p.id] || p.summary || {};
                    return (
                      <tr key={p.id} className="border-t border-line">
                        <td className="px-4 py-3.5"><span className="font-display text-lg font-bold">{p.code}</span>{p.name ? <span className="block text-xs text-ink-2">{p.name}</span> : null}</td>
                        <td className="px-4 py-3.5 text-ink-2">{fmtDate(p.starts_on)} – {fmtDate(p.ends_on)}</td>
                        <td className="px-4 py-3.5 text-right font-mono">{st.formularios ?? '–'}</td>
                        <td className="px-4 py-3.5 text-right font-mono">{st.evaluaciones ?? '–'}</td>
                        <td className="px-4 py-3.5 text-right font-mono">{st.evaluaciones ? `${pct(st.completadas, st.evaluaciones)} %` : '–'}</td>
                        <td className="px-2 py-2">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => openAnalysis(p.code, 'estadistica')} className="k-btn-secondary !h-9 !text-[13px]"><BarChart3 size={14} /> Estadística</button>
                            <button type="button" onClick={() => openAnalysis(p.code, 'reportes')} className="k-btn-secondary !h-9 !text-[13px]">Informe</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {wizard ? (
        <OpenPeriodDialog
          periods={periods}
          current={current}
          stats={stats}
          surveys={surveys}
          onCancel={() => setWizard(false)}
          onDone={async (code, copied) => {
            setWizard(false);
            setNotice(`Período ${code} abierto con ${copied} ${copied === 1 ? 'formulario' : 'formularios'}.`);
            await load();
          }}
        />
      ) : null}

      {closing && current ? (
        <CloseDialog
          period={current}
          stats={stats[current.id]}
          onCancel={() => setClosing(false)}
          onDone={async () => { setClosing(false); setNotice(`Período ${current.code} cerrado y guardado en el histórico.`); await load(); }}
        />
      ) : null}
    </div>
  );
}

function PageHeader({ action }) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1.5">
        <p className="k-label">Evaluación / Períodos</p>
        <h1 className="font-display text-4xl font-bold leading-tight">Períodos de evaluación</h1>
        <p className="text-[15px] text-ink-2">Abre un período para recibir respuestas y ciérralo para guardarlo como histórico.</p>
      </div>
      {action}
    </header>
  );
}

function CurrentCard({ period, stats, onClose, onForms, onAnalysis }) {
  const st = stats || {};
  const daysLeft = period.ends_on ? Math.ceil((new Date(`${period.ends_on}T23:59:59`) - new Date()) / 86400000) : null;
  return (
    <section className="k-card">
      <div className="p-6 md:p-8 flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
        <div className="space-y-2">
          <span className="k-pill k-pill-high">Abierto</span>
          <p className="font-display text-6xl font-bold tracking-tight leading-none">{period.code}</p>
          <p className="text-sm text-ink-2">
            {fmtDate(period.starts_on)} – {fmtDate(period.ends_on)}
            {daysLeft !== null ? <span className={`font-semibold ${daysLeft < 0 ? 'text-score-low-fg' : daysLeft <= 14 ? 'text-score-mid-fg' : 'text-ink'}`}> · {daysLeft < 0 ? `venció hace ${-daysLeft} días` : daysLeft === 0 ? 'termina hoy' : `quedan ${daysLeft} días`}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onForms} className="k-btn-secondary">Formularios <ArrowRight size={14} /></button>
          <button type="button" onClick={onAnalysis} className="k-btn-secondary"><BarChart3 size={14} /> Estadística</button>
          <button type="button" onClick={onClose} className="k-btn-secondary"><Lock size={14} /> Cerrar período</button>
        </div>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-4 border-t border-line divide-x divide-line">
        {[['Evaluaciones', st.evaluaciones ?? 0], ['Completadas', st.evaluaciones ? `${pct(st.completadas, st.evaluaciones)} %` : '–'], ['Formularios', st.formularios ?? 0], ['Sitios con respuestas', st.sitios ?? 0]].map(([label, value]) => (
          <div key={label} className="px-5 py-4 space-y-1"><dt className="k-label">{label}</dt><dd className="font-display text-3xl font-bold">{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}

function Modal({ label, children, onCancel, busy }) {
  return (
    <div className="fixed inset-0 z-50 bg-night/60 flex items-end sm:items-center justify-center sm:p-4" onClick={() => !busy && onCancel()}>
      <div role="dialog" aria-modal="true" aria-label={label} className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-line p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function CloseDialog({ period, stats, onCancel, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true);
    setError('');
    try { await closePeriod(period.id); await onDone(); } catch (e) { setError(e?.message || 'No se pudo cerrar el período.'); setBusy(false); }
  };
  return (
    <Modal label="Cerrar período" onCancel={onCancel} busy={busy}>
      <h2 className="font-display text-2xl font-bold">¿Cerrar el período {period.code}?</h2>
      <ul className="space-y-2.5 text-sm leading-relaxed">
        <li className="flex gap-2.5"><Check size={16} className="mt-0.5 text-score-high-fg shrink-0" />Sus {stats?.evaluaciones ?? 0} evaluaciones y sus formularios pasan al histórico, sin cambios.</li>
        <li className="flex gap-2.5"><AlertTriangle size={16} className="mt-0.5 text-score-mid-fg shrink-0" />Los enlaces públicos dejan de recibir respuestas hasta que abras otro período.</li>
        <li className="flex gap-2.5"><AlertTriangle size={16} className="mt-0.5 text-score-mid-fg shrink-0" />Un período cerrado no se puede reabrir ni editar.</li>
      </ul>
      {error ? <p role="alert" className="text-sm font-medium text-score-low-fg">{error}</p> : null}
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <button type="button" className="k-btn-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="button" className="k-btn" onClick={run} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Cerrar período</button>
      </div>
    </Modal>
  );
}

function OpenPeriodDialog({ periods, current, stats, surveys, onCancel, onDone }) {
  const source = current || periods[0] || null; // de dónde se copian los formularios
  const sourceSurveys = useMemo(() => (source ? surveys.filter((s) => s.period_id === source.id) : []), [surveys, source]);
  const initialCode = suggestCode(source);
  const [step, setStep] = useState(1);
  const [code, setCode] = useState(initialCode);
  const [dates, setDates] = useState(suggestDates(initialCode));
  const [picked, setPicked] = useState(() => new Set(sourceSurveys.map((s) => s.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const codeTrim = code.trim();
  const duplicate = periods.some((p) => p.code === codeTrim);
  const datesBad = dates.end && dates.start && dates.end < dates.start;
  const step1Error = !codeTrim ? 'Escribe el código del período.' : duplicate ? `Ya existe el período ${codeTrim}.` : datesBad ? 'La fecha de fin es anterior al inicio.' : '';

  const toggle = (id) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await openPeriod({ code: codeTrim, startsOn: dates.start, endsOn: dates.end || null, surveyIds: [...picked] });
      await onDone(codeTrim, picked.size);
    } catch (e) {
      setError(e?.message || 'No se pudo abrir el período.');
      setBusy(false);
    }
  };

  return (
    <Modal label="Abrir nuevo período" onCancel={onCancel} busy={busy}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="k-label">Paso {step} de 3</p>
          <h2 className="font-display text-2xl font-bold">Abrir nuevo período</h2>
        </div>
        <button type="button" aria-label="Cerrar" onClick={onCancel} disabled={busy} className="w-10 h-10 -mr-2 -mt-2 flex items-center justify-center text-ink-2 hover:text-ink"><X size={18} /></button>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="pd-code" className="k-label block">Código del período</label>
            <input id="pd-code" className="k-input !font-display !text-2xl !font-bold !h-14" value={code} onChange={(e) => setCode(e.target.value)} placeholder="2026-B" />
            <p className="text-xs text-ink-2">Con el formato 2026-A o 2026-B, los formularios copiados actualizan su período solos.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label htmlFor="pd-start" className="k-label block">Inicio</label><input id="pd-start" type="date" className="k-input !h-11 !text-sm" value={dates.start} onChange={(e) => setDates((d) => ({ ...d, start: e.target.value }))} /></div>
            <div className="space-y-1.5"><label htmlFor="pd-end" className="k-label block">Fin (opcional)</label><input id="pd-end" type="date" className="k-input !h-11 !text-sm" value={dates.end} onChange={(e) => setDates((d) => ({ ...d, end: e.target.value }))} /></div>
          </div>
          {step1Error ? <p role="alert" className="text-sm font-medium text-score-low-fg">{step1Error}</p> : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-2 leading-relaxed">{source ? <>Elige los formularios de <strong className="text-ink">{source.code}</strong> que pasan al nuevo período. Se copian: los originales quedan intactos con sus respuestas.</> : 'No hay formularios anteriores para copiar. Podrás crearlos después.'}</p>
          {sourceSurveys.length ? (
            <>
              <div className="flex gap-3 text-sm font-semibold">
                <button type="button" className="text-blue-600" onClick={() => setPicked(new Set(sourceSurveys.map((s) => s.id)))}>Todos</button>
                <button type="button" className="text-blue-600" onClick={() => setPicked(new Set())}>Ninguno</button>
              </div>
              <ul className="border border-line rounded-lg divide-y divide-line max-h-72 overflow-y-auto">
                {sourceSurveys.map((s) => (
                  <li key={s.id}>
                    <label className="flex items-start gap-3 px-3 py-3 cursor-pointer hover:bg-paper min-h-[52px]">
                      <input type="checkbox" className="w-[18px] h-[18px] mt-0.5 accent-blue-600" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
                      <span className="min-w-0"><span className="block text-sm font-semibold leading-snug">{s.title}</span><span className="block text-xs text-ink-2">{s.target_type}{parseDescription(s.description).programa ? ` · ${parseDescription(s.description).programa}` : ''}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <ul className="space-y-2.5 text-sm leading-relaxed">
            {current ? <li className="flex gap-2.5"><Lock size={16} className="mt-0.5 text-score-mid-fg shrink-0" />Se cierra el período <strong>{current.code}</strong> con sus {stats[current.id]?.evaluaciones ?? 0} evaluaciones, que pasan al histórico.</li> : null}
            <li className="flex gap-2.5"><CalendarRange size={16} className="mt-0.5 text-score-high-fg shrink-0" />Se abre <strong>{codeTrim}</strong> ({fmtDate(dates.start)} – {fmtDate(dates.end)}).</li>
            <li className="flex gap-2.5"><Check size={16} className="mt-0.5 text-score-high-fg shrink-0" />Se copian {picked.size} {picked.size === 1 ? 'formulario' : 'formularios'}; sus enlaces públicos siguen siendo los mismos.</li>
          </ul>
          {!picked.size ? <p className="text-sm font-medium text-score-mid-fg">No copiaste ningún formulario: los enlaces públicos no tendrán nada que mostrar hasta que crees uno.</p> : null}
          {error ? <p role="alert" className="text-sm font-medium text-score-low-fg">{error}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-1">
        <button type="button" className="k-btn-secondary" onClick={() => (step === 1 ? onCancel() : setStep(step - 1))} disabled={busy}>{step === 1 ? 'Cancelar' : 'Atrás'}</button>
        {step < 3 ? (
          <button type="button" className="k-btn" disabled={step === 1 && !!step1Error} onClick={() => setStep(step + 1)}>Continuar <ArrowRight size={14} /></button>
        ) : (
          <button type="button" className="k-btn" onClick={run} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Abrir período</button>
        )}
      </div>
    </Modal>
  );
}
