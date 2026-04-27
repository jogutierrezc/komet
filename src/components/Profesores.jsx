import { useEffect, useState } from 'react';
import { Search, UserCheck, ClipboardCheck, ShieldCheck, Plus, Upload, CheckCircle, X, Pencil, Trash2 } from 'lucide-react';
import { getProfessors, getConvenios, getCampuses, createProfessor, updateProfessor, deleteProfessor, importProfessors } from '../lib/data';

export default function Profesores() {
  const [professors, setProfessors] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [newProfessor, setNewProfessor] = useState({
    full_name: '',
    email: '',
    document_number: '',
    specialty: '',
    campus_id: '',
    convenio_id: '',
    status: 'Activo'
  });
  const [selectedProfessor, setSelectedProfessor] = useState(null);

  useEffect(() => {
    loadCampuses();
    loadConvenios();
    loadProfessors();
  }, []);

  async function loadCampuses() {
    try {
      const data = await getCampuses();
      setCampuses(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadConvenios() {
    try {
      const data = await getConvenios();
      setConvenios(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadProfessors() {
    setLoading(true);
    try {
      const data = await getProfessors();
      setProfessors(data);
    } catch (error) {
      setErrorMessage('No se pudieron cargar los profesores desde la base de datos.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function findCampusId(name) {
    if (!name) return null;
    const campus = campuses.find((item) => item.name?.toLowerCase() === name.toLowerCase());
    return campus?.id || null;
  }

  function findConvenioId(name) {
    if (!name) return null;
    const convenio = convenios.find((item) => item.name?.toLowerCase() === name.toLowerCase());
    return convenio?.id || null;
  }

  function getCampusName(id) {
    return campuses.find((item) => item.id === id)?.name || '-';
  }

  function getConvenioName(id) {
    return convenios.find((item) => item.id === id)?.name || '-';
  }

  const normalizeStatus = (status) => String(status || '').trim().toLowerCase();
  const isActiveStatus = (status) => normalizeStatus(status) === 'activo';

  const filtered = professors.filter((profesor) =>
    profesor.full_name?.toLowerCase().includes(query.toLowerCase()) ||
    profesor.specialty?.toLowerCase().includes(query.toLowerCase()) ||
    getCampusName(profesor.campus_id).toLowerCase().includes(query.toLowerCase()) ||
    getConvenioName(profesor.convenio_id).toLowerCase().includes(query.toLowerCase())
  );

  const totalTutors = professors.length;
  const totalActive = professors.filter((item) => isActiveStatus(item.status)).length;

  async function handleCreateProfessor(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setStatusMessage('');

    if (!newProfessor.full_name || !newProfessor.specialty || !newProfessor.campus_id) {
      setErrorMessage('Completa nombre, especialidad y campus antes de guardar.');
      setLoading(false);
      return;
    }

    try {
      await createProfessor({
        full_name: newProfessor.full_name,
        email: newProfessor.email || null,
        specialty: newProfessor.specialty || null,
        campus_id: newProfessor.campus_id || null,
        convenio_id: newProfessor.convenio_id || null,
        status: newProfessor.status
      });
      setStatusMessage('Profesor creado correctamente.');
      setNewProfessor({ full_name: '', email: '', specialty: '', campus_id: '', convenio_id: '', status: 'Activo' });
      await loadProfessors();
      setView('list');
    } catch (error) {
      setErrorMessage('Error al crear el profesor en la base de datos.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleImportFile(file) {
    setErrorMessage('');
    setStatusMessage('');

    if (!file) {
      setErrorMessage('Selecciona un archivo CSV válido para importar.');
      return;
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (!rows.length) {
      setErrorMessage('El CSV no contiene filas válidas.');
      return;
    }

    const mappedRows = rows.map((row) => ({
      full_name: row.full_name || row.name || row.nombre || '',
      email: row.email || row.correo || null,
      document_number: row.document_number || row.numero_documento || row.documento || null,
      specialty: row.specialty || row.especialidad || '',
      campus_id: findCampusId(row.campus || row.centro || ''),
      convenio_id: findConvenioId(row.convenio || row.convenio_id || row.convenio_nombre || ''),
      status: row.status || row.estado || 'Activo'
    }));

    try {
      setLoading(true);
      await importProfessors(mappedRows);
      setStatusMessage(`Se importaron ${mappedRows.length} profesores correctamente.`);
      setImportFile(null);
      await loadProfessors();
      setView('list');
    } catch (error) {
      setErrorMessage('Error al importar profesores a la base de datos.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function importSelectedFile() {
    handleImportFile(importFile);
  }

  function resetProfessorForm() {
    setSelectedProfessor(null);
    setNewProfessor({ full_name: '', email: '', document_number: '', specialty: '', campus_id: '', convenio_id: '', status: 'Activo' });
  }

  function handleEditProfessor(profesor) {
    setSelectedProfessor(profesor);
    setNewProfessor({
      full_name: profesor.full_name || '',
      email: profesor.email || '',
      document_number: profesor.document_number || profesor.numero_documento || '',
      specialty: profesor.specialty || '',
      campus_id: profesor.campus_id || '',
      convenio_id: profesor.convenio_id || '',
      status: profesor.status || 'Activo'
    });
    setView('create');
  }

  async function handleDeleteProfessor(id) {
    setErrorMessage('');
    setStatusMessage('');
    try {
      await deleteProfessor(id);
      setProfessors((prev) => prev.filter((item) => item.id !== id));
      setStatusMessage('Profesor eliminado correctamente.');
    } catch (error) {
      setErrorMessage('Error al eliminar el profesor.');
      console.error(error);
    }
  }

  async function handleCreateProfessor(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setStatusMessage('');

    if (!newProfessor.full_name || !newProfessor.specialty || !newProfessor.campus_id) {
      setErrorMessage('Completa nombre, especialidad y campus antes de guardar.');
      setLoading(false);
      return;
    }

    try {
      if (selectedProfessor) {
        const updated = await updateProfessor(selectedProfessor.id, {
          full_name: newProfessor.full_name,
          email: newProfessor.email || null,
          document_number: newProfessor.document_number || null,
          specialty: newProfessor.specialty || null,
          campus_id: newProfessor.campus_id || null,
          convenio_id: newProfessor.convenio_id || null,
          status: newProfessor.status
        });
        setProfessors((prev) => prev.map((item) => (item.id === selectedProfessor.id ? updated[0] : item)));
        setStatusMessage('Profesor actualizado correctamente.');
      } else {
        const created = await createProfessor({
          full_name: newProfessor.full_name,
          email: newProfessor.email || null,
          document_number: newProfessor.document_number || null,
          specialty: newProfessor.specialty || null,
          campus_id: newProfessor.campus_id || null,
          convenio_id: newProfessor.convenio_id || null,
          status: newProfessor.status
        });
        setProfessors((prev) => [created[0], ...prev]);
        setStatusMessage('Profesor creado correctamente.');
      }
      resetProfessorForm();
      setView('list');
    } catch (error) {
      setErrorMessage(selectedProfessor ? 'Error al actualizar el profesor.' : 'Error al crear el profesor en la base de datos.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Profesores</h1>
          <p className="text-gray-500 text-sm mt-1">Administra tutores y profesores desde la base de datos.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setView('list')}
            className={`rounded-2xl px-5 py-2 text-sm font-semibold ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Lista
          </button>
          <button
            onClick={() => setView('create')}
            className={`rounded-2xl px-5 py-2 text-sm font-semibold ${view === 'create' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Crear
          </button>
          <button
            onClick={() => setView('import')}
            className={`rounded-2xl px-5 py-2 text-sm font-semibold ${view === 'import' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Importar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard icon={UserCheck} label="Total Tutores" value={professors.length} />
        <MetricCard icon={ShieldCheck} label="Activos" value={totalActive} />
        <MetricCard icon={ClipboardCheck} label="Campuses" value={campuses.length} />
      </div>

      {errorMessage && <Alert type="error" message={errorMessage} />}
      {statusMessage && <Alert type="success" message={statusMessage} />}

      {view === 'create' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">{selectedProfessor ? 'Editar profesor' : 'Crear nuevo profesor'}</h2>
            <button onClick={() => { resetProfessorForm(); setView('list'); }} className="text-gray-500 hover:text-gray-800 flex items-center gap-2">
              <X size={16} /> Cancelar
            </button>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateProfessor}>
            <label className="space-y-2 text-sm text-gray-600">
              Nombre completo
              <input
                value={newProfessor.full_name}
                onChange={(e) => setNewProfessor({ ...newProfessor, full_name: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Ej. Dra. Laura Torres"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              Correo
              <input
                value={newProfessor.email}
                onChange={(e) => setNewProfessor({ ...newProfessor, email: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Ej. laura@udes.edu.co"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              No. Documento de Identidad
              <input
                value={newProfessor.document_number}
                onChange={(e) => setNewProfessor({ ...newProfessor, document_number: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Ej. 123456789"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              Especialidad
              <input
                value={newProfessor.specialty}
                onChange={(e) => setNewProfessor({ ...newProfessor, specialty: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Ej. Psicología"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              Campus
              <select
                value={newProfessor.campus_id}
                onChange={(e) => setNewProfessor({ ...newProfessor, campus_id: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">Selecciona un campus</option>
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              Convenio
              <select
                value={newProfessor.convenio_id}
                onChange={(e) => setNewProfessor({ ...newProfessor, convenio_id: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">Sin convenio</option>
                {convenios.map((convenio) => (
                  <option key={convenio.id} value={convenio.id}>
                    {convenio.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-gray-600 md:col-span-2">
              Estado
              <select
                value={newProfessor.status}
                onChange={(e) => setNewProfessor({ ...newProfessor, status: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </label>
            <div className="md:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setView('list')} className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600">Cancelar</button>
              <button type="submit" disabled={loading} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition">
                {loading ? 'Guardando...' : 'Guardar profesor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'import' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Importar profesores</h2>
            <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-800 flex items-center gap-2">
              <X size={16} /> Cancelar
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">Selecciona un CSV con columnas: <span className="font-semibold">full_name, email, specialty, campus, convenio, status</span>.</p>
          <label className="w-full cursor-pointer rounded-3xl border border-dashed border-blue-300 bg-blue-50 px-6 py-8 text-center text-sm text-blue-700 transition hover:bg-blue-100">
            <Upload size={24} className="mx-auto mb-2" />
            <span>{importFile ? `Archivo seleccionado: ${importFile.name}` : 'Selecciona un archivo CSV'}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          </label>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={loading || !importFile}
              onClick={() => importSelectedFile()}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {loading ? 'Importando...' : 'Importar ahora'}
            </button>
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600">Lista de profesores</h2>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar profesor, departamento o rol"
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Especialidad</th>
                  <th className="px-6 py-4">Campus</th>
                  <th className="px-6 py-4">Convenio</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">Cargando profesores...</td>
                  </tr>
                ) : filtered.length ? (
                  filtered.map((profesor) => (
                    <tr key={profesor.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-700">{profesor.full_name}</td>
                      <td className="px-6 py-4 text-gray-500">{profesor.specialty}</td>
                      <td className="px-6 py-4 text-gray-500">{getCampusName(profesor.campus_id)}</td>
                      <td className="px-6 py-4 text-gray-500">{getConvenioName(profesor.convenio_id)}</td>
                      <td className="px-6 py-4 text-gray-700">
                        <span className={`inline-flex px-3 py-1 rounded-full ${isActiveStatus(profesor.status) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                          {profesor.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditProfessor(profesor)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteProfessor(profesor.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-semibold"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No hay profesores registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
      <div className="w-12 h-12 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-3xl font-black text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function Alert({ type, message }) {
  return (
    <div className={`rounded-3xl px-6 py-4 text-sm font-medium ${type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
      {message}
    </div>
  );
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const headers = lines[0].split(',').map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim());
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index] || '';
      return obj;
    }, {});
  });
}
