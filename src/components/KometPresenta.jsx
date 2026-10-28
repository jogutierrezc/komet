import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, Download, X, Wand2 } from 'lucide-react';
import {
  getCampuses,
  getConvenios,
  getEvaluationReportMetrics,
  getSystemSettings,
  runMistralPrompt
} from '../lib/data';
import { PptxTemplateEngine, buildTemplateData } from '../lib/pptxTemplateEngine';

// --- Módulos extraídos ---
import { norm, avg, stdDev, resolveProgram, resolveLevel, normalizeRoleName, getRowCenter, formatPct, formatFilters, rankBy, getMonthKey, shortList, calculateCenterAnalysis, calculateRoleGrid, formatCenterAnalysisForPrompt } from '../utils/dataHelpers';
import { parseAiPayload, buildNarrativeFallback } from '../services/aiService';
import { useBasket, removeCapture, clearBasket } from '../lib/presentationBasket';
import { readInitialPeriodChoice, latestPeriod, clearInitialPeriod, periodOptionsFrom, matchesPeriod } from '../lib/periodFilter';
import { buildSlidePlan, buildSlideNarrativePrompt, parseSlideNarrative, applySlideNarrative, planFingerprint, LIMITS } from '../services/slidePlan';
import { downloadDeck } from '../lib/pptDeck';
import { buildChartCatalog } from '../lib/estadistica/chartCatalog';
import { DEFAULT_BRIEF } from '../services/presentaBrief';
import PresentaSelect from './presenta/PresentaSelect';
import PresentaWizard from './presenta/PresentaWizard';
import { useReveal } from './presenta/usePresentaMotion';

const NARRATIVE_CACHE_KEY = 'komet.presenta.narrative.v1';
import ComparadorCentrosProgramas from './ComparadorCentrosProgramas';

