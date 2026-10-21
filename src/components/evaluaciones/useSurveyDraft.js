import { useCallback, useEffect, useReducer } from 'react';
import { addQuestion, addSection, duplicateItem, moveItem, removeItem, updateItem } from './surveyModel';

// Un solo reducer: cada acción cambia borrador, selección y "sin guardar" de forma atómica
// (antes eran varios setState encadenados que podían pisarse entre sí).

function reducer(state, action) {
  switch (action.type) {
    case 'load':
      return { draft: action.draft, selectedId: null, dirty: false, removed: null };
    case 'saved':
      return { ...state, dirty: false };
    case 'meta':
      return { ...state, dirty: true, draft: { ...state.draft, ...action.patch } };
    case 'meta-field':
      return { ...state, dirty: true, draft: { ...state.draft, meta: { ...state.draft.meta, ...action.patch } } };
    case 'select':
      return { ...state, selectedId: action.id };
    case 'add-section': {
      const { items, id } = addSection(state.draft.items);
      return { ...state, dirty: true, selectedId: id, draft: { ...state.draft, items } };
    }
    case 'add-question': {
      const sectionId = action.sectionId || sectionOf(state.draft.items, state.selectedId);
      const { items, id } = addQuestion(state.draft.items, action.tipo, { sectionId, parentId: action.parentId || null });
      return { ...state, dirty: true, selectedId: id, draft: { ...state.draft, items } };
    }
    case 'update':
      return { ...state, dirty: true, draft: { ...state.draft, items: updateItem(state.draft.items, action.id, action.patch) } };
    case 'move':
      return { ...state, dirty: true, draft: { ...state.draft, items: moveItem(state.draft.items, action.id, action.direction) } };
    case 'duplicate': {
      const { items, id } = duplicateItem(state.draft.items, action.id);
      return { ...state, dirty: true, selectedId: id || state.selectedId, draft: { ...state.draft, items } };
    }
    case 'remove': {
      const target = state.draft.items.find((i) => i.id === action.id);
      if (!target) return state;
      return {
        ...state,
        dirty: true,
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        removed: { snapshot: state.draft.items, label: target.label || 'Elemento sin título', tipo: target.tipo },
        draft: { ...state.draft, items: removeItem(state.draft.items, action.id) },
      };
    }
    case 'undo-remove':
      return state.removed ? { ...state, draft: { ...state.draft, items: state.removed.snapshot }, removed: null } : state;
    case 'dismiss-removed':
      return { ...state, removed: null };
    default:
      return state;
  }
}

// La sección donde cae una pregunta nueva: la de lo seleccionado, o la última.
function sectionOf(items, selectedId) {
  const selected = items.find((i) => i.id === selectedId);
  if (selected) return selected.tipo === 'section' ? selected.id : selected.sectionId;
  const sections = items.filter((i) => i.tipo === 'section');
  return sections.length ? sections[sections.length - 1].id : null;
}

export function useSurveyDraft(initialDraft) {
  const [state, dispatch] = useReducer(reducer, { draft: initialDraft, selectedId: null, dirty: false, removed: null });

  // Aviso del navegador al cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!state.dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.dirty]);

  // El aviso de "eliminado" se retira solo.
  useEffect(() => {
    if (!state.removed) return undefined;
    const t = setTimeout(() => dispatch({ type: 'dismiss-removed' }), 9000);
    return () => clearTimeout(t);
  }, [state.removed]);

  const actions = {
    load: useCallback((draft) => dispatch({ type: 'load', draft }), []),
    saved: useCallback(() => dispatch({ type: 'saved' }), []),
    setMeta: useCallback((patch) => dispatch({ type: 'meta', patch }), []),
    setMetaField: useCallback((patch) => dispatch({ type: 'meta-field', patch }), []),
    select: useCallback((id) => dispatch({ type: 'select', id }), []),
    addSection: useCallback(() => dispatch({ type: 'add-section' }), []),
    addQuestion: useCallback((tipo, opts = {}) => dispatch({ type: 'add-question', tipo, ...opts }), []),
    update: useCallback((id, patch) => dispatch({ type: 'update', id, patch }), []),
    move: useCallback((id, direction) => dispatch({ type: 'move', id, direction }), []),
    duplicate: useCallback((id) => dispatch({ type: 'duplicate', id }), []),
    remove: useCallback((id) => dispatch({ type: 'remove', id }), []),
    undoRemove: useCallback(() => dispatch({ type: 'undo-remove' }), []),
    dismissRemoved: useCallback(() => dispatch({ type: 'dismiss-removed' }), []),
  };

  return { ...state, ...actions };
}
