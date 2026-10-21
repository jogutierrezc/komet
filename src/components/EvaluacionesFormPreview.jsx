import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Send, X } from 'lucide-react';
import KometMark from './shared/KometMark';
import { QUESTION_TYPES, hasAnswer, isQuestionVisible, parseDescription, toTree } from './evaluaciones/surveyModel';

// Formulario que responde quien evalúa (enlace público y vista previa del editor).
// Una sección por página, preguntas obligatorias validadas y preguntas dependientes según la respuesta.

export const sampleStudentInfo = {
  nombre: 'Estudiante de ejemplo',
  programaOrigen: 'Programa académico',
  escenario: 'Sitio de práctica',
  periodo: '2026-A',
};

const LIKERT_LABELS = { 1: 'Totalmente en desacuerdo', 2: 'En desacuerdo', 3: 'Ni de acuerdo ni en desacuerdo', 4: 'De acuerdo', 5: 'Totalmente de acuerdo' };
const isUuidString = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value).trim());

// Páginas: una por sección. Cada elemento es una pregunta con su padre (si es dependiente).
function buildPages(survey) {
  if (!survey) return [];
  return toTree(survey.questions || survey.preguntas || []).map(({ section, questions }) => ({
    id: section.id,
    title: section.label || 'Preguntas',
    intro: section.instrucciones || '',
    items: questions.flatMap((n) => [{ q: n.q, parent: null }, ...n.children.map((c) => ({ q: c, parent: n.q }))]),
  }));
}

const visibleItems = (page, answers) => page.items.filter(({ q, parent }) => isQuestionVisible(q, parent, answers));
const needsAnswer = ({ q }) => q.requerido && !QUESTION_TYPES[q.tipo]?.noAnswer;

