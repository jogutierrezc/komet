// Modelo del formulario de evaluación: funciones puras, sin React.
//
// Una encuesta guarda sus preguntas como lista plana (columna `questions` jsonb):
//   { id, tipo, label, instrucciones, codigo, requerido, opciones, logic, parentId, sectionId }
// `tipo` es 'section' o un tipo de pregunta. El ORDEN de la lista manda: cada sección va seguida de sus
// preguntas, y cada pregunta de sus preguntas dependientes. `canonicalize` garantiza ese orden.

export const QUESTION_TYPES = {
  rating: { label: 'Escala 1–5', hint: 'Cuenta para el puntaje', scored: true },
  yesno: { label: 'Sí / No', hint: 'No suma al puntaje' },
  multiple: { label: 'Opción múltiple', hint: 'Una respuesta de varias', hasOptions: true },
  text: { label: 'Texto libre', hint: 'Comentarios abiertos' },
  number: { label: 'Número', hint: 'No suma al puntaje' },
  date: { label: 'Fecha', hint: '' },
  instruction: { label: 'Instrucciones', hint: 'Texto de apoyo, sin respuesta', noAnswer: true },
  // Solo lectura: el formulario no los captura todavía, por eso ya no se ofrecen al crear.
  photo: { label: 'Foto', hint: '', legacy: true, noAnswer: true },
  signature: { label: 'Firma', hint: '', legacy: true, noAnswer: true },
};

export const PALETTE = ['rating', 'yesno', 'multiple', 'text', 'number', 'date', 'instruction'];
export const LIKERT_OPTIONS = ['5', '4', '3', '2', '1'];
export const TARGETS = ['Estudiante', 'Profesor', 'Coordinador', 'Todos'];

export const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14));

const defaultLogic = () => ({ active: false, whenValue: '', dependentId: null });

export function createSection(name = 'Nueva sección') {
  return { id: newId(), tipo: 'section', label: name, instrucciones: '', requerido: false, opciones: [...LIKERT_OPTIONS], logic: defaultLogic(), parentId: null, sectionId: null };
}

export function createQuestion(tipo, { sectionId = null, parentId = null } = {}) {
  const opciones = tipo === 'yesno' ? ['Sí', 'No'] : tipo === 'multiple' ? ['Opción 1', 'Opción 2'] : tipo === 'rating' ? [...LIKERT_OPTIONS] : [];
  return { id: newId(), tipo, label: '', instrucciones: '', codigo: '', requerido: tipo === 'rating', opciones, logic: defaultLogic(), parentId, sectionId };
}

/** Respuestas posibles de una pregunta, para elegir la condición de sus preguntas dependientes. */
export function answerChoices(question) {
  if (question.tipo === 'yesno') return ['Sí', 'No'];
  if (question.tipo === 'rating') return ['1', '2', '3', '4', '5'];
  if (question.tipo === 'multiple') return (question.opciones || []).filter((o) => String(o).trim());
  return [];
}

// ── Estructura ────────────────────────────────────────────────────────────────
// Árbol: [{ section, questions: [{ q, children: [q…] }] }]

export function toTree(items = []) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const sections = [];
  const byId = new Map();
  let current = null;

  const ensureSection = () => {
    if (!current) {
      current = { section: createSection('SECCIÓN 1'), questions: [] };
      sections.push(current);
      byId.set(current.section.id, current);
    }
    return current;
  };

  list.forEach((item) => {
    if (item.tipo === 'section') {
      current = { section: { ...item }, questions: [] };
      sections.push(current);
      byId.set(item.id, current);
    }
  });
  current = null;

  // Segunda pasada: reparte preguntas por sectionId; si falta o no existe, usa la última sección vista en la lista.
  const questions = new Map();
  list.forEach((item) => {
    if (item.tipo === 'section') {
      current = byId.get(item.id);
      return;
    }
    const home = (item.sectionId && byId.get(item.sectionId)) || current || ensureSection();
    questions.set(item.id, { q: { ...item, sectionId: home.section.id }, home, children: [] });
  });

  questions.forEach((node) => {
    const parent = node.q.parentId ? questions.get(node.q.parentId) : null;
    if (parent && parent !== node && parent.home === node.home) {
      parent.children.push(node.q);
    } else {
      node.q.parentId = null;
      node.home.questions.push(node);
    }
  });
  return sections;
}

export function fromTree(tree) {
  const out = [];
  tree.forEach(({ section, questions }) => {
    out.push(section);
    questions.forEach(({ q, children }) => {
      out.push(q);
      children.forEach((child) => out.push(child));
    });
  });
  return out;
}

export const canonicalize = (items) => fromTree(toTree(items));

// ── Edición ───────────────────────────────────────────────────────────────────

export function addSection(items) {
  const count = items.filter((i) => i.tipo === 'section').length;
  const section = createSection(`SECCIÓN ${count + 1}`);
  return { items: [...items, section], id: section.id };
}