export default function KometPresenta({ onNavigate }) {
  const basket = useBasket();
  const [aiSlideTexts, setAiSlideTexts] = useState({});
  const [edits, setEdits] = useState({});
  const [selectedSlideId, setSelectedSlideId] = useState('resumen');
  const [narrativeSource, setNarrativeSource] = useState('none');
  const [templateMode, setTemplateMode] = useState('komet');
  const [rows, setRows] = useState([]);
  // Mientras nadie elija otro, se usa el período más reciente (igual que Estadística e Informe).
  const [pickedPeriod, setSelectedPeriod] = useState(readInitialPeriodChoice);
  const latest = useMemo(() => latestPeriod(rows), [rows]);
  const selectedPeriod = pickedPeriod ?? latest;
  useEffect(() => { clearInitialPeriod(); }, []);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const [error, setError] = useState('');
  const [aiNarrative, setAiNarrative] = useState(null);
  const [aiReady, setAiReady] = useState(false); // marca si la IA ya ha generado al menos una vez

  const [selectedCampus, setSelectedCampus] = useState('Todos');
  const [selectedLevel, setSelectedLevel] = useState('Todos');
  const [selectedCenter, setSelectedCenter] = useState('Todos');
  const [selectedProgram, setSelectedProgram] = useState('Todos');
  const [combineSimilarCenters, setCombineSimilarCenters] = useState(false);

  // Entrevista previa: el asistente se abre solo hasta que el usuario lo termina o lo salta.
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [chartIds, setChartIds] = useState([]);
  const [wizardOpen, setWizardOpen] = useState(true);

  // Listas de opciones para los dropdowns — cargadas desde Supabase al montar
  const [campusesMeta, setCampusesMeta] = useState([]);
  const [centersMeta, setCentersMeta] = useState([]);

  useEffect(() => {
    Promise.all([getCampuses(), getConvenios()])
      .then(([campuses, convenios]) => {
        setCampusesMeta(campuses || []);
        setCentersMeta(convenios || []);
      })
      .catch(() => {});
  }, []);

  // Mapa nombre → id para traducir el filtro textual al UUID de Supabase
  const campusIdMap = useMemo(() => {
    const map = new Map();
    campusesMeta.forEach((c) => map.set(c.name, c.id));
    return map;
  }, [campusesMeta]);

  const centerIdMap = useMemo(() => {
    const map = new Map();
    centersMeta.forEach((c) => map.set(c.name, c.id));
    return map;
  }, [centersMeta]);

  // Fetch data con filtros server-side cuando cambia campus o centro
  useEffect(() => {
    setLoading(true);
    setError('');

    const campusId = campusIdMap.get(selectedCampus) || null;
    const centerId = centerIdMap.get(selectedCenter) || null;

    getEvaluationReportMetrics({ campusId, centerId })
      .then((result) => setRows(result?.rows || []))
      .catch(() => {
        setRows([]);
        setError('No se pudo cargar información de evaluaciones.');
      })
      .finally(() => setLoading(false));
  }, [selectedCampus, selectedCenter, campusIdMap, centerIdMap]);

  // Opciones de dropdown derivadas de metadatos + datos
  const campusOptions = useMemo(() => {
    return ['Todos', ...[...new Set(campusesMeta.map((c) => c.name).filter(Boolean))]];
  }, [campusesMeta]);

  const centerOptions = useMemo(() => {
    const names = selectedCampus === 'Todos'
      ? centersMeta.map((c) => c.name)
      : centersMeta
          .filter((c) => c.campus_id === campusIdMap.get(selectedCampus))
          .map((c) => c.name);
    return ['Todos', ...[...new Set(names.filter(Boolean))]];
  }, [centersMeta, selectedCampus, campusIdMap]);

  const periodOptions = useMemo(() => periodOptionsFrom(rows), [rows]);
  const baseFiltered = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesPeriod(row, selectedPeriod)) return false;
      if (selectedLevel !== 'Todos') {
        const level = resolveLevel(row);
        if (level && level !== selectedLevel) return false;
      }
      return true;
    });
  }, [rows, selectedPeriod, selectedLevel]);

  const programOptions = useMemo(() => {
    const source = selectedCenter === 'Todos'
      ? baseFiltered
      : baseFiltered.filter((row) => norm(row.center || 'Sin sitio') === selectedCenter);
    const programs = [...new Set(source.map((row) => resolveProgram(row)).filter((value) => value && value !== 'Sin programa'))];
    return ['Todos', ...programs.sort()];
  }, [baseFiltered, selectedCenter]);

  useEffect(() => {
    if (!programOptions.includes(selectedProgram)) setSelectedProgram('Todos');
  }, [programOptions, selectedProgram]);

  const filteredRows = useMemo(() => {
    return baseFiltered.filter((row) => {
      const center = norm(row.center || 'Sin sitio');
      const program = resolveProgram(row);
      if (selectedCenter !== 'Todos' && center !== selectedCenter) return false;
      if (selectedProgram !== 'Todos' && program !== selectedProgram) return false;
      return true;
    });
  }, [baseFiltered, selectedCenter, selectedProgram]);

  const effectiveFilteredRows = useMemo(() => {
    if (!combineSimilarCenters) return filteredRows;
    return filteredRows.map((row) => ({ ...row, center: getRowCenter(row, true) }));
  }, [filteredRows, combineSimilarCenters]);

  const metrics = useMemo(() => {
    const scoreRows = filteredRows
      .map((row) => row.scoreSummary?.globalScore)
      .filter((value) => typeof value === 'number');

    const completed = effectiveFilteredRows.filter((row) => row.status === 'Completada').length;

    const byCampus = rankBy(effectiveFilteredRows, (row) => norm(row.campus || 'Sin campus'), (row) => row.scoreSummary?.globalScore);
    const byCenter = rankBy(effectiveFilteredRows, (row) => norm(row.center || 'Sin sitio'), (row) => row.scoreSummary?.globalScore);
    const byProgram = rankBy(filteredRows, (row) => resolveProgram(row), (row) => row.scoreSummary?.globalScore)
      .filter((item) => item.name !== 'Sin programa');
    const byRole = rankBy(filteredRows, (row) => normalizeRoleName(norm(row.role || 'Sin definir')), (row) => row.scoreSummary?.globalScore);

    const monthMap = new Map();
    filteredRows.forEach((row) => {
      const key = getMonthKey(row.completed_at || row.created_at);
      const entry = monthMap.get(key) || { name: key, total: 0, completed: 0, scores: [] };
      entry.total += 1;
      if (row.status === 'Completada') entry.completed += 1;
      const score = row.scoreSummary?.globalScore;
      if (typeof score === 'number') entry.scores.push(score);
      monthMap.set(key, entry);
    });

    const monthly = [...monthMap.values()]
      .map((item) => ({
        ...item,
        score: avg(item.scores),
        completionPct: item.total ? Number(((item.completed / item.total) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const distribution = [
      { label: '0-2', count: 0 },
      { label: '2-3', count: 0 },
      { label: '3-4', count: 0 },
      { label: '4-5', count: 0 }
    ];

    scoreRows.forEach((score) => {
      if (score < 2) distribution[0].count += 1;
      else if (score < 3) distribution[1].count += 1;
      else if (score < 4) distribution[2].count += 1;
      else distribution[3].count += 1;
    });

    const sortedDates = filteredRows
      .map((row) => new Date(row.completed_at || row.created_at))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const dateRange = sortedDates.length
      ? `${sortedDates[0].toLocaleDateString('es-CO')} a ${sortedDates[sortedDates.length - 1].toLocaleDateString('es-CO')}`
      : 'Sin fechas registradas';

    const firstHalf = monthly.slice(0, Math.floor(monthly.length / 2));
    const secondHalf = monthly.slice(Math.floor(monthly.length / 2));
    const trendDirection = avg(secondHalf.map((row) => row.score)) >= avg(firstHalf.map((row) => row.score))
      ? 'al alza'
      : 'a la baja';

    const centerAnalysis = calculateCenterAnalysis(effectiveFilteredRows);
    const roleGrid = calculateRoleGrid(centerAnalysis);

    return {
      kpis: {
        total: filteredRows.length,
        completed,
        completionPct: filteredRows.length ? Number(((completed / filteredRows.length) * 100).toFixed(1)) : 0,
        globalScore: avg(scoreRows),
        programs: new Set(filteredRows.map((row) => resolveProgram(row)).filter((value) => value !== 'Sin programa')).size,
        centers: new Set(effectiveFilteredRows.map((row) => norm(row.center || 'Sin sitio'))).size,
        scored: scoreRows.length
      },
      distribution,
      byCampus,
      byCenter,
      byProgram,
      byRole,
      monthly,
      variability: stdDev(scoreRows),
      topCenter: byCenter[0] || null,
      lowCenter: byCenter.length ? byCenter[byCenter.length - 1] : null,
      topProgram: byProgram[0] || null,
      lowProgram: byProgram.length ? byProgram[byProgram.length - 1] : null,
      dateRange,
      trendDirection,
      centerAnalysis,
      roleGrid
    };
  }, [filteredRows, effectiveFilteredRows]);

  const catalog = useMemo(() => buildChartCatalog(filteredRows), [filteredRows]);
  // Se respeta el orden en que el usuario eligió; las que ya no tienen datos con los filtros actuales se descartan.
  const selectedCharts = useMemo(() => {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    return chartIds.map((id) => byId.get(id)).filter(Boolean);
  }, [catalog, chartIds]);

  const filters = {
    period: selectedPeriod,
    campus: selectedCampus,
    level: selectedLevel,
    center: selectedCenter,
    program: selectedProgram
  };

  const fallbackNarrative = useMemo(() => buildNarrativeFallback(metrics), [metrics]);

  // Plan sin las diapositivas que dependen de la narrativa: sirve para el prompt y para la huella de caché.
  const corePlan = useMemo(
    () => buildSlidePlan({ metrics, filters, captures: basket, narrative: null, charts: selectedCharts, brief }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics, selectedPeriod, selectedCampus, selectedLevel, selectedCenter, selectedProgram, basket, selectedCharts, brief]
  );
  const fingerprint = useMemo(
    () => planFingerprint(corePlan, filters, metrics.kpis, brief),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [corePlan, selectedPeriod, selectedCampus, selectedLevel, selectedCenter, selectedProgram, metrics.kpis, brief]
  );

  const activeNarrative = aiNarrative || fallbackNarrative;

  const plan = useMemo(() => {
    const base = buildSlidePlan({ metrics, filters, captures: basket, narrative: aiNarrative, charts: selectedCharts, brief });
    return applySlideNarrative(base, aiSlideTexts).map((s) => (edits[s.id] ? { ...s, ...edits[s.id] } : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, selectedCharts, brief, selectedPeriod, selectedCampus, selectedLevel, selectedCenter, selectedProgram, basket, aiNarrative, aiSlideTexts, edits]);

  const includedCount = plan.filter((s) => s.include).length;
  const selectedSlide = plan.find((s) => s.id === selectedSlideId) || plan[0];

  // Movimiento: la lista entra escalonada al aparecer o al cambiar las gráficas; la vista previa, al cambiar de diapositiva.
  const listRef = useRef(null);
  const previewRef = useRef(null);
  const slideKey = plan.map((s) => s.id).join('|');
  useReveal(listRef, [loading || !metrics.kpis.total, slideKey], { y: 6, stagger: 0.025 });
  useReveal(previewRef, [selectedSlide?.id], { y: 6, stagger: 0 });

  function editSlide(id, patch) {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }

  // Si ya hay una narrativa guardada para estos mismos datos y filtros, se reutiliza sin llamar al modelo.
  useEffect(() => {
    if (loading || !metrics.kpis.total) return;
    try {
      const cached = JSON.parse(localStorage.getItem(NARRATIVE_CACHE_KEY) || 'null');
      if (cached && cached.fingerprint === fingerprint) {
        setAiNarrative(cached.legacy);
        setAiSlideTexts(cached.slides || {});
        setAiReady(true);
        setNarrativeSource('cache');
      } else {
        setAiReady(false);
        setNarrativeSource('none');
        setAiSlideTexts({});
      }
    } catch {
      setNarrativeSource('none');
    }
  }, [fingerprint, loading, metrics.kpis.total]);

  /**
   * Una sola llamada al modelo por diapositiva-lote: título-mensaje, viñetas y nota del orador.
   * Solo se ejecuta al pulsar el botón; el resultado se guarda por huella de datos y filtros.
   */
  async function handleGenerateAiNarrative() {
    setGeneratingAi(true);
    setError('');

    try {
      const settings = await getSystemSettings();
      const selectedModel = settings?.mistral_model;

      const raw = await runMistralPrompt({
        apiKey: settings?.mistral_api_key || '',
        model: selectedModel,
        systemPrompt: 'Eres analista de datos senior en calidad educativa y relación docencia-servicio. ' +
          'Escribes textos breves para diapositivas ejecutivas, siempre con cifras tomadas de los datos recibidos. ' +
          'Respondes exclusivamente en JSON válido.',
        prompt: buildSlideNarrativePrompt(corePlan, { metrics, filters, brief }),
        temperature: 0.3
      });

      const { slides, legacy } = parseSlideNarrative(raw, corePlan);
      if (!Object.keys(slides).length) throw new Error('El modelo no devolvió diapositivas en el formato esperado.');

      const legacyNarrative = {
        ...fallbackNarrative,
        ...(legacy?.resumen ? { resumen: legacy.resumen } : {}),
        ...(legacy?.hallazgos?.length ? { hallazgos: legacy.hallazgos } : {}),
        ...(legacy?.riesgos?.length ? { riesgos: legacy.riesgos } : {}),
        ...(legacy?.acciones?.length ? { acciones: legacy.acciones } : {}),
        ...(brief.includeRecommendations ? {} : { acciones: [] }),
      };
      setAiNarrative(legacyNarrative);
      setAiSlideTexts(slides);
      setAiReady(true);
      setNarrativeSource('model');
      try {
        localStorage.setItem(NARRATIVE_CACHE_KEY, JSON.stringify({ fingerprint, legacy: legacyNarrative, slides }));
      } catch {
        // sin almacenamiento: la narrativa vale solo para esta sesión
      }
    } catch (aiError) {
      setAiNarrative(fallbackNarrative);
      setError(`No se pudo generar la narrativa con IA: ${aiError?.message || 'error no identificado'}. Se usan los textos automáticos.`);
    } finally {
      setGeneratingAi(false);
    }
  }

  async function handleDownloadDeck() {
    if (!metrics.kpis.total) {
      setError('No hay datos para armar la presentación.');
      return;
    }
    setExporting(true);
    setError('');
    try {
      await downloadDeck(plan, { filters });
    } catch (exportError) {
      setError(`No se pudo crear el archivo PPTX: ${exportError?.message || 'error no identificado'}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportWithTemplate() {
    if (!metrics.kpis.total) {
      setError('No hay datos para exportar con la plantilla.');
      return;
    }

    setExportingTemplate(true);
    setError('');

    try {
      const templateUrl = '/templates/INFORME AUTOEVALUACIÓN PRACTICAS.pptx';
      const engine = new PptxTemplateEngine();
      await engine.load(templateUrl);

      const operations = buildTemplateData(metrics, filters, aiNarrative || fallbackNarrative, filteredRows);

      console.log(`[Komet Presenta] Aplicando ${operations.length} operaciones a la plantilla...`);

      const bySlide = new Map();
      for (const op of operations) {
        if (!bySlide.has(op.slide)) bySlide.set(op.slide, []);
        bySlide.get(op.slide).push(op);
      }

      let totalSuccess = 0;
      for (const [slideNum, ops] of bySlide) {
        const success = engine.applyOperations(slideNum, ops);
        totalSuccess += success;
        console.log(`  Slide ${slideNum}: ${success}/${ops.length} operaciones exitosas`);
      }

      console.log(`[Komet Presenta] Total: ${totalSuccess}/${operations.length} operaciones completadas`);

      const timeTag = new Date().toISOString().slice(0, 10);
      await engine.download(`Informe-Autoevaluacion-${timeTag}.pptx`);
    } catch (templateError) {
      setError(`Error al generar con plantilla: ${templateError?.message || 'error no identificado'}`);
    } finally {
      setExportingTemplate(false);
    }
  }

  const noData = loading || !metrics.kpis.total;
  const steps = [
    { label: 'Asistente', done: !wizardOpen },
    { label: 'Datos', done: !noData },
    { label: 'Contenido', done: !noData && includedCount > 0 },
    { label: 'Narrativa', done: aiReady },
    { label: 'Exportar', done: false },
  ];
  const currentStep = steps.findIndex((s) => !s.done);
  const TYPE_LABEL = { cover: 'Portada', stat: 'Cifra', chart: 'Gráfico nativo', table: 'Tabla', figures: 'Cifras', columns: 'Texto', bullets: 'Texto' };
  const SOURCE_LABEL = { estadistica: 'Estadística', informe: 'Informe' };
  const NARRATIVE_LABEL = { model: 'Generada con IA', cache: 'Guardada para estos datos', none: 'Pendiente' };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="k-label">Análisis / Komet Presenta</p>
          <h1 className="font-display text-4xl font-bold leading-tight">Komet Presenta</h1>
          <p className="text-[15px] text-ink-2">Arma la presentación con lo que capturaste y descárgala en PowerPoint.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        {!wizardOpen ? (
          <button type="button" onClick={() => setWizardOpen(true)} className="k-btn-secondary !h-11 !px-4 !text-[15px]">
            <Wand2 className="w-4 h-4" /> Asistente
          </button>
        ) : null}
        <button
          type="button"
          onClick={templateMode === 'udes' ? handleExportWithTemplate : handleDownloadDeck}
          disabled={noData || exporting || exportingTemplate}
          className="k-btn !h-11 !px-5 !text-[15px]"
        >
          {exporting || exportingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Descargar PPTX
        </button>
        </div>
      </header>

      <ol aria-label="Pasos" className="k-card px-4 py-3.5 flex flex-wrap items-center gap-x-8 gap-y-2">
        {steps.map((step, i) => (
          <li key={step.label} aria-current={i === currentStep ? 'step' : undefined} className={`flex items-center gap-2.5 text-sm font-medium ${step.done ? 'text-score-high-fg' : i === currentStep ? 'text-ink font-semibold' : 'text-ink-2'}`}>
            <span className={`w-[26px] h-[26px] rounded-full border-[1.5px] flex items-center justify-center font-mono text-xs ${step.done ? 'bg-blue-600 border-blue-600 text-white' : i === currentStep ? 'bg-ink border-ink text-white' : 'border-line-strong'}`}>{i + 1}</span>
            {step.label}
          </li>
        ))}
        <li className="font-mono text-xs text-ink-2 sm:ml-auto">{includedCount} DIAPOSITIVAS · NARRATIVA {NARRATIVE_LABEL[narrativeSource].toUpperCase()}</li>
      </ol>

      {wizardOpen ? (
        <PresentaWizard
          brief={brief}
          onBrief={setBrief}
          scope={{
            period: selectedPeriod, setPeriod: setSelectedPeriod, periodOptions,
            campus: selectedCampus, setCampus: (v) => { setSelectedCampus(v); setSelectedCenter('Todos'); }, campusOptions,
            level: selectedLevel, setLevel: setSelectedLevel,
            program: selectedProgram, setProgram: setSelectedProgram, programOptions,
          }}
          catalog={catalog}
          chartIds={chartIds}
          onChartIds={setChartIds}
          sample={loading ? 'Cargando datos…' : `${metrics.kpis.total.toLocaleString('es-CO')} evaluaciones con este alcance`}
          canGenerate={!noData}
          generating={generatingAi}
          onFinish={() => { setWizardOpen(false); handleGenerateAiNarrative(); }}
          onSkip={() => setWizardOpen(false)}
        />
      ) : null}

      {error ? <div role="alert" className="rounded-lg bg-score-mid-bg text-score-mid-fg px-4 py-3 text-sm font-medium">{error}</div> : null}

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Datos y capturas */}
        <div className="w-full xl:w-[300px] xl:shrink-0 space-y-6">
          <section className="k-card p-5 space-y-4">
            <h2 className="font-display text-lg font-bold">Datos</h2>
 <PresentaSelect id="pr-period" label="Período" value={selectedPeriod} onChange={setSelectedPeriod} options={periodOptions} />
            <PresentaSelect id="pr-campus" label="Campus" value={selectedCampus} onChange={(v) => { setSelectedCampus(v); setSelectedCenter('Todos'); }} options={campusOptions} />
            <PresentaSelect id="pr-level" label="Nivel" value={selectedLevel} onChange={setSelectedLevel} options={[['Todos', 'Todos'], ['pregrado', 'Pregrado'], ['posgrado', 'Posgrado']]} />
            <PresentaSelect id="pr-center" label="Centro" value={selectedCenter} onChange={setSelectedCenter} options={centerOptions} />
            <PresentaSelect id="pr-program" label="Programa" value={selectedProgram} onChange={setSelectedProgram} options={programOptions} />
            <label htmlFor="pr-combine" className="flex items-center gap-2.5 min-h-[36px] text-sm cursor-pointer">
              <input id="pr-combine" type="checkbox" checked={combineSimilarCenters} onChange={(e) => setCombineSimilarCenters(e.target.checked)} className="w-[18px] h-[18px] accent-blue-600" />
              Combinar centros similares
            </label>
            <div className="border-t border-line pt-3 space-y-1.5">
              <div className="flex justify-between items-baseline"><span className="k-label">Muestra</span><span className="font-display text-2xl font-bold">{loading ? '–' : metrics.kpis.total.toLocaleString('es-CO')}</span></div>
              <div className="flex justify-between text-sm"><span>Completas</span><span className="font-mono">{loading ? '–' : `${metrics.kpis.completionPct.toFixed(1).replace('.', ',')} %`}</span></div>
              {!loading && metrics.kpis.total > 0 ? (
                <span className={`k-pill ${metrics.kpis.scored >= 30 ? 'k-pill-high' : 'k-pill-mid'}`}>{metrics.kpis.scored >= 30 ? 'Muestra suficiente' : 'Muestra pequeña'}</span>
              ) : null}
            </div>
          </section>

          <section className="k-card p-5 space-y-3">
            <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Capturas</h2><span className="font-mono text-xs text-ink-2">{basket.length}</span></div>
            <p className="text-[13px] leading-relaxed text-ink-2">Guardan los datos y los filtros, no una imagen. Se agregan desde Estadística e Informe.</p>
            {basket.length ? (
              <ul>
                {basket.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 border-t border-line py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{c.title}</p>
                      <p className="font-mono text-[11px] text-ink-2 uppercase">{SOURCE_LABEL[c.source] || c.source} · {c.kind === 'bar' ? 'barras' : c.kind === 'line' ? 'línea' : c.kind === 'table' ? 'tabla' : 'texto'}</p>
                    </div>
                    <button type="button" aria-label={`Quitar ${c.title}`} onClick={() => removeCapture(c.id)} className="w-10 h-10 shrink-0 flex items-center justify-center text-ink-2 hover:text-ink"><X size={16} /></button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2 border-t border-line pt-3">Aún no hay capturas. La presentación incluye por defecto el resumen, la distribución, la tendencia, los centros y los programas.</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => onNavigate?.('estadistica')} className="k-btn-secondary flex-1 !h-9 !text-[13px]">Estadística</button>
              <button type="button" onClick={() => onNavigate?.('reportes')} className="k-btn-secondary flex-1 !h-9 !text-[13px]">Informe</button>
            </div>
            {basket.length ? <button type="button" onClick={clearBasket} className="text-[13px] font-semibold text-ink-2 hover:text-ink">Vaciar capturas</button> : null}
          </section>
        </div>

        {/* Diapositivas */}
        <section className="k-card p-5 w-full xl:flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold">Diapositivas</h2>
            <button type="button" onClick={handleGenerateAiNarrative} disabled={noData || generatingAi} className="k-btn-secondary !h-9 !text-[13px]">
              {generatingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {narrativeSource === 'none' ? 'Generar narrativa' : 'Regenerar narrativa'}
            </button>
          </div>

          {noData ? (
            <p className="text-sm text-ink-2 py-10 text-center">{loading ? 'Cargando datos…' : 'No hay evaluaciones con estos filtros.'}</p>
          ) : (
            <ul ref={listRef} className="space-y-1">
              {plan.map((s, idx) => {
                const open = selectedSlide?.id === s.id;
                return (
                  <li key={s.id} data-reveal>
                    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${open ? 'bg-blue-50 border-blue-600' : 'border-transparent hover:bg-paper'} ${s.include ? '' : 'opacity-50'}`}>
                      <input type="checkbox" aria-label={`Incluir diapositiva ${idx + 1}`} checked={s.include} onChange={(e) => editSlide(s.id, { include: e.target.checked })} className="w-[18px] h-[18px] accent-blue-600 shrink-0" />
                      <button type="button" onClick={() => setSelectedSlideId(s.id)} aria-expanded={open} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                        <span className="font-mono text-xs text-ink-2 w-5 shrink-0">{idx + 1}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-snug">{s.title}</span>
                          <span className="k-pill bg-paper text-ink mt-1">{TYPE_LABEL[s.type] || 'Texto'}</span>
                        </span>
                      </button>
                    </div>
                    {open && s.type !== 'cover' ? (
                      <div className="ml-8 my-2 p-4 border border-line rounded-lg bg-white space-y-3">
                        <div className="space-y-1.5">
                          <label htmlFor={`t-${s.id}`} className="k-label block">Mensaje del título</label>
                          <input id={`t-${s.id}`} type="text" value={s.title} maxLength={LIMITS.title} onChange={(e) => editSlide(s.id, { title: e.target.value })} className="k-input !h-11 !text-[15px]" />
                          <span className="font-mono text-[11px] text-ink-2">{s.title.length} / {LIMITS.title} CARACTERES</span>
                        </div>
                        {s.type !== 'columns' && s.type !== 'table' && s.type !== 'figures' ? (
                          <div className="space-y-1.5">
                            <label htmlFor={`b-${s.id}`} className="k-label block">Viñetas · una por línea, máximo {LIMITS.bullets}</label>
                            <textarea id={`b-${s.id}`} rows={3} value={(s.bullets || []).join('\n')} onChange={(e) => editSlide(s.id, { bullets: e.target.value.split('\n').slice(0, LIMITS.bullets) })} className="k-input !h-auto !py-2.5 !text-sm !font-normal leading-relaxed resize-none" />
                          </div>
                        ) : null}
                        <div className="space-y-1.5">
                          <label htmlFor={`n-${s.id}`} className="k-label block">Nota del orador</label>
                          <textarea id={`n-${s.id}`} rows={3} value={s.notes || ''} maxLength={LIMITS.notes} onChange={(e) => editSlide(s.id, { notes: e.target.value })} className="k-input !h-auto !py-2.5 !text-sm !font-normal leading-relaxed resize-none" />
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Vista previa y opciones */}
        <div className="w-full xl:w-[340px] xl:shrink-0 space-y-6">
          <section className="k-card p-5 space-y-3">
            <h2 className="font-display text-lg font-bold">Vista previa</h2>
            <div ref={previewRef}>{selectedSlide ? <SlidePreview slide={selectedSlide} /> : null}</div>
            <p className="font-mono text-[11px] text-ink-2">{selectedSlide?.type === 'chart' ? 'GRÁFICO NATIVO, EDITABLE EN POWERPOINT' : 'TEXTO EDITABLE EN POWERPOINT'}</p>
          </section>

          <section className="k-card p-5 space-y-2">
            <h2 className="font-display text-lg font-bold">Plantilla</h2>
            <label htmlFor="pl-komet" className="flex items-start gap-2.5 text-sm min-h-[44px] cursor-pointer">
              <input id="pl-komet" type="radio" name="plantilla" checked={templateMode === 'komet'} onChange={() => setTemplateMode('komet')} className="mt-1 accent-blue-600" />
              <span><b className="font-semibold">Estándar Komet</b><br /><span className="text-ink-2">Diseño propio con gráficos nativos.</span></span>
            </label>
            <label htmlFor="pl-udes" className="flex items-start gap-2.5 text-sm min-h-[44px] cursor-pointer">
              <input id="pl-udes" type="radio" name="plantilla" checked={templateMode === 'udes'} onChange={() => setTemplateMode('udes')} className="mt-1 accent-blue-600" />
              <span><b className="font-semibold">Plantilla institucional UDES</b><br /><span className="text-ink-2">Informe de autoevaluación de prácticas. No usa el plan de diapositivas.</span></span>
            </label>
          </section>

          <section className="k-card p-5 space-y-2 text-sm">
            <h2 className="font-display text-lg font-bold">Narrativa</h2>
            <div className="flex justify-between"><span>Estado</span><span className="font-semibold">{NARRATIVE_LABEL[narrativeSource]}</span></div>
            <p className="text-[13px] text-ink-2 leading-relaxed">Se genera al pulsar el botón y se guarda mientras los datos y filtros no cambien.</p>
          </section>
        </div>
      </div>

      {/* ── Módulo de Análisis Comparativo: Centros × Programas ── */}
      {!loading && metrics.centerAnalysis.length > 0 && (
        <ComparadorCentrosProgramas
          centerAnalysis={metrics.centerAnalysis}
          loading={loading}
        />
      )}
    </div>
  );
}

// Vista previa 16:9 simplificada de la diapositiva elegida (el PPTX real usa gráficos nativos).
function SlidePreview({ slide }) {
  const dark = slide.type === 'cover';
  const chart = slide.chart;
  const max = chart ? (chart.scoreScale ? 5 : Math.max(...chart.series[0].values, 1)) : 1;
  return (
    <div data-reveal className={`w-full aspect-video border p-3 overflow-hidden flex flex-col gap-2 ${dark ? 'bg-night border-night text-white' : 'bg-white border-line-strong'}`} style={{ fontFamily: 'Calibri, Carlito, sans-serif' }}>
      <p className={`font-bold leading-tight text-[13px] ${dark ? 'text-white' : 'text-night'}`} style={{ fontFamily: 'Cambria, Georgia, serif' }}>{slide.title}</p>
      {dark ? <p className="text-[10px] text-[#A9BCC6]">{slide.subtitle}</p> : null}
      {chart ? (
        <div className="flex-1 flex flex-col justify-center gap-1 min-h-0">
          {chart.categories.slice(0, 5).map((cat, i) => (
            <div key={cat} className="flex items-center gap-1.5 text-[8px]">
              <span className="w-14 truncate text-ink-2">{cat}</span>
              <div className="flex-1 h-1.5 bg-paper"><div data-bar className="h-1.5 bg-blue-600" style={{ width: `${Math.min(100, (chart.series[0].values[i] / max) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      ) : slide.stat ? (
        <p className="text-4xl font-bold text-blue-600 leading-none" style={{ fontFamily: 'Cambria, Georgia, serif' }}>{slide.stat.value}</p>
      ) : slide.table ? (
        <div className="flex-1 flex flex-col gap-0.5 text-[7px] text-ink-2 min-h-0">
          {slide.table.rows.slice(0, 4).map((r, i) => <div key={i} className="flex justify-between border-b border-line pb-0.5"><span className="truncate">{r[0]}</span><span>{r[2] ?? r[1]}</span></div>)}
        </div>
      ) : null}
      {!dark && slide.bullets?.length ? (
        <ul className="text-[8px] leading-snug space-y-0.5">{slide.bullets.slice(0, 3).map((b, i) => <li key={i} className="truncate">• {b}</li>)}</ul>
      ) : null}
    </div>
  );
}
