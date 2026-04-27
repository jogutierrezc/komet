// Mock Data Actualizada (Komet / UDES Context)
export const MOCK_CENTERS = [
  { id: 1, name: 'Hospital Universitario de Santander', type: 'Salud', city: 'Bucaramanga', status: 'Activo', convenio: 'C-2024-001' },
  { id: 2, name: 'Clínica Chicamocha', type: 'Salud', city: 'Bucaramanga', status: 'Activo', convenio: 'C-2024-015' },
  { id: 3, name: 'Alcaldía de Bucaramanga', type: 'Administrativo', city: 'Bucaramanga', status: 'En Proceso', convenio: 'C-2024-022' },
];

export const MOCK_RECENT_EVALS = [
  { id: 1, name: 'James Carter', program: 'Medicina', center: 'HUS', status: 'Completed', score: '4.8/5', date: 'Hoy' },
  { id: 2, name: 'Michael Thompson', program: 'Derecho', center: 'Alcaldía', status: 'In Process', score: '-', date: 'Ayer' },
  { id: 3, name: 'Daniel Rivera', program: 'Enfermería', center: 'Clínica Chicamocha', status: 'On Hold', score: '-', date: '24 May' },
  { id: 4, name: 'Robert Bennett', program: 'Psicología', center: 'HUS', status: 'Completed', score: '4.5/5', date: '23 May' },
];

export const MOCK_STUDENTS = [
  { id: 'ST-001', name: 'Ana Morales', program: 'Medicina', center: 'Hospital Universitario de Santander', status: 'En Práctica', started: '05 Mar 2026' },
  { id: 'ST-002', name: 'Camila Rojas', program: 'Enfermería', center: 'Clínica Chicamocha', status: 'Activo', started: '12 Feb 2026' },
  { id: 'ST-003', name: 'Juan Pérez', program: 'Derecho', center: 'Alcaldía de Bucaramanga', status: 'En Práctica', started: '28 Ene 2026' },
  { id: 'ST-004', name: 'Laura Sánchez', program: 'Psicología', center: 'Hospital Universitario de Santander', status: 'Activo', started: '02 Abr 2026' },
];

export const MOCK_PROFESSORS = [
  { id: 'PR-001', name: 'Dra. Laura Torres', department: 'Enfermería', role: 'Tutor', evaluations: 12, status: 'Activo' },
  { id: 'PR-002', name: 'Mtro. Carlos Ramos', department: 'Medicina', role: 'Profesor', evaluations: 8, status: 'Activo' },
  { id: 'PR-003', name: 'Dra. Natalia Vega', department: 'Psicología', role: 'Tutor', evaluations: 15, status: 'Activo' },
  { id: 'PR-004', name: 'Mtra. Sandra Huertas', department: 'Derecho', role: 'Profesor', evaluations: 5, status: 'Inactivo' },
];

export const MOCK_SURVEYS = [
  { id: 'S1', title: 'Evaluación de Desempeño Estudiante', target: 'Institución' },
  { id: 'S2', title: 'Evaluación de Tutoría Docente', target: 'Estudiante' },
  { id: 'S3', title: 'Encuesta de Satisfacción Centro', target: 'Coordinador' },
];
