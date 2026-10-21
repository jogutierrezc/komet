import { useEffect, useRef, useState } from 'react';
import { Plus, Upload, Download, Pencil, Trash2, Ban, Search, X, ChevronRight, ClipboardCheck, Building2, MapPin, Image as ImageIcon, RotateCw, Sparkles } from 'lucide-react';
import { getConvenios, getCampuses, createConvenio, importConvenios, updateConvenio, deleteConvenio, getEvaluationSummaryByConvenio, getStudentsByConvenio, getProfessorsByConvenio, getRotationsByConvenio, createRotation, deleteRotation, getSystemSettings, runMistralPrompt } from '../lib/data';
import { parseFile } from '../lib/importHelpers';

export default function Convenios() {
  const [view, setView] = useState('list');
  const [sites, setSites] = useState([]);
  const [selectedConvenio, setSelectedConvenio] = useState(null);
  const [editedConvenio, setEditedConvenio] = useState(null);
  const [evaluationSummaries, setEvaluationSummaries] = useState({});
  const [convenioStudents, setConvenioStudents] = useState([]);
  const [convenioProfessors, setConvenioProfessors] = useState([]);
  const [convenioRotations, setConvenioRotations] = useState([]);
  const [rotationSaving, setRotationSaving] = useState(false);
  const [rotationForm, setRotationForm] = useState({ name: '', number: '', type: '', program: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [campusFilter, setCampusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'IPS',
    address: '',
    photo: '',
    campus_id: ''
  });

  useEffect(() => {
    loadCampuses();
    loadConvenios();
  }, []);

  const loadCampuses = async () => {
    setLoading(true);
    try {
      const campusData = await getCampuses();
      setCampuses(campusData);
    } catch (error) {
      setErrorMessage('No se pudieron cargar los campus.');
    } finally {
      setLoading(false);
    }
  };

  const loadConvenios = async () => {
    setLoading(true);
    try {
      const data = await getConvenios();
      setSites(data);
      const summaries = await Promise.all(data.map(async (convenio) => {
        const summary = await getEvaluationSummaryByConvenio(convenio.id);
        return [convenio.id, summary];
      }));
      setEvaluationSummaries(Object.fromEntries(summaries));
    } catch (error) {
      setErrorMessage('No se pudieron cargar los convenios.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditedConvenio(null);
    setFormData({ name: '', type: 'IPS', address: '', photo: '', campus_id: '' });
  };

  const handleCreateSite = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      if (editedConvenio) {
        const updated = await updateConvenio(editedConvenio.id, {
          name: formData.name,
          type: formData.type,
          address: formData.address,
          photo_url: formData.photo || "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=150",
          campus_id: formData.campus_id,
          status: editedConvenio.status || 'activo'
        });
        setSites((prev) => prev.map((site) => (site.id === editedConvenio.id ? updated[0] : site)));
        setStatusMessage('Convenio actualizado correctamente.');
      } else {
        const created = await createConvenio({
          name: formData.name,
          type: formData.type,
          address: formData.address,
          photo_url: formData.photo || "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=150",
          campus_id: formData.campus_id,
          status: 'activo'
        });
        setSites((prev) => [created[0], ...prev]);
        setStatusMessage('Convenio creado correctamente.');
      }
      resetForm();
      setView('list');
    } catch (error) {
      setErrorMessage(editedConvenio ? 'No se pudo actualizar el convenio.' : 'No se pudo crear el convenio.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSite = (site) => {
    setEditedConvenio(site);
    setFormData({
      name: site.name || '',
      type: site.type || 'IPS',
      address: site.address || '',
      photo: site.photo_url || '',
      campus_id: site.campus_id || ''
    });
    setView('create');
  };

  const handleDeleteSite = async (id) => {
    setErrorMessage('');
    setStatusMessage('');
    try {
      await deleteConvenio(id);
      setSites((prev) => prev.filter((site) => site.id !== id));
      setStatusMessage('Convenio eliminado correctamente.');
    } catch (error) {
      setErrorMessage('No se pudo eliminar el convenio.');
      console.error(error);
    }
  };

  const toggleStatus = async (id) => {
    setErrorMessage('');
    setStatusMessage('');

    const site = sites.find((site) => site.id === id);
    if (!site) return;

    const newStatus = site.status === 'activo' ? 'inactivo' : 'activo';
    try {
      const updated = await updateConvenio(id, { status: newStatus });
      setSites((prev) => prev.map((item) => (item.id === id ? updated[0] : item)));
      setStatusMessage(`Convenio ${newStatus === 'activo' ? 'habilitado' : 'deshabilitado'} correctamente.`);
    } catch (error) {
      setErrorMessage('No se pudo actualizar el estado del convenio.');
      console.error(error);
    }
  };

  const filteredSites = sites.filter((site) => {
    if (campusFilter && site.campus_id !== campusFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return `${site.name || ''} ${site.address || ''}`.toLowerCase().includes(q);
  });

  const buildCampusResolver = () => {
    const map = new Map();
    campuses.forEach((campus) => {
      map.set(String(campus.id).toLowerCase(), campus.id);
      map.set(String(campus.name || '').trim().toLowerCase(), campus.id);
    });
    return map;
  };

  const normalizeStatus = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return 'activo';
    if (['activo', 'active', '1', 'si', 'sí', 'true'].includes(normalized)) return 'activo';
    if (['inactivo', 'inactive', '0', 'no', 'false'].includes(normalized)) return 'inactivo';
    return 'activo';
  };

  const normalizeImportRows = (rows = []) => {
    const campusResolver = buildCampusResolver();
    const valid = [];
    const issues = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2;
      const name = String(row?.name || row?.sitio || row?.convenio || '').trim();
      const type = String(row?.type || row?.tipo || 'IPS').trim() || 'IPS';
      const address = String(row?.address || row?.direccion || '').trim();
      const photo_url = String(row?.photo_url || row?.photo || row?.foto || '').trim();
      const status = normalizeStatus(row?.status || row?.estado);
      const campusRaw = String(row?.campus_id || row?.campus || row?.campus_name || '').trim().toLowerCase();
      const campus_id = campusResolver.get(campusRaw) || null;

      if (!name) {
        issues.push(`Fila ${rowNum}: falta el nombre del sitio.`);
        return;
      }

      if (!address) {
        issues.push(`Fila ${rowNum}: falta la direccion.`);
        return;
      }

      if (!campus_id) {
        issues.push(`Fila ${rowNum}: campus no reconocido (${row?.campus_id || row?.campus_name || row?.campus || 'vacio'}).`);
        return;
      }

      valid.push({
        name,
        type,
        address,
        photo_url,
        campus_id,
        status
      });
    });

    return { valid, issues };
  };

  const handleDownloadConveniosTemplate = () => {
    const headers = ['name', 'type', 'address', 'campus_name', 'photo_url', 'status'];
    const sampleRows = [
      ['Clinica Santa Cruz', 'IPS', 'Cra 27 #45-12 Bucaramanga', 'Bucaramanga', '', 'activo'],
      ['Hospital Universitario del Oriente', 'Hospital Universitario', 'Calle 100 #12-34 Cucuta', 'Cucuta', '', 'activo'],
      ['Centro de Simulacion UDES Valledupar', 'Centros de Simulación', 'Av. Sierra Nevada #18-20 Valledupar', 'Valledupar', '', 'inactivo']
    ];

    const csv = [headers.join(','), ...sampleRows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'plantilla_importar_convenios.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setStatusMessage('Plantilla CSV descargada. Puedes llenarla y luego importar.');
    setErrorMessage('');
  };

  const triggerConveniosImport = () => {
    importInputRef.current?.click();
  };

  const handleConveniosFileImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const parsedRows = await parseFile(file);
      if (!parsedRows.length) {
        setErrorMessage('El archivo no tiene filas para importar.');
        return;
      }

      const { valid, issues } = normalizeImportRows(parsedRows);

      if (!valid.length) {
        setErrorMessage(`No se importaron convenios. ${issues.slice(0, 3).join(' ')}`);
        return;
      }

      const inserted = await importConvenios(valid);
      setSites((prev) => [...inserted, ...prev]);

      // Recalcula resumen para convenios nuevos
      const summaries = await Promise.all(inserted.map(async (convenio) => {
        const summary = await getEvaluationSummaryByConvenio(convenio.id);
        return [convenio.id, summary];
      }));
      setEvaluationSummaries((prev) => ({ ...prev, ...Object.fromEntries(summaries) }));

      const issueHint = issues.length
        ? ` Se omitieron ${issues.length} fila(s): ${issues.slice(0, 2).join(' ')}`
        : '';
      setStatusMessage(`Importacion completada. Se crearon ${inserted.length} sitio(s).${issueHint}`);
    } catch (error) {
      console.error('Error importando convenios:', error);
      setErrorMessage('No fue posible importar el archivo. Verifica formato CSV y columnas requeridas.');
    } finally {
      event.target.value = '';
      setImporting(false);
    }
  };

  const openConvenioDetail = async (convenio) => {
    setSelectedConvenio(convenio);
    setDetailLoading(true);
    setConvenioRotations([]);
    setRotationForm({ name: '', number: '', type: '', program: '' });
    setAiSuggestions([]);
    try {
      const [students, professors, rotations] = await Promise.all([
        getStudentsByConvenio(convenio.id),
        getProfessorsByConvenio(convenio.id),
        getRotationsByConvenio(convenio.id, { onlyActive: false })
      ]);
      setConvenioStudents(students);
      setConvenioProfessors(professors);
      setConvenioRotations(rotations);
    } catch (error) {
      setErrorMessage('No se pudieron cargar los datos asociados al convenio.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddRotation = async (e) => {
    e.preventDefault();
    if (!selectedConvenio) return;
    const name = rotationForm.name.trim();
    if (!name) {
      setErrorMessage('El nombre de la rotación es obligatorio.');
      return;
    }
    setRotationSaving(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const created = await createRotation({
        convenio_id: selectedConvenio.id,
        name,
        number: rotationForm.number,
        type: rotationForm.type.trim(),
        program: rotationForm.program.trim()
      });
      setConvenioRotations((prev) => [...prev, created[0]].sort((a, b) => (a.number || 999) - (b.number || 999) || a.name.localeCompare(b.name)));
      setRotationForm({ name: '', number: '', type: '', program: '' });
      setStatusMessage(`Rotación "${name}" agregada a ${selectedConvenio.name}.`);
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.code === '23505'
        ? 'Ya existe una rotación con ese nombre en este sitio.'
        : 'No se pudo guardar la rotación.');
    } finally {
      setRotationSaving(false);
    }
  };

  const handleDeleteRotation = async (id) => {
    setErrorMessage('');
    setStatusMessage('');
    try {
      await deleteRotation(id);
      setConvenioRotations((prev) => prev.filter((rotation) => rotation.id !== id));
      setStatusMessage('Rotación eliminada.');
    } catch (error) {
      console.error(error);
      setErrorMessage('No se pudo eliminar la rotación.');
    }
  };

  // Sugerencia de rotaciones con Mistral, usando la misma configuración de
  // Sistema > Configuración API (API key, modelo y temperature de Mistral).
  const handleGenerateRotationsWithAI = async () => {
    if (!selectedConvenio) return;
    setAiLoading(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const settings = await getSystemSettings();
      const apiKey = String(settings?.mistral_api_key || '').trim();
      if (!apiKey) {
        setErrorMessage('Configura la API key de Mistral en Sistema > Configuración de Mistral AI antes de generar rotaciones.');
        return;
      }

      const templateStructure = {
        rotaciones: [
          { nombre: 'Cirugía', numero: 1, tipo: 'Asistencial', programa: null }
        ]
      };

      const prompt = 'Genera el catálogo de rotaciones de práctica formativa de un sitio de práctica para programas de salud (Medicina, Enfermería, Fisioterapia, Psicología, entre otros).\n\n' +
        'Devuelve exclusivamente JSON con esta estructura exacta:\n' +
        JSON.stringify(templateStructure, null, 2) +
        '\n\nReglas:\n' +
        '- Entre 6 y 12 rotaciones típicas de ese tipo de sitio, con numero secuencial desde 1.\n' +
        '- nombre: área, servicio o escenario donde rota el estudiante.\n' +
        '- tipo: clasificación de la rotación (ej: Asistencial, Comunitaria, Docente-asistencial, Simulación).\n' +
        '- programa: nombre del programa al que aplica la rotación, o null si aplica a todos.\n' +
        '- No repitas rotaciones que ya existen en el sitio.\n' +
        '\nSitio de práctica:\n' +
        JSON.stringify({
          nombre: selectedConvenio.name,
          tipo: selectedConvenio.type,
          direccion: selectedConvenio.address,
          campus: selectedConvenio.campus?.name || null,
          rotacionesExistentes: convenioRotations.map((rotation) => rotation.name)
        });

      const raw = await runMistralPrompt({
        apiKey,
        model: settings?.mistral_model,
        systemPrompt: settings?.mistral_system_prompt,
        temperature: Number(settings?.mistral_temperature ?? 0.3),
        prompt
      });

      const suggestions = parseRotationSuggestions(raw, convenioRotations);
      if (!suggestions.length) {
        setErrorMessage('Mistral no devolvió rotaciones válidas. Intenta de nuevo o agrégalas manualmente.');
        return;
      }
      setAiSuggestions(suggestions.map((item) => ({ ...item, selected: true })));
      setStatusMessage(`Mistral sugirió ${suggestions.length} rotación(es). Revisa y agrega las que apliquen.`);
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || 'No fue posible generar rotaciones con Mistral.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddSuggestedRotations = async () => {
    if (!selectedConvenio) return;
    const selected = aiSuggestions.filter((item) => item.selected);
    if (!selected.length) {
      setErrorMessage('Selecciona al menos una rotación sugerida.');
      return;
    }
    setRotationSaving(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      for (const item of selected) {
        await createRotation({
          convenio_id: selectedConvenio.id,
          name: item.name,
          number: item.number,
          type: item.type,
          program: item.program
        });
      }
      const rotations = await getRotationsByConvenio(selectedConvenio.id, { onlyActive: false });
      setConvenioRotations(rotations);
      setAiSuggestions([]);
      setStatusMessage(`Se agregaron ${selected.length} rotación(es) a ${selectedConvenio.name}.`);
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.code === '23505'
        ? 'Una de las rotaciones sugeridas ya existe en este sitio.'
        : 'No se pudieron guardar las rotaciones sugeridas.');
    } finally {
      setRotationSaving(false);
    }
  };

  if (view === 'create') {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <button 
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ChevronRight size={16} className="rotate-180" />
          Volver al listado
        </button>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{editedConvenio ? 'Editar Sitio de Práctica' : 'Registrar Nuevo Sitio'}</h2>
              <p className="text-sm text-gray-500 italic">Completa la información básica del convenio.</p>
            </div>
          </div>

          <form onSubmit={handleCreateSite} className="space-y-6">
            {statusMessage && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 text-sm">
                {statusMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-2xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-500 ml-1">Nombre del Sitio</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ej. Clínica Santa Cruz"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-500 ml-1">Tipo de Sitio</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                >
                  <option>IPS</option>
                  <option>Hospital Universitario</option>
                  <option>Escenarios de Práctica no clínicos</option>
                  <option>Centros de Simulación</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-500 ml-1">Campus</label>
                <select 
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                  value={formData.campus_id}
                  onChange={e => setFormData({...formData, campus_id: e.target.value})}
                >
                  <option value="">Selecciona un campus</option>
                  {campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>{campus.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-500 ml-1">Dirección del Sitio</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    required
                    type="text" 
                    placeholder="Calle, número, ciudad..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-500 ml-1">Foto del Sitio (URL)</label>
              <div className="relative">
                <ImageIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="url" 
                  placeholder="https://ejemplo.com/foto.jpg"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={formData.photo}
                  onChange={e => setFormData({...formData, photo: e.target.value})}
                />
              </div>
              <p className="text-[10px] text-gray-400 italic ml-1">Si dejas este campo vacío, se asignará una imagen por defecto.</p>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
              >
                Guardar Sitio de Práctica
              </button>
              <button 
                type="button"
                onClick={() => { resetForm(); setView('list'); }}
                className="px-6 py-3 border border-gray-200 rounded-2xl text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const siteCountByCampus = (campusId) => sites.filter((site) => site.campus_id === campusId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-end">
        <div className="space-y-1.5">
          <p className="k-label">Gestión / Sitios de práctica</p>
          <h1 className="font-display text-4xl font-bold leading-tight">Sitios de práctica</h1>
          <p className="text-[15px] text-ink-2">Convenios y lugares donde tus estudiantes hacen sus prácticas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleDownloadConveniosTemplate} className="k-btn-secondary">
            <Download size={16} /> Plantilla CSV
          </button>
          <button type="button" onClick={triggerConveniosImport} disabled={importing} className="k-btn-secondary disabled:opacity-60">
            <Upload size={16} /> {importing ? 'Importando…' : 'Importar convenios'}
          </button>
          <button type="button" onClick={() => setView('create')} className="k-btn">
            <Plus size={18} /> Nuevo sitio
          </button>
          <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleConveniosFileImport} />
        </div>
      </div>

      {statusMessage ? (
        <div role="status" className="rounded-lg bg-score-high-bg text-score-high-fg px-4 py-3 text-sm font-medium">{statusMessage}</div>
      ) : null}
      {errorMessage ? (
        <div role="alert" className="rounded-lg bg-score-low-bg text-score-low-fg px-4 py-3 text-sm font-medium">{errorMessage}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por campus">
        <button type="button" aria-pressed={!campusFilter} onClick={() => setCampusFilter('')} className={`h-9 px-3.5 rounded-full border text-sm font-medium transition-colors ${!campusFilter ? 'bg-ink border-ink text-white' : 'bg-white border-line-strong text-ink hover:bg-paper'}`}>
          Todos <span className="font-mono text-xs opacity-75 ml-1">{sites.length}</span>
        </button>
        {campuses.map((campus) => (
          <button key={campus.id} type="button" aria-pressed={campusFilter === campus.id} onClick={() => setCampusFilter(campus.id)} className={`h-9 px-3.5 rounded-full border text-sm font-medium transition-colors ${campusFilter === campus.id ? 'bg-ink border-ink text-white' : 'bg-white border-line-strong text-ink hover:bg-paper'}`}>
            {campus.name} <span className="font-mono text-xs opacity-75 ml-1">{siteCountByCampus(campus.id)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 h-10 w-full sm:w-80 px-3 rounded-lg border border-line-strong bg-white text-sm text-ink-2 focus-within:border-blue-600">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nombre o dirección" aria-label="Buscar sitio" className="flex-1 min-w-0 bg-transparent outline-none text-ink placeholder:text-ink-2" />
        </label>
        <span className="k-label">{filteredSites.length} {filteredSites.length === 1 ? 'resultado' : 'resultados'}</span>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="k-card overflow-hidden w-full xl:flex-1 min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead>
                <tr className="bg-paper/60">
                  <th className="k-label px-4 py-3">Sitio</th>
                  <th className="k-label px-4 py-3 hidden md:table-cell">Tipo</th>
                  <th className="k-label px-4 py-3 hidden lg:table-cell">Campus</th>
                  <th className="k-label px-4 py-3" title="Estudiantes / Docentes / Coordinadores">Eval. E/D/C</th>
                  <th className="k-label px-4 py-3">Estado</th>
                  <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredSites.map((site) => {
                  const selected = selectedConvenio?.id === site.id;
                  const summary = evaluationSummaries[site.id];
                  return (
                    <tr
                      key={site.id}
                      onClick={() => openConvenioDetail(site)}
                      className={`border-t border-line cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-paper/60'} ${site.status === 'inactivo' ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3.5">
                        <button type="button" onClick={(e) => { e.stopPropagation(); openConvenioDetail(site); }} className="text-left">
                          <span className="block font-semibold leading-tight">{site.name}</span>
                          {site.address ? <span className="block text-xs text-ink-2 mt-0.5">{site.address}</span> : null}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-ink-2 hidden md:table-cell">{site.type || '-'}</td>
                      <td className="px-4 py-3.5 text-ink-2 hidden lg:table-cell">{site.campus?.name || '-'}</td>
                      <td className="px-4 py-3.5 font-mono text-[13px]">
                        {summary ? `${summary.student} / ${summary.professor} / ${summary.coordinator}` : '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`k-pill ${site.status === 'activo' ? 'k-pill-high' : 'bg-paper text-ink-2'}`}>{site.status || 'activo'}</span>
                      </td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <IconButton label="Editar" onClick={() => handleEditSite(site)}><Pencil size={16} /></IconButton>
                          <IconButton label={site.status === 'activo' ? 'Deshabilitar' : 'Habilitar'} onClick={() => toggleStatus(site.id)}>
                            {site.status === 'activo' ? <Ban size={16} /> : <ClipboardCheck size={16} />}
                          </IconButton>
                          <IconButton label="Eliminar" danger onClick={() => handleDeleteSite(site.id)}><Trash2 size={16} /></IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredSites.length === 0 && (
            <div className="py-16 px-6 flex flex-col items-center text-center text-ink-2">
              <p className="text-lg font-semibold text-ink">{sites.length ? 'Ningún sitio coincide con la búsqueda' : 'Todavía no hay sitios de práctica'}</p>
              {!sites.length ? (
                <button type="button" onClick={() => setView('create')} className="text-blue-600 text-sm font-semibold mt-2 hover:underline">
                  Agrega el primero
                </button>
              ) : null}
            </div>
          )}
        </div>

        {selectedConvenio ? (
          <aside
            aria-label="Detalle del sitio"
            className="k-slide-in fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-white p-6 space-y-6 xl:static xl:z-auto xl:w-[400px] xl:shrink-0 xl:rounded-xl xl:border xl:border-line"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                <p className="k-label">{selectedConvenio.type || 'Convenio'} · {selectedConvenio.campus?.name || 'Sin campus'}</p>
                <h2 className="font-display text-2xl font-bold leading-tight">{selectedConvenio.name}</h2>
                {selectedConvenio.address ? <p className="text-sm text-ink-2">{selectedConvenio.address}</p> : null}
              </div>
              <button type="button" aria-label="Cerrar detalle" onClick={() => { setSelectedConvenio(null); setConvenioStudents([]); setConvenioProfessors([]); }} className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center text-ink-2 hover:text-ink shrink-0">
                <X size={20} />
              </button>
            </div>

            <div className="flex border border-line rounded-lg divide-x divide-line">
              <div className="flex-1 p-3.5 space-y-1">
                <p className="k-label">Estado</p>
                <span className={`k-pill ${selectedConvenio.status === 'inactivo' ? 'bg-paper text-ink-2' : 'k-pill-high'}`}>{selectedConvenio.status || 'activo'}</span>
              </div>
              <div className="flex-1 p-3.5 space-y-1"><p className="k-label">Estudiantes</p><p className="font-display text-2xl font-bold">{convenioStudents.length}</p></div>
              <div className="flex-1 p-3.5 space-y-1"><p className="k-label">Profesores</p><p className="font-display text-2xl font-bold">{convenioProfessors.length}</p></div>
            </div>

            {evaluationSummaries[selectedConvenio.id] ? (
              <div className="space-y-2.5">
                <p className="k-label">Evaluaciones recibidas</p>
                {[
                  ['Estudiantes', evaluationSummaries[selectedConvenio.id].student],
                  ['Docentes', evaluationSummaries[selectedConvenio.id].professor],
                  ['Coordinadores', evaluationSummaries[selectedConvenio.id].coordinator],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm border-t border-line pt-2.5"><span>{label}</span><span className="font-mono">{value}</span></div>
                ))}
              </div>
            ) : null}

            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <RotateCw size={15} aria-hidden="true" />
                <p className="k-label">Rotaciones de práctica en este sitio</p>
              </div>
              {detailLoading ? (
                <p className="text-sm text-ink-2">Cargando…</p>
              ) : convenioRotations.length ? (
                <ul className="flex flex-wrap gap-2">
                  {convenioRotations.map((rotation) => (
                    <li
                      key={rotation.id}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${rotation.is_active === false ? 'border-line bg-paper text-ink-2 opacity-70' : 'border-line-strong bg-white'}`}
                    >
                      <span className="font-semibold">{rotation.name}</span>
                      {rotation.number ? <span className="k-label">No. {rotation.number}</span> : null}
                      {rotation.type ? <span className="k-label">{rotation.type}</span> : null}
                      {rotation.program ? <span className="k-label">· {rotation.program}</span> : null}
                      <button
                        type="button"
                        aria-label={`Eliminar rotación ${rotation.name}`}
                        onClick={() => handleDeleteRotation(rotation.id)}
                        className="text-ink-2 hover:text-score-low-fg"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">Este sitio no tiene rotaciones configuradas. Quienes evalúen podrán escribir la rotación a mano.</p>
              )}
              <form onSubmit={handleAddRotation} className="space-y-2.5 border-t border-line pt-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={rotationForm.name}
                    onChange={(e) => setRotationForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre de la rotación (ej: Cirugía)"
                    className="h-10 flex-1 min-w-[160px] px-3 rounded-lg border border-line-strong bg-white text-sm outline-none focus:border-blue-600"
                    required
                  />
                  <input
                    type="number"
                    min="1"
                    value={rotationForm.number}
                    onChange={(e) => setRotationForm((prev) => ({ ...prev, number: e.target.value }))}
                    placeholder="No."
                    className="h-10 w-20 px-3 rounded-lg border border-line-strong bg-white text-sm outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    value={rotationForm.type}
                    onChange={(e) => setRotationForm((prev) => ({ ...prev, type: e.target.value }))}
                    placeholder="Tipo (ej: Asistencial)"
                    className="h-10 w-40 px-3 rounded-lg border border-line-strong bg-white text-sm outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    value={rotationForm.program}
                    onChange={(e) => setRotationForm((prev) => ({ ...prev, program: e.target.value }))}
                    placeholder="Programa (opcional)"
                    className="h-10 w-44 px-3 rounded-lg border border-line-strong bg-white text-sm outline-none focus:border-blue-600"
                  />
                </div>
                <button type="submit" disabled={rotationSaving} className="k-btn-secondary disabled:opacity-60 !h-10">
                  <Plus size={16} /> {rotationSaving ? 'Guardando…' : 'Agregar rotación'}
                </button>
              </form>

              <div className="space-y-2.5 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={handleGenerateRotationsWithAI}
                  disabled={aiLoading}
                  className="k-btn-secondary disabled:opacity-60 !h-10 w-full"
                >
                  <Sparkles size={16} /> {aiLoading ? 'Generando con Mistral…' : 'Generar rotaciones con IA (Mistral)'}
                </button>
                <p className="text-xs text-ink-2">
                  Mistral propone el catálogo de rotaciones según el tipo de sitio. Revisa las sugerencias y agrega las que apliquen.
                </p>
                {aiSuggestions.length ? (
                  <div className="space-y-2">
                    <p className="k-label">Sugerencias de Mistral</p>
                    {aiSuggestions.map((item, index) => (
                      <label key={`${item.name}-${index}`} className="flex items-start gap-2 border border-line-strong rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-paper/60">
                        <input
                          type="checkbox"
                          checked={!!item.selected}
                          onChange={(e) => setAiSuggestions((prev) => prev.map((suggestion, i) => i === index ? { ...suggestion, selected: e.target.checked } : suggestion))}
                          className="mt-0.5 rounded"
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold">{item.name}</span>
                          <span className="block text-xs text-ink-2">
                            {[item.number ? `No. ${item.number}` : null, item.type, item.program ? `Programa: ${item.program}` : null].filter(Boolean).join(' · ') || 'Sin clasificación'}
                          </span>
                        </span>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddSuggestedRotations}
                      disabled={rotationSaving}
                      className="k-btn disabled:opacity-60 !h-10 w-full"
                    >
                      {rotationSaving ? 'Guardando…' : `Agregar seleccionadas (${aiSuggestions.filter((item) => item.selected).length})`}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="k-label">Estudiantes asociados</p>
              {detailLoading ? (
                <p className="text-sm text-ink-2">Cargando…</p>
              ) : convenioStudents.length ? (
                <ul>
                  {convenioStudents.map((student) => (
                    <li key={student.id} className="flex items-start justify-between gap-3 border-t border-line py-2.5">
                      <div className="min-w-0"><p className="text-sm font-semibold">{student.full_name}</p><p className="text-xs text-ink-2">{student.program}</p></div>
                      <span className={`k-pill shrink-0 ${student.status === 'Activo' ? 'k-pill-high' : 'bg-paper text-ink-2'}`}>{student.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">No hay estudiantes asociados.</p>
              )}
            </div>

            <div className="space-y-2.5">
              <p className="k-label">Profesores asociados</p>
              {detailLoading ? (
                <p className="text-sm text-ink-2">Cargando…</p>
              ) : convenioProfessors.length ? (
                <ul>
                  {convenioProfessors.map((profesor) => (
                    <li key={profesor.id} className="flex items-start justify-between gap-3 border-t border-line py-2.5">
                      <div className="min-w-0"><p className="text-sm font-semibold">{profesor.full_name}</p><p className="text-xs text-ink-2">{profesor.specialty}</p></div>
                      <span className={`k-pill shrink-0 ${profesor.status === 'Activo' ? 'k-pill-high' : 'bg-paper text-ink-2'}`}>{profesor.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">No hay profesores asociados.</p>
              )}
            </div>

            <button type="button" onClick={() => handleEditSite(selectedConvenio)} className="k-btn-secondary w-full">
              <Pencil size={16} /> Editar sitio
            </button>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

// Extrae de forma tolerante la lista de rotaciones que devuelve Mistral
// (acepta JSON puro, JSON en bloque de código o un array embebido) y descarta
// las que ya existen en el sitio.
function parseRotationSuggestions(rawText = '', existingRotations = []) {
  const text = String(rawText || '').trim();
  if (!text) return [];

  const fromFence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  let candidate = (fromFence || text).trim();

  let parsed = null;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('[');
    const end = candidate.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(candidate.slice(start, end + 1));
      } catch {
        parsed = null;
      }
    }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.rotaciones)
    ? parsed.rotaciones
    : Array.isArray(parsed?.rotations)
    ? parsed.rotations
    : [];

  const existingNames = new Set(existingRotations.map((rotation) => String(rotation.name || '').trim().toLowerCase()));

  return list
    .map((item) => {
      const numberValue = Number(item?.numero ?? item?.number);
      return {
        name: String(item?.nombre || item?.name || '').trim(),
        number: Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null,
        type: String(item?.tipo || item?.type || '').trim() || null,
        program: String(item?.programa || item?.program || '').trim() || null
      };
    })
    .filter((item) => item.name && !existingNames.has(item.name.toLowerCase()));
}

const IconButton = ({ label, danger, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className={`w-10 h-10 flex items-center justify-center rounded-lg text-ink-2 transition-colors ${danger ? 'hover:bg-score-low-bg hover:text-score-low-fg' : 'hover:bg-paper hover:text-ink'}`}
  >
    {children}
  </button>
);
