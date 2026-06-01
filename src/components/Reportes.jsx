import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Download, Printer, Eye, Code2, Sparkles, MapPin, Users, GraduationCap, Building2 } from 'lucide-react';
import { getEvaluationReportMetrics, getSystemSettings, runOpenRouterPrompt, getProgramsByCampus } from '../lib/data';
import { NIVELES_COMPLEJIDAD } from '../lib/informe/algoritmo0273';
import { generarInformeDesdeRows } from '../lib/informe/informeEngine';

const LOCAL_REPORT_KEY = 'komet_informe_html_v1';

function average(values = []) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function normalizeText(value) {
  return String(value || '').trim();
}

const LEVEL_WORDS = new Set(['pregrado', 'posgrado', 'postgrado']);

function resolveProgram(row = {}) {
  // Para evaluaciones públicas, el programa real está en el JSONB del respondente
  const fromJsonb = normalizeText(
    row.rawAnswers?._publicRespondent?.program ||
    row.rawAnswers?.program ||
    row.rawAnswers?.programa ||
    ''
  );
  if (fromJsonb && !LEVEL_WORDS.has(fromJsonb.toLowerCase())) return fromJsonb;

  // Para evaluaciones internas (tutores/estudiantes vinculados), usar row.program
  // pero ignorarlo si contiene un valor de nivel en lugar de nombre de programa
  const fromRow = normalizeText(row.program || '');
  if (fromRow && !LEVEL_WORDS.has(fromRow.toLowerCase())) return fromRow;

  return 'Sin programa';
}

