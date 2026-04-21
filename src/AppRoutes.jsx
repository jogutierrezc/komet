import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import App from './App';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './routes/ProtectedRoute';
import { isAuthenticated, logout } from './auth/auth';

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
    <Routes>
      <Route path="/login" element={isAuthenticated() ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <ProtectedAppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
