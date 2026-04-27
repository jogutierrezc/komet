import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Send, 
  CheckCircle2, 
  Info, 
  FileText, 
  User, 
  Calendar,
  PenTool,
  GraduationCap,
  Building2,
  ShieldCheck,
  Layout,
  X
} from 'lucide-react';

export const sampleStudentInfo = {
  nombre: "Juan Camilo Pérez Sánchez",
  programaOrigen: "Enfermería - Facultad de Salud",
  escenario: "Hospital Universitario San José",
  periodo: "2026-A"
};

export const defaultSections = [
  {
    title: "Instrucciones Generales",
    type: "info",
    content: "A continuación encontrará una serie de preguntas donde puede expresar su opinión frente a ellas, señalando su grado de acuerdo o desacuerdo. Sistema de evaluación: 5: Totalmente de acuerdo, 4: De acuerdo, 3: Ni de acuerdo ni en desacuerdo, 2: En desacuerdo, 1: Totalmente en desacuerdo."
  },
  {
    title: "Infraestructura y Recursos",
    questions: [
      { id: 'q1', type: 'likert', label: 'Los recursos de bienestar (Lockers, áreas de descanso) son adecuados para el desarrollo de la práctica.', required: true },
      { id: 'q2', type: 'likert', label: 'El escenario de práctica cuenta con los insumos necesarios para la atención segura del paciente.', required: true },
    ]
  },
  {
    title: "Relación Docencia-Servicio",
    questions: [
      { id: 'q3', type: 'likert', label: 'El personal del escenario de práctica facilita los procesos de aprendizaje y participación activa.', required: true },
      { id: 'q4', type: 'text', label: 'Describa brevemente las fortalezas o aspectos a mejorar identificados en este escenario.', required: false },
    ]
  },
  {
    title: "Validación y Firma",
    questions: [
      { id: 'q5', type: 'signature', label: 'Firma del Estudiante', required: true },
    ]
  }
];

const normalizeSurveySections = (items = []) => {
  const sections = [];
  let currentSection = null;

  const mapQuestion = (question) => {
    const base = {
      id: question.id || String(Math.random()).slice(2),
      label: question.label || question.instrucciones || 'Pregunta',
      required: !!question.requerido
    };

    switch (question.tipo) {
      case 'yesno':
        return { ...base, type: 'yesno', options: ['Sí', 'No'] };
      case 'multiple':
        return { ...base, type: 'multiple', options: question.opciones || ['Opción 1', 'Opción 2'] };
      case 'number':
        return { ...base, type: 'number' };
      case 'date':
        return { ...base, type: 'date' };
      case 'rating':
        return { ...base, type: 'likert' };
      case 'photo':
        return { ...base, type: 'photo' };
      case 'signature':
        return { ...base, type: 'signature' };
      case 'instruction':
        return { ...base, type: 'info', content: question.instrucciones || question.label || '' };
      default:
        return { ...base, type: 'text' };
    }
  };

  items.forEach((item) => {
    if (item.tipo === 'section') {
      currentSection = {
        title: item.label || 'Sección',
        type: 'questions',
        questions: [],
        content: item.instrucciones || ''
      };
      sections.push(currentSection);
      return;
    }

    if (item.tipo === 'instruction') {
      sections.push({
        title: item.label || 'Instrucciones',
        type: 'info',
        content: item.instrucciones || item.label || ''
      });
      return;
    }

    const question = mapQuestion(item);
    if (!currentSection) {
      currentSection = { title: 'Preguntas', type: 'questions', questions: [] };
      sections.push(currentSection);
    }
    currentSection.questions.push(question);
  });

  return sections.length ? sections : defaultSections;
};

const isUuidString = (value = '') => {
  const trimmed = String(value).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
};

const parseSurveyMeta = (description = '') => ({
  periodo: (description.match(/Per[ií]odo:\s*([^·]+)/i)?.[1] || sampleStudentInfo.periodo).trim(),
  escenario: (description.match(/Escenario:\s*([^·]+)/i)?.[1] || '').trim()
});

