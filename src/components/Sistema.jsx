import React, { useEffect, useState } from 'react';
import {
  Users,
  Mail,
  Send,
  Code,
  Cpu,
  ChevronLeft,
  Search,
  Bell,
  Mail as MailIcon,
  LayoutDashboard,
  Handshake,
  GraduationCap,
  Users as UsersRound,
  FileCheck,
  BarChart3,
  LogOut,
  Plus,
  Save,
  Key,
  Database,
  Terminal,
  Bot,
  Sliders,
} from 'lucide-react';
import { getSystemUsers, createSystemUser, updateSystemUser, deleteSystemUser, getSystemSettings, saveSystemSettings, getDbStatus } from '../lib/data';

const initialUser = {
  full_name: '',
  email: '',
  role: 'Administrador',
  status: 'Activo',
};

const defaultTemplates = [
  { key: 'Bienvenida', description: 'Mensaje de bienvenida para nuevos usuarios', last: '12 Oct 2023' },
  { key: 'Recuperación de Contraseña', description: 'Instrucciones para recuperar acceso', last: '02 Nov 2023' },
  { key: 'Notificación de Pago', description: 'Aviso de pago recibido o pendiente', last: '20 Nov 2023' },
  { key: 'Actualización de Sistema', description: 'Aviso de mantenimiento y mejoras', last: '05 Dic 2023' },
];

