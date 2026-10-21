import React, { useRef, useState } from 'react';
import { Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
import PresentaSelect from './PresentaSelect';
import ChartPicker from './ChartPicker';
import { useReveal, useProgressBar } from './usePresentaMotion';
import { AUDIENCES, TONES, EXTENSIONS, briefSummary } from '../../services/presentaBrief';

const STEPS = ['Audiencia', 'Alcance', 'Gráficas', 'Énfasis'];
const QUESTIONS = ['¿Para quién es el informe?', '¿Qué datos incluir?', '¿Qué gráficas mostrar?', '¿Qué más debe destacar?'];

function ChoiceGroup({ legend, options, value, onChange }) {
  return (
    <fieldset className="space-y-2" data-reveal>
      <legend className="k-label mb-2">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`min-h-[52px] rounded-lg border px-3.5 py-2 text-left transition-colors ${value === o.id ? 'bg-blue-50 border-blue-600' : 'bg-white border-line hover:border-line-strong'}`}
          >
            <span className="block text-sm font-semibold">{o.label}</span>
            <span className="block text-[12px] text-ink-2">{o.hint}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Entrevista previa: cuatro pasos cortos antes de generar. Escribe en `brief`, en los filtros
 * de la pantalla (scope) y en la lista de gráficas elegidas; no llama a la IA por sí sola.
 */
export default function PresentaWizard({ brief, onBrief, scope, catalog, chartIds, onChartIds, sample, canGenerate, generating, onFinish, onSkip }) {
  const [step, setStep] = useState(0);
  const panelRef = useRef(null);
  const barRef = useRef(null);
  const set = (patch) => onBrief({ ...brief, ...patch });
  const suggestedCount = EXTENSIONS.find((e) => e.id === brief.extension)?.charts ?? 6;

  useReveal(panelRef, [step], { y: 8 });
  useProgressBar(barRef, (step + 1) / STEPS.length);

  const last = step === STEPS.length - 1;

  return (
    <section aria-label="Asistente de la presentación" className="k-card p-5 space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="k-label">Asistente · {STEPS[step]} · paso {step + 1} de {STEPS.length}</p>
          <h2 className="font-display text-xl font-bold">{QUESTIONS[step]}</h2>
        </div>
        <button type="button" onClick={onSkip} className="text-[13px] font-semibold text-ink-2 hover:text-ink min-h-[40px]">Saltar asistente</button>
      </div>

      <div className="h-1 bg-paper overflow-hidden" aria-hidden="true">
        <div ref={barRef} className="h-full bg-blue-600 origin-left" style={{ transform: 'scaleX(0)' }} />
      </div>

      <div ref={panelRef} className="min-h-[220px]">
        {step === 0 ? (
          <div className="space-y-5">
            <ChoiceGroup legend="Audiencia" options={AUDIENCES} value={brief.audience} onChange={(audience) => set({ audience })} />
            <ChoiceGroup legend="Enfoque y tono" options={TONES} value={brief.tone} onChange={(tone) => set({ tone })} />
            <ChoiceGroup legend="Extensión" options={EXTENSIONS} value={brief.extension} onChange={(extension) => set({ extension })} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-reveal>
              <PresentaSelect id="wz-period" label="Período" value={scope.period} onChange={scope.setPeriod} options={scope.periodOptions} />
              <PresentaSelect id="wz-campus" label="Campus" value={scope.campus} onChange={scope.setCampus} options={scope.campusOptions} />
              <PresentaSelect id="wz-level" label="Nivel" value={scope.level} onChange={scope.setLevel} options={[['Todos', 'Pregrado y posgrado'], ['pregrado', 'Pregrado'], ['posgrado', 'Posgrado']]} />
              <PresentaSelect id="wz-program" label="Programa" value={scope.program} onChange={scope.setProgram} options={scope.programOptions} />
            </div>
            <p data-reveal className="font-mono text-xs text-ink-2">{sample}</p>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <ChartPicker catalog={catalog} selectedIds={chartIds} onChange={onChartIds} suggestedCount={suggestedCount} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="space-y-1.5" data-reveal>
              <label htmlFor="wz-highlights" className="k-label block">Qué destacar (opcional)</label>
              <textarea id="wz-highlights" rows={3} maxLength={500} value={brief.highlights} onChange={(e) => set({ highlights: e.target.value })} placeholder="Ej.: la brecha entre centros, el programa con menor participación…" className="k-input !h-auto !py-2.5 !text-sm !font-normal leading-relaxed resize-none" />
            </div>
            <label htmlFor="wz-reco" data-reveal className="flex items-center gap-2.5 min-h-[40px] text-sm cursor-pointer">
              <input id="wz-reco" type="checkbox" checked={brief.includeRecommendations} onChange={(e) => set({ includeRecommendations: e.target.checked })} className="w-[18px] h-[18px] accent-blue-600" />
              Incluir recomendaciones y acciones
            </label>
            <div data-reveal className="border-t border-line pt-3 text-sm space-y-1">
              <p><b className="font-semibold">Resumen:</b> {briefSummary(brief)}</p>
              <p className="text-ink-2">{chartIds.length ? `${chartIds.length} gráficas elegidas; cada una tendrá su diapositiva con un título generado.` : 'Sin gráficas elegidas: se usará el plan automático.'}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="k-btn-secondary !h-10">
          <ArrowLeft className="w-4 h-4" /> Atrás
        </button>
        {last ? (
          <button type="button" onClick={onFinish} disabled={!canGenerate || generating} className="k-btn !h-10">
            <Sparkles className="w-4 h-4" /> Generar presentación
          </button>
        ) : (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="k-btn !h-10">
            Siguiente <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </section>
  );
}
