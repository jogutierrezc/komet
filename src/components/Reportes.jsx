import { useEffect, useMemo, useState } from 'react';
import { FileText, Download, Printer, Eye, Code2, Sparkles, MapPin, Users, GraduationCap, Building2 } from 'lucide-react';
import { getEvaluationReportMetrics, getSystemSettings, runOpenRouterPrompt } from '../lib/data';
import { generarInformeDesdeRows } from '../lib/informe/informeEngine';

const LOCAL_REPORT_KEY = 'komet_informe_html_v1';

function average(values = []) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function normalizeText(value) {
  return String(value || '').trim();
}

function resolveProgram(row = {}) {
  return normalizeText(
    row.program ||
      row.rawAnswers?._publicRespondent?.program ||
      row.rawAnswers?.program ||
      row.rawAnswers?.programa ||
      'Sin programa'
  );
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildCenterSummary(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const key = normalizeText(row.center || 'Sin sitio');
    const current =
      map.get(key) || {
        center: key,
        campus: normalizeText(row.campus || 'Sin campus'),
        total: 0,
        completed: 0,
        scores: [],
        programs: new Map(),
        roles: new Map()
      };

    const score = row.scoreSummary?.globalScore;
    current.total += 1;
    if (row.status === 'Completada') current.completed += 1;
    if (typeof score === 'number') current.scores.push(score);

    const program = resolveProgram(row);
    const role = normalizeText(row.role || 'Sin rol');

    current.programs.set(program, (current.programs.get(program) || 0) + 1);
    current.roles.set(role, (current.roles.get(role) || 0) + 1);

    map.set(key, current);
  });

  return [...map.values()]
    .map((item) => ({
      center: item.center,
      campus: item.campus,
      total: item.total,
      completionRate: item.total ? Number(((item.completed / item.total) * 100).toFixed(1)) : 0,
      avgScore: average(item.scores),
      programs: [...item.programs.entries()].map(([name, count]) => ({ name, count })),
      roles: [...item.roles.entries()].map(([name, count]) => ({ name, count }))
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function buildProgramSummary(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const key = resolveProgram(row);
    const current =
      map.get(key) || {
        program: key,
        total: 0,
        scores: [],
        centers: new Map(),
        roles: new Map()
      };

    const score = row.scoreSummary?.globalScore;
    current.total += 1;
    if (typeof score === 'number') current.scores.push(score);

    const center = normalizeText(row.center || 'Sin sitio');
    const role = normalizeText(row.role || 'Sin rol');

    current.centers.set(center, (current.centers.get(center) || 0) + 1);
    current.roles.set(role, (current.roles.get(role) || 0) + 1);

    map.set(key, current);
  });

  return [...map.values()]
    .map((item) => ({
      program: item.program,
      total: item.total,
      avgScore: average(item.scores),
      centers: [...item.centers.entries()].map(([name, count]) => ({ name, count })),
      roles: [...item.roles.entries()].map(([name, count]) => ({ name, count }))
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function buildImprovementSummary(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    (row.scoreSummary?.sectionScores || []).forEach((section) => {
      if (typeof section.score === 'number' && section.score < 3.7) {
        const key = normalizeText(section.title || 'Aspecto no identificado');
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
  });

  return [...map.entries()]
    .map(([aspect, mentions]) => ({ aspect, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);
}

function buildBarRow(label, value, max = 5) {
  const pct = Math.max(0, Math.min(100, (Number(value || 0) / max) * 100));
  return `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td style="width:50%">
        <div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
      </td>
      <td class="num">${Number(value || 0).toFixed(2)}</td>
    </tr>
  `;
}

function scoreToText(value) {
  if (typeof value !== 'number') return 'N/D';
  return value.toFixed(2);
}

function parseNarrativeJson(rawText = '') {
  try {
    const parsed = JSON.parse(rawText);
    return {
      summary: parsed.summary || '',
      methodology: parsed.methodology || '',
      quantitative: parsed.quantitative || '',
      qualitative: parsed.qualitative || '',
      actionPlan: parsed.actionPlan || '',
      conclusion: parsed.conclusion || ''
    };
  } catch {
    return {
      summary: rawText,
      methodology: '',
      quantitative: '',
      qualitative: '',
      actionPlan: '',
      conclusion: ''
    };
  }
}

function composeReportHtml({
  campus,
  role,
  program,
  center,
  generatedAt,
  globalScore,
  completionRate,
  totalRows,
  centerSummary,
  programSummary,
  improvements,
  narrative,
  informeOutput
}) {
  const metricasGlobales = informeOutput?.metricasGlobales || {};
  const resumenPorCampus = informeOutput?.resumenPorCampus || [];
  const resumenPorEscenario = informeOutput?.resumenPorEscenario || [];
  const resumenPorPrograma = informeOutput?.resumenPorPrograma || [];
  const preguntasCriticas = informeOutput?.preguntasCriticas || [];
  const planesAccion = informeOutput?.planesAccion || [];

  const topCenters = centerSummary.slice(0, 10);
  const topPrograms = programSummary.slice(0, 10);

  const centerRowsHtml = topCenters
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.center)}</td>
        <td>${escapeHtml(row.campus)}</td>
        <td class="num">${row.total}</td>
        <td class="num">${row.completionRate.toFixed(1)}%</td>
        <td class="num">${row.avgScore.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  const programRowsHtml = topPrograms
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.program)}</td>
        <td class="num">${row.total}</td>
        <td class="num">${row.avgScore.toFixed(2)}</td>
        <td>${escapeHtml(row.centers.map((c) => `${c.name} (${c.count})`).join(', ') || '-')}</td>
      </tr>
    `
    )
    .join('');

  const improvementRowsHtml = improvements
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.aspect)}</td>
        <td class="num">${row.mentions}</td>
      </tr>
    `
    )
    .join('');

  const centerChartRowsHtml = topCenters.map((row) => buildBarRow(row.center, row.avgScore)).join('');
  const programChartRowsHtml = topPrograms.map((row) => buildBarRow(row.program, row.avgScore)).join('');

  const sectionRowsHtml = (metricasGlobales.promediosPorSeccion || [])
    .map(
      (section) => `
      <tr>
        <td>${escapeHtml(section.seccion)}</td>
        <td class="num">${scoreToText(section.promedio)}</td>
        <td class="num">${section.totalRespuestas || 0}</td>
        <td>${escapeHtml(section.interpretacion || '')}</td>
      </tr>
    `
    )
    .join('');

  const campusRowsHtml = resumenPorCampus
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.campus)}</td>
        <td class="num">${item.totalEvaluaciones}</td>
        <td class="num">${item.totalEscenarios}</td>
        <td class="num">${item.totalProgramas}</td>
        <td class="num">${scoreToText(item.promedioGlobal)}</td>
        <td>${escapeHtml(item.escenarioDestacado || 'N/D')}</td>
        <td>${escapeHtml(item.escenarioCritico || 'N/D')}</td>
      </tr>
    `
    )
    .join('');

  const escenarioRowsHtml = resumenPorEscenario
    .slice(0, 15)
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.campus)}</td>
        <td>${escapeHtml(item.escenario)}</td>
        <td class="num">${item.totalEvaluaciones}</td>
        <td class="num">${scoreToText(item.promedioGlobal)}</td>
        <td>${escapeHtml(item.calificacionCualitativa)}</td>
      </tr>
    `
    )
    .join('');

  const programaRowsHtmlEngine = resumenPorPrograma
    .slice(0, 15)
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.programa)}</td>
        <td>${escapeHtml(item.tipoPrograma)}</td>
        <td>${escapeHtml((item.campus || []).join(', ') || 'N/D')}</td>
        <td class="num">${item.totalEvaluaciones}</td>
        <td class="num">${scoreToText(item.promedioGlobal)}</td>
      </tr>
    `
    )
    .join('');

  const criticasRowsHtml = preguntasCriticas
    .slice(0, 12)
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.preguntaId)}</td>
        <td>${escapeHtml(item.seccion)}</td>
        <td>${escapeHtml(item.texto)}</td>
        <td class="num">${scoreToText(item.promedio)}</td>
        <td>${escapeHtml((item.escenarios || []).join(', ') || 'N/D')}</td>
      </tr>
    `
    )
    .join('');

  const planesRowsHtml = planesAccion
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.seccion)}</td>
        <td>${escapeHtml(item.problema)}</td>
        <td>${escapeHtml(item.accionPropuesta)}</td>
        <td>${escapeHtml(item.responsable)}</td>
        <td>${escapeHtml(item.plazo)}</td>
        <td>${escapeHtml(item.indicador)}</td>
      </tr>
    `
    )
    .join('');

  const fortalezasHtml = (informeOutput?.fortalezasIdentificadas || [])
    .slice(0, 8)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  const oportunidadesHtml = (informeOutput?.oportunidadesMejora || [])
    .slice(0, 10)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  const recomendacionesHtml = (informeOutput?.recomendaciones || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Informe IA - Komet</title>
  <style>
    @page { size: letter; margin: 16mm; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; background: #fff; }
    .doc { max-width: 900px; margin: 0 auto; }
    .meta { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; margin: 14px 0 20px; font-size: 12px; }
    .meta div { border: 1px solid #e2e8f0; padding: 8px 10px; border-radius: 8px; }
    h1 { font-size: 34px; margin: 6px 0 8px; font-family: 'Segoe UI', Tahoma, sans-serif; }
    h2 { margin-top: 26px; font-size: 18px; font-family: 'Segoe UI', Tahoma, sans-serif; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    h3 { margin-top: 18px; font-size: 14px; font-family: 'Segoe UI', Tahoma, sans-serif; }
    p { line-height: 1.65; text-align: justify; }
    ul { margin: 10px 0 18px; padding-left: 20px; }
    li { margin-bottom: 6px; line-height: 1.5; }
    .kpis { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; margin: 12px 0 14px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
    .kpi .label { font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; letter-spacing: 0.06em; }
    .kpi .value { font-size: 28px; font-weight: 800; margin-top: 3px; font-family: 'Segoe UI', Tahoma, sans-serif; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; vertical-align: top; }
    th { background: #f8fafc; text-align: left; font-family: 'Segoe UI', Tahoma, sans-serif; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .chart-block { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; margin: 8px 0 18px; }
    .bar-track { width: 100%; background: #e2e8f0; border-radius: 999px; height: 12px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg,#2563eb,#14b8a6); }
    .page-break { page-break-before: always; }
    .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #64748b; }
    @media print { .no-print { display:none !important; } }
  </style>
</head>
<body>
  <div class="doc">
    <p style="font-size:11px; text-transform:uppercase; letter-spacing:0.25em; color:#2563eb; font-family:'Segoe UI',Tahoma,sans-serif; font-weight:800;">Modulo Informe Komet</p>
    <h1>Informe de Analitica Docencia-Servicio</h1>
    <p>Documento generado automaticamente con analisis cuantitativo, tablas y visualizaciones por centro de practica, programa y rol de evaluador.</p>

    <div class="meta">
      <div><strong>Campus:</strong> ${escapeHtml(campus)}</div>
      <div><strong>Rol evaluador:</strong> ${escapeHtml(role)}</div>
      <div><strong>Programa:</strong> ${escapeHtml(program)}</div>
      <div><strong>Centro:</strong> ${escapeHtml(center)}</div>
      <div><strong>Fecha de generacion:</strong> ${escapeHtml(generatedAt)}</div>
      <div><strong>Total de evaluaciones:</strong> ${totalRows}</div>
      <div><strong>Periodo consolidado:</strong> ${escapeHtml(informeOutput?.periodo || 'No definido')}</div>
      <div><strong>Campus en corte:</strong> ${escapeHtml((metricasGlobales.campuses || []).join(', ') || 'No definido')}</div>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="label">Puntaje Global</div><div class="value">${globalScore.toFixed(2)}</div></div>
      <div class="kpi"><div class="label">Cumplimiento</div><div class="value">${completionRate.toFixed(1)}%</div></div>
      <div class="kpi"><div class="label">Aspectos de Mejora</div><div class="value">${improvements.length}</div></div>
    </div>

    <h2>1. Resumen Ejecutivo</h2>
    <p>${escapeHtml(narrative.summary || 'El analisis muestra tendencias consistentes de desempeno entre centros de practica y programas, con oportunidades de mejora focalizadas en componentes de seguimiento y bienestar.')}</p>
    <p>${escapeHtml(informeOutput?.analisisGeneral || '')}</p>

    <h2>2. Metodologia y Alcance</h2>
    <p>${escapeHtml(narrative.methodology || 'Se consolidaron evaluaciones completadas, filtradas por campus, rol, programa y centro. Se calcularon promedios globales y distribuciones por subgrupos para identificar brechas y prioridades de intervencion.')}</p>

    <h3>2.1 Metricas globales del instrumento</h3>
    <table>
      <thead>
        <tr><th>Seccion</th><th>Promedio</th><th>Respuestas</th><th>Interpretacion</th></tr>
      </thead>
      <tbody>
        ${sectionRowsHtml || '<tr><td colspan="4">Sin datos de secciones para el filtro seleccionado.</td></tr>'}
      </tbody>
    </table>

    <h2>3. Analisis Cuantitativo por Centro</h2>
    <table>
      <thead>
        <tr><th>Centro de practica</th><th>Campus</th><th>Evaluaciones</th><th>Cumplimiento</th><th>Promedio</th></tr>
      </thead>
      <tbody>
        ${centerRowsHtml || '<tr><td colspan="5">Sin datos para el filtro seleccionado.</td></tr>'}
      </tbody>
    </table>

    <div class="chart-block">
      <h3 style="font-family:'Segoe UI',Tahoma,sans-serif; font-size:14px; margin:4px 0 10px;">Grafico de promedios por centro</h3>
      <table>
        <thead><tr><th>Centro</th><th>Barra de desempeno</th><th>Promedio</th></tr></thead>
        <tbody>${centerChartRowsHtml || ''}</tbody>
      </table>
    </div>

    <h2>4. Analisis por Campus</h2>
    <table>
      <thead>
        <tr><th>Campus</th><th>Evaluaciones</th><th>Escenarios</th><th>Programas</th><th>Promedio</th><th>Escenario destacado</th><th>Escenario critico</th></tr>
      </thead>
      <tbody>
        ${campusRowsHtml || '<tr><td colspan="7">Sin datos por campus para el filtro seleccionado.</td></tr>'}
      </tbody>
    </table>

    <div class="page-break"></div>

    <h2>5. Analisis por Programa Academico</h2>
    <table>
      <thead>
        <tr><th>Programa</th><th>Evaluaciones</th><th>Promedio</th><th>Sitios vinculados</th></tr>
      </thead>
      <tbody>
        ${programRowsHtml || '<tr><td colspan="4">Sin datos para el filtro seleccionado.</td></tr>'}
      </tbody>
    </table>

    <div class="chart-block">
      <h3 style="font-family:'Segoe UI',Tahoma,sans-serif; font-size:14px; margin:4px 0 10px;">Grafico de promedios por programa</h3>
      <table>
        <thead><tr><th>Programa</th><th>Barra de desempeno</th><th>Promedio</th></tr></thead>
        <tbody>${programChartRowsHtml || ''}</tbody>
      </table>
    </div>

    <h3>5.1 Resumen estructurado por programa</h3>
    <table>
      <thead><tr><th>Programa</th><th>Tipo</th><th>Campus</th><th>Evaluaciones</th><th>Promedio</th></tr></thead>
      <tbody>${programaRowsHtmlEngine || '<tr><td colspan="5">Sin resumen por programa.</td></tr>'}</tbody>
    </table>

    <h2>6. Analisis por Escenario</h2>
    <table>
      <thead><tr><th>Campus</th><th>Escenario</th><th>Evaluaciones</th><th>Promedio</th><th>Interpretacion</th></tr></thead>
      <tbody>${escenarioRowsHtml || '<tr><td colspan="5">Sin datos por escenario.</td></tr>'}</tbody>
    </table>

    <h2>7. Preguntas Criticas del Instrumento</h2>
    <table>
      <thead><tr><th>ID</th><th>Seccion</th><th>Pregunta</th><th>Promedio</th><th>Escenarios</th></tr></thead>
      <tbody>${criticasRowsHtml || '<tr><td colspan="5">No se detectaron preguntas criticas por debajo del umbral.</td></tr>'}</tbody>
    </table>

    <h2>8. Aspectos de Mejora Priorizados</h2>
    <table>
      <thead><tr><th>Aspecto</th><th>Menciones</th></tr></thead>
      <tbody>${improvementRowsHtml || '<tr><td colspan="2">No se detectaron aspectos por debajo del umbral configurado.</td></tr>'}</tbody>
    </table>

    <h2>9. Interpretacion Cualitativa</h2>
    <p>${escapeHtml(narrative.quantitative || '')}</p>
    <p>${escapeHtml(narrative.qualitative || 'Las observaciones sugieren priorizar acciones de mejora en trazabilidad de compromisos, retroalimentacion por rol y estandarizacion operativa entre escenarios de practica.')}</p>

    <h3>9.1 Fortalezas identificadas</h3>
    <ul>${fortalezasHtml || '<li>No se reportaron fortalezas textuales en este corte.</li>'}</ul>

    <h3>9.2 Oportunidades de mejora</h3>
    <ul>${oportunidadesHtml || '<li>No se reportaron oportunidades de mejora textuales en este corte.</li>'}</ul>

    <h2>10. Plan 30-60-90 Dias</h2>
    <p>${escapeHtml(narrative.actionPlan || '30 dias: validacion de brechas por centro y programa. 60 dias: implementacion de acciones formativas y ajustes operativos. 90 dias: evaluacion de impacto y cierre del ciclo con nuevo corte de medicion.')}</p>

    <h3>10.1 Plan de accion sugerido</h3>
    <table>
      <thead><tr><th>Seccion</th><th>Problema</th><th>Accion</th><th>Responsable</th><th>Plazo</th><th>Indicador</th></tr></thead>
      <tbody>${planesRowsHtml || '<tr><td colspan="6">No se generaron planes de accion para este corte.</td></tr>'}</tbody>
    </table>

    <h3>10.2 Recomendaciones</h3>
    <ul>${recomendacionesHtml || '<li>Sin recomendaciones para el filtro seleccionado.</li>'}</ul>

    <h2>11. Conclusiones</h2>
    <p>${escapeHtml(narrative.conclusion || 'El informe confirma que la combinacion de analitica estructurada y lectura cualitativa permite orientar decisiones de calidad con mayor precision y seguimiento institucional.')}</p>
    <p>${escapeHtml(informeOutput?.conclusiones || '')}</p>

    <div class="footer">Komet | Informe HTML local para visualizacion e impresion en tamano carta.</div>
  </div>
</body>
</html>`;
}