/** Agrega una pregunta al final de su sección (o debajo de su pregunta padre). */
export function addQuestion(items, tipo, { sectionId = null, parentId = null } = {}) {
  let tree = toTree(items);
  if (!tree.length) tree = toTree([createSection('SECCIÓN 1')]);
  const parentNode = parentId ? tree.flatMap((s) => s.questions).find((n) => n.q.id === parentId) : null;
  const home = parentNode
    ? tree.find((s) => s.questions.includes(parentNode))
    : tree.find((s) => s.section.id === sectionId) || tree[tree.length - 1];
  const question = createQuestion(tipo, { sectionId: home.section.id, parentId: parentNode ? parentNode.q.id : null });
  if (parentNode) {
    parentNode.children.push(question);
    parentNode.q = { ...parentNode.q, logic: { ...parentNode.q.logic, active: true, dependentId: question.id } };
  } else {
    home.questions.push({ q: question, children: [] });
  }
  return { items: fromTree(tree), id: question.id, sectionId: home.section.id };
}

export function updateItem(items, id, patch) {
  return items.map((i) => (i.id === id ? { ...i, ...patch } : i));
}

export function removeItem(items, id) {
  const target = items.find((i) => i.id === id);
  if (!target) return items;
  const gone = new Set([id]);
  if (target.tipo === 'section') items.forEach((i) => { if (i.sectionId === id) gone.add(i.id); });
  let changed = true;
  while (changed) {
    changed = false;
    items.forEach((i) => {
      if (!gone.has(i.id) && i.parentId && gone.has(i.parentId)) { gone.add(i.id); changed = true; }
    });
  }
  return items.filter((i) => !gone.has(i.id)).map((i) => (
    i.logic?.dependentId && gone.has(i.logic.dependentId) ? { ...i, logic: { ...i.logic, dependentId: null } } : i
  ));
}

/** Mueve una sección o pregunta entre sus hermanas. */
export function moveItem(items, id, direction) {
  const tree = toTree(items);
  const delta = direction === 'up' ? -1 : 1;
  const swap = (arr, index) => {
    const next = index + delta;
    if (index < 0 || next < 0 || next >= arr.length) return false;
    [arr[index], arr[next]] = [arr[next], arr[index]];
    return true;
  };
  const sIdx = tree.findIndex((s) => s.section.id === id);
  if (sIdx >= 0) { swap(tree, sIdx); return fromTree(tree); }
  for (const s of tree) {
    const qIdx = s.questions.findIndex((n) => n.q.id === id);
    if (qIdx >= 0) { swap(s.questions, qIdx); return fromTree(tree); }
    for (const n of s.questions) {
      const cIdx = n.children.findIndex((c) => c.id === id);
      if (cIdx >= 0) { swap(n.children, cIdx); return fromTree(tree); }
    }
  }
  return items;
}

/** Copia con ids nuevos, manteniendo la relación entre sección, padre e hijos. */
export function cloneItems(items = []) {
  const idMap = new Map(items.map((i) => [i.id, newId()]));
  return items.map((i) => ({
    ...i,
    id: idMap.get(i.id),
    parentId: i.parentId ? idMap.get(i.parentId) || null : null,
    sectionId: i.sectionId ? idMap.get(i.sectionId) || null : null,
    logic: { ...(i.logic || defaultLogic()), dependentId: i.logic?.dependentId ? idMap.get(i.logic.dependentId) || null : null },
  }));
}

export function duplicateItem(items, id) {
  const target = items.find((i) => i.id === id);
  if (!target) return { items, id: null };
  const subtree = items.filter((i) => i.id === id || i.parentId === id || (target.tipo === 'section' && i.sectionId === id));
  const copies = cloneItems(subtree);
  const copyOfTarget = copies[0];
  copyOfTarget.label = copyOfTarget.label ? `${copyOfTarget.label} (copia)` : copyOfTarget.label;
  if (target.tipo !== 'section') {
    // La copia vive en la misma sección y conserva el padre del original.
    copies.forEach((c) => { c.sectionId = target.sectionId; });
    copyOfTarget.parentId = target.parentId;
  }
  const tree = toTree([...items, ...copies]);
  return { items: fromTree(tree), id: copyOfTarget.id };
}

// ── Metadatos de la encuesta ──────────────────────────────────────────────────
// Programa, nivel, escenario y período se guardan en `description` con este formato. El portal público y el
// formulario lo leen con las mismas expresiones: este es el único lugar que lo escribe y lo interpreta.

// `Alcance` es el nivel al que está abierta la evaluación (Pregrado, Posgrado o Ambos). Las evaluaciones creadas antes
// de que existiera no lo tienen: se tratan como Ambos, porque su `Nivel` era solo un valor por defecto.
export const LEVELS = ['Pregrado', 'Posgrado', 'Ambos'];

export function buildDescription({ programa = '', nivel = '', escenario = '', periodo = '' } = {}) {
  return `Programa: ${programa} · Nivel: ${nivel} · Escenario: ${escenario} · Alcance: ${nivel || 'Ambos'} · Período: ${periodo}`;
}

