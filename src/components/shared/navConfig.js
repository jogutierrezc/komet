import {
  LayoutDashboard,
  School,
  Users,
  UserCheck,
  ClipboardCheck,
  BarChart3,
  LineChart,
  Presentation,
  Settings,
  CalendarRange,
} from 'lucide-react';

// Los ids son los mismos que usa App.jsx para elegir el módulo.
export const NAV_GROUPS = [
  { label: 'Hoy', items: [{ id: 'dashboard', label: 'Panel', icon: LayoutDashboard }] },
  {
    label: 'Gestión',
    items: [
      { id: 'convenios', label: 'Sitios de práctica', icon: School },
      { id: 'estudiantes', label: 'Estudiantes', icon: Users },
      { id: 'profesores', label: 'Profesores', icon: UserCheck },
    ],
  },
  {
    label: 'Evaluación',
    items: [
      { id: 'evaluaciones', label: 'Formularios', icon: ClipboardCheck },
      { id: 'periodos', label: 'Períodos', icon: CalendarRange },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { id: 'reportes', label: 'Informe', icon: BarChart3 },
      { id: 'estadistica', label: 'Estadística', icon: LineChart },
      { id: 'presenta', label: 'Komet Presenta', icon: Presentation },
    ],
  },
];

export const SYSTEM_ITEM = { id: 'sistema', label: 'Sistema', icon: Settings };

// Destinos de la barra inferior en móvil; el resto vive en "Más".
export const MOBILE_TABS = [
  { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
  { id: 'convenios', label: 'Sitios', icon: School },
  { id: 'evaluaciones', label: 'Evaluar', icon: ClipboardCheck },
  { id: 'estadistica', label: 'Análisis', icon: LineChart },
];

export const PAGE_TITLES = Object.fromEntries(
  [...NAV_GROUPS.flatMap((g) => g.items), SYSTEM_ITEM].map((i) => [i.id, i.label])
);
