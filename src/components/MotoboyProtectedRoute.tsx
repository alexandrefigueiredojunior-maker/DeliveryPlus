import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function MotoboyProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/app-motoboy/login" state={{ from: location }} replace />;
  }

  // Se estiver logado mas não for motoboy, redireciona para login geral
  if (user.user_metadata?.role && user.user_metadata.role !== 'motoboy') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
