export const NIVELES_COMPLEJIDAD = {
  ALTA: 'ALTA',
  MEDIA: 'MEDIA',
  BAJA: 'BAJA',
  NO_CLINICO: 'NO_CLINICO'
};

export const CONDICIONES_CALIDAD_0273 = {
  ASPECTOS_GENERALES: {
    nombre: 'Aspectos Generales',
    aplica: [NIVELES_COMPLEJIDAD.ALTA, NIVELES_COMPLEJIDAD.MEDIA, NIVELES_COMPLEJIDAD.BAJA, NIVELES_COMPLEJIDAD.NO_CLINICO]
  },
  CAPACIDAD_INSTALADA: {
    nombre: 'Capacidad Instalada',
    aplica: [NIVELES_COMPLEJIDAD.ALTA, NIVELES_COMPLEJIDAD.MEDIA, NIVELES_COMPLEJIDAD.BAJA, NIVELES_COMPLEJIDAD.NO_CLINICO]
  },
  SEGURIDAD_PROTECCION: {
    nombre: 'Seguridad, Proteccion y Bienestar',
    aplica: [NIVELES_COMPLEJIDAD.ALTA, NIVELES_COMPLEJIDAD.MEDIA, NIVELES_COMPLEJIDAD.BAJA, NIVELES_COMPLEJIDAD.NO_CLINICO]
  },
  ORGANIZACION_ADMINISTRATIVA: {
    nombre: 'Organizacion Administrativa Relacion Docencia-Servicio',
    aplica: [NIVELES_COMPLEJIDAD.ALTA, NIVELES_COMPLEJIDAD.MEDIA, NIVELES_COMPLEJIDAD.BAJA, NIVELES_COMPLEJIDAD.NO_CLINICO]
  },
  PRACTICAS_FORMATIVAS: {
    nombre: 'Practicas Formativas',
    aplica: [NIVELES_COMPLEJIDAD.ALTA, NIVELES_COMPLEJIDAD.MEDIA, NIVELES_COMPLEJIDAD.BAJA, NIVELES_COMPLEJIDAD.NO_CLINICO]
  },
  CULTURA_MEJORAMIENTO: {
    nombre: 'Cultura del Mejoramiento Continuo',
    aplica: [NIVELES_COMPLEJIDAD.ALTA, NIVELES_COMPLEJIDAD.MEDIA, NIVELES_COMPLEJIDAD.BAJA, NIVELES_COMPLEJIDAD.NO_CLINICO]
  }
};

export const TEXTOS_NORMATIVOS = {
  INTRO_ALGORITMO:
    'La evaluacion se fundamenta en el Algoritmo 00273 de 2021, que establece la corresponsabilidad entre las IES y los escenarios de practica para garantizar condiciones optimas de formacion.',
  CRITERIO_AUTOPROGRAMACION:
    'Se verifica la existencia de un modelo de autoevaluacion de la relacion docencia-servicio con participacion de estudiantes, docentes y personal del escenario.',
  CRITERIO_BIENESTAR_DETALLADO: {
    GENERAL:
      'Para escenarios clinicos y no clinicos, se evalua la garantia de condiciones de bienestar y soporte al estudiante durante la practica.',
    ESPACIOS:
      'Se enfatiza la suficiencia de areas fisicas para descanso, alimentacion, unidades sanitarias diferenciadas y almacenamiento de pertenencias.',
    COHERENCIA:
      'La disponibilidad de estos espacios debe ser coherente con la capacidad instalada y el numero de estudiantes por turno.',
    MECANISMO:
      'La verificacion combina soporte documental, inspeccion ocular y entrevista directa a los estudiantes para validar la calidad real de estos servicios.'
  },
  CRITERIO_CAPACIDAD:
    'Se evalua la suficiencia de infraestructura, insumos, dispositivos medicos y recursos tecnologicos para el proceso de ensenanza-aprendizaje.',
  CRITERIO_SEGURIDAD:
    'Se verifica ARL, vacunacion, bioseguridad y dotacion de elementos de proteccion personal segun el area de practica.'
};

export function normalizeComplexity(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  if (normalized === NIVELES_COMPLEJIDAD.ALTA) return NIVELES_COMPLEJIDAD.ALTA;
  if (normalized === NIVELES_COMPLEJIDAD.MEDIA) return NIVELES_COMPLEJIDAD.MEDIA;
  if (normalized === NIVELES_COMPLEJIDAD.BAJA) return NIVELES_COMPLEJIDAD.BAJA;
  if (normalized === NIVELES_COMPLEJIDAD.NO_CLINICO || normalized === 'NO_CLINICA') return NIVELES_COMPLEJIDAD.NO_CLINICO;
  return NIVELES_COMPLEJIDAD.ALTA;
}

export function generarAnalisisNormativo(metricas = {}, nivelComplejidad = NIVELES_COMPLEJIDAD.ALTA) {
  const promediosPorSeccion = Array.isArray(metricas?.promediosPorSeccion) ? metricas.promediosPorSeccion : [];
  const hallazgosTecnicos = [];
  let cumplimientoGlobal = 0;
  let totalSecciones = 0;

  promediosPorSeccion.forEach((seccion) => {
    const promedio = seccion.promedio;
    const nombreSeccion = seccion.seccion;

    if (typeof promedio !== 'number') {
      hallazgosTecnicos.push({
        eje: nombreSeccion,
        estado: 'Informacion insuficiente',
        detalle: `La condicion "${nombreSeccion}" no cuenta con respuestas suficientes para valoracion tecnica bajo el algoritmo 00273.`
      });
      totalSecciones += 1;
      return;
    }

    if (promedio < 4.0) {
      hallazgosTecnicos.push({
        eje: nombreSeccion,
        estado: promedio < 3.0 ? 'Riesgo alto de incumplimiento' : 'Riesgo de incumplimiento',
        detalle: `Segun el algoritmo 00273, la condicion "${nombreSeccion}" presenta una brecha en la percepcion de los actores para un escenario de complejidad ${nivelComplejidad}.`
      });
    } else {
      cumplimientoGlobal += 1;
    }
    totalSecciones += 1;
  });

  const porcentajeCumplimiento = totalSecciones ? (cumplimientoGlobal / totalSecciones) * 100 : 0;

  return {
    tituloNormativo: 'ANALISIS BAJO MODELO DE EVALUACION 00273 DE 2021',
    nivelComplejidadEvaluado: nivelComplejidad,
    porcentajeCumplimiento: Number(porcentajeCumplimiento.toFixed(2)),
    veredictoTecnico:
      porcentajeCumplimiento === 100
        ? 'Escenario con estandares de alta calidad segun parametros del Ministerio.'
        : 'Escenario requiere ajustes en planes de mejoramiento para alineacion normativa.',
    hallazgos: hallazgosTecnicos,
    recomendacionEstrategica:
      'Fortalecer el mecanismo de autoevaluacion permanente y el seguimiento de condiciones de bienestar, seguridad y capacidad instalada para asegurar la vigencia del escenario ante visitas de inspeccion ocular.'
  };
}