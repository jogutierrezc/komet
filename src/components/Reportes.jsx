import { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Building2,
  GraduationCap,
  GitCompare,
  Sparkles,
  Download,
  MapPin,
  Users,
  AlertTriangle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  Cell
} from 'recharts';
import {
  getEvaluationReportMetrics,
  getSystemSettings,
  runOpenRouterPrompt,
  OPENROUTER_FREE_MODELS
} from '../lib/data';

function average(values = []) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value || '').trim();
}

function extractTextsDeep(input, acc = []) {
  if (input === null || input === undefined) return acc;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.length >= 20) {
      acc.push(trimmed);
    }
    return acc;
  }
  if (Array.isArray(input)) {
    input.forEach((item) => extractTextsDeep(item, acc));
    return acc;
  }
  if (typeof input === 'object') {
    Object.values(input).forEach((value) => extractTextsDeep(value, acc));
    return acc;
  }
  return acc;
}

function summarizeImprovementAspects(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    (row.scoreSummary?.sectionScores || []).forEach((section) => {
      if (typeof section.score !== 'number') return;
      if (section.score < 3.7) {
        const key = normalizeText(section.title || 'Aspecto no identificado');
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
  });

  return [...map.entries()]
    .map(([aspect, mentions]) => ({ aspect, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 8);
}

function buildCenterAnalytics(rows = []) {
  const bucket = new Map();

  rows.forEach((row) => {
    const centerName = normalizeText(row.center || 'Sin sitio');
    const current =
      bucket.get(centerName) ||
      {
        center: centerName,
        campus: normalizeText(row.campus || 'Sin campus'),
        evaluations: 0,
        completed: 0,
        scores: [],
        roles: new Map(),
        programs: new Map(),
        lowAspects: new Map(),
        comments: []
      };

    current.evaluations += 1;
    if (row.status === 'Completada') current.completed += 1;

    const globalScore = row.scoreSummary?.globalScore;
    if (typeof globalScore === 'number') {
      current.scores.push(globalScore);
    }

    const roleKey = normalizeText(row.role || 'Sin rol');
    const roleScores = current.roles.get(roleKey) || [];
    if (typeof globalScore === 'number') {
      roleScores.push(globalScore);
    }
    current.roles.set(roleKey, roleScores);

    const programKey = normalizeText(row.program || 'Sin programa');
    const programScores = current.programs.get(programKey) || [];
    if (typeof globalScore === 'number') {
      programScores.push(globalScore);
    }
    current.programs.set(programKey, programScores);

    (row.scoreSummary?.sectionScores || []).forEach((section) => {
      if (typeof section.score === 'number' && section.score < 3.7) {
        const aspect = normalizeText(section.title || 'Aspecto no identificado');
        current.lowAspects.set(aspect, (current.lowAspects.get(aspect) || 0) + 1);
      }
    });

    const commentSnippets = extractTextsDeep(row.rawAnswers || {}).slice(0, 4);
    current.comments.push(...commentSnippets);

    bucket.set(centerName, current);
  });

  return [...bucket.values()]
    .map((item) => {
      const roles = [...item.roles.entries()].map(([role, scores]) => ({
        role,
        evaluations: scores.length,
        average: average(scores)
      }));

      const programs = [...item.programs.entries()].map(([program, scores]) => ({
        program,
        evaluations: scores.length,
        average: average(scores)
      }));

      const lowAspects = [...item.lowAspects.entries()]
        .map(([aspect, mentions]) => ({ aspect, mentions }))
        .sort((a, b) => b.mentions - a.mentions)
        .slice(0, 6);

      return {
        center: item.center,
        campus: item.campus,
        evaluations: item.evaluations,
        completed: item.completed,
        completionRate: item.evaluations ? Number(((item.completed / item.evaluations) * 100).toFixed(1)) : 0,
        averageScore: average(item.scores),
        roles,
        programs,
        lowAspects,
        comments: item.comments.slice(0, 12)
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);
}

function buildProgramAnalytics(rows = []) {
  const bucket = new Map();

  rows.forEach((row) => {
    const key = normalizeText(row.program || 'Sin programa');
    const current =
      bucket.get(key) ||
      {
        program: key,
        evaluations: 0,
        scores: [],
        centers: new Map(),
        roles: new Map(),
        lowAspects: new Map()
      };

    current.evaluations += 1;
    const globalScore = row.scoreSummary?.globalScore;
    if (typeof globalScore === 'number') {
      current.scores.push(globalScore);
    }

    const centerKey = normalizeText(row.center || 'Sin sitio');
    const centerScores = current.centers.get(centerKey) || [];
    if (typeof globalScore === 'number') {
      centerScores.push(globalScore);
    }
    current.centers.set(centerKey, centerScores);

    const roleKey = normalizeText(row.role || 'Sin rol');
    const roleScores = current.roles.get(roleKey) || [];
    if (typeof globalScore === 'number') {
      roleScores.push(globalScore);
    }
    current.roles.set(roleKey, roleScores);

    (row.scoreSummary?.sectionScores || []).forEach((section) => {
      if (typeof section.score === 'number' && section.score < 3.7) {
        const aspect = normalizeText(section.title || 'Aspecto no identificado');
        current.lowAspects.set(aspect, (current.lowAspects.get(aspect) || 0) + 1);
      }
    });

    bucket.set(key, current);
  });

  return [...bucket.values()]
    .map((item) => {
      const centers = [...item.centers.entries()]
        .map(([center, scores]) => ({
          center,
          evaluations: scores.length,
          average: average(scores)
        }))
        .sort((a, b) => b.average - a.average);

      const roles = [...item.roles.entries()]
        .map(([role, scores]) => ({
          role,
          evaluations: scores.length,
          average: average(scores)
        }))
        .sort((a, b) => b.average - a.average);

      const lowAspects = [...item.lowAspects.entries()]
        .map(([aspect, mentions]) => ({ aspect, mentions }))
        .sort((a, b) => b.mentions - a.mentions)
        .slice(0, 6);

      return {
        program: item.program,
        evaluations: item.evaluations,
        averageScore: average(item.scores),
        centers,
        roles,
        lowAspects
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);
}

function getModelForReports(settings) {
  const configuredModel = normalizeText(settings?.openrouter_model);
  if (configuredModel && configuredModel.includes(':free')) {
    return configuredModel;
  }
  return OPENROUTER_FREE_MODELS[0];
}

function NarrativeCard({ loading, error, content, modelLabel }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Narrativa IA</p>
        <p className="text-xs text-slate-500">Modelo: {modelLabel}</p>
      </div>
      {loading ? <p className="text-sm text-slate-500">Generando informe narrativo avanzado...</p> : null}
      {error ? <p className="text-sm text-rose-700 whitespace-pre-wrap">{error}</p> : null}
      {content ? <div className="text-sm leading-7 whitespace-pre-wrap text-slate-700 max-h-[760px] overflow-y-auto pr-2">{content}</div> : null}
      {!loading && !error && !content ? (
        <p className="text-sm text-slate-500">Aun no se ha generado narrativa para este informe.</p>
      ) : null}
    </div>
  );
}

export default function Reportes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [systemSettings, setSystemSettings] = useState(null);
  const [activeReport, setActiveReport] = useState('centro');
  const [selectedCampus, setSelectedCampus] = useState('Todos');
  const [selectedCenter, setSelectedCenter] = useState('Todos');
  const [selectedProgram, setSelectedProgram] = useState('Todos');
  const [narrativeState, setNarrativeState] = useState({
    centro: { loading: false, error: '', content: '' },
    programa: { loading: false, error: '', content: '' },
    comparado: { loading: false, error: '', content: '' }
  });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError('');
      try {
        const [metrics, settings] = await Promise.all([
          getEvaluationReportMetrics({}),
          getSystemSettings()
        ]);

        if (!cancelled) {
          setRows(metrics?.rows || []);
          setSystemSettings(settings || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'No se pudo cargar el modulo Informe.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const campuses = useMemo(() => {
    return [...new Set(rows.map((row) => normalizeText(row.campus || 'Sin campus')))].sort();
  }, [rows]);

  const scopedRows = useMemo(() => {
    if (selectedCampus === 'Todos') return rows;
    return rows.filter((row) => normalizeText(row.campus) === selectedCampus);
  }, [rows, selectedCampus]);

  const centerAnalytics = useMemo(() => buildCenterAnalytics(scopedRows), [scopedRows]);
  const programAnalytics = useMemo(() => buildProgramAnalytics(scopedRows), [scopedRows]);
  const globalAspects = useMemo(() => summarizeImprovementAspects(scopedRows), [scopedRows]);

  const centerOptions = useMemo(() => centerAnalytics.map((item) => item.center), [centerAnalytics]);
  const programOptions = useMemo(() => programAnalytics.map((item) => item.program), [programAnalytics]);

  useEffect(() => {
    if (selectedCenter !== 'Todos' && !centerOptions.includes(selectedCenter)) {
      setSelectedCenter('Todos');
    }
  }, [centerOptions, selectedCenter]);

  useEffect(() => {
    if (selectedProgram !== 'Todos' && !programOptions.includes(selectedProgram)) {
      setSelectedProgram('Todos');
    }
  }, [programOptions, selectedProgram]);

  const centerReportData = useMemo(() => {
    const selected = selectedCenter === 'Todos' ? centerAnalytics[0] : centerAnalytics.find((item) => item.center === selectedCenter);
    return selected || null;
  }, [centerAnalytics, selectedCenter]);

  const programReportData = useMemo(() => {
    const selected = selectedProgram === 'Todos' ? programAnalytics[0] : programAnalytics.find((item) => item.program === selectedProgram);
    return selected || null;
  }, [programAnalytics, selectedProgram]);

  const topCentersComparison = useMemo(() => centerAnalytics.slice(0, 12), [centerAnalytics]);
  const bottomCentersComparison = useMemo(
    () => centerAnalytics.filter((item) => item.averageScore > 0).slice(-6).reverse(),
    [centerAnalytics]
  );

  const roleRadarData = useMemo(() => {
    if (!centerReportData) return [];
    return centerReportData.roles.map((row) => ({
      role: row.role,
      score: row.average,
      volume: clamp((row.evaluations / Math.max(1, centerReportData.evaluations)) * 5, 0.6, 5)
    }));
  }, [centerReportData]);

  const programCenterLineData = useMemo(() => {
    if (!programReportData) return [];
    return programReportData.centers.slice(0, 12);
  }, [programReportData]);

  const comparisonChartData = useMemo(() => {
    return topCentersComparison.map((item, index) => ({
      ...item,
      ranking: index + 1,
      risk: item.averageScore < 3.6 ? 1 : 0
    }));
  }, [topCentersComparison]);

  const globalScore = useMemo(() => {
    const scores = scopedRows
      .map((row) => row.scoreSummary?.globalScore)
      .filter((value) => typeof value === 'number');
    return average(scores);
  }, [scopedRows]);

  const totalEvaluations = scopedRows.length;
  const completionRate = useMemo(() => {
    if (!scopedRows.length) return 0;
    const completed = scopedRows.filter((row) => row.status === 'Completada').length;
    return Number(((completed / scopedRows.length) * 100).toFixed(1));
  }, [scopedRows]);

  const reportModel = getModelForReports(systemSettings);

  async function generateNarrative(reportType) {
    if (!systemSettings?.openrouter_api_key) {
      setNarrativeState((prev) => ({
        ...prev,
        [reportType]: {
          ...prev[reportType],
          error: 'Configura la API key de OpenRouter en Sistema > Configuración IA antes de generar el informe.',
          loading: false
        }
      }));
      return;
    }

    const dataset =
      reportType === 'centro'
        ? {
            campusFiltro: selectedCampus,
            centro: centerReportData,
            promediosGlobales: {
              score: globalScore,
              completionRate,
              evaluaciones: totalEvaluations
            },
            aspectosMejoraGlobales: globalAspects,
            topCentrosContexto: topCentersComparison.slice(0, 6)
          }
        : reportType === 'programa'
        ? {
            campusFiltro: selectedCampus,
            programa: programReportData,
            promedioGlobal: globalScore,
            aspectosMejoraGlobales: globalAspects,
            programasComparables: programAnalytics.slice(0, 8)
          }
        : {
            campusFiltro: selectedCampus,
            comparativoTop: topCentersComparison,
            comparativoRiesgo: bottomCentersComparison,
            promediosPrograma: programAnalytics.slice(0, 12),
            aspectosMejoraGlobales: globalAspects,
            scoreGlobal: globalScore
          };

    const payload = JSON.stringify(dataset, null, 2).slice(0, 13000);

    const titleByType = {
      centro: 'Informe del Centro de Practica (Global, por Programa y por Roles)',
      programa: 'Informe del Programa (analiza todos los sitios asociados)',
      comparado: 'Informe Comparado de Sitios de Practica'
    };

    const prompt = `
Genera un informe ejecutivo narrativo en español para: ${titleByType[reportType]}.
Requisitos obligatorios:
1. Longitud minima: 2200 palabras (equivalente a 3 paginas o mas).
2. Estilo: analitico, tecnico y narrativo, con conclusiones accionables.
3. Estructura: resumen ejecutivo, metodologia, analisis cuantitativo, interpretacion cualitativa, riesgos, oportunidades, plan de mejora 30-60-90 dias, conclusiones.
4. Incluir cuadros en texto markdown (tablas) para sintetizar hallazgos por campus/centro/programa/roles.
5. Identificar explicitamente aspectos de mejora mencionados por evaluadores y priorizar por impacto.
6. No inventar datos fuera del dataset, si falta informacion debes explicitarlo.
7. Mantener tono institucional para toma de decisiones academico-asistenciales.

Dataset JSON:
${payload}
    `.trim();

    setNarrativeState((prev) => ({
      ...prev,
      [reportType]: { ...prev[reportType], loading: true, error: '' }
    }));

    try {
      const content = await runOpenRouterPrompt({
        apiKey: systemSettings.openrouter_api_key,
        model: reportModel,
        systemPrompt:
          (systemSettings.openrouter_system_prompt || '') +
          ' Eres un analista senior de docencia-servicio y redactas informes extensos con hallazgos estadisticos y narrativos.',
        temperature: Number(systemSettings.openrouter_temperature ?? 0.6),
        prompt
      });

      setNarrativeState((prev) => ({
        ...prev,
        [reportType]: {
          ...prev[reportType],
          loading: false,
          content: content || 'No se recibio contenido desde OpenRouter.',
          error: ''
        }
      }));
    } catch (err) {
      setNarrativeState((prev) => ({
        ...prev,
        [reportType]: {
          ...prev[reportType],
          loading: false,
          error: err?.message || 'No fue posible generar el informe narrativo.'
        }
      }));
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500">
        Cargando modulo Informe y analitica de sitios de practica...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <p className="font-semibold">No se pudo cargar el modulo Informe</p>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">Modulo Informe</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Analitica Avanzada de Sitios de Practica por Campus</h1>
            <p className="mt-2 text-sm text-slate-500 max-w-4xl">
              Consolida evaluaciones para producir informes complejos del centro de practica, del programa academico y comparativos entre sitios, reforzados con narrativa IA usando OpenRouter.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download size={16} /> Imprimir / PDF
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <MapPin size={16} className="text-slate-400" />
            <select
              className="w-full bg-transparent outline-none"
              value={selectedCampus}
              onChange={(event) => setSelectedCampus(event.target.value)}
            >
              <option value="Todos">Todos los campus</option>
              {campuses.map((campus) => (
                <option key={campus} value={campus}>{campus}</option>
              ))}
            </select>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <select
              className="w-full bg-transparent outline-none"
              value={selectedCenter}
              onChange={(event) => setSelectedCenter(event.target.value)}
            >
              <option value="Todos">Centro lider (automatico)</option>
              {centerOptions.map((center) => (
                <option key={center} value={center}>{center}</option>
              ))}
            </select>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <GraduationCap size={16} className="text-slate-400" />
            <select
              className="w-full bg-transparent outline-none"
              value={selectedProgram}
              onChange={(event) => setSelectedProgram(event.target.value)}
            >
              <option value="Todos">Programa lider (automatico)</option>
              {programOptions.map((program) => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600">Puntaje Global</p>
          <p className="mt-2 text-4xl font-black text-slate-900">{globalScore.toFixed(2)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Evaluaciones</p>
          <p className="mt-2 text-4xl font-black text-slate-900">{totalEvaluations}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-600">Cumplimiento</p>
          <p className="mt-2 text-4xl font-black text-slate-900">{completionRate}%</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">Aspectos de Mejora</p>
          <p className="mt-2 text-4xl font-black text-amber-800">{globalAspects.length}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'centro', label: '1. Informe Centro de Practica', icon: Building2 },
            { id: 'programa', label: '2. Informe Programa', icon: GraduationCap },
            { id: 'comparado', label: '3. Informe Comparado', icon: GitCompare }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveReport(tab.id)}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                activeReport === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeReport === 'centro' ? (
        <section className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-slate-900">Informe del Centro de Practica</h2>
                <button
                  type="button"
                  onClick={() => generateNarrative('centro')}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Sparkles size={15} /> Generar Informe IA
                </button>
              </div>

              {centerReportData ? (
                <div className="space-y-3 text-sm text-slate-700">
                  <p><span className="font-bold">Centro:</span> {centerReportData.center}</p>
                  <p><span className="font-bold">Campus:</span> {centerReportData.campus}</p>
                  <p><span className="font-bold">Promedio global:</span> {centerReportData.averageScore.toFixed(2)} / 5</p>
                  <p><span className="font-bold">Cobertura:</span> {centerReportData.evaluations} evaluaciones ({centerReportData.completionRate}% completadas)</p>

                  <div className="h-72 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={roleRadarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="role" />
                        <PolarRadiusAxis domain={[0, 5]} />
                        <Radar name="Puntaje" dataKey="score" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.5} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No hay datos del centro para el filtro actual.</p>
              )}
            </div>

            <NarrativeCard
              loading={narrativeState.centro.loading}
              error={narrativeState.centro.error}
              content={narrativeState.centro.content}
              modelLabel={reportModel}
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <p className="text-sm font-black text-slate-900">Cuadro Global / Programa / Roles del Centro</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-widest font-black">
                  <tr>
                    <th className="px-6 py-3">Dimension</th>
                    <th className="px-6 py-3">Categoria</th>
                    <th className="px-6 py-3 text-right">Evaluaciones</th>
                    <th className="px-6 py-3 text-right">Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {centerReportData ? (
                    <>
                      <tr className="bg-indigo-50/50">
                        <td className="px-6 py-3 font-semibold">Global</td>
                        <td className="px-6 py-3">{centerReportData.center}</td>
                        <td className="px-6 py-3 text-right">{centerReportData.evaluations}</td>
                        <td className="px-6 py-3 text-right font-black">{centerReportData.averageScore.toFixed(2)}</td>
                      </tr>
                      {centerReportData.programs.map((program) => (
                        <tr key={`program-${program.program}`}>
                          <td className="px-6 py-3 font-semibold text-slate-500">Por programa</td>
                          <td className="px-6 py-3">{program.program}</td>
                          <td className="px-6 py-3 text-right">{program.evaluations}</td>
                          <td className="px-6 py-3 text-right">{program.average.toFixed(2)}</td>
                        </tr>
                      ))}
                      {centerReportData.roles.map((role) => (
                        <tr key={`role-${role.role}`}>
                          <td className="px-6 py-3 font-semibold text-slate-500">Por rol</td>
                          <td className="px-6 py-3">{role.role}</td>
                          <td className="px-6 py-3 text-right">{role.evaluations}</td>
                          <td className="px-6 py-3 text-right">{role.average.toFixed(2)}</td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <tr>
                      <td className="px-6 py-4 text-slate-500" colSpan={4}>Sin datos para mostrar.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {activeReport === 'programa' ? (
        <section className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-slate-900">Informe del Programa</h2>
                <button
                  type="button"
                  onClick={() => generateNarrative('programa')}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Sparkles size={15} /> Generar Informe IA
                </button>
              </div>

              {programReportData ? (
                <>
                  <p className="text-sm text-slate-700"><span className="font-bold">Programa:</span> {programReportData.program}</p>
                  <p className="text-sm text-slate-700"><span className="font-bold">Promedio:</span> {programReportData.averageScore.toFixed(2)} / 5</p>
                  <p className="text-sm text-slate-700 mb-4"><span className="font-bold">Sitios vinculados:</span> {programReportData.centers.length}</p>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={programCenterLineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="center" hide />
                        <YAxis domain={[0, 5]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="average" name="Promedio por sitio" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">No hay datos del programa para el filtro actual.</p>
              )}
            </div>

            <NarrativeCard
              loading={narrativeState.programa.loading}
              error={narrativeState.programa.error}
              content={narrativeState.programa.content}
              modelLabel={reportModel}
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <p className="text-sm font-black text-slate-900">Cuadro del Programa por Sitio de Practica</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-widest font-black">
                  <tr>
                    <th className="px-6 py-3">Sitio de practica</th>
                    <th className="px-6 py-3 text-right">Evaluaciones</th>
                    <th className="px-6 py-3 text-right">Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {programReportData?.centers?.length ? (
                    programReportData.centers.map((site) => (
                      <tr key={site.center}>
                        <td className="px-6 py-3">{site.center}</td>
                        <td className="px-6 py-3 text-right">{site.evaluations}</td>
                        <td className="px-6 py-3 text-right font-semibold">{site.average.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-6 py-4 text-slate-500" colSpan={3}>Sin datos para mostrar.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {activeReport === 'comparado' ? (
        <section className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-slate-900">Informe Comparado de Sitios</h2>
                <button
                  type="button"
                  onClick={() => generateNarrative('comparado')}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Sparkles size={15} /> Generar Informe IA
                </button>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="center" hide />
                    <YAxis domain={[0, 5]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="averageScore" name="Promedio" radius={[8, 8, 0, 0]}>
                      {comparisonChartData.map((entry) => (
                        <Cell key={entry.center} fill={entry.risk ? '#f59e0b' : '#2563eb'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <NarrativeCard
              loading={narrativeState.comparado.loading}
              error={narrativeState.comparado.error}
              content={narrativeState.comparado.content}
              modelLabel={reportModel}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-emerald-600" />
                <p className="text-sm font-black text-slate-900">Top Sitios de Practica</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-widest text-slate-500 font-black">
                    <tr>
                      <th className="py-2">Centro</th>
                      <th className="py-2 text-right">Evals</th>
                      <th className="py-2 text-right">Promedio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topCentersComparison.slice(0, 8).map((center) => (
                      <tr key={center.center}>
                        <td className="py-2">{center.center}</td>
                        <td className="py-2 text-right">{center.evaluations}</td>
                        <td className="py-2 text-right font-semibold">{center.averageScore.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-amber-700" />
                <p className="text-sm font-black text-amber-800">Sitios a Intervenir</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-widest text-amber-700 font-black">
                    <tr>
                      <th className="py-2">Centro</th>
                      <th className="py-2 text-right">Evals</th>
                      <th className="py-2 text-right">Promedio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-200">
                    {bottomCentersComparison.length ? (
                      bottomCentersComparison.map((center) => (
                        <tr key={center.center}>
                          <td className="py-2">{center.center}</td>
                          <td className="py-2 text-right">{center.evaluations}</td>
                          <td className="py-2 text-right font-semibold">{center.averageScore.toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-2 text-amber-700" colSpan={3}>No se detectan centros criticos para el filtro actual.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <footer className="rounded-3xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <FileText size={14} />
          <p>
            Para informes de mas de 3 paginas, usa "Generar Informe IA" en cada tipo y luego "Imprimir / PDF" para obtener documento institucional.
          </p>
        </div>
      </footer>
    </div>
  );
}