export function parseDescription(description = '') {
  const pick = (re) => (String(description).match(re)?.[1] || '').trim();
  return {
    programa: pick(/Programa:\s*([^·]+)/i),
    nivel: pick(/Nivel:\s*([^·]+)/i),
    escenario: pick(/Escenario:\s*([^·]+)/i),
    alcance: LEVELS.find((l) => l.toLowerCase() === pick(/Alcance:\s*([^·]+)/i).toLowerCase()) || 'Ambos',
    periodo: pick(/Per[ií]odo:\s*(.+)$/i),
  };
}

export function emptyDraft(campusId = '') {
  return {
    title: 'Nueva evaluación',
    campusId,
    targetType: 'Estudiante',
    meta: { programa: '', nivel: 'Ambos', escenario: 'Todos', periodo: 'A' },
    items: [],
  };
}

export function draftFromSurvey(survey) {
  const meta = parseDescription(survey.description);
  return {
    title: survey.title || 'Nueva evaluación',
    campusId: survey.campus_id || '',
    targetType: survey.target_type || 'Estudiante',
    meta: { programa: meta.programa, nivel: meta.alcance, escenario: meta.escenario || 'Todos', periodo: meta.periodo || 'A' },
    items: canonicalize(survey.questions || survey.preguntas || []),
  };
}

export function surveyPayload(draft) {
  return {
    title: draft.title.trim(),
    description: buildDescription(draft.meta),
    target_type: draft.targetType,
    questions: canonicalize(draft.items),
    campus_id: draft.campusId || null,
  };
}

export const publicLink = (surveyId) => `${window.location.origin}/evaluacion-publica?survey=${surveyId}`;

// ── Revisión antes de guardar ─────────────────────────────────────────────────

/** @returns {{ id: string|null, level: 'error'|'warn', message: string }[]} */
export function validateDraft(draft) {
  const issues = [];
  const add = (id, level, message) => issues.push({ id, level, message });
  const tree = toTree(draft.items);
  const questions = tree.flatMap((s) => s.questions.flatMap((n) => [n.q, ...n.children]));
  const answerable = questions.filter((q) => !QUESTION_TYPES[q.tipo]?.noAnswer);

  if (!draft.title.trim()) add(null, 'error', 'Falta el nombre de la evaluación.');
  if (!draft.campusId) add(null, 'error', 'Elige el campus.');
  if (!answerable.length) add(null, 'error', 'Agrega al menos una pregunta.');
  else if (!questions.some((q) => q.tipo === 'rating')) add(null, 'warn', 'No hay preguntas de escala 1–5: esta evaluación no tendrá puntaje.');

  tree.forEach(({ section, questions: nodes }) => {
    if (!section.label.trim()) add(section.id, 'error', 'Una sección no tiene título.');
    if (!nodes.length) add(section.id, 'warn', `La sección “${section.label || 'sin título'}” no tiene preguntas.`);
  });

  const codes = new Map();
  questions.forEach((q, i) => {
    const name = `Pregunta ${i + 1}`;
    if (q.tipo !== 'instruction' && !q.label.trim()) add(q.id, 'error', `${name} no tiene enunciado.`);
    if (q.tipo === 'instruction' && !q.label.trim() && !q.instrucciones.trim()) add(q.id, 'error', `${name} (instrucciones) está vacía.`);
    if (q.tipo === 'multiple') {
      const opts = (q.opciones || []).map((o) => String(o).trim());
      if (opts.filter(Boolean).length < 2) add(q.id, 'error', `${name} necesita al menos dos opciones.`);
      else if (new Set(opts.filter(Boolean).map((o) => o.toLowerCase())).size !== opts.filter(Boolean).length) add(q.id, 'warn', `${name} tiene opciones repetidas.`);
    }
    if (q.logic?.active && !q.logic.whenValue) add(q.id, 'warn', `${name}: elige con qué respuesta aparecen sus preguntas dependientes.`);
    if (q.codigo) codes.set(q.codigo, [...(codes.get(q.codigo) || []), q.id]);
  });
  codes.forEach((ids, code) => { if (ids.length > 1) add(ids[1], 'warn', `El código ${code} se repite en ${ids.length} preguntas.`); });

  return issues;
}

export function draftStats(items) {
  const questions = toTree(items).flatMap((s) => s.questions.flatMap((n) => [n.q, ...n.children]));
  return {
    sections: items.filter((i) => i.tipo === 'section').length,
    questions: questions.filter((q) => !QUESTION_TYPES[q.tipo]?.noAnswer).length,
    scored: questions.filter((q) => q.tipo === 'rating').length,
  };
}

// ── Respuesta ─────────────────────────────────────────────────────────────────

/** Una pregunta dependiente solo se muestra si la respuesta de su padre coincide con la condición. */
export function isQuestionVisible(question, parent, answers) {
  if (!question.parentId) return true;
  if (!parent || !parent.logic?.active) return true;
  const given = answers[parent.id];
  return given !== undefined && given !== null && String(given) === String(parent.logic.whenValue);
}

export function hasAnswer(value) {
  if (value === undefined || value === null) return false;
  return String(value).trim() !== '';
}
