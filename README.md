# Komet - Portal de Gestión de Encuestas

Komet es una herramienta moderna para generar encuestas basadas en sitios de práctica de la Universidad de Santander (UDES). Proporciona un panel administrativo intuitivo para gestionar convenios, estudiantes, profesores, evaluaciones y reportes.

## 🚀 Características

- **Dashboard Intuitivo**: Visualización de métricas clave en tiempo real
- **Gestión de Convenios**: Administra los acuerdos de práctica con instituciones
- **Gestión de Estudiantes**: Seguimiento de estudiantes en programas de práctica
- **Gestión de Tutores**: Control de docentes evaluadores
- **Generador de Encuestas**: Crear y distribuir evaluaciones con enlaces seguros
- **Sistema de Reportes**: Análisis detallado de evaluaciones
- **Configuración de Sistema**: Parámetros globales de Komet

## 📁 Estructura del Proyecto

```
komet/
├── src/
│   ├── components/
│   │   ├── shared/
│   │   │   ├── Sidebar.jsx          # Componente de sidebar
│   │   │   ├── Topbar.jsx           # Barra superior
│   │   │   ├── SidebarItem.jsx      # Elemento de navegación
│   │   │   └── StatusBadge.jsx      # Badge de estado
│   │   ├── Dashboard.jsx            # Panel principal
│   │   ├── Convenios.jsx            # Módulo de convenios
│   │   ├── Estudiantes.jsx          # Módulo de estudiantes
│   │   ├── Profesores.jsx           # Módulo de tutores
│   │   ├── Evaluaciones.jsx         # Generador de encuestas
│   │   ├── Reportes.jsx             # Módulo de reportes
│   │   └── Sistema.jsx              # Configuración del sistema
│   ├── constants/
│   │   └── mockData.js              # Datos de demostración
│   ├── App.jsx                      # Componente principal
│   ├── main.jsx                     # Punto de entrada
│   └── index.css                    # Estilos globales
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 🛠️ Instalación

### Requisitos previos
- Node.js 16+ 
- npm o yarn

### Pasos

1. **Clonar o descargar el proyecto**
```bash
cd komet
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Ejecutar en modo desarrollo**
```bash
npm run dev
```

El proyecto se abrirá automáticamente en `http://localhost:3000`

## 📦 Dependencias Principales

- **React 18.2**: Framework de interfaz de usuario
- **Vite 5.0**: Herramienta de construcción y desarrollo
- **Tailwind CSS 3.4**: Framework de estilos
- **Lucide React**: Iconos SVG de alta calidad

## 🎨 Módulos Implementados

### ✅ Dashboard
Panel de control principal con métricas de:
- Convenios activos
- Estudiantes en práctica
- Satisfacción global
- Flujo de evaluaciones recientes
- Sistema de alertas

### 💼 Evaluaciones
Generador de enlaces para encuestas con:
- Selección de tipo de cuestionario
- Configuración de población objetivo
- Generación segura de URLs únicas
- Copiar al portapapeles

### 🔄 Módulos en Desarrollo
- Convenios
- Estudiantes
- Tutores/Profesores
- Reportes
- Sistema (Configuración)

## 🎯 Próximos Pasos

1. Implementar las páginas de los módulos pendientes
2. Conectar con backend API
3. Autenticación y autorización
4. Sistema de notificaciones
5. Exportación de reportes (PDF, Excel)
6. Internacionalización (i18n)

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor de desarrollo

# Producción
npm run build        # Construye para producción
npm run preview      # Preview de la construcción

# Análisis
npm run lint         # Ejecuta ESLint
```

## 📝 Notas de Desarrollo

- Los componentes están organizados por funcionalidad
- Se utilizan componentes compartidos reutilizables
- Los datos se simulan con `mockData.js`
- El diseño es completamente responsive
- Se utiliza Tailwind CSS para estilos

## 👥 Contribuciones

Para contribuir al proyecto:
1. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
2. Commit tus cambios (`git commit -m 'Add AmazingFeature'`)
3. Push a la rama (`git push origin feature/AmazingFeature`)
4. Abre un Pull Request

## 📄 Licencia

Este proyecto es propiedad de la Universidad de Santander (UDES).

## 📞 Soporte

Para soporte o consultas, contacta con el equipo de desarrollo de Komet.
