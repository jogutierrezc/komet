import { useEffect, useRef, useState } from 'react';
import { 
  Plus, 
  Upload,
  Download,
  Eye, 
  Pencil, 
  Trash2, 
  Ban,
  MapPin,
  Building2,
  Image as ImageIcon,
  ChevronRight,
  Rocket,
  ClipboardCheck
} from 'lucide-react';
import { getConvenios, getCampuses, createConvenio, importConvenios, updateConvenio, deleteConvenio, getEvaluationSummaryByConvenio, getStudentsByConvenio, getProfessorsByConvenio } from '../lib/data';
import { parseFile } from '../lib/importHelpers';

export default function Convenios() {
  const [view, setView] = useState('list');
  const [sites, setSites] = useState([]);
  const [selectedConvenio, setSelectedConvenio] = useState(null);
  const [editedConvenio, setEditedConvenio] = useState(null);
  const [evaluationSummaries, setEvaluationSummaries] = useState({});
  const [convenioStudents, setConvenioStudents] = useState([]);
  const [convenioProfessors, setConvenioProfessors] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [campusFilter, setCampusFilter] = useState('');
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

  const filteredSites = campusFilter ? sites.filter((site) => site.campus_id === campusFilter) : sites;

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
    setView('detail');
    setDetailLoading(true);
    try {
      const [students, professors] = await Promise.all([
        getStudentsByConvenio(convenio.id),
        getProfessorsByConvenio(convenio.id)
      ]);
      setConvenioStudents(students);
      setConvenioProfessors(professors);
    } catch (error) {
      setErrorMessage('No se pudieron cargar los datos asociados al convenio.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (view === 'detail' && selectedConvenio) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <button 
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ChevronRight size={16} className="rotate-180" />
          Volver a convenios
        </button>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <div className="flex flex-col lg:flex-row gap-6 justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400">Convenio</p>
              <h1 className="text-3xl font-bold text-gray-800">{selectedConvenio.name}</h1>
              <p className="text-sm text-gray-500 mt-2">{selectedConvenio.type} · {selectedConvenio.campus?.name || 'Sin campus'}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard label="Estado" value={selectedConvenio.status || 'activo'} />
              <SummaryCard label="Estudiantes asociados" value={convenioStudents.length} />
              <SummaryCard label="Profesores asociados" value={convenioProfessors.length} />
            </div>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Estudiantes asociados</h2>
              {detailLoading ? (
                <p className="text-sm text-gray-500">Cargando estudiantes...</p>
              ) : convenioStudents.length ? (
                <ul className="space-y-3">
                  {convenioStudents.map((student) => (
                    <li key={student.id} className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="font-semibold text-gray-800">{student.full_name}</p>
                      <p className="text-sm text-gray-500">{student.program} · {student.campus?.name || 'Sin campus'}</p>
                      <span className={`mt-2 inline-flex px-3 py-1 rounded-full text-xs font-semibold ${student.status === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{student.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No hay estudiantes asociados a este convenio.</p>
              )}
            </div>
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Profesores asociados</h2>
              {detailLoading ? (
                <p className="text-sm text-gray-500">Cargando profesores...</p>
              ) : convenioProfessors.length ? (
                <ul className="space-y-3">
                  {convenioProfessors.map((profesor) => (
                    <li key={profesor.id} className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="font-semibold text-gray-800">{profesor.full_name}</p>
                      <p className="text-sm text-gray-500">{profesor.specialty} · {profesor.campus?.name || 'Sin campus'}</p>
                      <span className={`mt-2 inline-flex px-3 py-1 rounded-full text-xs font-semibold ${profesor.status === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{profesor.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No hay profesores asociados a este convenio.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sitios de Práctica</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona los convenios y lugares donde tus estudiantes realizan sus prácticas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadConveniosTemplate}
            className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-2xl font-medium text-sm inline-flex items-center gap-2"
          >
            <Download size={16} /> Plantilla CSV
          </button>
          <button
            type="button"
            onClick={triggerConveniosImport}
            disabled={importing}
            className="border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-2xl font-medium text-sm inline-flex items-center gap-2 disabled:opacity-70"
          >
            <Upload size={16} /> {importing ? 'Importando...' : 'Importar convenios'}
          </button>
          <button 
            onClick={() => setView('create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            Nuevo Sitio
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleConveniosFileImport}
          />
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 text-sm">
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Total Sitios" value={filteredSites.length} color="blue" />
          <StatCard label="Convenios Activos" value={filteredSites.filter((site) => site.status === 'activo').length} color="indigo" />
          <StatCard label="Campus con convenio" value={new Set(sites.map((site) => site.campus?.name || '')).size} color="emerald" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 ml-1">Filtrar por campus</label>
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value)}
            className="w-full mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            <option value="">Todos los campus</option>
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>{campus.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Convenio</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Tipo</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Campus</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Evaluaciones</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Estado</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Dirección</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredSites.map((site) => (
              <tr key={site.id} className={`hover:bg-gray-50/50 transition-colors ${site.status === 'inactivo' ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <img 
                      src={site.photo_url || 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=150'} 
                      alt={site.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                    <div>
                      <p className="font-bold text-gray-800 text-sm leading-tight">{site.name}</p>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${site.status === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                        {site.status}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 size={14} className="text-gray-400" />
                    {site.type || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{site.campus?.name || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {evaluationSummaries[site.id]
                    ? `${evaluationSummaries[site.id].student}/${evaluationSummaries[site.id].professor}/${evaluationSummaries[site.id].coordinator}`
                    : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{site.status || 'activo'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 italic">{site.address || '-'}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <ActionButton icon={<Eye size={16} />} tooltip="Ver" color="blue" onClick={() => openConvenioDetail(site)} />
                    <ActionButton icon={<Pencil size={16} />} tooltip="Editar" color="slate" onClick={() => handleEditSite(site)} />
                    <ActionButton
                      icon={site.status === 'activo' ? <Ban size={16} /> : <ClipboardCheck size={16} />}
                      tooltip={site.status === 'activo' ? 'Deshabilitar' : 'Habilitar'}
                      color="orange"
                      onClick={() => toggleStatus(site.id)}
                    />
                    <ActionButton
                      icon={<Trash2 size={16} />}
                      tooltip="Eliminar"
                      color="red"
                      onClick={() => handleDeleteSite(site.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSites.length === 0 && (
          <div className="py-20 flex flex-col items-center text-gray-400">
            <Rocket size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">No hay sitios de práctica registrados</p>
            <button onClick={() => setView('create')} className="text-blue-600 text-sm font-semibold mt-2 hover:underline">
              Comienza agregando uno nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// UI Components
const StatCard = ({ label, value, color }) => {
  const colors = {
    blue: "bg-blue-50 border-blue-100",
    indigo: "bg-indigo-50 border-indigo-100",
    emerald: "bg-emerald-50 border-emerald-100"
  };
  
  return (
    <div className={`p-6 rounded-2xl border shadow-sm flex items-center justify-between ${colors[color] || colors.blue}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-black text-gray-800">{value}</p>
      </div>
      <div className="p-3 rounded-2xl bg-white border border-gray-200">
        <Building2 size={24} className="text-gray-300" />
      </div>
    </div>
  );
};

const ActionButton = ({ icon, tooltip, color, onClick }) => {
  const colors = {
    blue: "hover:bg-blue-50 hover:text-blue-600",
    red: "hover:bg-red-50 hover:text-red-600",
    slate: "hover:bg-gray-100 hover:text-gray-800",
    orange: "hover:bg-orange-50 hover:text-orange-600"
  };

  return (
    <div className="relative group">
      <button 
        onClick={onClick}
        className={`p-2 rounded-lg transition-colors text-gray-400 ${colors[color]}`}
      >
        {icon}
      </button>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
        {tooltip}
      </span>
    </div>
  );
};

const SummaryCard = ({ label, value }) => (
  <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
    <p className="text-xs uppercase tracking-widest text-gray-400">{label}</p>
    <p className="mt-3 text-3xl font-black text-gray-800">{value}</p>
  </div>
);
