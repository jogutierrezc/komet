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

export const MOCK_SURVEYS = [
  { id: 'S1', title: 'Evaluación de Desempeño Estudiante', target: 'Institución' },
  { id: 'S2', title: 'Evaluación de Tutoría Docente', target: 'Estudiante' },
  { id: 'S3', title: 'Encuesta de Satisfacción Centro', target: 'Coordinador' },
];