export const buildEvaluationPreviewHtml = ({ studentInfo, sections, currentYear }) => {
  const renderQuestions = (section) => {
    if (section.type === 'info') {
      return `
        <div class="bg-blue-50/40 border border-blue-100 rounded-[2rem] p-8 md:p-10 mb-8">
          <div class="flex items-center gap-6 text-center md:text-left">
            <div class="bg-blue-600 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ring-4 ring-white">i</div>
            <div>
              <h3 class="text-blue-900 font-bold text-lg">Nota importante</h3>
              <p class="text-slate-700 text-base leading-relaxed font-medium">${section.content}</p>
              <div class="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-tighter mt-4">
                <div class="w-8 h-[2px] bg-blue-500"></div>
                Favor completar todos los campos obligatorios
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return section.questions.map((q, idx) => {
      if (q.type === 'likert') {
        const options = [1, 2, 3, 4, 5].map((val) => `
          <div class="relative flex flex-col items-center justify-center py-8 rounded-[2rem] border-2 bg-white border-slate-100 text-slate-400">
            <span class="text-3xl font-black mb-1">${val}</span>
            <span class="text-[10px] uppercase font-black tracking-tighter text-slate-300">${val === 1 ? 'Nunca' : val === 5 ? 'Siempre' : val === 3 ? 'Neutral' : ''}</span>
          </div>
        `).join('');

        return `
          <div class="mb-16">
            <div class="flex items-start gap-5 mb-8">
              <span class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 text-xs font-black">${idx + 1}</span>
              <label class="block text-slate-800 font-bold text-xl leading-tight">${q.label} ${q.required ? '<span class="text-blue-500 font-black">*</span>' : ''}</label>
            </div>
            <div class="grid grid-cols-5 gap-3 md:gap-6">${options}</div>
          </div>
        `;
      }

      if (q.type === 'text') {
        return `
          <div class="mb-16">
            <div class="flex items-start gap-5 mb-8">
              <span class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 text-xs font-black">${idx + 1}</span>
              <label class="block text-slate-800 font-bold text-xl leading-tight">${q.label} ${q.required ? '<span class="text-blue-500 font-black">*</span>' : ''}</label>
            </div>
            <textarea class="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-8 h-44 text-slate-700 placeholder-slate-300 font-medium text-lg" placeholder="Escriba aquí sus observaciones..."></textarea>
          </div>
        `;
      }

      if (q.type === 'signature') {
        return `
          <div class="mb-16">
            <div class="flex items-start gap-5 mb-8">
              <span class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 text-xs font-black">${idx + 1}</span>
              <label class="block text-slate-800 font-bold text-xl leading-tight">${q.label} ${q.required ? '<span class="text-blue-500 font-black">*</span>' : ''}</label>
            </div>
            <div class="border-2 border-dashed border-slate-200 rounded-[3rem] p-12 bg-slate-50 text-center">
              <div class="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-md">✍️</div>
              <h3 class="text-slate-800 font-extrabold text-xl mb-2">Firma del Estudiante</h3>
              <p class="text-sm font-medium text-slate-400 mb-10">Confirmo que la información suministrada es verídica</p>
              <div class="h-40 mt-4 border-b-2 border-slate-200 w-4/5 mx-auto flex items-end justify-center">
                <span class="text-[10px] text-slate-300 uppercase font-black tracking-[0.5em] pb-4">Espacio para firma</span>
              </div>
            </div>
          </div>
        `;
      }

      return '';
    }).join('');
  };

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Previsualización de Evaluación</title>
      <style>
        body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #111827; }
        .page { min-height: 100vh; padding: 32px; }
        .preview-card { max-width: 900px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 24px; padding: 28px; box-shadow: 0 24px 80px rgba(15,23,42,.08); }
        .header { margin-bottom: 24px; }
        .header h1 { margin: 0 0 8px; font-size: 28px; }
        .meta { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-top: 18px; }
        .meta span { display: block; font-size: 13px; color: #6b7280; }
        .meta strong { display: block; margin-top: 4px; color: #111827; }
        section { margin-bottom: 28px; }
        section h2 { margin-bottom: 10px; }
        .question { margin-bottom: 16px; }
        .question-title { font-weight: 700; margin-bottom: 12px; }
        .likert-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; }
        .likert-card { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; border-radius: 28px; border: 2px solid #e2e8f0; background: #ffffff; color: #64748b; }
        .likert-card span:first-child { font-size: 2rem; font-weight: 800; margin-bottom: 6px; }
        .textarea { width: 100%; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 28px; padding: 32px; min-height: 160px; font-size: 1rem; color: #111827; }
        .signature-card { border: 2px dashed #cbd5e1; border-radius: 48px; padding: 48px; background: #f8fafc; text-align: center; }
        .signature-card h3 { margin: 0 0 12px; font-size: 1.25rem; font-weight: 800; }
        .signature-placeholder { height: 160px; border-bottom: 2px solid #cbd5e1; width: 80%; margin: 0 auto; display: flex; align-items: flex-end; justify-content: center; color: #94a3b8; font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="preview-card">
          <div class="header">
            <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:18px;background:#0369a1;color:white;font-weight:700;">S</div>
              <div>
                <div style="display:flex;align-items:center;gap:8px;font-size:10px;font-weight:800;letter-spacing:.25em;text-transform:uppercase;color:#2563eb;">Formato de Calidad</div>
                <h1 style="font-size:1.75rem;font-weight:800;margin:8px 0 0;">Evaluación de Prácticas Formativas - Relación Docencia-Servicio</h1>
              </div>
            </div>
          </div>

          <div class="meta">
            <span>Estudiante<strong>${studentInfo.nombre}</strong></span>
            <span>Programa Académico<strong>${studentInfo.programaOrigen}</strong></span>
            <span>Escenario de Práctica<strong>${studentInfo.escenario}</strong></span>
            <span>Periodo Académico<strong>${studentInfo.periodo}</strong></span>
          </div>

          ${sections.map(section => `
            <section>
              <h2>${section.title}</h2>
              ${renderQuestions(section)}
            </section>
          `).join('')}
        </div>
      </div>
    </body>
    </html>
  `;
};

export default function EvaluacionesFormPreview({ onClose, studentInfo = sampleStudentInfo, survey = null }) {
  const sections = survey ? normalizeSurveySections(survey.questions || survey.preguntas || []) : defaultSections;
  const surveyMeta = survey ? parseSurveyMeta(survey.description || '') : {};
  const previewStudentInfo = {
    ...studentInfo,
    periodo: surveyMeta.periodo || studentInfo.periodo,
    escenario: surveyMeta.escenario && !isUuidString(surveyMeta.escenario)
      ? surveyMeta.escenario
      : studentInfo.escenario
  };
  const surveyTitle = survey?.title || 'Evaluación de Prácticas Formativas';
  const surveySubtitle = survey?.target_type ? survey.target_type : 'Relación Docencia-Servicio';

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [animate, setAnimate] = useState(true);

  const handleNext = () => {
    setAnimate(false);
    setTimeout(() => {
      setStep(prev => Math.min(prev + 1, sections.length - 1));
      setAnimate(true);
    }, 200);
  };

  const handleBack = () => {
    setAnimate(false);
    setTimeout(() => {
      setStep(prev => Math.max(prev - 1, 0));
      setAnimate(true);
    }, 200);
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
  };

  const progress = ((step + 1) / sections.length) * 100;

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-500 border border-slate-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Evaluación Exitosa!</h2>
          <p className="text-slate-500 mb-8">La información ha sido registrada correctamente en el sistema de Relación Docencia-Servicio.</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            Finalizar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl shadow-md shadow-blue-100">
                <ShieldCheck className="text-white w-7 h-7" />
              </div>
              <div className="h-10 w-[1px] bg-slate-200 hidden md:block"></div>
              <div>
                <div className="flex items-center gap-2">
                  <Layout className="w-3 h-3 text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Formato de Calidad</span>
                </div>
                <h1 className="text-sm md:text-base font-extrabold text-slate-800 leading-tight max-w-xs md:max-w-md">
                  {surveyTitle}
                </h1>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">
                  {surveySubtitle}
                </p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 p-3 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 p-3 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Progreso</span>
                <span className="text-sm font-black text-slate-700">Paso {step + 1} de {sections.length}</span>
              </div>
              <div className="relative w-12 h-12">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100" />
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * progress) / 100} className="text-blue-600 transition-all duration-700" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                  {Math.round(progress)}%
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full h-[2px] bg-slate-50">
          <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${progress}%` }}></div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 mt-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 mb-8 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative overflow-hidden group">
          <div className="flex items-start gap-3">
            <div className="bg-blue-50 p-2.5 rounded-2xl text-blue-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Estudiante</p>
              <p className="text-sm font-bold text-slate-800 leading-tight">{previewStudentInfo.nombre}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Programa Académico</p>
              <p className="text-sm font-bold text-slate-800 leading-tight">{previewStudentInfo.programaOrigen}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-emerald-50 p-2.5 rounded-2xl text-emerald-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Escenario de Práctica</p>
              <p className="text-sm font-bold text-slate-800 leading-tight">{previewStudentInfo.escenario}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-amber-50 p-2.5 rounded-2xl text-amber-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Periodo Académico</p>
              <p className="text-sm font-bold text-slate-800 leading-tight">{previewStudentInfo.periodo}</p>
            </div>
          </div>
        </div>

        <div className={`transition-all duration-300 transform ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/30 overflow-hidden">
            <div className="bg-slate-900 px-8 py-6 flex items-center gap-4">
              <div className="bg-blue-600 p-2 rounded-xl">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold tracking-tight text-lg">{sections[step].title}</h2>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-0.5">Sección {step + 1}</p>
              </div>
            </div>

            <div className="p-8 md:p-14">
              {sections[step].type === 'info' ? (
                <div className="bg-blue-50/40 border border-blue-100 rounded-[2rem] p-8 md:p-10 relative overflow-hidden">
                  <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                    <div className="bg-blue-600 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-200 ring-4 ring-white">
                      <Info className="w-7 h-7 text-white" />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-blue-900 font-bold text-lg">Nota importante</h3>
                      <p className="text-slate-700 text-base leading-relaxed font-medium">
                        {sections[step].content}
                      </p>
                      <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-tighter">
                        <div className="w-8 h-[2px] bg-blue-500"></div>
                        Favor completar todos los campos obligatorios
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-16">
                  {sections[step].questions.map((q, idx) => (
                    <div key={q.id} className="animate-in fade-in slide-in-from-bottom-6 duration-700" style={{ animationDelay: `${idx * 150}ms` }}>
                      <div className="flex items-start gap-5 mb-8">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 text-xs font-black shrink-0">
                          {idx + 1}
                        </span>
                        <label className="block text-slate-800 font-bold text-xl leading-tight">
                          {q.label} {q.required && <span className="text-blue-500 font-black">*</span>}
                        </label>
                      </div>

                      {q.type === 'likert' && (
                        <div className="grid grid-cols-5 gap-3 md:gap-6">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setFormData({ ...formData, [q.id]: val })}
                              className={`relative flex flex-col items-center justify-center py-8 rounded-[2rem] border-2 transition-all duration-300 ${formData[q.id] === val ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-300 -translate-y-2' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:bg-slate-50 active:scale-95'}`}
                            >
                              <span className="text-3xl font-black mb-1">{val}</span>
                              <span className={`text-[10px] uppercase font-black tracking-tighter ${formData[q.id] === val ? 'text-blue-100' : 'text-slate-300'}`}>
                                {val === 1 ? 'Nunca' : val === 5 ? 'Siempre' : val === 3 ? 'Neutral' : ''}
                              </span>
                              {formData[q.id] === val && (
                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      {q.type === 'yesno' && (
                        <div className="grid grid-cols-2 gap-4">
                          {['Sí', 'No'].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setFormData({ ...formData, [q.id]: option })}
                              className={`py-6 rounded-[2rem] border-2 transition-all duration-300 ${formData[q.id] === option ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      {q.type === 'multiple' && (
                        <div className="grid grid-cols-1 gap-3">
                          {(q.options || []).map((option, index) => (
                            <button
                              key={`${q.id}-${index}`}
                              type="button"
                              onClick={() => setFormData({ ...formData, [q.id]: option })}
                              className={`w-full text-left px-6 py-5 rounded-[2rem] border-2 transition-all duration-300 ${formData[q.id] === option ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      {q.type === 'number' && (
                        <input
                          type="number"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-5 text-slate-700 placeholder-slate-300 font-medium text-lg"
                          placeholder="Ingrese un número"
                          value={formData[q.id] || ''}
                          onChange={(e) => setFormData({ ...formData, [q.id]: e.target.value })}
                        />
                      )}

                      {q.type === 'date' && (
                        <input
                          type="date"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-5 text-slate-700 font-medium text-lg"
                          value={formData[q.id] || ''}
                          onChange={(e) => setFormData({ ...formData, [q.id]: e.target.value })}
                        />
                      )}

                      {q.type === 'text' && (
                        <textarea 
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-8 focus:ring-8 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all h-44 text-slate-700 placeholder-slate-300 font-medium text-lg"
                          placeholder="Escriba aquí sus observaciones..."
                          onChange={(e) => setFormData({ ...formData, [q.id]: e.target.value })}
                        />
                      )}

                      {q.type === 'photo' && (
                        <div className="border-2 border-dashed border-slate-200 rounded-[3rem] p-12 bg-slate-50 text-center">
                          <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-md">
                            <span className="text-3xl">📷</span>
                          </div>
                          <p className="text-slate-500 text-sm">Adjunte una fotografía relacionada con la evaluación.</p>
                        </div>
                      )}

                      {q.type === 'signature' && (
                        <div className="border-2 border-dashed border-slate-200 rounded-[3rem] p-12 bg-slate-50 text-center group cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all duration-500">
                          <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                            <PenTool className="w-10 h-10 text-blue-500" />
                          </div>
                          <h3 className="text-slate-800 font-extrabold text-xl mb-2">Firma del Estudiante</h3>
                          <p className="text-sm font-medium text-slate-400 mb-10">Confirmo que la información suministrada es verídica</p>
                          <div className="h-40 mt-4 border-b-2 border-slate-200 w-4/5 mx-auto flex items-end justify-center group-hover:border-blue-300 transition-colors">
                            <span className="text-[10px] text-slate-300 uppercase font-black tracking-[0.5em] pb-4">Espacio para firma</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-12 gap-8">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className={`flex items-center gap-3 px-10 py-5 rounded-2xl font-black transition-all ${step === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-800'}`}
          >
            <ChevronLeft className="w-6 h-6" />
            ANTERIOR
          </button>

          {step === sections.length - 1 ? (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-4 px-12 py-5 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 hover:shadow-blue-400 active:scale-95 uppercase tracking-widest"
            >
              Finalizar Envío
              <Send className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-4 px-12 py-5 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all shadow-2xl shadow-slate-300 hover:shadow-slate-500 active:scale-95 uppercase tracking-widest"
            >
              Siguiente
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-4 mt-24 text-center border-t border-slate-200 pt-12">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-slate-900 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
            Control de Calidad Académica
          </div>
          <p className="text-slate-400 text-xs leading-relaxed max-w-lg mx-auto font-medium">
            Este documento digital forma parte del proceso de mejora institucional. Toda la información es tratada bajo estrictas normas de protección de datos personales.
          </p>
        </div>
      </footer>
    </div>
  );
}
