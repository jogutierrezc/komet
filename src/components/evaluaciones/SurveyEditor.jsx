import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, ChevronLeft, Copy, Eye, Loader2, Plus, Save, Star, Trash2, X,
  Type, Hash, Calendar, ListTodo, CheckSquare, Info, Layers, AlertTriangle,
} from 'lucide-react';
import { getProgramsByCampus, getConveniosByCampus } from '../../lib/data';
import { useSurveyDraft } from './useSurveyDraft';
import {
  PALETTE, QUESTION_TYPES, TARGETS, answerChoices, draftStats, toTree, validateDraft,
} from './surveyModel';

const TYPE_ICONS = { rating: Star, yesno: CheckSquare, multiple: ListTodo, text: Type, number: Hash, date: Calendar, instruction: Info };
const LEVELS = ['Pregrado', 'Posgrado'];
const fieldClass ='k-input !h-10 !text-sm';

export default function SurveyEditor({ initialDraft, isNew, campuses, onSave, onPreview, onExit }) {
  const ed = useSurveyDraft(initialDraft);
  const { draft, selectedId, dirty } = ed;
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null); // { tone: 'ok' | 'error', text }
  const [confirmExit, setConfirmExit] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [sites, setSites] = useState([]);
  const canvasRef = useRef(null);

  const tree = useMemo(() => toTree(draft.items), [draft.items]);
  const issues = useMemo(() => validateDraft(draft), [draft]);
  const errors = issues.filter((i) => i.level === 'error');
  const issuesById = useMemo(() => {
    const map = new Map();
    issues.forEach((i) => { if (i.id) map.set(i.id, [...(map.get(i.id) || []), i]); });
    return map;
  }, [issues]);
  const stats = useMemo(() => draftStats(draft.items), [draft.items]);
  const selected = draft.items.find((i) => i.id === selectedId) || null;

  // Los escenarios dependen del campus; los programas, además, del nivel (pregrado / posgrado).
  useEffect(() => {
    let cancelled = false;
    if (!draft.campusId) { setSites([]); return undefined; }
    getConveniosByCampus(draft.campusId)
      .then((s) => { if (!cancelled) setSites(s || []); })
      .catch(() => { if (!cancelled) setSites([]); });
    return () => { cancelled = true; };
  }, [draft.campusId]);

  useEffect(() => {
    let cancelled = false;
    if (!draft.campusId) { setPrograms([]); return undefined; }
    getProgramsByCampus(draft.campusId, draft.meta.nivel || 'Pregrado')
      .then((p) => { if (!cancelled) setPrograms(p || []); })
      .catch(() => { if (!cancelled) setPrograms([]); });
    return () => { cancelled = true; };
  }, [draft.campusId, draft.meta.nivel]);

  async function handleSave() {
    if (saving) return;
    if (errors.length) {
      setBanner({ tone: 'error', text: `Corrige ${errors.length === 1 ? 'el problema' : `los ${errors.length} problemas`} marcados antes de guardar.` });
      ed.select(null);
      return;
    }
    setSaving(true);
    setBanner(null);
    const result = await onSave(draft);
    setSaving(false);
    if (result?.ok) {
      ed.saved();
      setBanner({ tone: 'ok', text: 'Cambios guardados.' });
    } else {
      setBanner({ tone: 'error', text: result?.message || 'No se pudo guardar. Intenta de nuevo.' });
    }
  }

  // Ctrl/Cmd + S guarda.
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!banner || banner.tone !== 'ok') return undefined;
    const t = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(t);
  }, [banner]);

  const tryExit = () => (dirty ? setConfirmExit(true) : onExit());

  const pickProgram = (name) => ed.setMetaField({ programa: name });

  // Al cambiar de nivel, el programa elegido deja de aplicar.
  const pickLevel = (nivel) => {
    if (nivel === (draft.meta.nivel || 'Pregrado')) return;
    ed.setMetaField({ nivel, programa: '' });
  };

  return (
    <div className="space-y-5">
      {/* Barra superior */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button type="button" onClick={tryExit} className="inline-flex items-center gap-1 h-10 -ml-2 px-2 text-sm font-semibold text-ink-2 hover:text-ink">
          <ChevronLeft size={18} /> Evaluaciones
        </button>
        <div className="flex-1 min-w-[200px]">
          <p className="k-label">{isNew ? 'Nueva evaluación' : 'Editando'}</p>
          <p className="font-display text-xl font-bold leading-tight truncate">{draft.title || 'Sin nombre'}</p>
        </div>
        <span className={`font-mono text-xs ${dirty ? 'text-score-mid-fg' : 'text-ink-2'}`}>{dirty ? 'SIN GUARDAR' : 'GUARDADO'}</span>
        <button type="button" onClick={() => onPreview(draft)} className="k-btn-secondary"><Eye size={16} /> Previsualizar</button>
        <button type="button" onClick={handleSave} disabled={saving} className="k-btn">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
        </button>
      </header>

      {banner ? (
        <div role={banner.tone === 'error' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-sm font-medium ${banner.tone === 'error' ? 'bg-score-low-bg text-score-low-fg' : 'bg-score-high-bg text-score-high-fg'}`}>
          {banner.text}
        </div>
      ) : null}

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Paleta */}
        <aside aria-label="Agregar" className="w-full xl:w-[208px] xl:shrink-0 xl:sticky xl:top-20 space-y-2">
          <p className="k-label">Agregar</p>
          <div className="flex xl:flex-col gap-2 overflow-x-auto xl:overflow-visible pb-1 xl:pb-0">
            <button type="button" onClick={ed.addSection} className="shrink-0 flex items-center gap-2.5 h-11 px-3 rounded-lg border border-line-strong bg-white text-sm font-semibold hover:bg-paper transition-colors">
              <Layers size={16} className="text-ink-2" /> Sección
            </button>
            {PALETTE.map((tipo) => {
              const Icon = TYPE_ICONS[tipo];
              const meta = QUESTION_TYPES[tipo];
              return (
                <button key={tipo} type="button" onClick={() => ed.addQuestion(tipo)} className={`shrink-0 flex items-center gap-2.5 min-h-[44px] px-3 py-1.5 rounded-lg border text-left transition-colors hover:bg-paper ${meta.scored ? 'border-blue-600 bg-blue-50' : 'border-line-strong bg-white'}`}>
                  <Icon size={16} className={meta.scored ? 'text-blue-600' : 'text-ink-2'} />
                  <span>
                    <span className="block text-sm font-semibold leading-tight whitespace-nowrap">{meta.label}</span>
                    {meta.hint ? <span className="hidden xl:block text-[11px] text-ink-2 leading-tight">{meta.hint}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Lienzo */}
        <main ref={canvasRef} className="flex-1 min-w-0 w-full space-y-5">
          <section className="k-card p-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="ev-title" className="k-label block">Nombre de la evaluación</label>
              <input id="ev-title" className="k-input !h-12 !text-lg !font-semibold" value={draft.title} onChange={(e) => ed.setMeta({ title: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Campus" id="ev-campus">
                <select id="ev-campus" className={fieldClass} value={draft.campusId} onChange={(e) => { ed.setMeta({ campusId: e.target.value }); ed.setMetaField({ programa: '', escenario: 'Todos' }); }}>
                  <option value="">Elige un campus</option>
                  {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Dirigido a" id="ev-target" wide>
                <div className="flex" role="group" aria-label="Dirigido a">
                  {TARGETS.map((t, i) => (
                    <button key={t} type="button" aria-pressed={draft.targetType === t} onClick={() => ed.setMeta({ targetType: t })}
                      className={`flex-1 h-10 border text-[13px] font-medium transition-colors ${i === 0 ? 'rounded-l-lg' : 'border-l-0'} ${i === TARGETS.length - 1 ? 'rounded-r-lg' : ''} ${draft.targetType === t ? 'bg-ink border-ink text-white' : 'bg-white border-line-strong text-ink hover:bg-paper'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Nivel de formación" id="ev-level">
                <div className="flex" role="group" aria-label="Nivel de formación">
                  {LEVELS.map((l, i) => (
                    <button key={l} type="button" aria-pressed={(draft.meta.nivel || 'Pregrado') === l} onClick={() => pickLevel(l)}
                      className={`flex-1 h-10 border text-[13px] font-medium transition-colors ${i === 0 ? 'rounded-l-lg' : 'rounded-r-lg border-l-0'} ${(draft.meta.nivel || 'Pregrado') === l ? 'bg-ink border-ink text-white' : 'bg-white border-line-strong text-ink hover:bg-paper'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Programa académico" id="ev-program">
                <select id="ev-program" className={fieldClass} value={draft.meta.programa} onChange={(e) => pickProgram(e.target.value)} disabled={!draft.campusId}>
                  <option value="">{draft.campusId ? `Elige un programa de ${(draft.meta.nivel || 'Pregrado').toLowerCase()}` : 'Primero elige el campus'}</option>
                  {draft.meta.programa && !programs.some((p) => p.name === draft.meta.programa) ? <option value={draft.meta.programa}>{draft.meta.programa}</option> : null}
                  {programs.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Escenario de práctica" id="ev-site">
                <select id="ev-site" className={fieldClass} value={draft.meta.escenario} onChange={(e) => ed.setMetaField({ escenario: e.target.value })}>
                  <option value="Todos">Todos los sitios</option>
                  {draft.meta.escenario && draft.meta.escenario !== 'Todos' && !sites.some((s) => s.name === draft.meta.escenario) ? <option value={draft.meta.escenario}>{draft.meta.escenario}</option> : null}
                  {sites.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Período académico" id="ev-period">
                <div className="flex" role="group" aria-label="Período">
                  {['A', 'B'].map((p, i) => (
                    <button key={p} type="button" aria-pressed={draft.meta.periodo === p} onClick={() => ed.setMetaField({ periodo: p })}
                      className={`w-16 h-10 border text-sm font-semibold transition-colors ${i === 0 ? 'rounded-l-lg' : 'rounded-r-lg border-l-0'} ${draft.meta.periodo === p ? 'bg-ink border-ink text-white' : 'bg-white border-line-strong hover:bg-paper'}`}>
                      {p}
                    </button>
                  ))}
                  <span className="ml-3 self-center font-mono text-sm text-ink-2">{new Date().getFullYear()}</span>
                </div>
              </Field>
            </div>
          </section>

          {tree.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-white p-10 text-center space-y-3">
              <p className="font-display text-xl font-bold">Empieza por una sección</p>
              <p className="text-sm text-ink-2 max-w-md mx-auto">Las secciones agrupan las preguntas, por ejemplo Capacidad instalada o Seguridad. Después agrega preguntas de escala 1–5, que son las que dan el puntaje.</p>
              <button type="button" onClick={ed.addSection} className="k-btn mx-auto"><Plus size={16} /> Agregar sección</button>
            </div>
          ) : null}

          {tree.map(({ section, questions }, sIdx) => (
            <section key={section.id} aria-label={`Sección ${sIdx + 1}`} className="space-y-3">
              <SectionHeader
                section={section} index={sIdx + 1} selected={selectedId === section.id} issues={issuesById.get(section.id)}
                onSelect={() => ed.select(section.id)}
                onChange={(label) => ed.update(section.id, { label })}
                onMove={(dir) => ed.move(section.id, dir)} onDuplicate={() => ed.duplicate(section.id)} onRemove={() => ed.remove(section.id)}
                isFirst={sIdx === 0} isLast={sIdx === tree.length - 1}
              />
              {questions.map((node, qIdx) => (
                <div key={node.q.id} className="space-y-2">
                  <QuestionBlock
                    q={node.q} number={`${sIdx + 1}.${qIdx + 1}`} selected={selectedId === node.q.id} issues={issuesById.get(node.q.id)}
                    ed={ed} isFirst={qIdx === 0} isLast={qIdx === questions.length - 1}
                  />
                  {node.q.logic?.active && node.children.length ? (
                    <div className="ml-6 sm:ml-10 pl-4 border-l-2 border-line space-y-2">
                      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-2">Aparece si la respuesta es “{node.q.logic.whenValue || '…'}”</p>
                      {node.children.map((child, cIdx) => (
                        <QuestionBlock key={child.id} q={child} number={`${sIdx + 1}.${qIdx + 1}.${cIdx + 1}`} selected={selectedId === child.id} issues={issuesById.get(child.id)} ed={ed} isFirst={cIdx === 0} isLast={cIdx === node.children.length - 1} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              <button type="button" onClick={() => ed.addQuestion('rating', { sectionId: section.id })} className="w-full h-11 rounded-lg border border-dashed border-line-strong text-sm font-semibold text-ink-2 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-colors">
                <Plus size={14} className="inline -mt-0.5 mr-1" /> Agregar pregunta a esta sección
              </button>
            </section>
          ))}
        </main>

        {/* Propiedades / revisión */}
        <aside
          aria-label="Propiedades"
          className={`${selected ? 'fixed inset-x-0 bottom-[57px] z-40 max-h-[65vh] overflow-y-auto border-t border-line shadow-[0_-8px_24px_rgba(12,31,43,0.12)]' : 'hidden'} xl:block xl:static xl:z-auto xl:max-h-none xl:shadow-none xl:border xl:border-line xl:rounded-xl w-full xl:w-[320px] xl:shrink-0 xl:sticky xl:top-20 bg-white p-5 space-y-5`}
        >
          {selected ? (
            <SettingsPanel item={selected} ed={ed} issues={issuesById.get(selected.id)} />
          ) : (
            <ReviewPanel stats={stats} issues={issues} items={draft.items} onSelect={ed.select} />
          )}
        </aside>
      </div>

      {ed.removed ? (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-20 xl:bottom-6 z-50 flex items-center gap-4 rounded-lg bg-night text-white pl-4 pr-2 py-2 shadow-lg max-w-[92vw]">
          <span className="text-sm truncate">Eliminaste “{ed.removed.label}”</span>
          <button type="button" onClick={ed.undoRemove} className="h-9 px-3 rounded-md text-sm font-semibold text-comet hover:bg-night-2">Deshacer</button>
        </div>
      ) : null}

      {confirmExit ? (
        <div className="fixed inset-0 z-50 bg-night/60 flex items-center justify-center p-4" onClick={() => setConfirmExit(false)}>
          <div role="dialog" aria-modal="true" aria-label="Cambios sin guardar" className="k-card p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Tienes cambios sin guardar</h2>
            <p className="text-sm text-ink-2">Si sales ahora, se pierden.</p>
            <div className="flex flex-col gap-2">
              <button type="button" className="k-btn" onClick={async () => { setConfirmExit(false); await handleSave(); }}>Guardar y seguir</button>
              <button type="button" className="k-btn-secondary" onClick={onExit}>Salir sin guardar</button>
              <button type="button" className="h-10 text-sm font-semibold text-ink-2 hover:text-ink" onClick={() => setConfirmExit(false)}>Seguir editando</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, id, children, wide }) {
  return (
    <div className={`space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="k-label block">{label}</label>
      {children}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }) {
  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none ${danger ? 'text-ink-2 hover:bg-score-low-bg hover:text-score-low-fg' : 'text-ink-2 hover:bg-paper hover:text-ink'}`}
    >
      {children}
    </button>
  );
}

function IssueDots({ issues }) {
  if (!issues?.length) return null;
  const hasError = issues.some((i) => i.level === 'error');
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${hasError ? 'text-score-low-fg' : 'text-score-mid-fg'}`} title={issues.map((i) => i.message).join('\n')}>
      <AlertTriangle size={13} /> {hasError ? 'Falta algo' : 'Revisar'}
    </span>
  );
}

function SectionHeader({ section, index, selected, issues, onSelect, onChange, onMove, onDuplicate, onRemove, isFirst, isLast }) {
  return (
    <div onClick={onSelect} className={`rounded-xl border bg-night text-white px-4 py-3 flex items-center gap-3 cursor-pointer transition-shadow ${selected ? 'border-comet shadow-md' : 'border-night'}`}>
      <span className="font-mono text-xs text-[#8FA8B3]">{String(index).padStart(2, '0')}</span>
      <input
        aria-label={`Título de la sección ${index}`}
        value={section.label}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onSelect}
        placeholder="Título de la sección"
        className="flex-1 min-w-0 bg-transparent font-display text-lg font-bold outline-none placeholder:text-[#7F9BAA] focus:underline decoration-comet underline-offset-4"
      />
      <IssueDots issues={issues} />
      <div className="flex items-center text-[#B9CAD2] [&_button]:text-[#B9CAD2] [&_button:hover]:bg-night-2 [&_button:hover]:text-white">
        <IconBtn label="Subir sección" onClick={() => onMove('up')} disabled={isFirst}><ArrowUp size={15} /></IconBtn>
        <IconBtn label="Bajar sección" onClick={() => onMove('down')} disabled={isLast}><ArrowDown size={15} /></IconBtn>
        <IconBtn label="Duplicar sección" onClick={onDuplicate}><Copy size={15} /></IconBtn>
        <IconBtn label="Eliminar sección" onClick={onRemove}><Trash2 size={15} /></IconBtn>
      </div>
    </div>
  );
}

function QuestionBlock({ q, number, selected, issues, ed, isFirst, isLast }) {
  const meta = QUESTION_TYPES[q.tipo] || QUESTION_TYPES.text;
  const Icon = TYPE_ICONS[q.tipo] || Type;
  const isInstruction = q.tipo === 'instruction';
  const hasError = issues?.some((i) => i.level === 'error');

  return (
    <div
      onClick={() => ed.select(q.id)}
      className={`k-card p-4 cursor-pointer transition-[border-color,box-shadow] duration-150 ${selected ? '!border-blue-600 shadow-md' : hasError ? '!border-score-low/50' : 'hover:border-line-strong'}`}
    >
      <div className="flex items-start gap-3">
        <span className="font-mono text-xs text-ink-2 pt-2.5 w-9 shrink-0">{number}</span>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start gap-2">
            <textarea
              aria-label={`Enunciado de la pregunta ${number}`}
              rows={selected ? 2 : 1}
              value={isInstruction ? (q.instrucciones || q.label) : q.label}
              onChange={(e) => ed.update(q.id, isInstruction ? { instrucciones: e.target.value, label: e.target.value } : { label: e.target.value })}
              onFocus={() => ed.select(q.id)}
              placeholder={isInstruction ? 'Texto de apoyo para quien responde' : 'Escribe el enunciado de la pregunta'}
              className="flex-1 min-w-0 resize-none bg-transparent text-[15px] font-semibold leading-snug outline-none placeholder:font-normal placeholder:text-ink-2 rounded px-1 -mx-1 py-1 focus:bg-paper"
            />
            {q.requerido && !isInstruction ? <span className="text-score-low-fg font-bold pt-1" title="Obligatoria" aria-label="Obligatoria">*</span> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`k-pill ${meta.scored ? 'k-pill-high' : 'bg-paper text-ink'}`}><Icon size={12} /> {meta.label}</span>
            {q.codigo ? <span className="font-mono text-[11px] text-ink-2">{q.codigo}</span> : null}
            <IssueDots issues={issues} />
          </div>

          {q.tipo === 'rating' ? (
            <div className="grid grid-cols-5 gap-2 max-w-md" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => <span key={n} className="h-10 rounded-lg border border-line-strong bg-paper flex items-center justify-center font-mono text-sm text-ink-2">{n}</span>)}
            </div>
          ) : null}
          {q.tipo === 'yesno' ? (
            <div className="flex gap-2 max-w-xs" aria-hidden="true">{['Sí', 'No'].map((o) => <span key={o} className="flex-1 h-10 rounded-lg border border-line-strong bg-paper flex items-center justify-center text-sm text-ink-2">{o}</span>)}</div>
          ) : null}
          {q.tipo === 'multiple' ? <OptionsEditor question={q} ed={ed} editable={selected} /> : null}
          {q.tipo === 'text' ? <div className="h-10 rounded-lg border border-dashed border-line-strong" aria-hidden="true" /> : null}
          {q.tipo === 'number' || q.tipo === 'date' ? <div className="h-10 w-48 rounded-lg border border-line-strong bg-paper" aria-hidden="true" /> : null}
          {meta.legacy ? <p className="text-xs text-ink-2">Este tipo ya no se puede crear: el formulario aún no captura {q.tipo === 'photo' ? 'fotos' : 'firmas'}.</p> : null}
        </div>

        {selected ? (
          <div className="flex flex-col sm:flex-row shrink-0 -mr-1">
            <IconBtn label="Subir" onClick={() => ed.move(q.id, 'up')} disabled={isFirst}><ArrowUp size={15} /></IconBtn>
            <IconBtn label="Bajar" onClick={() => ed.move(q.id, 'down')} disabled={isLast}><ArrowDown size={15} /></IconBtn>
            <IconBtn label="Duplicar" onClick={() => ed.duplicate(q.id)}><Copy size={15} /></IconBtn>
            <IconBtn label="Eliminar" danger onClick={() => ed.remove(q.id)}><Trash2 size={15} /></IconBtn>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OptionsEditor({ question, ed, editable }) {
  const options = question.opciones || [];
  const set = (next) => ed.update(question.id, { opciones: next });
  if (!editable) {
    return (
      <ul className="space-y-1.5" aria-hidden="true">
        {options.map((o, i) => <li key={i} className="h-9 px-3 rounded-lg border border-line-strong bg-paper flex items-center text-sm text-ink-2">{o || <span className="italic">Opción vacía</span>}</li>)}
      </ul>
    );
  }
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input aria-label={`Opción ${i + 1}`} className={`${fieldClass} !h-9`} value={o} onChange={(e) => set(options.map((x, j) => (j === i ? e.target.value : x)))} />
          <IconBtn label={`Quitar opción ${i + 1}`} onClick={() => set(options.filter((_, j) => j !== i))} disabled={options.length <= 2}><X size={15} /></IconBtn>
        </div>
      ))}
      <button type="button" onClick={() => set([...options, `Opción ${options.length + 1}`])} className="h-9 text-sm font-semibold text-blue-600 hover:text-blue-700">+ Agregar opción</button>
    </div>
  );
}

function SettingsPanel({ item, ed, issues }) {
  const isSection = item.tipo === 'section';
  const meta = QUESTION_TYPES[item.tipo];
  const answerable = !isSection && !meta?.noAnswer;
  const choices = answerChoices(item);
  const canHaveLogic = answerable && !item.parentId && choices.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="k-label">{isSection ? 'Sección' : meta?.label || 'Pregunta'}</p>
          <h2 className="font-display text-lg font-bold leading-tight">Propiedades</h2>
        </div>
        <button type="button" aria-label="Cerrar propiedades" onClick={() => ed.select(null)} className="w-10 h-10 -mr-2 -mt-2 flex items-center justify-center text-ink-2 hover:text-ink"><X size={18} /></button>
      </div>

      {issues?.length ? (
        <ul className="rounded-lg bg-score-mid-bg text-score-mid-fg px-3 py-2.5 text-[13px] font-medium space-y-1">
          {issues.map((i, n) => <li key={n}>{i.message}</li>)}
        </ul>
      ) : null}

      {answerable ? (
        <label htmlFor="sp-required" className="flex items-center gap-2.5 min-h-[40px] text-sm font-medium cursor-pointer">
          <input id="sp-required" type="checkbox" className="w-[18px] h-[18px] accent-blue-600" checked={!!item.requerido} onChange={(e) => ed.update(item.id, { requerido: e.target.checked })} />
          Respuesta obligatoria
        </label>
      ) : null}

      {answerable ? (
        <div className="space-y-1.5">
          <label htmlFor="sp-code" className="k-label block">Código del instrumento</label>
          <input id="sp-code" className={`${fieldClass} font-mono uppercase`} placeholder="AG1, CI2, PF10…" value={item.codigo || ''} onChange={(e) => ed.update(item.id, { codigo: e.target.value.toUpperCase().trim() })} />
          <p className="text-xs text-ink-2">El informe usa este código para agrupar resultados.</p>
        </div>
      ) : null}

      {!meta?.noAnswer || isSection ? (
        <div className="space-y-1.5">
          <label htmlFor="sp-help" className="k-label block">{isSection ? 'Texto introductorio' : 'Ayuda para quien responde'}</label>
          <textarea id="sp-help" rows={3} className="k-input !h-auto !py-2.5 !text-sm !font-normal resize-none" value={item.instrucciones || ''} onChange={(e) => ed.update(item.id, { instrucciones: e.target.value })} placeholder={isSection ? 'Se muestra al empezar la sección' : 'Aclaración opcional bajo el enunciado'} />
        </div>
      ) : null}

      {canHaveLogic ? (
        <div className="space-y-3 border-t border-line pt-4">
          <p className="k-label">Preguntas dependientes</p>
          <label htmlFor="sp-logic" className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input id="sp-logic" type="checkbox" className="w-[18px] h-[18px] mt-0.5 accent-blue-600" checked={!!item.logic?.active}
              onChange={(e) => ed.update(item.id, { logic: { ...item.logic, active: e.target.checked, whenValue: item.logic?.whenValue || choices[0] } })} />
            <span className="font-medium">Mostrar preguntas adicionales según la respuesta</span>
          </label>
          {item.logic?.active ? (
            <div className="space-y-3 rounded-lg bg-paper p-3">
              <div className="space-y-1.5">
                <label htmlFor="sp-when" className="k-label block">Aparecen si responde</label>
                <select id="sp-when" className={fieldClass} value={item.logic.whenValue || ''} onChange={(e) => ed.update(item.id, { logic: { ...item.logic, whenValue: e.target.value } })}>
                  {choices.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="k-label">Agregar pregunta dependiente</p>
                <div className="flex flex-wrap gap-1.5">
                  {[['text', 'Texto'], ['rating', 'Escala 1–5'], ['yesno', 'Sí / No']].map(([tipo, label]) => (
                    <button key={tipo} type="button" onClick={() => ed.addQuestion(tipo, { parentId: item.id })} className="h-9 px-3 rounded-lg border border-line-strong bg-white text-[13px] font-semibold hover:bg-white hover:border-blue-600">+ {label}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReviewPanel({ stats, issues, items, onSelect }) {
  const label = (id) => items.find((i) => i.id === id);
  return (
    <div className="space-y-5">
      <div>
        <p className="k-label">Resumen</p>
        <h2 className="font-display text-lg font-bold leading-tight">Revisión</h2>
      </div>
      <dl className="grid grid-cols-3 border border-line rounded-lg divide-x divide-line text-center">
        <div className="py-3"><dt className="k-label">Secciones</dt><dd className="font-display text-2xl font-bold">{stats.sections}</dd></div>
        <div className="py-3"><dt className="k-label">Preguntas</dt><dd className="font-display text-2xl font-bold">{stats.questions}</dd></div>
        <div className="py-3"><dt className="k-label">Puntúan</dt><dd className="font-display text-2xl font-bold">{stats.scored}</dd></div>
      </dl>
      {issues.length ? (
        <ul className="space-y-1.5">
          {issues.map((i, n) => (
            <li key={n}>
              <button type="button" disabled={!i.id || !label(i.id)} onClick={() => onSelect(i.id)} className={`w-full text-left rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${i.level === 'error' ? 'bg-score-low-bg text-score-low-fg' : 'bg-score-mid-bg text-score-mid-fg'} enabled:hover:brightness-95`}>
                {i.message}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-score-high-bg text-score-high-fg px-3 py-2.5 text-[13px] font-medium">Todo en orden para guardar.</p>
      )}
      <p className="text-xs leading-relaxed text-ink-2">Solo las preguntas de escala 1–5 cuentan para el puntaje. Selecciona una pregunta para ver sus propiedades. Ctrl + S guarda.</p>
    </div>
  );
}
