import { useEffect, useState } from 'react';
import { getCampuses, getPeriods, getSurveys, createSurvey, updateSurvey, deleteSurvey } from '../lib/data';
import EvaluacionesFormPreview from './EvaluacionesFormPreview';
import SurveyList from './evaluaciones/SurveyList';
import SurveyEditor from './evaluaciones/SurveyEditor';
import { cloneItems, draftFromSurvey, emptyDraft, publicLink, surveyPayload } from './evaluaciones/surveyModel';

// Orquesta lista, editor y vista previa. La lógica de formularios vive en ./evaluaciones.
export default function Evaluaciones({ onNavigate }) {
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [surveys, setSurveys] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [periods, setPeriods] = useState([]); // vacío si aún no se aplicó la migración de períodos
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null); // { surveyId | null, draft }
  const [preview, setPreview] = useState(null); // survey para previsualizar

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getCampuses(), getSurveys(), getPeriods()]).then(([c, s, p]) => {
      if (cancelled) return;
      if (c.status === 'fulfilled') setCampuses(c.value || []);
      if (p.status === 'fulfilled' && p.value?.available) setPeriods(p.value.periods || []);
      if (s.status === 'fulfilled') setSurveys(s.value || []);
      else setLoadError('No se pudieron cargar los formularios. Revisa la conexión e intenta de nuevo.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const defaultCampus = campuses[0] ? String(campuses[0].id) : '';

  const openPeriodRow = periods.find((p) => p.status === 'abierto') || null;

  const openNew = () => {
    if (periods.length && !openPeriodRow) {
      setLoadError('Abre un período antes de crear formularios: no hay ninguno abierto.');
      return;
    }
    setLoadError('');
    setEditing({ surveyId: null, draft: emptyDraft(defaultCampus) });
    setView('editor');
  };

  const isClosed = (survey) => periods.find((p) => String(p.id) === String(survey.period_id))?.status === 'cerrado';

  const openEdit = (survey) => {
    if (isClosed(survey)) {
      setPreview(survey);
      return;
    }
    setEditing({ surveyId: survey.id, draft: draftFromSurvey(survey) });
    setView('editor');
  };

  const duplicate = (survey) => {
    const draft = draftFromSurvey(survey);
    setEditing({ surveyId: null, draft: { ...draft, title: `${draft.title} (copia)`, items: cloneItems(draft.items) } });
    setNotice('Copia lista. Ajústala y guárdala como un formulario nuevo.');
    setView('editor');
  };

  const copyLink = async (surveyId) => {
    try {
      await navigator.clipboard.writeText(publicLink(surveyId));
      return true;
    } catch {
      setLoadError('No se pudo copiar el enlace. Cópialo desde la barra de direcciones: ' + publicLink(surveyId));
      return false;
    }
  };

  // Devuelve { ok, message } para que el editor muestre el resultado sin alert().
  const save = async (draft) => {
    const payload = surveyPayload(draft);
    try {
      let saved;
      if (editing?.surveyId) {
        saved = await updateSurvey(editing.surveyId, payload);
      } else {
        saved = await createSurvey(payload);
      }
      const row = Array.isArray(saved) ? saved[0] : saved;
      if (!row) throw new Error('La base de datos no devolvió el formulario guardado.');
      setSurveys((prev) => (editing?.surveyId ? prev.map((s) => (s.id === row.id ? row : s)) : [row, ...prev]));
      setEditing((prev) => ({ ...prev, surveyId: row.id }));
      return { ok: true };
    } catch (error) {
      console.error('Error guardando el formulario:', error);
      return { ok: false, message: `No se pudo guardar: ${error?.message || 'error desconocido'}.` };
    }
  };

  // Elimina en la base de datos (antes solo se quitaba de la lista y reaparecía al recargar).
  const remove = async (survey) => {
    try {
      await deleteSurvey(survey.id);
      setSurveys((prev) => prev.filter((s) => s.id !== survey.id));
      setNotice(`Se eliminó “${survey.title}”.`);
      return { ok: true };
    } catch (error) {
      console.error('Error eliminando el formulario:', error);
      return { ok: false, message: `No se pudo eliminar: ${error?.message || 'error desconocido'}.` };
    }
  };

  if (preview) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-paper">
        <EvaluacionesFormPreview survey={preview} onClose={() => setPreview(null)} />
      </div>
    );
  }

  if (view === 'editor' && editing) {
    return (
      <SurveyEditor
        key={editing.surveyId || 'new'}
        initialDraft={editing.draft}
        isNew={!editing.surveyId}
        campuses={campuses}
        onSave={save}
        onPreview={(draft) => setPreview({ ...surveyPayload(draft), id: editing.surveyId || 'borrador' })}
        onExit={() => { setView('list'); setEditing(null); }}
      />
    );
  }

  return (
    <SurveyList
      surveys={surveys}
      loading={loading}
      error={loadError}
      notice={notice}
      campuses={campuses}
      periods={periods}
      onOpenPeriods={() => onNavigate?.('periodos')}
      onNew={openNew}
      onEdit={openEdit}
      onPreview={(survey) => setPreview(survey)}
      onDuplicate={duplicate}
      onCopyLink={copyLink}
      onDelete={remove}
    />
  );
}
