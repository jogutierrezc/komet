import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Presentation, Sparkles, Download, BarChart3, FileText, PieChart, FileUp } from 'lucide-react';
import {
  getEvaluationReportMetrics,
  getSystemSettings,
  runOpenRouterPrompt,
  OPENROUTER_FREE_MODELS
} from '../lib/data';
import { PptxTemplateEngine, buildTemplateData } from '../lib/pptxTemplateEngine';

// --- Módulos extraídos ---
import { norm, avg, stdDev, resolveProgram, resolveLevel, formatPct, formatFilters, rankBy, getMonthKey, shortList } from '../utils/dataHelpers';
import { parseAiPayload, buildNarrativeFallback } from '../services/aiService';
import { createPresentationDeck } from '../services/pptService';

export default function KometPresenta() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const [error, setError] = useState('');
  const [aiNarrative, setAiNarrative] = useState(null);

  const [selectedCampus, setSelectedCampus] = useState('Todos');
  const [selectedLevel, setSelectedLevel] = useState('Todos');
  const [selectedCenter, setSelectedCenter] = useState('Todos');
  const [selectedProgram, setSelectedProgram] = useState('Todos');

  useEffect(() => {
    setLoading(true);
    getEvaluationReportMetrics()
      .then((result) => setRows(result?.rows || []))
      .catch(() => {
        setRows([]);
        setError('No se pudo cargar información de evaluaciones.');
      })
      .finally(() => setLoading(false));
  }, []);

  const campusOptions = useMemo(() => {
    return ['Todos', ...new Set(rows.map((row) => norm(row.campus)).filter(Boolean))];
  }, [rows]);

  const baseFiltered = useMemo(() => {
    return rows.filter((row) => {
      if (selectedCampus !== 'Todos' && norm(row.campus) !== selectedCampus) return false;
      if (selectedLevel !== 'Todos') {
        const level = resolveLevel(row);
        if (level && level !== selectedLevel) return false;
      }
      return true;
    });
  }, [rows, selectedCampus, selectedLevel]);

  const centerOptions = useMemo(() => {
    return ['Todos', ...new Set(baseFiltered.map((row) => norm(row.center || 'Sin sitio')).filter(Boolean))];
  }, [baseFiltered]);

  const programOptions = useMemo(() => {
    const source = selectedCenter === 'Todos'
      ? baseFiltered
      : baseFiltered.filter((row) => norm(row.center || 'Sin sitio') === selectedCenter);
    const programs = [...new Set(source.map((row) => resolveProgram(row)).filter((value) => value && value !== 'Sin programa'))];
    return ['Todos', ...programs];
  }, [baseFiltered, selectedCenter]);

  useEffect(() => {
    if (!centerOptions.includes(selectedCenter)) setSelectedCenter('Todos');
  }, [centerOptions, selectedCenter]);

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

  const metrics = useMemo(() => {
    const scoreRows = filteredRows
      .map((row) => row.scoreSummary?.globalScore)
      .filter((value) => typeof value === 'number');

    const completed = filteredRows.filter((row) => row.status === 'Completada').length;

    const byCampus = rankBy(filteredRows, (row) => norm(row.campus || 'Sin campus'), (row) => row.scoreSummary?.globalScore);
    const byCenter = rankBy(filteredRows, (row) => norm(row.center || 'Sin sitio'), (row) => row.scoreSummary?.globalScore);
    const byProgram = rankBy(filteredRows, (row) => resolveProgram(row), (row) => row.scoreSummary?.globalScore)
      .filter((item) => item.name !== 'Sin programa');
    const byRole = rankBy(filteredRows, (row) => norm(row.role || 'Sin definir'), (row) => row.scoreSummary?.globalScore);

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

    return {
      kpis: {
        total: filteredRows.length,
        completed,
        completionPct: filteredRows.length ? Number(((completed / filteredRows.length) * 100).toFixed(1)) : 0,
        globalScore: avg(scoreRows),
        programs: new Set(filteredRows.map((row) => resolveProgram(row)).filter((value) => value !== 'Sin programa')).size,
        centers: new Set(filteredRows.map((row) => norm(row.center || 'Sin sitio'))).size,
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
      trendDirection
    };
  }, [filteredRows]);

  const filters = {
    campus: selectedCampus,
    level: selectedLevel,
    center: selectedCenter,
    program: selectedProgram
  };

  const fallbackNarrative = useMemo(() => buildNarrativeFallback(metrics), [metrics]);

  async function handleGenerateAiNarrative() {
    setGeneratingAi(true);
    setError('');

    try {
      const settings = await getSystemSettings();
      const selectedModel = String(settings?.openrouter_model || '').includes(':free')
        ? settings.openrouter_model
        : OPENROUTER_FREE_MODELS[0];

      const prompt = [
        'Eres un analista de datos avanzado especialista en calidad de educación y salud.',
        'Analiza las siguientes métricas y entrega SOLO un JSON válido con esta estructura exacta:',
        '{"resumen":"texto de 2 lineas","analisis_completo":"Un estudio detallado interpretando los datos, tendencias temporales, correlaciones y conclusiones fuertes basadas en las desviaciones.","hallazgos":["..."],"riesgos":["..."],"acciones":["Sugerencia accionable 1..."]}',
        'Máximo 5 hallazgos, 5 riesgos y 5 acciones (sugerencias estratégicas de mejora).',
        `Filtros aplicados: ${formatFilters(filters)}`,
        `Data: Total evaluaciones=${metrics.kpis.total}, Cumplimiento=${metrics.kpis.completionPct}%, Promedio=${metrics.kpis.globalScore}`,
        `Distribución de notas: 0-2(${metrics.distribution[0].count}), 2-3(${metrics.distribution[1].count}), 3-4(${metrics.distribution[2].count}), 4-5(${metrics.distribution[3].count})`,
        `Top 3 Centros: ${metrics.byCenter.slice(0, 3).map((item) => `${item.name}:${item.score.toFixed(2)}`).join(', ') || 'N/A'}`,
        `Top 3 Programas: ${metrics.byProgram.slice(0, 3).map((item) => `${item.name}:${item.score.toFixed(2)}`).join(', ') || 'N/A'}`,
        `Tendencia Mensual: ${metrics.monthly.map((item) => `${item.name}:${item.score.toFixed(2)}`).join(', ') || 'N/A'}`,
        `Desviación Estándar Global: ${metrics.variability}`
      ].join('\n');

      const raw = await runOpenRouterPrompt({
        apiKey: settings?.openrouter_api_key || '',
        model: selectedModel,
        systemPrompt: settings?.openrouter_system_prompt || 'Eres un Chief Data Officer experto en generar insights a partir de data cruda.',
        prompt,
        temperature: 0.6
      });

      const parsed = parseAiPayload(raw);
      setAiNarrative(parsed);
    } catch (aiError) {
      setAiNarrative(fallbackNarrative);
      setError(`No se pudo generar análisis profundo IA: ${aiError?.message || 'error no identificado'}`);
    } finally {
      setGeneratingAi(false);
    }
  }

  async function handleExportPptx() {
    setExporting(true);
    setError('');

    try {
      const deck = createPresentationDeck({
        filters,
        metrics,
        narrative: aiNarrative || fallbackNarrative
      });

      const timeTag = new Date().toISOString().slice(0, 10);
      await deck.writeFile({ fileName: `Komet-Data-Report-${timeTag}.pptx` });
    } catch (exportError) {
      setError(`Error al exportar la presentación con gráficos: ${exportError?.message || 'error no identificado'}`);
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

      const operations = buildTemplateData(metrics, filters, aiNarrative || fallbackNarrative);

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

  const activeNarrative = aiNarrative || fallbackNarrative;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Presentation className="w-7 h-7 text-blue-600" />
              Komet Data & Analytics
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              Generador de presentaciones ejecutivas. Incluye gráficos nativos interactivos, tablas formateadas y un modelo de estudio de datos profundo.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerateAiNarrative}
              disabled={loading || generatingAi || !metrics.kpis.total}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2 transition-all"
            >
              {generatingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-yellow-400" />}
              Analizar Dataset (IA)
            </button>
            <button
              type="button"
              onClick={handleExportPptx}
              disabled={loading || exporting || !metrics.kpis.total}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 inline-flex items-center gap-2 transition-all shadow-sm shadow-blue-200"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Generar PPTX con Gráficas
            </button>
            <button
              type="button"
              onClick={handleExportWithTemplate}
              disabled={loading || exportingTemplate || !metrics.kpis.total}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center gap-2 transition-all shadow-sm shadow-emerald-200"
            >
              {exportingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              Exportar con Plantilla
            </button>
          </div>
        </div>
        {error && <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Segmentación de la Muestra</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <select className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedCampus} onChange={(e) => setSelectedCampus(e.target.value)}>
            {campusOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
          </select>
          <select className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
            <option value="Todos">Todos los niveles</option>
            <option value="pregrado">Pregrado</option>
            <option value="posgrado">Posgrado</option>
          </select>
          <select className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)}>
            {centerOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
          </select>
          <select className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)}>
            {programOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Evaluaciones</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{loading ? '-' : metrics.kpis.total}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completadas</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{loading ? '-' : metrics.kpis.completed}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cumplimiento</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{loading ? '-' : `${metrics.kpis.completionPct}%`}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Promedio Global</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{loading ? '-' : metrics.kpis.globalScore.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3">
            <PieChart className="w-5 h-5 text-indigo-500" />
            Resumen Ejecutivo
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            {activeNarrative.resumen}
          </p>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[16rem]">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            Estudio Profundo de Datos (Slide 12)
          </h3>
          {generatingAi ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm">Analizando correlaciones y varianzas...</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed text-justify">
              {activeNarrative.analisis_completo}
            </p>
          )}
        </div>

        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-orange-500" />
            Sugerencias y Plan de Acción (Slide 15)
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeNarrative.acciones.slice(0, 6).map((accion, idx) => (
              <li key={idx} className="text-sm text-slate-700 bg-orange-50/50 p-4 rounded-xl border border-orange-100 flex items-start gap-2">
                <span className="text-orange-600 font-black mt-0.5">•</span>
                <span>{accion}</span>
              </li>
            ))}
            {activeNarrative.acciones.length === 0 && (
              <p className="text-sm text-slate-400">No hay sugerencias generadas aún.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
