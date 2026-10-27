import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import { isAuthenticated, logout } from './auth/auth';

// Cada pantalla se descarga solo cuando se visita: quien responde un enlace público no baja el panel administrativo.
const App = lazy(() => import('./App'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PublicEvaluationPortal = lazy(() => import('./pages/PublicEvaluationPortal'));

function ProtectedAppShell() {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return <App onLogout={handleLogout} />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" role="status" aria-label="Cargando" />}>
    <Routes>
      <Route path="/login" element={isAuthenticated() ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/evaluacion-publica" element={<PublicEvaluationPortal />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <ProtectedAppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
    </Suspense>
  );
}
