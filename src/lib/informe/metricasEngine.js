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
  return SECCIONES_INSTRUMENTO.map((seccion) => {
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
}

export function calcularPromedioGlobal(evaluaciones = []) {
  const todos = evaluaciones.flatMap((ev) =>
    (ev.respuestas || []).map((r) => r.valor).filter((v) => v !== null)
  );
  return avg(todos);
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

  return resultado.sort((a, b) => a.promedio - b.promedio);
}