export default function EvaluacionesFormPreview({ onClose, studentInfo = sampleStudentInfo, survey = null, onSubmit, isSubmitting = false }) {
  const pages = useMemo(() => buildPages(survey), [survey]);
  const meta = useMemo(() => parseDescription(survey?.description || ''), [survey]);
  const info = {
    ...studentInfo,
    periodo: meta.periodo || studentInfo.periodo,
    escenario: meta.escenario && meta.escenario !== 'Todos' && !isUuidString(meta.escenario) ? meta.escenario : studentInfo.escenario,
  };

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [missing, setMissing] = useState(() => new Set());
  const [submissionError, setSubmissionError] = useState('');
  const [done, setDone] = useState(false);

  const page = pages[step];
  const total = pages.length;
  const setAnswer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setMissing((prev) => { if (!prev.has(id)) return prev; const next = new Set(prev); next.delete(id); return next; });
  };

  const missingOn = (p) => visibleItems(p, answers).filter((it) => needsAnswer(it) && !hasAnswer(answers[it.q.id])).map((it) => it.q.id);

  const goTo = (index) => { setStep(index); window.scrollTo?.({ top: 0, behavior: 'smooth' }); };

  const next = () => {
    const gaps = missingOn(page);
    if (gaps.length) {
      setMissing(new Set(gaps));
      requestAnimationFrame(() => document.getElementById(`q-${gaps[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    goTo(Math.min(step + 1, total - 1));
  };

  const submit = async () => {
    const firstBad = pages.findIndex((p) => missingOn(p).length);
    if (firstBad >= 0) {
      setMissing(new Set(missingOn(pages[firstBad])));
      if (firstBad !== step) goTo(firstBad);
      requestAnimationFrame(() => document.getElementById(`q-${missingOn(pages[firstBad])[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    // Solo viajan las respuestas de preguntas que estaban visibles.
    const payload = {};
    pages.forEach((p) => visibleItems(p, answers).forEach(({ q }) => { if (hasAnswer(answers[q.id])) payload[q.id] = answers[q.id]; }));

    if (onSubmit) {
      setSubmissionError('');
      try {
        await onSubmit(payload);
      } catch (error) {
        console.error('Error guardando evaluación:', error);
        setSubmissionError(error?.message || 'No se pudo registrar la evaluación. Intenta nuevamente.');
        return;
      }
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-5">
        <div className="max-w-md w-full space-y-5 text-center">
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="mx-auto"><circle cx="32" cy="32" r="30" fill="#E7F1EF" stroke="#0F6B68" strokeWidth="2" /><path d="M20 33l8 8 16-17" fill="none" stroke="#0F6B68" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <h1 className="font-display text-3xl font-bold">{onSubmit ? 'Evaluación registrada' : 'Fin de la vista previa'}</h1>
          <p className="text-ink-2">{onSubmit ? 'La información quedó guardada en el sistema de Relación Docencia-Servicio.' : 'Así verá el formulario quien responda. Nada se guardó.'}</p>
          {onClose ? <button type="button" onClick={onClose} className="k-btn mx-auto">Cerrar</button> : null}
        </div>
      </div>
    );
  }

  if (!total) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-5">
        <div className="max-w-md w-full space-y-4 text-center">
          <h1 className="font-display text-2xl font-bold">Este formulario aún no tiene preguntas</h1>
          {onClose ? <button type="button" onClick={onClose} className="k-btn-secondary mx-auto">Volver</button> : null}
        </div>
      </div>
    );
  }

  const items = visibleItems(page, answers);
  let number = 0;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="sticky top-0 z-10 bg-paper border-b border-line">
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <KometMark size={22} />
              <p className="font-display text-base font-bold truncate">{survey?.title || 'Evaluación de prácticas formativas'}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-ink-2">{step + 1} / {total}</span>
              {onClose ? <button type="button" aria-label="Cerrar vista previa" onClick={onClose} className="w-10 h-10 -mr-2 flex items-center justify-center text-ink-2 hover:text-ink"><X size={18} /></button> : null}
            </div>
          </div>
          <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} aria-label="Avance">
            {pages.map((p, i) => <div key={p.id} className={`flex-1 h-1 rounded-full transition-colors duration-200 ${i <= step ? 'bg-blue-600' : 'bg-line'}`} />)}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-7 space-y-7">
        <div key={page.id} className="k-enter space-y-7">
          {step === 0 ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 border border-line rounded-xl bg-white p-4 text-sm">
              {[['Evaluador', info.nombre], ['Rol', info.role], ['Programa', info.programaOrigen], ['Sitio de práctica', info.escenario], ['Periodo', info.periodo]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><dt className="k-label">{k}</dt><dd className="font-semibold mt-0.5">{v}</dd></div>
              ))}
            </dl>
          ) : null}

          <div className="space-y-2">
            <p className="k-label">Sección {step + 1} de {total}</p>
            <h1 className="font-display text-3xl font-bold leading-tight text-balance">{page.title}</h1>
            {page.intro ? <p className="text-base leading-relaxed text-ink-2">{page.intro}</p> : null}
          </div>

          {items.length === 0 ? <p className="text-ink-2">Esta sección no tiene preguntas.</p> : null}

          {items.map(({ q, parent }) => {
            const isInstruction = q.tipo === 'instruction';
            if (!isInstruction) number += 1;
            const value = answers[q.id];
            const error = missing.has(q.id);
            return (
              <fieldset key={q.id} id={`q-${q.id}`} className={`space-y-3.5 min-w-0 ${parent ? 'pl-4 border-l-2 border-line' : ''}`}>
                {isInstruction ? (
                  <p className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-[15px] leading-relaxed">{q.instrucciones || q.label}</p>
                ) : (
                  <>
                    <legend className="flex items-start gap-3 text-[17px] font-semibold leading-snug">
                      <span className="font-mono text-xs text-ink-2 pt-1.5 w-6 shrink-0">{number}</span>
                      <span>{q.label}{q.requerido ? <span className="text-score-low-fg" aria-label=" obligatoria"> *</span> : null}</span>
                    </legend>
                    {q.instrucciones ? <p className="pl-9 text-sm text-ink-2 -mt-1.5">{q.instrucciones}</p> : null}
                    <div className="pl-0 sm:pl-9">
                      <Control q={q} value={value} onChange={(v) => setAnswer(q.id, v)} />
                    </div>
                    {error ? <p role="alert" className="pl-0 sm:pl-9 text-sm font-semibold text-score-low-fg">Responde esta pregunta para continuar.</p> : null}
                  </>
                )}
              </fieldset>
            );
          })}
        </div>

        {submissionError ? <div role="alert" className="rounded-lg bg-score-low-bg text-score-low-fg px-4 py-3 text-sm font-medium">{submissionError}</div> : null}
      </main>

      <footer className="sticky bottom-0 bg-paper border-t border-line">
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-3">
          {step > 0 ? (
            <button type="button" aria-label="Sección anterior" onClick={() => goTo(step - 1)} className="shrink-0 w-14 h-14 rounded-xl border border-line-strong bg-white flex items-center justify-center active:scale-95 transition-transform"><ArrowLeft size={20} /></button>
          ) : null}
          {step < total - 1 ? (
            <button type="button" onClick={next} className="k-btn flex-1 !h-14 !rounded-xl !text-base">Siguiente <ArrowRight size={18} /></button>
          ) : (
            <button type="button" onClick={submit} disabled={isSubmitting} className="k-btn flex-1 !h-14 !rounded-xl !text-base">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Guardando…</> : <>Enviar evaluación <Send size={18} /></>}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function Control({ q, value, onChange }) {
  const choice = (selected) => `w-full min-h-[52px] px-4 py-3 rounded-xl border text-left text-[15px] font-medium transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] ${selected ? 'border-2 border-blue-600 bg-blue-50 px-[15px] py-[11px]' : 'border-line-strong bg-white hover:bg-paper'}`;

  if (q.tipo === 'rating') {
    const n = Number(value) || 0;
    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={q.label}>
          {[1, 2, 3, 4, 5].map((v) => (
            <button key={v} type="button" role="radio" aria-checked={n === v} onClick={() => onChange(v)}
              className={`h-14 sm:h-16 rounded-xl border font-display text-2xl font-bold transition-[transform,background-color] duration-150 ease-out active:scale-95 ${n === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-line-strong text-ink hover:bg-paper'}`}>
              {v}
            </button>
          ))}
        </div>
        <p className="flex justify-between gap-3 text-xs text-ink-2" aria-live="polite">
          <span className="hidden sm:inline">1 · {LIKERT_LABELS[1]}</span>
          <span className="font-semibold text-ink sm:hidden">{n ? `${n} · ${LIKERT_LABELS[n]}` : '1 = en desacuerdo · 5 = de acuerdo'}</span>
          <span className="hidden sm:inline">5 · {LIKERT_LABELS[5]}</span>
        </p>
      </div>
    );
  }
  if (q.tipo === 'yesno') {
    return (
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={q.label}>
        {['Sí', 'No'].map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={`${choice(value === o)} text-center`}>{o}</button>)}
      </div>
    );
  }
  if (q.tipo === 'multiple') {
    return (
      <div className="space-y-2.5" role="radiogroup" aria-label={q.label}>
        {(q.opciones || []).filter((o) => String(o).trim()).map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={`${choice(value === o)} flex items-center gap-3`}>
            <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${value === o ? 'border-blue-600' : 'border-line-strong'}`}>{value === o ? <Check size={12} className="text-blue-600" /> : null}</span>
            {o}
          </button>
        ))}
      </div>
    );
  }
  if (q.tipo === 'text') {
    return <textarea aria-label={q.label} rows={4} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Escribe aquí tus observaciones" className="k-input !h-auto !py-3 !font-normal resize-y" />;
  }
  if (q.tipo === 'number') {
    return <input aria-label={q.label} type="number" inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="k-input !h-[52px] sm:!w-56" />;
  }
  if (q.tipo === 'date') {
    return <input aria-label={q.label} type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className="k-input !h-[52px] sm:!w-56" />;
  }
  // Foto y firma: el formulario todavía no las captura.
  return <p className="text-sm text-ink-2 rounded-lg bg-paper px-3 py-2.5">Esta pregunta ({q.tipo === 'photo' ? 'foto' : 'firma'}) todavía no está disponible y no es obligatoria.</p>;
}