function resolveLevel(row = {}) {
  const raw = String(
    row.rawAnswers?._publicRespondent?.program_level ||
    row.rawAnswers?.program_level ||
    ''
  ).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (raw.startsWith('pre')) return 'pregrado';
  if (raw.startsWith('pos')) return 'posgrado';
  return '';
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extrae el puntaje global de una evaluación usando múltiples niveles de fallback:
 * 1. scoreSummary.globalScore (ya calculado por calculateSurveyScoreSummary)
 * 2. Extracción directa desde rawAnswers (valores numéricos 1-5)
 * 3. scoreSummary.sectionScores promediado
 */
function extractGlobalScore(row) {
  // Nivel 1: scoreSummary ya calculado
  if (typeof row.scoreSummary?.globalScore === 'number') {
    return row.scoreSummary.globalScore;
  }

  // Nivel 2: promediar sectionScores si existen
  if (Array.isArray(row.scoreSummary?.sectionScores) && row.scoreSummary.sectionScores.length > 0) {
    const valid = row.scoreSummary.sectionScores.filter(s => typeof s.score === 'number').map(s => s.score);
    if (valid.length > 0) {
      return valid.reduce((sum, v) => sum + v, 0) / valid.length;
    }
  }

  // Nivel 3: extraer valores numéricos 1-5 directamente de rawAnswers
  const raw = row.rawAnswers || {};
  const numericValues = Object.entries(raw)
    .filter(([key]) => !key.startsWith('_'))
    .map(([, val]) => {
      if (typeof val === 'number' && val >= 1 && val <= 5) return val;
      if (typeof val === 'string') {
        const n = Number(val.trim());
        return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
      }
      return null;
    })
    .filter(v => v !== null);

  if (numericValues.length > 0) {
    return numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
  }

  return null;
}

/**
 * Extrae los puntajes por sección de una evaluación con múltiples niveles de fallback.
 */
function extractSectionScores(row) {
  // Nivel 1: scoreSummary.sectionScores
  if (Array.isArray(row.scoreSummary?.sectionScores) && row.scoreSummary.sectionScores.length > 0) {
    return row.scoreSummary.sectionScores;
  }

  // Nivel 2: extraer secciones desde rawAnswers agrupando por prefijo de clave
  const raw = row.rawAnswers || {};
  const rawSections = new Map();

  Object.entries(raw)
    .filter(([key]) => !key.startsWith('_'))
    .forEach(([key, val]) => {
      let score = null;
      if (typeof val === 'number' && val >= 1 && val <= 5) score = val;
      else if (typeof val === 'string') {
        const n = Number(val.trim());
        if (Number.isFinite(n) && n >= 1 && n <= 5) score = n;
      }
      if (score === null) return;

      // Inferir sección desde la clave (AG, CI, SPB, OA, PF, CMC)
      const codeMatch = key.toUpperCase().match(/\b(AG|CI|SPB|OA|PF|CMC)\s*-?\s*(\d{1,2})\b/);
      const sectionName = codeMatch
        ? ({ AG: 'ASPECTOS GENERALES', CI: 'CAPACIDAD INSTALADA', SPB: 'SEGURIDAD, PROTECCION Y BIENESTAR',
             OA: 'ORGANIZACION ADMINISTRATIVA RELACION DOCENCIA - SERVICIO', PF: 'PRACTICAS FORMATIVAS',
             CMC: 'CULTURA DE MEJORAMIENTO CONTINUO' })[codeMatch[1]] || 'General'
        : 'General';

      if (!rawSections.has(sectionName)) rawSections.set(sectionName, []);
      rawSections.get(sectionName).push(score);
    });

  if (rawSections.size === 0) return [];

  return [...rawSections.entries()].map(([title, scores]) => ({
    sectionId: title.replace(/\s+/g, '_'),
    title,
    score: scores.reduce((s, v) => s + v, 0) / scores.length,
    questionCount: scores.length
  }));
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

    const score = extractGlobalScore(row);
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

    const score = extractGlobalScore(row);
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
    (extractSectionScores(row) || []).forEach((section) => {
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

function buildRoleSummary(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const role = normalizeText(row.role || 'Sin rol');
    const current =
      map.get(role) || {
        role,
        total: 0,
        completed: 0,
        scores: []
      };

    const score = extractGlobalScore(row);
    current.total += 1;
    if (row.status === 'Completada') current.completed += 1;
    if (typeof score === 'number') current.scores.push(score);
    map.set(role, current);
  });

  return [...map.values()]
    .map((item) => ({
      role: item.role,
      total: item.total,
      completionRate: item.total ? Number(((item.completed / item.total) * 100).toFixed(1)) : 0,
      avgScore: average(item.scores)
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function buildEvaluatedSummary(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const person = normalizeText(row.person || 'Evaluado sin nombre');
    const role = normalizeText(row.role || 'Sin rol');
    const key = `${person}||${role}`;
    const current =
      map.get(key) || {
        person,
        role,
        center: normalizeText(row.center || 'Sin sitio'),
        campus: normalizeText(row.campus || 'Sin campus'),
        total: 0,
        completed: 0,
        scores: []
      };

    const score = extractGlobalScore(row);
    current.total += 1;
    if (row.status === 'Completada') current.completed += 1;
    if (typeof score === 'number') current.scores.push(score);
    map.set(key, current);
  });

  return [...map.values()]
    .map((item) => ({
      person: item.person,
      role: item.role,
      center: item.center,
      campus: item.campus,
      total: item.total,
      completionRate: item.total ? Number(((item.completed / item.total) * 100).toFixed(1)) : 0,
      avgScore: average(item.scores)
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function buildComparacionCentrosHtml(comparacion = []) {
  if (!comparacion.length) return '<p>No hay datos suficientes para comparacion entre programas por centro.</p>';

  return comparacion
    .map(
      (item) => `
    <h4 style="margin-top:16px;">${escapeHtml(item.escenario)} (${escapeHtml(item.campus)}) — ${item.totalEvaluaciones} evaluaciones</h4>
    <table>
      <thead><tr><th>Programa</th><th>Evaluaciones</th><th>Promedio Global</th>${(item.programas[0]?.promediosPorSeccion || []).map((s) => `<th>${escapeHtml(s.seccion)}</th>`).join('')}</tr></thead>
      <tbody>
        ${item.programas
          .map(
            (prog) => `
          <tr>
            <td>${escapeHtml(prog.programa)}</td>
            <td class="num">${prog.totalEvaluaciones}</td>
            <td class="num">${scoreToText(prog.promedioGlobal)}</td>
            ${(prog.promediosPorSeccion || []).map((s) => `<td class="num">${scoreToText(s.promedio)}</td>`).join('')}
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `
    )
    .join('');
}

function buildPlanRows(plan = []) {
  return plan
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.objetivo || '')}</td>
        <td>${escapeHtml(item.accion || '')}</td>
        <td>${escapeHtml(item.responsable || '')}</td>
        <td>${escapeHtml(item.indicador || '')}</td>
      </tr>
    `
    )
    .join('');
}

function buildSectionDistributionSummary(metricasGlobales = {}) {
  return (metricasGlobales.promediosPorSeccion || []).map((section) => ({
    seccion: section.seccion,
    promedio: section.promedio,
    totalRespuestas: section.totalRespuestas || 0,
    distribucion: section.distribucion || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  }));
}

function buildRoleDistributionSummary(rows = []) {
  const roleMap = new Map();

  rows.forEach((row) => {
    const role = normalizeText(row.role || 'Sin rol');
    const bucket = roleMap.get(role) || { role, total: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };    (extractSectionScores(row) || []).forEach((section) => {
      const rounded = Math.round(Number(section.score || 0));
      if (rounded >= 1 && rounded <= 5) {
        bucket.counts[rounded] += 1;
        bucket.total += 1;
      }
    });
    roleMap.set(role, bucket);
  });

  return [...roleMap.values()].sort((a, b) => b.total - a.total);
}

function buildProgramDistributionSummary(rows = []) {
  const programMap = new Map();

  rows.forEach((row) => {
    const program = resolveProgram(row);
    const bucket = programMap.get(program) || { program, total: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

    (extractSectionScores(row) || []).forEach((section) => {
      const rounded = Math.round(Number(section.score || 0));
      if (rounded >= 1 && rounded <= 5) {
        bucket.counts[rounded] += 1;
        bucket.total += 1;
      }
    });

    programMap.set(program, bucket);
  });

  return [...programMap.values()].sort((a, b) => b.total - a.total).slice(0, 10);
}

function buildDistributionCells(counts = {}, total = 0) {
  return [1, 2, 3, 4, 5]
    .map((score) => {
      const count = counts?.[score] || 0;
      const pct = total ? ((count / total) * 100).toFixed(1) : '0.0';
      return `<td class="num">${count} <span style="color:#64748b; font-size:10px;">(${pct}%)</span></td>`;
    })
    .join('');
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

function getAlertLevel(score) {
  if (typeof score !== 'number') return { key: 'amarillo', label: 'Sin dato' };
  if (score >= 4.0) return { key: 'verde', label: 'Verde' };
  if (score >= 3.5) return { key: 'amarillo', label: 'Amarillo' };
  if (score >= 2.5) return { key: 'naranja', label: 'Naranja' };
  return { key: 'rojo', label: 'Rojo' };
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
  level,
  program,
  center,
  filteredRows,
  generatedAt,
  globalScore,
  completionRate,
  totalRows,
  centerSummary,
  programSummary,
  roleSummary,
  evaluatedSummary,
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
  const plan306090 = informeOutput?.plan306090 || { dias30: [], dias60: [], dias90: [] };
  const analisisNormativo = informeOutput?.analisisNormativo || null;
  const textosNormativos = informeOutput?.textosNormativos || {};

  const topCenters = centerSummary.slice(0, 10);
  const topPrograms = programSummary.slice(0, 10);
  const topRoles = roleSummary.slice(0, 10);
  const topEvaluados = evaluatedSummary.slice(0, 12);
  const sectionDistribution = buildSectionDistributionSummary(metricasGlobales);
  const roleDistribution = buildRoleDistributionSummary(filteredRows).slice(0, 10);
  const programDistribution = buildProgramDistributionSummary(filteredRows);

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

  const roleRowsHtml = topRoles
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.role)}</td>
        <td class="num">${row.total}</td>
        <td class="num">${row.completionRate.toFixed(1)}%</td>
        <td class="num">${row.avgScore.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  const evaluatedRowsHtml = topEvaluados
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.person)}</td>
        <td>${escapeHtml(row.role)}</td>
        <td>${escapeHtml(row.campus)}</td>
        <td>${escapeHtml(row.center)}</td>
        <td class="num">${row.total}</td>
        <td class="num">${row.completionRate.toFixed(1)}%</td>
        <td class="num">${row.avgScore.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  const centerChartRowsHtml = topCenters.map((row) => buildBarRow(row.center, row.avgScore)).join('');
  const programChartRowsHtml = topPrograms.map((row) => buildBarRow(row.program, row.avgScore)).join('');

  const sectionRowsHtml = (metricasGlobales.promediosPorSeccion || [])
    .map(
      (section) => {
        const alert = getAlertLevel(section.promedio);
        return `
      <tr>
        <td>${escapeHtml(section.seccion)}</td>
        <td class="num">${scoreToText(section.promedio)}</td>
        <td><span class="alert-badge alert-${alert.key}">${alert.label}</span></td>
        <td class="num">${section.totalRespuestas || 0}</td>
        <td>${escapeHtml(section.interpretacion || '')}</td>
      </tr>
    `;
      }
    )
    .join('');

  const sectionDistributionRowsHtml = sectionDistribution
    .map(
      (section) => `
      <tr>
        <td>${escapeHtml(section.seccion)}</td>
        <td class="num">${scoreToText(section.promedio)}</td>
        ${buildDistributionCells(section.distribucion, section.totalRespuestas)}
        <td class="num">${section.totalRespuestas}</td>
      </tr>
    `
    )
    .join('');

  const roleDistributionRowsHtml = roleDistribution
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.role)}</td>
        ${buildDistributionCells(item.counts, item.total)}
        <td class="num">${item.total}</td>
      </tr>
    `
    )
    .join('');

  const programDistributionRowsHtml = programDistribution
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.program)}</td>
        ${buildDistributionCells(item.counts, item.total)}
        <td class="num">${item.total}</td>
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

  const hallazgosNormativosHtml = (analisisNormativo?.hallazgos || [])
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.eje)}</td>
        <td>${escapeHtml(item.estado)}</td>
        <td>${escapeHtml(item.detalle)}</td>
      </tr>
    `
    )
    .join('');

  const centerBest = topCenters[0];
  const centerWorst = topCenters[topCenters.length - 1];
  const roleBest = topRoles[0];
  const roleWorst = topRoles[topRoles.length - 1];

  const comparativeNarrative = [
    centerBest && centerWorst
      ? `En el comparativo por centros, ${centerBest.center} presenta el mejor promedio (${scoreToText(centerBest.avgScore)}), mientras ${centerWorst.center} registra el menor (${scoreToText(centerWorst.avgScore)}), lo que sugiere una brecha operativa relevante entre escenarios.`
      : 'No se dispone de suficientes centros con puntuacion para calcular brechas comparativas.',
    roleBest && roleWorst
      ? `Por rol evaluador, el desempeno promedio es mayor en ${roleBest.role} (${scoreToText(roleBest.avgScore)}) y menor en ${roleWorst.role} (${scoreToText(roleWorst.avgScore)}), por lo que se recomienda focalizar acompanamiento segun actor.`
      : 'No se dispone de suficientes datos por rol para comparativos robustos.'
  ].join(' ');

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
    .alert-badge { display: inline-block; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; }
    .alert-verde { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .alert-amarillo { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
    .alert-naranja { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
    .alert-rojo { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
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
      <div><strong>Nivel de formacion:</strong> ${escapeHtml(level || 'Todos los niveles')}</div>
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
    <p>${escapeHtml(comparativeNarrative)}</p>

    <h2>2. Metodologia y Alcance</h2>
    <p>${escapeHtml(narrative.methodology || 'Se consolidaron evaluaciones completadas, filtradas por campus, rol, programa y centro. Se calcularon promedios globales y distribuciones por subgrupos para identificar brechas y prioridades de intervencion.')}</p>

    <h3>2.1 Metricas globales del instrumento</h3>
    <table>
      <thead>
        <tr><th>Seccion</th><th>Promedio</th><th>Semaforo</th><th>Respuestas</th><th>Interpretacion</th></tr>
      </thead>
      <tbody>
        ${sectionRowsHtml || '<tr><td colspan="5">Sin datos de secciones para el filtro seleccionado.</td></tr>'}
      </tbody>
    </table>

    <h3>2.2 Lectura normativa MEN 00273 de 2021</h3>
    <p>${escapeHtml(textosNormativos.INTRO_ALGORITMO || '')}</p>
    <p>${escapeHtml(analisisNormativo?.veredictoTecnico || '')}</p>
    <div class="kpis">
      <div class="kpi"><div class="label">Nivel de complejidad</div><div class="value">${escapeHtml(analisisNormativo?.nivelComplejidadEvaluado || 'ALTA')}</div></div>
      <div class="kpi"><div class="label">Cumplimiento normativo</div><div class="value">${typeof analisisNormativo?.porcentajeCumplimiento === 'number' ? `${analisisNormativo.porcentajeCumplimiento.toFixed(2)}%` : 'N/D'}</div></div>
      <div class="kpi"><div class="label">Hallazgos tecnicos</div><div class="value">${(analisisNormativo?.hallazgos || []).length}</div></div>
    </div>

    <table>
      <thead>
        <tr><th>Eje</th><th>Estado</th><th>Detalle tecnico</th></tr>
      </thead>
      <tbody>
        ${hallazgosNormativosHtml || '<tr><td colspan="3">No se detectaron brechas normativas con los parametros seleccionados.</td></tr>'}
      </tbody>
    </table>

    <p>${escapeHtml(textosNormativos.CRITERIO_CAPACIDAD || '')}</p>
    <p>${escapeHtml(textosNormativos.CRITERIO_SEGURIDAD || '')}</p>
    <p>${escapeHtml(analisisNormativo?.recomendacionEstrategica || '')}</p>

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

    <h3>3.1 Comparativo por rol evaluador</h3>
    <table>
      <thead>
        <tr><th>Rol</th><th>Evaluaciones</th><th>Cumplimiento</th><th>Promedio</th></tr>
      </thead>
      <tbody>
        ${roleRowsHtml || '<tr><td colspan="4">Sin datos por rol para el filtro seleccionado.</td></tr>'}
      </tbody>
    </table>

    <h3>3.2 Comparativo por evaluado</h3>
    <table>
      <thead>
        <tr><th>Evaluado</th><th>Rol</th><th>Campus</th><th>Centro</th><th>Evaluaciones</th><th>Cumplimiento</th><th>Promedio</th></tr>
      </thead>
      <tbody>
        ${evaluatedRowsHtml || '<tr><td colspan="7">Sin datos por evaluado para el filtro seleccionado.</td></tr>'}
      </tbody>
    </table>

    <h3>3.3 Distribucion detallada de calificaciones por seccion</h3>
    <table>
      <thead>
        <tr><th>Seccion</th><th>Promedio</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${sectionDistributionRowsHtml || '<tr><td colspan="8">Sin distribuciones por seccion para el filtro seleccionado.</td></tr>'}
      </tbody>
    </table>

    <h3>3.4 Distribucion de resultados por rol evaluador</h3>
    <table>
      <thead>
        <tr><th>Rol</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${roleDistributionRowsHtml || '<tr><td colspan="7">Sin distribucion por roles para el filtro seleccionado.</td></tr>'}
      </tbody>
    </table>

    <h3>3.5 Distribucion de resultados por programa</h3>
    <table>
      <thead>
        <tr><th>Programa</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${programDistributionRowsHtml || '<tr><td colspan="7">Sin distribucion por programa para el filtro seleccionado.</td></tr>'}
      </tbody>
    </table>

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

    <h3>5.1 Comparacion por Programas en un Mismo Centro</h3>
    <p>Analisis de como distintos programas academicos evaluan un mismo escenario de practica, identificando brechas de percepcion entre actores formativos.</p>
    ${buildComparacionCentrosHtml(informeOutput?.comparacionProgramasCentro || [])}

    <h3>5.2 Resumen estructurado por programa</h3>
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

    <h3>10.1 Hoja de ruta 30 dias</h3>
    <table>
      <thead><tr><th>Objetivo</th><th>Accion</th><th>Responsable</th><th>Indicador</th></tr></thead>
      <tbody>${buildPlanRows(plan306090.dias30) || '<tr><td colspan="4">No se definieron acciones para 30 dias.</td></tr>'}</tbody>
    </table>

    <h3>10.2 Hoja de ruta 60 dias</h3>
    <table>
      <thead><tr><th>Objetivo</th><th>Accion</th><th>Responsable</th><th>Indicador</th></tr></thead>
      <tbody>${buildPlanRows(plan306090.dias60) || '<tr><td colspan="4">No se definieron acciones para 60 dias.</td></tr>'}</tbody>
    </table>

    <h3>10.3 Hoja de ruta 90 dias</h3>
    <table>
      <thead><tr><th>Objetivo</th><th>Accion</th><th>Responsable</th><th>Indicador</th></tr></thead>
      <tbody>${buildPlanRows(plan306090.dias90) || '<tr><td colspan="4">No se definieron acciones para 90 dias.</td></tr>'}</tbody>
    </table>

    <h3>10.4 Plan de accion sugerido</h3>
    <table>
      <thead><tr><th>Seccion</th><th>Problema</th><th>Accion</th><th>Responsable</th><th>Plazo</th><th>Indicador</th></tr></thead>
      <tbody>${planesRowsHtml || '<tr><td colspan="6">No se generaron planes de accion para este corte.</td></tr>'}</tbody>
    </table>

    <h3>10.5 Recomendaciones</h3>
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
  const [selectedLevel, setSelectedLevel] = useState('Todos');
  const [selectedProgram, setSelectedProgram] = useState('Todos');
  const [selectedCenter, setSelectedCenter] = useState('Todos');
  const [dbPrograms, setDbPrograms] = useState([]);
  const [selectedComplexity, setSelectedComplexity] = useState(NIVELES_COMPLEJIDAD.ALTA);
  const [reportHtml, setReportHtml] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showCode, setShowCode] = useState(false);
  const previewFrameRef = useRef(null);

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

  // Carga todos los programas desde la tabla programs (sin filtro de campus, los rows no exponen campus_id)
  useEffect(() => {
    let cancelled = false;
    async function loadDbPrograms() {
      try {
        const data = await getProgramsByCampus(null);
        if (!cancelled) setDbPrograms(data || []);
      } catch {
        if (!cancelled) setDbPrograms([]);
      }
    }
    loadDbPrograms();
    return () => { cancelled = true; };
  }, []);

  // Programas de BD filtrados por nivel seleccionado
  const levelFilteredDbPrograms = useMemo(() => {
    if (selectedLevel === 'Todos') return dbPrograms;
    return dbPrograms.filter((p) => p.level.toLowerCase() === selectedLevel.toLowerCase());
  }, [dbPrograms, selectedLevel]);

  // Set de nombres válidos por nivel (desde BD) — para fallback cuando el row no tiene program_level en JSONB
  const validProgramNamesForLevel = useMemo(() => {
    if (selectedLevel === 'Todos') return null;
    return new Set(levelFilteredDbPrograms.map((p) => normalizeText(p.name).toLowerCase()));
  }, [levelFilteredDbPrograms, selectedLevel]);

  // programOptions: union de DB (nivel filtrado) + programas reales de los rows que coinciden con el nivel
  const programOptions = useMemo(() => {
    const combined = new Set(levelFilteredDbPrograms.map((p) => normalizeText(p.name)));
    rows
      .filter((row) => selectedCampus === 'Todos' || normalizeText(row.campus) === selectedCampus)
      .filter((row) => {
        if (selectedLevel === 'Todos') return true;
        const rowLevel = resolveLevel(row);
        if (rowLevel) return rowLevel === selectedLevel;
        // Fallback: verificar por nombre en BD
        return validProgramNamesForLevel?.has(normalizeText(resolveProgram(row)).toLowerCase()) ?? true;
      })
      .forEach((row) => {
        const name = resolveProgram(row);
        if (name !== 'Sin programa') combined.add(name);
      });
    return [...combined].sort((a, b) => a.localeCompare(b, 'es'));
  }, [levelFilteredDbPrograms, rows, selectedCampus, selectedLevel, validProgramNamesForLevel]);

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
      // Filtro por nivel: leer primero del JSONB, luego validar contra BD como fallback
      if (selectedLevel !== 'Todos') {
        const rowLevel = resolveLevel(row);
        if (rowLevel) {
          if (rowLevel !== selectedLevel) return false;
        } else if (validProgramNamesForLevel) {
          // Sin level en JSONB: filtrar por si el nombre del programa está en los de ese nivel en BD
          if (!validProgramNamesForLevel.has(normalizeText(resolveProgram(row)).toLowerCase())) return false;
        }
      }
      if (selectedProgram !== 'Todos' && resolveProgram(row) !== selectedProgram) return false;
      if (selectedCenter !== 'Todos' && normalizeText(row.center || 'Sin sitio') !== selectedCenter) return false;
      return true;
    });
  }, [roleRows, selectedProgram, selectedCenter, selectedLevel, validProgramNamesForLevel]);

  const globalScore = useMemo(() => {
    const scores = filteredRows.map((row) => extractGlobalScore(row)).filter((value) => typeof value === 'number');
    return average(scores);
  }, [filteredRows]);

  const completionRate = useMemo(() => {
    if (!filteredRows.length) return 0;
    const completed = filteredRows.filter((row) => row.status === 'Completada').length;
    return Number(((completed / filteredRows.length) * 100).toFixed(1));
  }, [filteredRows]);

  async function generateHtmlReport({ autoPrint = false } = {}) {
    if (!filteredRows.length) {
      setAiError('No hay datos disponibles para generar el informe con el filtro actual.');
      return;
    }

    setAiError('');
    setIsGenerating(true);

    const centerSummary = buildCenterSummary(filteredRows);
    const programSummary = buildProgramSummary(filteredRows);
    const roleSummary = buildRoleSummary(filteredRows);
    const evaluatedSummary = buildEvaluatedSummary(filteredRows);
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
        nivelDetalle: 'completo',
        nivelComplejidadEscenario: selectedComplexity
      }
    });

    const compactDataset = {
      filters: {
        campus: selectedCampus,
        role: selectedRole,
        level: selectedLevel,
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
      roles: roleSummary,
      evaluados: evaluatedSummary.slice(0, 15),
      improvements,
      secciones: (informeOutput.metricasGlobales?.promediosPorSeccion || []).map((sec) => ({
        seccion: sec.seccion,
        promedio: sec.promedio,
        respuestas: sec.totalRespuestas,
        interpretacion: sec.interpretacion,
        distribucion: sec.distribucion || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      })),
      distribucionRoles: buildRoleDistributionSummary(filteredRows).slice(0, 10),
      distribucionProgramas: buildProgramDistributionSummary(filteredRows),
      resumenCampus: (informeOutput.resumenPorCampus || []).slice(0, 6),
      comparacionProgramasCentro: (informeOutput.comparacionProgramasCentro || []).slice(0, 10),
      preguntasCriticas: (informeOutput.preguntasCriticas || []).slice(0, 8),
      recomendaciones: informeOutput.recomendaciones || [],
      plan306090: informeOutput.plan306090 || { dias30: [], dias60: [], dias90: [] },
      analisisNormativo: informeOutput.analisisNormativo || null
    };

    const systemPrompt = `
  Eres un coordinador institucional experto en relacion docencia-servicio, aseguramiento de la calidad y evaluacion de escenarios de practica en educacion superior colombiana.

  Tu tarea es redactar la narrativa de un informe tecnico institucional con lenguaje profesional, criterio analitico y enfoque directivo.

  Reglas obligatorias:
  - Usa exclusivamente la evidencia entregada en el dataset.
  - No inventes cifras, porcentajes, causas, tendencias ni actores no presentes en los datos.
  - Integra lectura cuantitativa, comparativa y normativa.
  - Analiza variaciones entre centros, programas, roles evaluadores, evaluados y distribuciones de calificaciones.
  - Interpreta la distribucion de puntajes de 1 a 5 como evidencia de dispersion, concentracion, estabilidad o riesgo.
  - Explica brechas relevantes, posibles implicaciones institucionales y prioridades de intervencion.
  - Relaciona los hallazgos con el marco de calidad de la Resolucion 00273 de 2021 y, cuando aplique, con el Decreto 2376 de 2010.
  - Manten un tono sobrio, tecnico y ejecutivo; evita frases genericas, promocionales o vacias.
  - No uses markdown.
  - Debes responder solo con JSON valido siguiendo exactamente la estructura solicitada por el usuario.

  Contenido esperado por seccion:
  - summary: sintesis ejecutiva con hallazgos principales, brechas y nivel de desempeno general.
  - methodology: alcance, filtros, enfoque analitico y como se interpretaron tablas, comparativos y distribuciones.
  - quantitative: lectura detallada de promedios, dispersion, concentraciones de calificaciones y diferencias entre actores.
  - qualitative: interpretacion institucional, riesgos, causas probables sustentadas en datos y lectura normativa.
  - actionPlan: plan accionable con horizontes de 30, 60 y 90 dias, responsables tipo y criterios de seguimiento.
  - conclusion: cierre ejecutivo con prioridad estrategica y siguiente paso institucional.
    `.trim();

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
- Incluye comparativos claros entre roles evaluadores y entre evaluados (brechas, dispersion y hallazgos accionables).
- Analiza las diferencias de calificacion entre distintos programas academicos que evaluan un mismo centro de practica, identificando brechas de percepcion y posibles causas asociadas al perfil del programa o del escenario.
- Usa como insumo clave la distribucion de calificaciones por seccion, rol y programa para explicar concentraciones en puntajes bajos, medios o altos.
- Cuando identifiques dispersion o polarizacion, explicala como un hallazgo operativo y no solo descriptivo.
- En actionPlan incorpora acciones concretas por horizonte de 30, 60 y 90 dias.
- Incorpora una lectura normativa basada en el Algoritmo 00273 de 2021 y relaciona los hallazgos con el nivel de complejidad ${selectedComplexity}.

Dataset:
${JSON.stringify(compactDataset)}
      `.trim();

      const rawNarrative = await runOpenRouterPrompt({
        apiKey: settings?.openrouter_api_key,
        model: settings?.openrouter_model,
        systemPrompt: [systemPrompt, settings?.openrouter_system_prompt].filter(Boolean).join('\n\n'),
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
      level: selectedLevel === 'Todos' ? 'Todos los niveles' : selectedLevel.charAt(0).toUpperCase() + selectedLevel.slice(1),
      program: selectedProgram,
      center: selectedCenter,
      filteredRows,
      generatedAt,
      globalScore,
      completionRate,
      totalRows: filteredRows.length,
      centerSummary,
      programSummary,
      roleSummary,
      evaluatedSummary,
      improvements,
      narrative,
      informeOutput
    });

    localStorage.setItem(LOCAL_REPORT_KEY, html);
    setReportHtml(html);

    if (autoPrint) {
      printHtml(html);
    }

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

  function printHtml(html) {
    if (!html) return;
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!popup) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    const runPrint = () => {
      try {
        popup.focus();
        popup.print();
      } catch {
        // noop
      }
    };

    popup.onload = () => setTimeout(runPrint, 250);
    setTimeout(runPrint, 900);
  }

  function printReport() {
    const iframeWindow = previewFrameRef.current?.contentWindow;
    if (iframeWindow) {
      try {
        iframeWindow.focus();
        iframeWindow.print();
        return;
      } catch {
        // fallback below
      }
    }

    printHtml(reportHtml);
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
              onClick={() => generateHtmlReport()}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Sparkles size={15} /> {isGenerating ? 'Generando...' : 'Generar Informe'}
            </button>
            <button
              type="button"
              onClick={() => generateHtmlReport({ autoPrint: true })}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Printer size={15} /> {isGenerating ? 'Generando...' : 'Generar e imprimir'}
            </button>
            <button type="button" onClick={downloadHtml} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Download size={15} /> Guardar HTML
            </button>
            <button type="button" onClick={printReport} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Printer size={15} /> Imprimir reporte HTML
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <MapPin size={16} className="text-slate-400" />
            <select className="w-full bg-transparent outline-none" value={selectedCampus} onChange={(event) => { setSelectedCampus(event.target.value); setSelectedLevel('Todos'); setSelectedProgram('Todos'); }}>
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
            <select className="w-full bg-transparent outline-none" value={selectedLevel} onChange={(event) => { setSelectedLevel(event.target.value); setSelectedProgram('Todos'); }}>
              <option value="Todos">Todos los niveles</option>
              <option value="pregrado">Pregrado</option>
              <option value="posgrado">Posgrado</option>
            </select>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <GraduationCap size={16} className="text-slate-400" />
            <select className="w-full bg-transparent outline-none" value={selectedProgram} onChange={(event) => setSelectedProgram(event.target.value)}>
              <option value="Todos">
                {selectedLevel === 'Todos' ? 'Todos los programas' : `Todos (${selectedLevel === 'pregrado' ? 'Pregrado' : 'Posgrado'})`}
              </option>
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

          <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FileText size={16} className="text-slate-400" />
            <select className="w-full bg-transparent outline-none" value={selectedComplexity} onChange={(event) => setSelectedComplexity(event.target.value)}>
              <option value={NIVELES_COMPLEJIDAD.ALTA}>Complejidad alta</option>
              <option value={NIVELES_COMPLEJIDAD.MEDIA}>Complejidad media</option>
              <option value={NIVELES_COMPLEJIDAD.BAJA}>Complejidad baja</option>
              <option value={NIVELES_COMPLEJIDAD.NO_CLINICO}>No clinico</option>
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
          <iframe ref={previewFrameRef} title="Informe HTML" srcDoc={reportHtml} className="w-full min-h-[900px] rounded-2xl border border-slate-200 bg-white" />
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