export default function Sistema() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [activeSubmodule, setActiveSubmodule] = useState('usuarios');
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [dbStatus, setDbStatus] = useState('checking');
  const [dbStatusMessage, setDbStatusMessage] = useState('Verificando conexión a la base de datos...');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [formUser, setFormUser] = useState(initialUser);
  const [settings, setSettings] = useState({
    resend_api_key: '',
    resend_sender_email: '',
    email_templates: {
      student_completed_subject: '',
      student_completed_body: '',
      student_access_subject: '',
      student_access_body: '',
      professor_access_subject: '',
      professor_access_body: '',
      coordinator_access_subject: '',
      coordinator_access_body: ''
    },
    openrouter_api_key: '',
    openrouter_model: 'gpt-4o-mini',
    openrouter_system_prompt: 'Eres un asistente administrativo para el sistema Komet, ayudas a generar mensajes de email y notificaciones operativas.'
  });

  useEffect(() => {
    loadUsers();
    loadSettings();
    checkDbConnection();
  }, []);

  async function checkDbConnection() {
    setDbStatus('checking');
    setDbStatusMessage('Verificando conexión a la base de datos...');
    try {
      await getDbStatus();
      setDbStatus('connected');
      setDbStatusMessage('Base de datos conectada correctamente.');
    } catch (error) {
      setDbStatus('error');
      setDbStatusMessage(error?.message || 'No se pudo conectar a la base de datos.');
      console.error('DB connection error:', error);
    }
  }

  async function loadUsers() {
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await getSystemUsers();
      setUsers(data);
    } catch (error) {
      setErrorMessage('No se pudieron cargar los usuarios del sistema. Verifica la tabla profiles en Supabase.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    setConfigLoading(true);
    setErrorMessage('');
    try {
      const data = await getSystemSettings();
      setSettings(data);
    } catch (error) {
      setErrorMessage('No se pudo cargar la configuración del sistema.');
      console.error(error);
    } finally {
      setConfigLoading(false);
    }
  }

  function resetForm() {
    setSelectedUser(null);
    setFormUser(initialUser);
  }

  function handleConfigChange(field, value) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  function handleTemplateChange(field, value) {
    setSettings((prev) => ({
      ...prev,
      email_templates: {
        ...prev.email_templates,
        [field]: value
      }
    }));
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    setConfigLoading(true);
    try {
      const saved = await saveSystemSettings(settings);
      setSettings(saved);
      setStatusMessage('Configuración guardada correctamente.');
      setActiveSubmodule(null);
    } catch (error) {
      setErrorMessage('No se pudo guardar la configuración del sistema.');
      console.error(error);
    } finally {
      setConfigLoading(false);
    }
  }

  function handleEdit(user) {
    setSelectedUser(user);
    setFormUser({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'Administrador',
      status: user.status || 'Activo',
    });
    setShowUserForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (!formUser.full_name || !formUser.email) {
      setErrorMessage('Completa el nombre y el correo electrónico.');
      return;
    }

    setLoading(true);
    try {
      if (selectedUser) {
        const updated = await updateSystemUser(selectedUser.id, formUser);
        setUsers((prev) => prev.map((item) => (item.id === selectedUser.id ? updated[0] : item)));
        setStatusMessage('Usuario actualizado correctamente.');
      } else {
        const created = await createSystemUser(formUser);
        setUsers((prev) => [created[0], ...prev]);
        setStatusMessage('Usuario creado correctamente.');
      }
      resetForm();
      setShowUserForm(false);
    } catch (error) {
      setErrorMessage(selectedUser ? 'Error al actualizar el usuario.' : 'Error al crear el usuario.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    setErrorMessage('');
    setStatusMessage('');
    try {
      await deleteSystemUser(id);
      setUsers((prev) => prev.filter((user) => user.id !== id));
      setStatusMessage('Usuario eliminado correctamente.');
    } catch (error) {
      setErrorMessage('Error al eliminar el usuario.');
      console.error(error);
    }
  }

  const totalActive = users.filter((user) => user.status === 'Activo').length;
  const totalInactive = users.filter((user) => user.status !== 'Activo').length;
  const filteredUsers = users.filter((user) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return (
      user.full_name?.toLowerCase().includes(normalized) ||
      user.email?.toLowerCase().includes(normalized) ||
      user.role?.toLowerCase().includes(normalized) ||
      user.status?.toLowerCase().includes(normalized)
    );
  });

  const options = [
    { id: 'usuarios', title: 'Usuarios', icon: <Users size={28} />, color: 'bg-blue-500', desc: 'Gestiona perfiles y permisos.' },
    { id: 'plantillas', title: 'Plantillas de Correo', icon: <Mail size={28} />, color: 'bg-emerald-500', desc: 'Diseña correos automatizados.' },
    { id: 'resend', title: 'Configuración Resend', icon: <Send size={28} />, color: 'bg-slate-800', desc: 'Control de envíos SMTP/API.' },
    { id: 'api', title: 'Configuración API', icon: <Code size={28} />, color: 'bg-amber-500', desc: 'Conecta Komet con otras apps.' },
    { id: 'ia', title: 'Configuración IA', icon: <Cpu size={28} />, color: 'bg-indigo-600', desc: 'Personaliza los modelos de ML.' },
  ];

  const renderContent = () => {
    switch (activeSubmodule) {
      case 'usuarios':
        return (
          <UsuariosView
            users={filteredUsers}
            loading={loading}
            onCreate={() => { resetForm(); setShowUserForm(true); }}
            onEdit={handleEdit}
            onDelete={handleDelete}
            query={query}
            setQuery={setQuery}
            showUserForm={showUserForm}
            onCloseForm={() => { setShowUserForm(false); resetForm(); }}
            onSubmit={handleSubmit}
            formUser={formUser}
            setFormUser={setFormUser}
          />
        );
      case 'plantillas':
        return <PlantillasView emailTemplates={settings.email_templates} onChange={handleTemplateChange} onSave={handleSaveSettings} loading={configLoading} />;
      case 'resend':
        return <ResendView settings={settings} onChange={handleConfigChange} onSave={handleSaveSettings} loading={configLoading} />;
      case 'api':
        return <ApiView />;
      case 'ia':
        return <IaView settings={settings} onChange={handleConfigChange} />;
      default:
        return (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración del Sistema</h1>
              <p className="text-gray-500">Bienvenido al panel de administración central. Aquí puedes configurar todos los parámetros críticos de la plataforma KOMET.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setActiveSubmodule(opt.id)}
                  className="group relative bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left overflow-hidden"
                >
                  <div className={`absolute top-0 right-0 w-24 h-24 ${opt.color} opacity-[0.03] rounded-bl-full group-hover:opacity-[0.08] transition-opacity`}></div>
                  <div className={`w-14 h-14 ${opt.color} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                    {opt.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{opt.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{opt.desc}</p>
                  <div className="mt-6 flex items-center text-xs font-bold text-blue-600 uppercase tracking-widest group-hover:gap-2 transition-all">
                    Configurar <span>→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="rounded-[2rem] bg-white border border-slate-200 px-8 py-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Sistema</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Panel de configuración</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">Gestiona usuarios, plantillas, envíos por Resend, integraciones API e inteligencia artificial desde un único lugar.</p>
              <p className={`mt-3 text-sm ${dbStatus === 'connected' ? 'text-emerald-700' : dbStatus === 'error' ? 'text-rose-700' : 'text-slate-500'}`}>{dbStatusMessage}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setActiveSubmodule(opt.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeSubmodule === opt.id ? 'bg-slate-900 text-white border border-slate-900' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  {opt.title}
                </button>
              ))}
            </div>
          </div>
        </header>

        {errorMessage && <Alert type="error" message={errorMessage} />}
        {statusMessage && <Alert type="success" message={statusMessage} />}

        <main className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

function UsuariosView({ users, loading, onCreate, onEdit, onDelete, query, setQuery, showUserForm, onCloseForm, onSubmit, formUser, setFormUser }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h2>
        <button
          onClick={onCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} /> Nuevo Usuario
        </button>
      </div>
      {showUserForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4">Crear nuevo usuario</h3>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <input
              type="text"
              value={formUser.full_name}
              onChange={(e) => setFormUser({ ...formUser, full_name: e.target.value })}
              placeholder="Nombre completo"
              className="border rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="email"
              value={formUser.email}
              onChange={(e) => setFormUser({ ...formUser, email: e.target.value })}
              placeholder="Correo electrónico"
              className="border rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={formUser.role}
              onChange={(e) => setFormUser({ ...formUser, role: e.target.value })}
              className="border rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option>Administrador</option>
              <option>Editor</option>
              <option>Lector</option>
            </select>
            <select
              value={formUser.status}
              onChange={(e) => setFormUser({ ...formUser, status: e.target.value })}
              className="border rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={onCloseForm} className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600">Cancelar</button>
              <button type="submit" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition">Guardar Usuario</button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-gray-500" />
            <p className="text-sm font-semibold text-gray-700">Usuarios registrados</p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar usuario"
              className="w-full pl-11 pr-4 py-2 rounded-full border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Usuario</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Rol</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Estado</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Último Acceso</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">Cargando usuarios...</td>
              </tr>
            ) : users.length ? (
              users.map((u, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{u.full_name}</span>
                      <span className="text-xs text-gray-400">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">{u.role}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${u.status === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">Hace 5 min</td>
                  <td className="px-6 py-4">
                    <button onClick={() => onEdit(u)} className="text-blue-600 hover:underline text-sm">Editar</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No se encontraron usuarios.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlantillasView({ emailTemplates, onChange, onSave, loading }) {
  const [selectedPreview, setSelectedPreview] = useState('student_completed_body');

  const previewData = {
    name: 'María Pérez',
    evaluation_link: 'https://komet.app/evaluacion/abc123',
  };

  const templateRows = [
    {
      key: 'student_completed_subject',
      label: 'Asunto - Estudiante completó encuesta',
      type: 'subject'
    },
    {
      key: 'student_completed_body',
      label: 'Cuerpo HTML - Estudiante completó encuesta',
      type: 'body'
    },
    {
      key: 'student_access_subject',
      label: 'Asunto - Acceso estudiante',
      type: 'subject'
    },
    {
      key: 'student_access_body',
      label: 'Cuerpo HTML - Acceso estudiante',
      type: 'body'
    },
    {
      key: 'professor_access_subject',
      label: 'Asunto - Acceso profesor',
      type: 'subject'
    },
    {
      key: 'professor_access_body',
      label: 'Cuerpo HTML - Acceso profesor',
      type: 'body'
    },
    {
      key: 'coordinator_access_subject',
      label: 'Asunto - Acceso coordinador',
      type: 'subject'
    },
    {
      key: 'coordinator_access_body',
      label: 'Cuerpo HTML - Acceso coordinador',
      type: 'body'
    },
  ];

  const getPreviewHtml = (html) => {
    if (!html) return '<div class="text-sm text-slate-500">Sin contenido para vista previa.</div>';
    return html
      .replace(/{{name}}/g, previewData.name)
      .replace(/{{evaluation_link}}/g, previewData.evaluation_link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Plantillas de Correo</h2>
          <p className="text-slate-500">Edita los asuntos y cuerpos de tus correos en HTML, luego guarda y revisa la vista previa.</p>
        </div>
        <button
          onClick={onSave}
          disabled={loading}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? 'Guardando...' : 'Guardar plantillas'}
        </button>
      </div>

      <div className="grid gap-6">
        {templateRows.map((row) => (
          <div key={row.key} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-semibold text-slate-900">{row.label}</h3>
              {row.type === 'body' && (
                <button
                  type="button"
                  onClick={() => setSelectedPreview(row.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${selectedPreview === row.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}`}
                >
                  Ver vista previa
                </button>
              )}
            </div>
            {row.type === 'subject' ? (
              <input
                value={emailTemplates[row.key] || ''}
                onChange={(e) => onChange(row.key, e.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Escribe el asunto aquí"
              />
            ) : (
              <div className="mt-3 space-y-3">
                <textarea
                  value={emailTemplates[row.key] || ''}
                  onChange={(e) => onChange(row.key, e.target.value)}
                  rows={10}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Escribe el contenido HTML aquí"
                />
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-3">Vista previa</p>
                  <div className="prose max-w-none text-slate-800" dangerouslySetInnerHTML={{ __html: getPreviewHtml(emailTemplates[row.key] || '') }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const ResendView = ({ settings, onChange, onSave, loading }) => (
  <div className="max-w-2xl space-y-8 animate-in slide-in-from-bottom-4 duration-500">
    <div>
      <h2 className="text-2xl font-bold text-gray-800">Configuración de Resend</h2>
      <p className="text-gray-500">Configura tu proveedor de correos transaccionales.</p>
    </div>
    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Key size={16} /> API Key de Resend
        </label>
        <input
          type="password"
          value={settings.resend_api_key}
          onChange={(e) => onChange('resend_api_key', e.target.value)}
          placeholder="re_123456789..."
          className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Database size={16} /> Correo Remitente
        </label>
        <input
          type="email"
          value={settings.resend_sender_email}
          onChange={(e) => onChange('resend_sender_email', e.target.value)}
          placeholder="no-reply@komet.com"
          className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
      </div>
      <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-xl text-sm border border-green-100">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        Conexión establecida correctamente con Resend.
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={loading}
        className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
      >
        <Save size={20} /> {loading ? 'Guardando...' : 'Guardar Configuración'}
      </button>
    </div>
  </div>
);

const ApiView = () => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-bold text-gray-800">Configuración de API</h2>
      <p className="text-gray-500 text-sm">Gestiona tus llaves de acceso y Webhooks del sistema.</p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Terminal size={20} className="text-blue-600"/> API Keys Activas</h3>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
              <div>
                <p className="text-sm font-mono font-medium">KOMET_LIVE_xxxx_xxxx</p>
                <p className="text-xs text-gray-400">Creada el: 15/09/2023</p>
              </div>
              <button className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><LogOut size={16}/></button>
            </div>
          ))}
          <button className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all text-sm font-medium">
            + Generar Nueva Key
          </button>
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Database size={20} className="text-purple-600"/> Webhooks</h3>
        <p className="text-sm text-gray-500 mb-4">Configura URLs para recibir eventos en tiempo real.</p>
        <div className="space-y-2">
          <input type="text" placeholder="https://mi-servidor.com/webhook" className="w-full p-2 border rounded-lg text-sm" />
          <button className="text-sm bg-purple-100 text-purple-700 px-4 py-2 rounded-lg font-medium">Añadir Endpoint</button>
        </div>
      </div>
    </div>
  </div>
);

const IaView = ({ settings, onChange }) => (
  <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
    <div className="flex items-center gap-2">
      <Bot className="text-indigo-600" size={28}/>
      <h2 className="text-2xl font-bold text-gray-800">Configuración de Inteligencia Artificial</h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Modelo Principal</label>
          <select
            value={settings.openrouter_model}
            onChange={(e) => onChange('openrouter_model', e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option>gpt-4o-mini</option>
            <option>gpt-4o</option>
            <option>claude-3.5</option>
            <option>gemini-1.5</option>
          </select>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Sliders size={16}/> Creatividad (Temperature)</label>
            <span className="text-indigo-600 font-bold">0.7</span>
          </div>
          <input type="range" className="w-full accent-indigo-600" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">System Prompt Base</label>
          <textarea
            value={settings.openrouter_system_prompt}
            onChange={(e) => onChange('openrouter_system_prompt', e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-32 text-sm"
            placeholder="Eres un asistente experto en la plataforma KOMET..."
          />
        </div>
      </div>
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-2xl text-white flex flex-col justify-between shadow-lg">
        <div>
          <h3 className="text-xl font-bold mb-2">Estado del Motor IA</h3>
          <p className="text-indigo-100 text-sm opacity-90">El motor de IA está optimizado y listo para procesar solicitudes de estudiantes y profesores.</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase tracking-wider font-bold">Consumo de Tokens</span>
            <span className="text-xs">82% mensual</span>
          </div>
          <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div className="bg-white h-full w-[82%]"></div>
          </div>
        </div>
        <button className="bg-white text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
          Recargar Créditos
        </button>
      </div>
    </div>
  </div>
);

function SidebarItem({ icon, label, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between w-full p-3 rounded-lg text-left transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
    </button>
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
