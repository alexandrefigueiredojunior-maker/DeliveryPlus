import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RestauranteProtectedRoute() {
  const { user, loading: authLoading } = useAuth();
  const [isRestaurante, setIsRestaurante] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkRestaurante() {
      if (authLoading) return;
      
      if (!user) {
        setIsRestaurante(false);
        setLoading(false);
        return;
      }

      // Se já tiver no metadata, confia (opcional)
      if (user.user_metadata?.role === 'restaurante') {
        setIsRestaurante(true);
        setLoading(false);
        return;
      }

      // Senão, checa no banco
      try {
        const { data, error } = await supabase
          .from('restaurantes')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setIsRestaurante(!!data);
      } catch (err) {
        console.error('Erro ao verificar restaurante no guard:', err);
        setIsRestaurante(false);
      } finally {
        setLoading(false);
      }
    }

    checkRestaurante();
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isRestaurante) {
    return <Navigate to="/app-restaurante/login" replace />;
  }

  return <Outlet />;
}
