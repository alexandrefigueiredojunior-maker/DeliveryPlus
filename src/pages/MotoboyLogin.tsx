import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Bike, LogIn, AlertCircle, Loader2 } from 'lucide-react';

export default function MotoboyLogin() {
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
      if (user.user_metadata?.role === 'motoboy') {
        const from = (location.state as any)?.from?.pathname || '/app-motoboy';
        navigate(from, { replace: true });
      } else {
        // Se já estiver logado mas não for motoboy, deixamos ele tentar o login no form
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

      // Pegar o user direto do retorno
      let currentUser = authData.user;
      
      // Se data.user vier vazio, chamar getUser
      if (!currentUser) {
        const { data, error: getUsrErr } = await supabase.auth.getUser();
        if (getUsrErr) throw getUsrErr;
        currentUser = data?.user || null;
      }

      if (!currentUser) throw new Error('Falha ao obter dados do usuário após login.');

      console.log('Data do login:', authData);
      console.log('User ID:', currentUser.id);
      console.log('User Email:', currentUser.email);

      const { data: motoboyData, error: motoboyError } = await supabase
        .from('motoboys')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      console.log('Resultado da busca em motoboys:', motoboyData);
      console.log('Erro da busca:', motoboyError);

      if (motoboyError) throw motoboyError;

      if (motoboyData) {
        // Sucesso! Redireciona diretamente
        console.log('Motoboy encontrado:', motoboyData.nome);
        navigate('/app-motoboy', { replace: true });
      } else {
        // Se não encontrar, mostrar "Usuário não é motoboy" e deslogar
        await supabase.auth.signOut();
        throw new Error('Usuário não é motoboy. Esta conta não está vinculada a um perfil de motoboy.');
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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-100 mb-6">
            <Bike size={40} />
          </div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">DeliveryPlus</h1>
          <p className="mt-2 text-neutral-500">Entre para ver suas entregas</p>
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
                className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all"
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
                className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <LogIn className="h-6 w-6" />}
              Entrar agora
            </button>
          </form>
        </div>
        
        <p className="text-center text-neutral-400 text-sm">
          Painel do Gestor? {' '}
          <a href="/login" className="text-indigo-600 font-bold hover:underline">Clique aqui</a>
        </p>
      </div>
    </div>
  );
}
