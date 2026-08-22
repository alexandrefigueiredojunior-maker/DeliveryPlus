import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MapPin, LogIn, AlertCircle, Loader2 } from 'lucide-react';

export default function RestauranteLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data?.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error('Erro ao verificar auth:', err);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      if (user.user_metadata?.role === 'restaurante') {
        const from = (location.state as any)?.from?.pathname || '/app-restaurante';
        navigate(from, { replace: true });
      }
    }
  }, [user, authLoading, navigate, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

       let currentUser = authData.user;
      if (!currentUser) {
        const { data, error: getUsrErr } = await supabase.auth.getUser();
        if (getUsrErr) throw getUsrErr;
        currentUser = data?.user || null;
      }

      if (!currentUser) throw new Error('Falha ao obter dados do usuário.');

      const { data: restauranteData, error: restauranteError } = await supabase
        .from('restaurantes')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (restauranteError) throw restauranteError;

      if (restauranteData) {
        // Redireciona para o app do restaurante
        navigate('/app-restaurante', { replace: true });
      } else {
        await supabase.auth.signOut();
        throw new Error('Esta conta não está vinculada a um restaurante ou ainda não foi aprovada.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message === 'Invalid login credentials' 
        ? 'E-mail ou senha incorretos.' 
        : err.message || 'Erro ao entrar.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-orange-500 text-white shadow-xl shadow-orange-100 mb-6">
            <MapPin size={40} />
          </div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">DeliveryPlus</h1>
          <p className="mt-2 text-neutral-500">Portal do Restaurante</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="shrink-0 h-5 w-5" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 ml-1 uppercase tracking-wider">E-mail</label>
              <input
                type="email"
                required
                className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:border-orange-500 outline-none transition-all"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 ml-1 uppercase tracking-wider">Senha</label>
              <input
                type="password"
                required
                className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:border-orange-500 outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-100 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <LogIn className="h-6 w-6" />}
              Entrar agora
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
