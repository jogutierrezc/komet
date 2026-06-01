import { SECCIONES_INSTRUMENTO, PREGUNTAS_INSTRUMENTO, PREGUNTAS_POR_SECCION, interpretarPromedio } from './instrumento';

function avg(values) {
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return null;
  return Number((valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(2));
}

function distribucion(values) {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  values.forEach((v) => {
    if (v !== null && v >= 1 && v <= 5) dist[v] += 1;
  });
  return dist;
}

export function calcularMetricasPorSeccion(evaluaciones = []) {
  // 1. Intentar mapeo a secciones del instrumento (AG, CI, SPB, OA, PF, CMC)
  const instrumentResults = SECCIONES_INSTRUMENTO.map((seccion) => {
    const preguntasSeccion = PREGUNTAS_POR_SECCION[seccion] || [];
    const ids = new Set(preguntasSeccion.map((p) => p.id));

    const valores = evaluaciones.flatMap((ev) =>
      (ev.respuestas || []).filter((r) => ids.has(r.preguntaId)).map((r) => r.valor)
    );

    const numericos = valores.filter((v) => v !== null);
    const promedio = avg(numericos);

    return {
      seccion,
      promedio,
      distribucion: distribucion(valores),
      totalRespuestas: numericos.length,
      interpretacion: interpretarPromedio(promedio)
    };
  });

  // 2. Si el mapeo a instrumento no produjo datos, fallback a scoreSummary.sectionScores
  const totalRespuestasInstrumento = instrumentResults.reduce(
    (sum, s) => sum + s.totalRespuestas, 0
  );

  if (totalRespuestasInstrumento > 0) return instrumentResults;

  // Fallback: agrupar por título de sección desde scoreSummary
  const fallbackMap = new Map();
  evaluaciones.forEach((ev) => {
    if (!ev.scoreSummary?.sectionScores) return;
    ev.scoreSummary.sectionScores.forEach((sec) => {
      const title = sec.title || 'General';
      if (!fallbackMap.has(title)) fallbackMap.set(title, []);
      if (typeof sec.score === 'number') fallbackMap.get(title).push(sec.score);
    });
  });

  if (fallbackMap.size === 0) {
    // Nivel 3: extraer valores numéricos directamente desde rawAnswers
    const rawMap = new Map();
    evaluaciones.forEach((ev) => {
      if (!ev.rawAnswers) return;
      Object.entries(ev.rawAnswers).forEach(([key, val]) => {
        if (key.startsWith('_')) return;
        let score = null;
        if (typeof val === 'number' && val >= 1 && val <= 5) score = val;
        else if (typeof val === 'string') {
          const n = Number(val.trim());
          if (Number.isFinite(n) && n >= 1 && n <= 5) score = n;
        }
        if (score === null) return;

        // Inferir sección desde el código de instrumento en la clave
        const codeMatch = key.toUpperCase().match(/\b(AG|CI|SPB|OA|PF|CMC)\s*-?\s*(\d{1,2})\b/);
        const sectionName = codeMatch
          ? ({ AG: 'ASPECTOS GENERALES', CI: 'CAPACIDAD INSTALADA', SPB: 'SEGURIDAD, PROTECCION Y BIENESTAR',
               OA: 'ORGANIZACION ADMINISTRATIVA RELACION DOCENCIA - SERVICIO', PF: 'PRACTICAS FORMATIVAS',
               CMC: 'CULTURA DE MEJORAMIENTO CONTINUO' })[codeMatch[1]] || 'General'
          : 'General';

        if (!rawMap.has(sectionName)) rawMap.set(sectionName, []);
        rawMap.get(sectionName).push(score);
      });
    });

    if (rawMap.size > 0) {
      return [...rawMap.entries()].map(([title, scores]) => ({
        seccion: title,
        promedio: avg(scores),
        distribucion: distribucion(scores),
        totalRespuestas: scores.length,
        interpretacion: interpretarPromedio(avg(scores))
      }));
    }

    return instrumentResults;
  }

  return [...fallbackMap.entries()].map(([title, scores]) => ({
    seccion: title,
    promedio: avg(scores),
    distribucion: distribucion(scores),
    totalRespuestas: scores.length,
    interpretacion: interpretarPromedio(avg(scores))
  }));
}

export function calcularPromedioGlobal(evaluaciones = []) {
  const todos = evaluaciones.flatMap((ev) =>
    (ev.respuestas || []).map((r) => r.valor).filter((v) => v !== null)
  );

  if (todos.length > 0) return avg(todos);

  // Fallback a scoreSummary.globalScore
  const scores = evaluaciones
    .map((ev) => ev.scoreSummary?.globalScore)
    .filter((v) => typeof v === 'number');

  if (scores.length > 0) return avg(scores);

  // Tercer nivel: extraer valores numéricos directamente de rawAnswers
  const rawScores = evaluaciones.flatMap((ev) => {
    if (!ev.rawAnswers) return [];
    return Object.entries(ev.rawAnswers)
      .filter(([key]) => !key.startsWith('_'))
      .map(([, val]) => {
        if (typeof val === 'number' && val >= 1 && val <= 5) return val;
        if (typeof val === 'string') {
          const n = Number(val.trim());
          return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
        }
        return null;
      })
      .filter((v) => v !== null);
  });

  return rawScores.length > 0 ? avg(rawScores) : null;
}

export function calcularResumenPorEscenario(evaluaciones = []) {
  const grupos = new Map();

  evaluaciones.forEach((ev) => {
    const key = `${ev.campus}||${ev.escenarioPractica}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(ev);
  });

  return [...grupos.entries()].map(([key, evs]) => {
    const [campus, escenario] = key.split('||');
    const promedioGlobal = calcularPromedioGlobal(evs);
    const promediosPorSeccion = calcularMetricasPorSeccion(evs);

    const promediosPorActor = ['Estudiante', 'Docente', 'Coordinador'].reduce((acc, actor) => {
      const subset = evs.filter((e) => e.actor === actor);
      acc[actor] = subset.length ? calcularPromedioGlobal(subset) : null;
      return acc;
    }, {});

    const programas = [...new Set(evs.map((e) => e.programaAcademico).filter(Boolean))];
    const periodos = [...new Set(evs.map((e) => e.periodoAcademico).filter(Boolean))];

    return {
      campus,
      escenario,
      totalEvaluaciones: evs.length,
      promedioGlobal,
      promediosPorSeccion,
      promediosPorActor,
      programas,
      periodos,
      calificacionCualitativa: interpretarPromedio(promedioGlobal)
    };
  });
}

export function calcularResumenPorPrograma(evaluaciones = []) {
  const grupos = new Map();

  evaluaciones.forEach((ev) => {
    const key = ev.programaAcademico || 'Sin programa';
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(ev);
  });

  return [...grupos.entries()].map(([programa, evs]) => {
    const campuses = [...new Set(evs.map((e) => e.campus).filter(Boolean))];
    const tipoPrograma = evs[0]?.tipoPrograma || 'Pregrado';
    const escenarios = [...new Set(evs.map((e) => e.escenarioPractica).filter(Boolean))];
    const promedioGlobal = calcularPromedioGlobal(evs);
    const promediosPorSeccion = calcularMetricasPorSeccion(evs);

    return {
      programa,
      tipoPrograma,
      campus: campuses,
      totalEvaluaciones: evs.length,
      promedioGlobal,
      promediosPorSeccion,
      escenarios,
      analisis: interpretarPromedio(promedioGlobal)
    };
  });
}

export function calcularResumenPorCampus(evaluaciones = []) {
  const grupos = new Map();

  evaluaciones.forEach((ev) => {
    if (!grupos.has(ev.campus)) grupos.set(ev.campus, []);
    grupos.get(ev.campus).push(ev);
  });

  return [...grupos.entries()].map(([campus, evs]) => {
    const promedioGlobal = calcularPromedioGlobal(evs);
    const promediosPorSeccion = calcularMetricasPorSeccion(evs);
    const escenarios = [...new Set(evs.map((e) => e.escenarioPractica).filter(Boolean))];
    const programas = [...new Set(evs.map((e) => e.programaAcademico).filter(Boolean))];

    const resumenesEscenario = calcularResumenPorEscenario(evs).filter((r) => r.campus === campus);
    const conPromedio = resumenesEscenario.filter((r) => r.promedioGlobal !== null);

    const destacado = [...conPromedio].sort((a, b) => (b.promedioGlobal || 0) - (a.promedioGlobal || 0))[0]?.escenario || null;
    const critico = [...conPromedio].sort((a, b) => (a.promedioGlobal || 99) - (b.promedioGlobal || 99))[0]?.escenario || null;

    return {
      campus,
      totalEvaluaciones: evs.length,
      totalEscenarios: escenarios.length,
      totalProgramas: programas.length,
      promedioGlobal,
      promediosPorSeccion,
      escenarioDestacado: destacado !== critico ? destacado : null,
      escenarioCritico: destacado !== critico ? critico : null,
      analisis: interpretarPromedio(promedioGlobal)
    };
  });
}

export function calcularMetricasGlobales(evaluaciones = []) {
  const campuses = [...new Set(evaluaciones.map((e) => e.campus).filter(Boolean))];
  const periodos = [...new Set(evaluaciones.map((e) => e.periodoAcademico).filter(Boolean))];

  const distribucionPorActor = evaluaciones.reduce(
    (acc, ev) => {
      acc[ev.actor] = (acc[ev.actor] || 0) + 1;
      return acc;
    },
    { Estudiante: 0, Docente: 0, Coordinador: 0 }
  );

  const distribucionPorTipoPrograma = evaluaciones.reduce(
    (acc, ev) => {
      acc[ev.tipoPrograma] = (acc[ev.tipoPrograma] || 0) + 1;
      return acc;
    },
    { Pregrado: 0, Posgrado: 0 }
  );

  return {
    totalEvaluaciones: evaluaciones.length,
    campuses,
    promedioGlobalUdes: calcularPromedioGlobal(evaluaciones),
    promediosPorSeccion: calcularMetricasPorSeccion(evaluaciones),
    distribucionPorActor,
    distribucionPorTipoPrograma,
    periodos
  };
}

export function detectarPreguntasCriticas(evaluaciones = [], umbral = 3.0) {
  const resultado = [];

  // Verificar si hay respuestas mapeadas a instrumento
  const totalRespuestas = evaluaciones.reduce(
    (sum, ev) => sum + (ev.respuestas || []).length, 0
  );

  if (totalRespuestas > 0) {
    PREGUNTAS_INSTRUMENTO.forEach((pregunta) => {
      const respuestas = evaluaciones
        .map((ev) => ({
          escenario: ev.escenarioPractica,
          valor: (ev.respuestas || []).find((r) => r.preguntaId === pregunta.id)?.valor ?? null
        }))
        .filter((r) => r.valor !== null);

      const promedio = avg(respuestas.map((r) => r.valor));
      if (promedio !== null && promedio < umbral) {
        const escenarios = [...new Set(respuestas.map((r) => r.escenario).filter(Boolean))];
        resultado.push({
          preguntaId: pregunta.id,
          texto: pregunta.texto,
          seccion: pregunta.seccion,
          promedio,
          escenarios
        });
      }
    });
  } else {
    // Fallback: detectar secciones criticas desde scoreSummary
    const secciones = calcularMetricasPorSeccion(evaluaciones);
    secciones.forEach((sec) => {
      if (sec.promedio !== null && sec.promedio < umbral) {
        resultado.push({
          preguntaId: `SEC_${sec.seccion.replace(/\s+/g, '_')}`,
          texto: `Seccion: ${sec.seccion}`,
          seccion: sec.seccion,
          promedio: sec.promedio,
          escenarios: []
        });
      }
    });
  }

  return resultado.sort((a, b) => a.promedio - b.promedio);
}

export function calcularComparacionProgramasPorCentro(evaluaciones = []) {
  // Agrupa por centro de practica y dentro de cada centro por programa academico
  // Retorna una estructura que permite comparar como distintos programas evaluan un mismo escenario
  const centrosMap = new Map();

  evaluaciones.forEach((ev) => {
    const centerKey = `${ev.campus}||${ev.escenarioPractica}`;
    if (!centrosMap.has(centerKey)) centrosMap.set(centerKey, new Map());
    const programsMap = centrosMap.get(centerKey);

    const program = ev.programaAcademico || 'Sin programa';
    if (!programsMap.has(program)) programsMap.set(program, []);
    programsMap.get(program).push(ev);
  });

  return [...centrosMap.entries()].map(([centerKey, programsMap]) => {
    const [campus, escenario] = centerKey.split('||');
    const programas = [...programsMap.entries()].map(([program, evs]) => {
      const promedioGlobal = calcularPromedioGlobal(evs);
      const promediosPorSeccion = calcularMetricasPorSeccion(evs);
      return {
        programa: program,
        totalEvaluaciones: evs.length,
        promedioGlobal,
        promediosPorSeccion
      };
    }).sort((a, b) => (b.promedioGlobal || 0) - (a.promedioGlobal || 0));

    return {
      campus,
      escenario,
      totalEvaluaciones: programas.reduce((s, p) => s + p.totalEvaluaciones, 0),
      programas
    };
  });
}
