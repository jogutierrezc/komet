import { useState } from 'react';
import { 
  ClipboardCheck, Rocket, Pencil, Plus, ChevronRight, Settings2, X, 
  CheckSquare, Type, ListTodo, Hash, Calendar, AlertCircle,
  Star, Camera, PenTool, FileText, ArrowRightCircle, Trash2
} from 'lucide-react';
import { MOCK_CENTERS } from '../constants/mockData';

export default function Evaluaciones() {
  const [view, setView] = useState('list');
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const currentYear = new Date().getFullYear();

  const [evaluations, setEvaluations] = useState([
    {
      id: 1,
      titulo: "Evaluación de Desempeño Clínico",
      campus: "Bucaramanga",
      dirigidoA: "Estudiante",
      responde: "Tutor",
      preguntas: [],
      estado: 'activo'
    }
  ]);

  const [newEval, setNewEval] = useState({
    titulo: 'Nueva Evaluación',
    campus: 'Bucaramanga',
    actor: 'Estudiante',
    tipoPrograma: 'Pregrado',
    escenarioPractica: MOCK_CENTERS[0]?.name || '',
    periodoCorte: 'A',
    preguntas: []
  });

  const createId = () => Math.random().toString(36).slice(2, 11);

  const createSectionObject = (sectionName) => ({
    id: createId(),
    tipo: 'section',
    label: sectionName,
    instrucciones: '',
    requerido: false,
    opciones: ['5', '4', '3', '2', '1'],
    logic: { active: false, whenValue: 'Sí', dependentId: null },
    parentId: null,
    sectionId: null
  });

  const addSection = () => {
    const sectionCount = newEval.preguntas.filter(q => q.tipo === 'section').length;
    const section = createSectionObject(`SECCIÓN ${sectionCount + 1}`);

    setNewEval(prev => ({
      ...prev,
      preguntas: [...prev.preguntas, section]
    }));

    setSelectedSectionId(section.id);
    setSelectedQuestionId(section.id);
  };

  const addQuestion = (type, parentId = null) => {
    let createdQuestionId = null;
    let resolvedSectionId = selectedSectionId;

    const newQuestion = {
      id: createId(),
      tipo: type,
      label: type === 'instruction' ? 'Bloque de instrucciones' : `Nueva pregunta de ${type}`,
      instrucciones: '',
      requerido: false,
      opciones: ['Sí', 'No'],
      logic: { active: false, whenValue: 'Sí', dependentId: null },
      parentId: parentId,
      sectionId: null
    };

    setNewEval(prev => {
      let questions = [...prev.preguntas];

      const selectedSectionIsValid = resolvedSectionId && questions.some(q => q.id === resolvedSectionId && q.tipo === 'section');
      if (!selectedSectionIsValid) {
        const firstSection = questions.find(q => q.tipo === 'section');
        if (firstSection) {
          resolvedSectionId = firstSection.id;
        } else {
          const autoSection = createSectionObject('SECCIÓN 1');
          questions.push(autoSection);
          resolvedSectionId = autoSection.id;
        }
      }

      const questionWithSection = {
        ...newQuestion,
        sectionId: resolvedSectionId
      };

      createdQuestionId = questionWithSection.id;

      if (parentId) {
        return {
          ...prev,
          preguntas: questions.map(q =>
            q.id === parentId ? { ...q, logic: { ...q.logic, dependentId: questionWithSection.id } } : q
          ).concat(questionWithSection)
        };
      }

      return {
        ...prev,
        preguntas: [...questions, questionWithSection]
      };
    });

    setSelectedSectionId(resolvedSectionId);
    if (createdQuestionId) {
      setSelectedQuestionId(createdQuestionId);
    }
  };

  const updateQuestion = (id, field, value) => {
    setNewEval(prev => ({
      ...prev,
      preguntas: prev.preguntas.map(q => q.id === id ? { ...q, [field]: value } : q)
    }));
  };

  const selectedQuestion = newEval.preguntas.find(q => q.id === selectedQuestionId);
  const sections = newEval.preguntas.filter(q => q.tipo === 'section');

  if (view === 'list') {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Formularios de Evaluación</h1>
            <p className="text-gray-500 text-sm mt-1">Crea y gestiona cuestionarios de evaluación personalizados.</p>
          </div>
          <button 
            onClick={() => setView('create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            Nuevo Cuestionario
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {evaluations.map(e => (
            <div 
              key={e.id} 
              onClick={() => setView('create')}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex justify-between mb-4">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg"><ClipboardCheck size={20}/></div>
                <Pencil size={16} className="text-gray-300 group-hover:text-gray-600" />
              </div>
              <h3 className="font-bold text-gray-800">{e.titulo}</h3>
              <p className="text-xs text-gray-400 mt-1 uppercase tracking-tighter">Campus: {e.campus || 'Bucaramanga'}</p>
              <p className="text-xs text-gray-400 mt-1 uppercase tracking-tighter">Dirigido a: {e.dirigidoA}</p>
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">ACTIVO</span>
                <button className="text-blue-600 text-xs font-bold hover:underline">Editar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* TOP SUB-HEADER */}
      <div className="h-14 bg-gray-50 border-b flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView('list')}
            className="text-xs uppercase font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ChevronRight className="rotate-180 w-4 h-4" /> Volver
          </button>
          <div className="h-4 w-px bg-gray-200 mx-2"></div>
          <h2 className="font-bold text-sm tracking-wide text-gray-700">{newEval.titulo}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-gray-200 hover:bg-gray-300 px-4 py-1.5 rounded text-xs font-bold transition-all text-gray-700">Previsualizar</button>
          <button 
            onClick={() => setView('list')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-1.5 rounded text-xs font-bold transition-all text-white shadow-lg shadow-blue-500/20"
          >
            Guardar
          </button>
        </div>
      </div>

      {/* MAIN BUILDER */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: COMPONENTS */}
        <aside className="w-64 bg-white border-r overflow-y-auto p-4 shrink-0 flex flex-col gap-6">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Estructura</h4>
            <CompGroup>
              <ToolBtn icon={<FileText size={14}/>} label="Sección" onClick={addSection} />
              <ToolBtn icon={<AlertCircle size={14}/>} label="Instrucción" onClick={() => addQuestion('instruction')} />
            </CompGroup>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Preguntas</h4>
            <CompGroup>
              <ToolBtn icon={<CheckSquare size={14}/>} label="Sí/No" onClick={() => addQuestion('yesno')} />
              <ToolBtn icon={<Type size={14}/>} label="Texto" onClick={() => addQuestion('text')} />
              <ToolBtn icon={<ListTodo size={14}/>} label="Múltiple" onClick={() => addQuestion('multiple')} />
              <ToolBtn icon={<Hash size={14}/>} label="Número" onClick={() => addQuestion('number')} />
              <ToolBtn icon={<Calendar size={14}/>} label="Fecha" onClick={() => addQuestion('date')} />
              <ToolBtn icon={<Star size={14}/>} label="Ranking" onClick={() => addQuestion('rating')} />
            </CompGroup>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Media</h4>
            <CompGroup>
              <ToolBtn icon={<Camera size={14}/>} label="Foto" onClick={() => addQuestion('photo')} />
              <ToolBtn icon={<PenTool size={14}/>} label="Firma" onClick={() => addQuestion('signature')} />
            </CompGroup>
          </div>
        </aside>

        {/* CENTER: CANVAS */}
        <div className="flex-1 bg-gray-100 overflow-y-auto p-8 flex justify-center">
          <div className="w-full max-w-2xl flex flex-col gap-4">
            {/* Form Meta */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-4">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre de la Evaluación</label>
                  <input 
                    className="w-full border-b border-gray-200 py-2 outline-none focus:border-blue-500 font-bold text-gray-800" 
                    value={newEval.titulo} 
                    onChange={e => setNewEval({...newEval, titulo: e.target.value})} 
                  />
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 border-b border-gray-200">
                    <div className="col-span-3 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">Actor:</div>
                    <div className="col-span-9 px-3 py-1.5">
                      <select
                        className="w-full text-sm bg-white text-gray-700 outline-none"
                        value={newEval.actor}
                        onChange={e => setNewEval({ ...newEval, actor: e.target.value })}
                      >
                        <option value="Estudiante">Estudiante</option>
                        <option value="Coordinador">Coordinador</option>
                        <option value="Profesor">Profesor</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 border-b border-gray-200">
                    <div className="col-span-3 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">Tipo de Programa:</div>
                    <div className="col-span-9 px-3 py-1.5">
                      <select
                        className="w-full text-sm bg-white text-gray-700 outline-none"
                        value={newEval.tipoPrograma}
                        onChange={e => setNewEval({ ...newEval, tipoPrograma: e.target.value })}
                      >
                        <option value="Técnico">Técnico</option>
                        <option value="Pregrado">Pregrado</option>
                        <option value="Posgrado">Posgrado</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 border-b border-gray-200">
                    <div className="col-span-3 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">Escenario de Práctica:</div>
                    <div className="col-span-9 px-3 py-1.5">
                      <select
                        className="w-full text-sm bg-white text-gray-700 outline-none"
                        value={newEval.escenarioPractica}
                        onChange={e => setNewEval({ ...newEval, escenarioPractica: e.target.value })}
                      >
                        {MOCK_CENTERS.map((center) => (
                          <option key={center.id} value={center.name}>
                            {center.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-12">
                    <div className="col-span-3 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">Período Académico:</div>
                    <div className="col-span-9 px-3 py-1.5 flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={1}
                        className="w-12 border border-gray-200 rounded px-2 py-1 text-sm font-bold uppercase text-center"
                        value={newEval.periodoCorte}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          if (value === '' || value === 'A' || value === 'B') {
                            setNewEval({ ...newEval, periodoCorte: value });
                          }
                        }}
                        placeholder="A"
                      />
                      <span className="text-sm font-semibold text-gray-700">- {currentYear}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Questions List */}
            {sections.map((section, sIdx) => {
              const sectionQuestions = newEval.preguntas.filter(
                q => q.tipo !== 'section' && q.sectionId === section.id && !q.parentId
              );

              return (
                <div key={section.id} className="space-y-3">
                  <SectionHeader
                    section={section}
                    selected={selectedQuestionId === section.id}
                    index={sIdx + 1}
                    onClick={() => {
                      setSelectedSectionId(section.id);
                      setSelectedQuestionId(section.id);
                    }}
                  />

                  {sectionQuestions.map((q, idx) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      index={`${sIdx + 1}.${idx + 1}`}
                      selected={selectedQuestionId === q.id}
                      onClick={() => {
                        setSelectedSectionId(section.id);
                        setSelectedQuestionId(q.id);
                      }}
                      allQuestions={newEval.preguntas}
                      addDependent={(parentId) => addQuestion('yesno', parentId)}
                    />
                  ))}

                  <button
                    onClick={() => {
                      setSelectedSectionId(section.id);
                      addQuestion('yesno');
                    }}
                    className="w-full border border-dashed border-blue-200 rounded-xl py-2 text-[11px] font-bold text-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    + Agregar pregunta en esta sección
                  </button>
                </div>
              );
            })}

            {sections.length === 0 && (
              <div className="border-2 border-dashed border-blue-200 rounded-2xl py-10 px-6 text-center bg-blue-50/60 text-blue-700">
                <p className="text-sm font-bold">Primero agrega una sección</p>
                <p className="text-xs mt-1">Ejemplo: ASPECTOS GENERALES, CAPACIDAD INSTALADA, SEGURIDAD...</p>
              </div>
            )}

            {/* Drop Zone Placeholder */}
            <div className="border-2 border-dashed border-gray-300 rounded-2xl py-12 flex flex-col items-center justify-center text-gray-400">
              <Plus size={32} className="mb-2" />
              <p className="text-sm font-medium">Agregar preguntas desde el panel izquierdo</p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: PROPERTIES */}
        <aside className="w-72 bg-white border-l overflow-y-auto p-6 shrink-0">
          {selectedQuestion ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="font-bold text-sm flex items-center gap-2"><Settings2 size={16}/> Propiedades</h3>
                <button onClick={() => setSelectedQuestionId(null)}><X size={16} className="text-gray-400"/></button>
              </div>

              <div className="space-y-4">
                <PropField label={selectedQuestion.tipo === 'section' ? 'Título de Sección' : 'Etiqueta de Pregunta'}>
                  <input 
                    className="w-full border border-gray-200 rounded-2xl p-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" 
                    value={selectedQuestion.label}
                    onChange={e => updateQuestion(selectedQuestionId, 'label', e.target.value)}
                  />
                </PropField>

                {selectedQuestion.tipo !== 'section' && selectedQuestion.tipo !== 'instruction' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded"
                      checked={selectedQuestion.requerido}
                      onChange={e => updateQuestion(selectedQuestionId, 'requerido', e.target.checked)}
                    />
                    <span className="text-xs font-bold text-gray-600">Requerido</span>
                  </label>
                )}

                <PropField label="Instrucciones">
                  <textarea 
                    className="w-full border border-gray-200 rounded-2xl p-2 text-sm h-20 outline-none" 
                    placeholder="Ej: Adjunte evidencia..."
                    value={selectedQuestion.instrucciones}
                    onChange={e => updateQuestion(selectedQuestionId, 'instrucciones', e.target.value)}
                  />
                </PropField>

                {selectedQuestion.tipo !== 'section' && selectedQuestion.tipo !== 'instruction' && (
                  <div className="pt-6 border-t">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Lógica Condicional</h4>
                    <label className="flex items-center gap-2 cursor-pointer mb-4">
                      <input 
                        type="checkbox" 
                        className="rounded"
                        checked={selectedQuestion.logic.active}
                        onChange={e => updateQuestion(selectedQuestionId, 'logic', { ...selectedQuestion.logic, active: e.target.checked })}
                      />
                      <span className="text-xs font-bold text-blue-600">Agregar Pregunta Dependiente</span>
                    </label>

                    {selectedQuestion.logic.active && (
                      <div className="bg-blue-50 p-4 rounded-2xl space-y-3 border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-800 uppercase">Mostrar si respuesta es:</p>
                        <div className="flex items-center gap-2 text-xs">
                          <select 
                            className="flex-1 bg-white border border-blue-200 rounded-lg p-2 text-gray-700"
                            value={selectedQuestion.logic.whenValue}
                            onChange={e => updateQuestion(selectedQuestionId, 'logic', { ...selectedQuestion.logic, whenValue: e.target.value })}
                          >
                            {selectedQuestion.opciones.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <button 
                          onClick={() => addQuestion('yesno', selectedQuestion.id)}
                          className="w-full bg-white border border-blue-200 text-blue-600 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-colors"
                        >
                          Crear Pregunta Activador
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 text-center px-4">
              <Settings2 size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-medium italic">Selecciona una pregunta para editar</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

const CompGroup = ({ children }) => <div className="grid grid-cols-2 gap-2">{children}</div>;

const ToolBtn = ({ icon, label, onClick }) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-white hover:border-blue-300 hover:shadow-sm transition-all text-gray-600 active:scale-95"
  >
    <div className="mb-1 text-gray-400 hover:text-blue-500">{icon}</div>
    <span className="text-[10px] font-bold tracking-tighter whitespace-nowrap">{label}</span>
  </button>
);

const SectionHeader = ({ section, selected, index, onClick }) => (
  <div
    onClick={onClick}
    className={`rounded-xl border cursor-pointer transition-all overflow-hidden ${selected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-blue-300'}`}
  >
    <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between">
      <h4 className="text-xs font-black uppercase tracking-wide">{index}. {section.label}</h4>
      <div className="flex items-center gap-2 text-[11px] font-bold">
        <span>5</span>
        <span>4</span>
        <span>3</span>
        <span>2</span>
        <span>1</span>
      </div>
    </div>
    {section.instrucciones && (
      <div className="px-4 py-2 text-xs text-gray-500 bg-white border-t">
        {section.instrucciones}
      </div>
    )}
  </div>
);

const QuestionCard = ({ question, index, selected, onClick, allQuestions, addDependent }) => {
  const children = allQuestions.filter(q => q.parentId === question.id);

  return (
    <div className="space-y-2">
      <div 
        onClick={onClick}
        className={`bg-white rounded-2xl border-2 transition-all cursor-pointer p-6 relative group ${selected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={14} className="text-gray-300 hover:text-red-500 cursor-pointer" />
        </div>
        
        <div className="flex gap-4">
          <span className="text-xs font-bold text-gray-300 mt-1">{index}.</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {getIcon(question.tipo)}
              <h4 className="font-bold text-gray-700 text-sm">{question.label}</h4>
              {question.requerido && <span className="text-red-500">*</span>}
            </div>
            {question.instrucciones && <p className="text-xs text-gray-400 italic mb-4">{question.instrucciones}</p>}
            
            <div className="pt-2">
              {question.tipo === 'yesno' && (
                <div className="flex gap-4">
                  <div className="px-4 py-1.5 border border-gray-200 rounded-full text-xs text-gray-400 flex items-center gap-2"><CheckSquare size={12}/> Sí</div>
                  <div className="px-4 py-1.5 border border-gray-200 rounded-full text-xs text-gray-400 flex items-center gap-2"><X size={12}/> No</div>
                </div>
              )}
              {question.tipo === 'text' && <div className="w-full border-b border-dashed border-gray-300 py-2"></div>}
              {question.tipo === 'instruction' && <p className="text-xs text-gray-500 italic">{question.instrucciones || 'Texto de apoyo para el evaluador.'}</p>}
              {question.tipo === 'photo' && <div className="flex items-center gap-2 text-xs text-gray-400"><Camera size={14}/> Foto</div>}
              {question.tipo === 'signature' && <div className="flex items-center gap-2 text-xs text-gray-400"><PenTool size={14}/> Firma</div>}
            </div>
          </div>
        </div>

        {question.logic.active && (
          <div className="mt-6 border-l-4 border-blue-100 bg-gray-50 p-4 rounded-r-2xl">
            <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase mb-3">
              <ArrowRightCircle size={14} /> Si la respuesta es "{question.logic.whenValue}"
            </div>
            {children.length > 0 ? (
              <div className="space-y-3">
                {children.map((child, cIdx) => (
                  <QuestionCard
                    key={child.id}
                    question={child}
                    index={`${index}.${cIdx+1}`}
                    selected={false}
                    onClick={() => {}}
                    allQuestions={allQuestions}
                    addDependent={addDependent}
                  />
                ))}
              </div>
            ) : (
              <div 
                onClick={(e) => { e.stopPropagation(); addDependent(question.id); }}
                className="border-2 border-dashed border-blue-200 rounded-lg p-4 text-center text-[10px] text-blue-400 font-bold uppercase hover:bg-blue-100 transition-all cursor-pointer"
              >
                Agregar pregunta dependiente
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const PropField = ({ label, children }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

const getIcon = (type) => {
  const icons = {
    instruction: <AlertCircle size={16} className="text-indigo-500" />,
    yesno: <CheckSquare size={16} className="text-blue-500" />,
    text: <Type size={16} className="text-gray-400" />,
    multiple: <ListTodo size={16} className="text-purple-500" />,
    number: <Hash size={16} className="text-orange-500" />,
    date: <Calendar size={16} className="text-teal-500" />,
    rating: <Star size={16} className="text-yellow-500" />,
    photo: <Camera size={16} className="text-emerald-500" />,
    signature: <PenTool size={16} className="text-pink-500" />
  };
  return icons[type] || <FileText size={16} className="text-gray-400" />;
};
