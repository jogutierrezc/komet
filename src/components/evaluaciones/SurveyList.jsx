import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Eye, Link2, Loader2, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { parseDescription, toTree, QUESTION_TYPES } from './surveyModel';

const TARGET_FILTERS = ['Todos', 'Estudiante', 'Profesor', 'Coordinador'];

const countQuestions = (survey) =>
  toTree(survey.questions || survey.preguntas || [])
    .flatMap((s) => s.questions.flatMap((n) => [n.q, ...n.children]))
    .filter((q) => !QUESTION_TYPES[q.tipo]?.noAnswer).length;

const formatDate = (value) => {
  if (!value) return '–';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function SurveyList({ surveys, loading, error, notice, campuses, periods = [], onOpenPeriods, onNew, onEdit, onPreview, onDuplicate, onCopyLink, onDelete }) {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState('Todos');
  const [campus, setCampus] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const hasPeriods = periods.length > 0;
  const openPeriodRow = periods.find((p) => p.status === 'abierto') || null;
  const [periodId, setPeriodId] = useState('');
  const [periodTouched, setPeriodTouched] = useState(false);
  // Por defecto se ven los formularios del período abierto; el histórico se elige a propósito.
  useEffect(() => { if (!periodTouched) setPeriodId(openPeriodRow ? String(openPeriodRow.id) : ''); }, [openPeriodRow, periodTouched]);
  const periodOf = (survey) => periods.find((p) => String(p.id) === String(survey.period_id)) || null;
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const campusName = (id) => campuses.find((c) => String(c.id) === String(id))?.name || 'Sin campus';

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return surveys.filter((s) => {
      if (target !== 'Todos' && s.target_type !== target) return false;
      if (campus && String(s.campus_id) !== String(campus)) return false;
      if (hasPeriods && periodId && String(s.period_id) !== periodId) return false;
      if (!q) return true;
      return `${s.title || ''} ${s.description || ''}`.toLowerCase().includes(q);
    });
  }, [surveys, query, target, campus, periodId, hasPeriods]);

  async function copy(survey) {
    const ok = await onCopyLink(survey.id);
    if (ok) {
      setCopiedId(survey.id);
      setTimeout(() => setCopiedId((id) => (id === survey.id ? null : id)), 2000);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError('');
    const result = await onDelete(toDelete);
    setDeleting(false);
    if (result?.ok) setToDelete(null);
    else setDeleteError(result?.message || 'No se pudo eliminar.');
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="k-label">Evaluación / Formularios</p>
          <h1 className="font-display text-4xl font-bold leading-tight">Formularios de evaluación</h1>
          <p className="text-[15px] text-ink-2">Crea los cuestionarios y comparte su enlace público.</p>
        </div>
        <button type="button" onClick={onNew} className="k-btn"><Plus size={18} /> Nueva evaluación</button>
      </header>

      {notice ? <div role="status" className="rounded-lg bg-score-high-bg text-score-high-fg px-4 py-3 text-sm font-medium">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-lg bg-score-low-bg text-score-low-fg px-4 py-3 text-sm font-medium">{error}</div> : null}
      {hasPeriods && !openPeriodRow ? (
        <div role="status" className="rounded-lg bg-score-mid-bg text-score-mid-fg px-4 py-3 text-sm font-medium flex flex-wrap items-center gap-x-4 gap-y-1">
          No hay un período abierto: los enlaces públicos no reciben respuestas.
          <button type="button" onClick={onOpenPeriods} className="font-semibold underline underline-offset-2">Abrir un período</button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 h-10 w-full sm:w-72 px-3 rounded-lg border border-line-strong bg-white text-sm text-ink-2 focus-within:border-blue-600">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre" aria-label="Buscar formulario" className="flex-1 min-w-0 bg-transparent outline-none text-ink placeholder:text-ink-2" />
        </label>
        {hasPeriods ? (
          <select aria-label="Período" value={periodId} onChange={(e) => { setPeriodTouched(true); setPeriodId(e.target.value); }} className="k-input !h-10 !w-auto !text-sm">
            <option value="">Todos los períodos</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.code}{p.status === 'abierto' ? ' · abierto' : ''}</option>)}
          </select>
        ) : null}
        <select aria-label="Campus" value={campus} onChange={(e) => setCampus(e.target.value)} className="k-input !h-10 !w-auto !text-sm">
          <option value="">Todos los campus</option>
          {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dirigido a">
          {TARGET_FILTERS.map((t) => (
            <button key={t} type="button" aria-pressed={target === t} onClick={() => setTarget(t)} className={`h-9 px-3.5 rounded-full border text-sm font-medium transition-colors ${target === t ? 'bg-ink border-ink text-white' : 'bg-white border-line-strong hover:bg-paper'}`}>{t}</button>
          ))}
        </div>
        <span className="k-label sm:ml-auto">{rows.length} {rows.length === 1 ? 'formulario' : 'formularios'}</span>
      </div>

      <div className="k-card overflow-hidden">
        {loading ? (
          <p className="py-16 text-center text-sm text-ink-2 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Cargando formularios…</p>
        ) : rows.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-3">
            <p className="font-display text-xl font-bold">{surveys.length ? 'Ningún formulario coincide' : 'Todavía no hay formularios'}</p>
            {!surveys.length ? <button type="button" onClick={onNew} className="k-btn mx-auto"><Plus size={16} /> Crear el primero</button> : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-paper/60">
                  <th className="k-label px-4 py-3">Formulario</th>
                  <th className="k-label px-4 py-3">Dirigido a</th>
                  <th className="k-label px-4 py-3 hidden lg:table-cell">Programa</th>
                  <th className="k-label px-4 py-3 text-right">Preguntas</th>
                  <th className="k-label px-4 py-3 hidden md:table-cell">Actualizado</th>
                  <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {rows.map((s) => {
                  const meta = parseDescription(s.description);
                  const period = periodOf(s);
                  const locked = period?.status === 'cerrado';
                  return (
                    <tr key={s.id} onClick={() => (locked ? onPreview(s) : onEdit(s))} className="border-t border-line cursor-pointer hover:bg-paper/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(s); }} className="text-left">
                          <span className="block font-semibold leading-tight">{s.title || 'Sin nombre'}{locked ? <Lock size={13} className="inline ml-1.5 -mt-0.5 text-ink-2" aria-label="Período cerrado" /> : null}</span>
                          <span className="block text-xs text-ink-2 mt-0.5">{campusName(s.campus_id)}{meta.escenario && meta.escenario !== 'Todos' ? ` · ${meta.escenario}` : ''}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3.5"><span className="k-pill bg-paper text-ink">{s.target_type}</span></td>
                      <td className="px-4 py-3.5 text-ink-2 hidden lg:table-cell">{meta.programa || '–'}{period ? <span className="font-mono text-xs"> · {period.code}</span> : meta.periodo ? <span className="font-mono text-xs"> · {meta.periodo}</span> : null}</td>
                      <td className="px-4 py-3.5 text-right font-mono">{countQuestions(s)}</td>
                      <td className="px-4 py-3.5 text-ink-2 hidden md:table-cell">{formatDate(s.updated_at || s.created_at)}</td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          {locked ? null : <RowBtn label="Editar" onClick={() => onEdit(s)}><Pencil size={16} /></RowBtn>}
                          <RowBtn label="Previsualizar" onClick={() => onPreview(s)}><Eye size={16} /></RowBtn>
                          <RowBtn label={copiedId === s.id ? 'Enlace copiado' : 'Copiar enlace público'} onClick={() => copy(s)}>{copiedId === s.id ? <Check size={16} className="text-score-high-fg" /> : <Link2 size={16} />}</RowBtn>
                          <RowBtn label="Duplicar" onClick={() => onDuplicate(s)}><Copy size={16} /></RowBtn>
                          {locked ? null : <RowBtn label="Eliminar" danger onClick={() => { setDeleteError(''); setToDelete(s); }}><Trash2 size={16} /></RowBtn>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toDelete ? (
        <div className="fixed inset-0 z-50 bg-night/60 flex items-center justify-center p-4" onClick={() => !deleting && setToDelete(null)}>
          <div role="alertdialog" aria-modal="true" aria-label="Eliminar formulario" className="k-card p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">¿Eliminar “{toDelete.title}”?</h2>
            <p className="text-sm text-ink-2 leading-relaxed">Se borra de forma permanente, junto con <strong className="text-ink">todas las respuestas recibidas</strong> con este formulario, y su enlace público deja de funcionar. Si solo quieres otra versión, usa Duplicar.</p>
            {deleteError ? <p role="alert" className="text-sm font-medium text-score-low-fg">{deleteError}</p> : null}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" className="k-btn-secondary" onClick={() => setToDelete(null)} disabled={deleting}>Cancelar</button>
              <button type="button" className="k-btn !bg-score-low hover:!brightness-95" onClick={confirmDelete} disabled={deleting}>
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Eliminar para siempre
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RowBtn({ label, onClick, danger, children }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={`w-10 h-10 flex items-center justify-center rounded-lg text-ink-2 transition-colors ${danger ? 'hover:bg-score-low-bg hover:text-score-low-fg' : 'hover:bg-paper hover:text-ink'}`}>
      {children}
    </button>
  );
}