export default function Reportes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedCampus, setSelectedCampus] = useState('Todos');
  const [selectedRole, setSelectedRole] = useState('Todos');
  const [selectedProgram, setSelectedProgram] = useState('Todos');
  const [selectedCenter, setSelectedCenter] = useState('Todos');
  const [reportHtml, setReportHtml] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError('');

      try {
        const [metrics, config] = await Promise.all([getEvaluationReportMetrics({}), getSystemSettings()]);
        if (!cancelled) {
          setRows(metrics?.rows || []);
          setSettings(config || null);
          const cached = localStorage.getItem(LOCAL_REPORT_KEY);
          if (cached) {
            setReportHtml(cached);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'No se pudo cargar el modulo Informe.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const campusOptions = useMemo(() => [...new Set(rows.map((row) => normalizeText(row.campus || 'Sin campus')))].sort(), [rows]);
  const roleOptions = useMemo(() => [...new Set(rows.map((row) => normalizeText(row.role || 'Sin rol')))].sort(), [rows]);

  const campusRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedCampus !== 'Todos' && normalizeText(row.campus) !== selectedCampus) return false;
      return true;
    });
  }, [rows, selectedCampus]);

  const roleRows = useMemo(() => {
    return campusRows.filter((row) => {
      if (selectedRole !== 'Todos' && normalizeText(row.role) !== selectedRole) return false;
      return true;
    });
  }, [campusRows, selectedRole]);

  const programOptions = useMemo(() => {
    const options = [...new Set(campusRows.map((row) => resolveProgram(row)))].sort();
    return options.sort((a, b) => {
      if (a === 'Sin programa') return 1;
      if (b === 'Sin programa') return -1;
      return a.localeCompare(b);
    });
  }, [campusRows]);

  const centerOptions = useMemo(() => {
    const scopedByProgram = roleRows.filter((row) => selectedProgram === 'Todos' || resolveProgram(row) === selectedProgram);
    return [...new Set(scopedByProgram.map((row) => normalizeText(row.center || 'Sin sitio')))].sort();
  }, [roleRows, selectedProgram]);

  useEffect(() => {
    if (selectedProgram !== 'Todos' && !programOptions.includes(selectedProgram)) {
      setSelectedProgram('Todos');
    }
  }, [programOptions, selectedProgram]);

  useEffect(() => {
    if (selectedCenter !== 'Todos' && !centerOptions.includes(selectedCenter)) {
      setSelectedCenter('Todos');
    }
  }, [centerOptions, selectedCenter]);

  const filteredRows = useMemo(() => {
    return roleRows.filter((row) => {
      if (selectedProgram !== 'Todos' && resolveProgram(row) !== selectedProgram) return false;
      if (selectedCenter !== 'Todos' && normalizeText(row.center || 'Sin sitio') !== selectedCenter) return false;
      return true;
    });
  }, [roleRows, selectedProgram, selectedCenter]);

  const globalScore = useMemo(() => {
    const scores = filteredRows.map((row) => row.scoreSummary?.globalScore).filter((value) => typeof value === 'number');
    return average(scores);
  }, [filteredRows]);

  const completionRate = useMemo(() => {
    if (!filteredRows.length) return 0;
    const completed = filteredRows.filter((row) => row.status === 'Completada').length;
    return Number(((completed / filteredRows.length) * 100).toFixed(1));
  }, [filteredRows]);

  async function generateHtmlReport() {
    if (!filteredRows.length) {
      setAiError('No hay datos disponibles para generar el informe con el filtro actual.');
      return;
    }

    setAiError('');
    setIsGenerating(true);

    const centerSummary = buildCenterSummary(filteredRows);
    const programSummary = buildProgramSummary(filteredRows);
    const improvements = buildImprovementSummary(filteredRows);
    const informeOutput = generarInformeDesdeRows(filteredRows, {
      filtros: {
        campus: selectedCampus === 'Todos' ? undefined : [selectedCampus],
        programas: selectedProgram === 'Todos' ? undefined : [selectedProgram],
        escenarios: selectedCenter === 'Todos' ? undefined : [selectedCenter],
        actores: selectedRole === 'Todos' ? undefined : [selectedRole]
      },
      configuracion: {
        incluirRecomendaciones: true,
        incluirPlanesMejora: true,
        nivelDetalle: 'completo'
      }
    });

    const compactDataset = {
      filters: {
        campus: selectedCampus,
        role: selectedRole,
        program: selectedProgram,
        center: selectedCenter
      },
      totals: {
        evaluations: filteredRows.length,
        globalScore,
        completionRate
      },
      centers: centerSummary.slice(0, 15),
      programs: programSummary.slice(0, 15),
      improvements,
      secciones: (informeOutput.metricasGlobales?.promediosPorSeccion || []).map((sec) => ({
        seccion: sec.seccion,
        promedio: sec.promedio,
        respuestas: sec.totalRespuestas,
        interpretacion: sec.interpretacion
      })),
      resumenCampus: (informeOutput.resumenPorCampus || []).slice(0, 6),
      preguntasCriticas: (informeOutput.preguntasCriticas || []).slice(0, 8),
      recomendaciones: informeOutput.recomendaciones || []
    };

    let narrative = {
      summary: '',
      methodology: '',
      quantitative: '',
      qualitative: '',
      actionPlan: '',
      conclusion: ''
    };

    try {
      const prompt = `
Genera contenido ejecutivo para un informe institucional en espanol.
Devuelve exclusivamente JSON valido, sin markdown y sin explicaciones adicionales.
Estructura requerida del JSON:
{
  "summary": "...",
  "methodology": "...",
  "quantitative": "...",
  "qualitative": "...",
  "actionPlan": "...",
  "conclusion": "..."
}
Requisitos:
- Estilo limpio, profesional y organizado.
- Sin usar formato con dobles asteriscos.
- Tono narrativo tecnico para minimo 3 paginas al imprimirse en carta junto a tablas y graficos.
- No inventes datos fuera del dataset.
- Incluye lectura de secciones del instrumento y analisis de riesgos por preguntas criticas.

Dataset:
${JSON.stringify(compactDataset)}
      `.trim();

      const rawNarrative = await runOpenRouterPrompt({
        apiKey: settings?.openrouter_api_key,
        model: settings?.openrouter_model,
        systemPrompt:
          (settings?.openrouter_system_prompt || 'Eres analista institucional experto en docencia-servicio.') +
          ' Debes entregar narrativa profesional para informes tecnicos.',
        temperature: Number(settings?.openrouter_temperature ?? 0.6),
        prompt
      });

      narrative = parseNarrativeJson(rawNarrative || '');
    } catch (err) {
      setAiError(err?.message || 'No se pudo generar narrativa IA; se usara plantilla base.');
    }

    const generatedAt = new Date().toLocaleString('es-CO');
    const html = composeReportHtml({
      campus: selectedCampus,
      role: selectedRole,
      program: selectedProgram,
      center: selectedCenter,
      generatedAt,
      globalScore,
      completionRate,
      totalRows: filteredRows.length,
      centerSummary,
      programSummary,
      improvements,
      narrative,
      informeOutput
    });

    localStorage.setItem(LOCAL_REPORT_KEY, html);
    setReportHtml(html);
    setIsGenerating(false);
  }

  function downloadHtml() {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `informe-komet-${Date.now()}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    if (!reportHtml) return;
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!popup) return;
    popup.document.open();
    popup.document.write(reportHtml);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 350);
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500">Cargando modulo Informe...</div>;
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">Modulo Informe</p>
            <h1 className="mt-2 text-4xl font-black text-slate-900">Analitica Avanzada de Sitios de Practica por Campus</h1>
            <p className="mt-2 text-slate-500">Genera informe HTML local con tablas, graficos y narrativa para previsualizar e imprimir en tamano carta.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateHtmlReport}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Sparkles size={15} /> {isGenerating ? 'Generando...' : 'Generar Informe'}
            </button>
            <button type="button" onClick={downloadHtml} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Download size={15} /> Guardar HTML
            </button>
            <button type="button" onClick={printReport} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Printer size={15} /> Imprimir Carta
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <MapPin size={16} className="text-slate-400" />
            <select className="w-full bg-transparent outline-none" value={selectedCampus} onChange={(event) => setSelectedCampus(event.target.value)}>
              <option value="Todos">Todos los campus</option>
              {campusOptions.map((campus) => (
                <option key={campus} value={campus}>{campus}</option>
              ))}
            </select>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <select className="w-full bg-transparent outline-none" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
              <option value="Todos">Todos los roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <GraduationCap size={16} className="text-slate-400" />
            <select className="w-full bg-transparent outline-none" value={selectedProgram} onChange={(event) => setSelectedProgram(event.target.value)}>
              <option value="Todos">Todos los programas</option>
              {programOptions.map((program) => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <select className="w-full bg-transparent outline-none" value={selectedCenter} onChange={(event) => setSelectedCenter(event.target.value)}>
              <option value="Todos">Todos los centros</option>
              {centerOptions.map((center) => (
                <option key={center} value={center}>{center}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.15em] font-black text-slate-500">Puntaje Global</p>
          <p className="mt-2 text-4xl font-black text-slate-900">{globalScore.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.15em] font-black text-slate-500">Cumplimiento</p>
          <p className="mt-2 text-4xl font-black text-slate-900">{completionRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.15em] font-black text-slate-500">Registros</p>
          <p className="mt-2 text-4xl font-black text-slate-900">{filteredRows.length}</p>
        </div>
      </section>

      {aiError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{aiError}</div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-black text-slate-900 inline-flex items-center gap-2"><Eye size={15} /> Previsualizador HTML</p>
          <button type="button" onClick={() => setShowCode((prev) => !prev)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <Code2 size={14} /> {showCode ? 'Ocultar codigo' : 'Ver codigo'}
          </button>
        </div>

        {reportHtml ? (
          <iframe title="Informe HTML" srcDoc={reportHtml} className="w-full min-h-[900px] rounded-2xl border border-slate-200 bg-white" />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-slate-500 text-center">
            Genera el informe para guardar la plantilla HTML local y visualizarla aqui.
          </div>
        )}

        {showCode && reportHtml ? (
          <pre className="mt-4 max-h-[360px] overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100 whitespace-pre-wrap">{reportHtml}</pre>
        ) : null}
      </section>

      <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 inline-flex items-center gap-2">
        <FileText size={14} />
        Plantilla guardada en almacenamiento local con clave {LOCAL_REPORT_KEY}.
      </footer>
    </div>
  );
}
