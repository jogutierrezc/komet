import { useEffect, useState } from 'react';
import { Search, Users, GraduationCap, Plus, Upload, CheckCircle, X, Pencil, Trash2 } from 'lucide-react';
import { getStudents, getConvenios, getCampuses, createStudent, updateStudent, deleteStudent, importStudents } from '../lib/data';
import { parseFile, downloadTemplate } from '../lib/importHelpers';

export default function Estudiantes() {
  const [students, setStudents] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [newStudent, setNewStudent] = useState({
    full_name: '',
    academic_code: '',
    document_number: '',
    email: '',
    program: '',
    campus_id: '',
    convenio_id: '',
    status: 'Activo',
    started: ''
  });
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    loadCampuses();
    loadConvenios();
    loadStudents();
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

  async function loadStudents() {
    setLoading(true);
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (error) {
      setErrorMessage('No se pudieron cargar los estudiantes desde la base de datos.');
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

  function getCampusName(id) {
    return campuses.find((item) => item.id === id)?.name || '-';
  }

  function getConvenioName(id) {
    return convenios.find((item) => item.id === id)?.name || '-';
  }

  const normalizeStatus = (status) => String(status || '').trim().toLowerCase();
  const isActiveStatus = (status) => normalizeStatus(status) === 'activo';
  const isInPracticeStatus = (status) => ['en práctica', 'en practica'].includes(normalizeStatus(status));

  const filteredStudents = students.filter((student) =>
    student.full_name?.toLowerCase().includes(query.toLowerCase()) ||
    student.program?.toLowerCase().includes(query.toLowerCase()) ||
    getCampusName(student.campus_id).toLowerCase().includes(query.toLowerCase()) ||
    getConvenioName(student.convenio_id).toLowerCase().includes(query.toLowerCase())
  );

  const totalActive = students.filter((item) => isActiveStatus(item.status)).length;
  const totalInPractice = students.filter((item) => isInPracticeStatus(item.status)).length;

  async function handleCreateStudent(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setStatusMessage('');

    if (!newStudent.full_name || !newStudent.program || !newStudent.campus_id) {
      setErrorMessage('Completa nombre, programa y campus antes de guardar.');
      setLoading(false);
      return;
    }

    try {
      await createStudent({
        full_name: newStudent.full_name,
        email: newStudent.email || null,
        program: newStudent.program || null,
        campus_id: newStudent.campus_id || null,
        convenio_id: newStudent.convenio_id || null,
        status: newStudent.status
      });
      setStatusMessage('Estudiante creado correctamente.');
      setNewStudent({ full_name: '', email: '', program: '', campus_id: '', convenio_id: '', status: 'Activo', started: '' });
      await loadStudents();
      setView('list');
    } catch (error) {
      setErrorMessage('Error al crear el estudiante en la base de datos.');
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

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv') {
      setErrorMessage('Selecciona sólo archivos CSV para importar.');
      return;
    }

    let rows = [];
    try {
      rows = await parseFile(file);
    } catch (error) {
      setErrorMessage('No se pudo leer el archivo. Usa un CSV o un Excel válido.');
      console.error(error);
      return;
    }

    if (!rows.length) {
      setErrorMessage('El archivo no contiene filas válidas.');
      return;
    }

    const mappedRows = rows.map((row) => ({
      full_name: row.full_name || row.name || row.nombre || '',
      academic_code: row.academic_code || row.codigo_academico || row.codigo || null,
      document_number: row.document_number || row.numero_documento || row.documento || null,
      email: row.email || row.correo || null,
      program: row.program || row.programa || null,
      campus_id: findCampusId(row.campus || row.centro || row.campus_name || ''),
      convenio_id: findConvenioId(row.convenio || row.convenio_id || row.convenio_nombre || ''),
      status: row.status || row.estado || 'Activo',
      started: row.started || row.fecha_ingreso || row.fecha || null
    }));

    try {
      setLoading(true);
      await importStudents(mappedRows);
      setStatusMessage(`Se importaron ${mappedRows.length} estudiantes correctamente.`);
      setImportFile(null);
      await loadStudents();
      setView('list');
    } catch (error) {
      setErrorMessage('Error al importar estudiantes a la base de datos.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function findConvenioId(name) {
    if (!name) return null;
    const convenio = convenios.find((item) => item.name?.toLowerCase() === name.toLowerCase());
    return convenio?.id || null;
  }

  function importSelectedFile() {
    handleImportFile(importFile);
  }

  function resetStudentForm() {
    setSelectedStudent(null);
    setNewStudent({ full_name: '', academic_code: '', document_number: '', email: '', program: '', campus_id: '', convenio_id: '', status: 'Activo', started: '' });
  }

  function handleEditStudent(student) {
    setSelectedStudent(student);
    setNewStudent({
      full_name: student.full_name || '',
      academic_code: student.academic_code || student.codigo_academico || '',
      document_number: student.document_number || student.numero_documento || '',
      email: student.email || '',
      program: student.program || '',
      campus_id: student.campus_id || '',
      convenio_id: student.convenio_id || '',
      status: student.status || 'Activo',
      started: student.started || ''
    });
    setView('create');
  }

  async function handleDeleteStudent(id) {
    setErrorMessage('');
    setStatusMessage('');
    try {
      await deleteStudent(id);
      setStudents((prev) => prev.filter((item) => item.id !== id));
      setStatusMessage('Estudiante eliminado correctamente.');
    } catch (error) {
      setErrorMessage('Error al eliminar el estudiante.');
      console.error(error);
    }
  }

  async function handleCreateStudent(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setStatusMessage('');

    if (!newStudent.full_name || !newStudent.program || !newStudent.campus_id) {
      setErrorMessage('Completa nombre, programa y campus antes de guardar.');
      setLoading(false);
      return;
    }

    try {
      if (selectedStudent) {
        const updated = await updateStudent(selectedStudent.id, {
          full_name: newStudent.full_name,
          academic_code: newStudent.academic_code || null,
          document_number: newStudent.document_number || null,
          email: newStudent.email || null,
          program: newStudent.program || null,
          campus_id: newStudent.campus_id || null,
          convenio_id: newStudent.convenio_id || null,
          status: newStudent.status,
          started: newStudent.started || null
        });
        setStudents((prev) => prev.map((item) => (item.id === selectedStudent.id ? updated[0] : item)));
        setStatusMessage('Estudiante actualizado correctamente.');
      } else {
        const created = await createStudent({
          full_name: newStudent.full_name,
          academic_code: newStudent.academic_code || null,
          document_number: newStudent.document_number || null,
          email: newStudent.email || null,
          program: newStudent.program || null,
          campus_id: newStudent.campus_id || null,
          convenio_id: newStudent.convenio_id || null,
          status: newStudent.status,
          started: newStudent.started || null
        });
        setStudents((prev) => [created[0], ...prev]);
        setStatusMessage('Estudiante creado correctamente.');
      }
      resetStudentForm();
      setView('list');
    } catch (error) {
      setErrorMessage(selectedStudent ? 'Error al actualizar el estudiante.' : 'Error al crear el estudiante en la base de datos.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estudiantes</h1>
          <p className="text-gray-500 text-sm mt-1">Administra estudiantes y sincronízalos con la base de datos.</p>
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
        <MetricCard icon={GraduationCap} label="Total Estudiantes" value={students.length} />
        <MetricCard icon={Users} label="En Práctica" value={totalInPractice} />
        <MetricCard icon={Users} label="Activos" value={totalActive} />
      </div>

      {errorMessage && <Alert type="error" message={errorMessage} />}
      {statusMessage && <Alert type="success" message={statusMessage} />}

      {view === 'create' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">{selectedStudent ? 'Editar estudiante' : 'Crear nuevo estudiante'}</h2>
            <button onClick={() => { resetStudentForm(); setView('list'); }} className="text-gray-500 hover:text-gray-800 flex items-center gap-2">
              <X size={16} /> Cancelar
            </button>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateStudent}>
            <label className="space-y-2 text-sm text-gray-600">
              Nombre completo
              <input
                value={newStudent.full_name}
                onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Ej. Ana Morales"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              Código Académico
              <input
                value={newStudent.academic_code}
                onChange={(e) => setNewStudent({ ...newStudent, academic_code: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Ej. 202600123"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              No. Documento de Identidad
              <input
                value={newStudent.document_number}
                onChange={(e) => setNewStudent({ ...newStudent, document_number: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Ej. 123456789"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              Correo
              <input
                value={newStudent.email}
                onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Ej. ana@udes.edu.co"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              Programa
              <input
                value={newStudent.program}
                onChange={(e) => setNewStudent({ ...newStudent, program: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Ej. Medicina"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600">
              Campus
              <select
                value={newStudent.campus_id}
                onChange={(e) => setNewStudent({ ...newStudent, campus_id: e.target.value })}
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
                value={newStudent.convenio_id}
                onChange={(e) => setNewStudent({ ...newStudent, convenio_id: e.target.value })}
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
            <label className="space-y-2 text-sm text-gray-600">
              Estado
              <select
                value={newStudent.status}
                onChange={(e) => setNewStudent({ ...newStudent, status: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="Activo">Activo</option>
                <option value="En Práctica">En Práctica</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-gray-600 md:col-span-2">
              Fecha de ingreso
              <input
                type="date"
                value={newStudent.started}
                onChange={(e) => setNewStudent({ ...newStudent, started: e.target.value })}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              />
            </label>
            <div className="md:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setView('list')} className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600">Cancelar</button>
              <button type="submit" disabled={loading} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition">
                {loading ? 'Guardando...' : 'Guardar estudiante'}
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'import' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Importar estudiantes</h2>
            <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-800 flex items-center gap-2">
              <X size={16} /> Cancelar
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">Selecciona un archivo CSV con columnas: <span className="font-semibold">full_name, academic_code, document_number, email, program, campus, convenio, status, started</span>.</p>
          <label className="w-full cursor-pointer rounded-3xl border border-dashed border-blue-300 bg-blue-50 px-6 py-8 text-center text-sm text-blue-700 transition hover:bg-blue-100">
            <Upload size={24} className="mx-auto mb-2" />
            <span>{importFile ? `Archivo seleccionado: ${importFile.name}` : 'Selecciona un archivo CSV'}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          </label>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => downloadTemplate('plantilla-estudiantes.csv', ['full_name','academic_code','document_number','email','program','campus','convenio','status','started'])}
              className="rounded-2xl border border-blue-600 px-5 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition"
            >
              Descargar plantilla
            </button>
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
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600">Lista de estudiantes</h2>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar estudiante, programa o centro"
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Programa</th>
                  <th className="px-6 py-4">Centro</th>
                  <th className="px-6 py-4">Convenio</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Fecha Ingreso</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">Cargando estudiantes...</td>
                  </tr>
                ) : filteredStudents.length ? (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-700">{student.full_name}</td>
                      <td className="px-6 py-4 text-gray-500">{student.program}</td>
                      <td className="px-6 py-4 text-gray-500">{getCampusName(student.campus_id)}</td>
                      <td className="px-6 py-4 text-gray-500">{getConvenioName(student.convenio_id)}</td>
                      <td className="px-6 py-4 text-gray-700">
                        <span className={`inline-flex px-3 py-1 rounded-full ${isActiveStatus(student.status) ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{student.started || '-'}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditStudent(student)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-semibold"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">No hay estudiantes registrados.</td>
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

