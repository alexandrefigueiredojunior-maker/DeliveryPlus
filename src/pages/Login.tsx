import { useState, FormEvent, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { motion } from 'motion/react';
import { LogIn, Loader2, AlertCircle, LogOut } from 'lucide-react';

export default function Login() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { empresa, loading: empresaLoading } = useEmpresa();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !empresaLoading && user) {
      if (user.user_metadata?.role === 'motoboy') {
        navigate('/app-motoboy');
      } else if (user.user_metadata?.role === 'restaurante') {
        navigate('/app-restaurante');
      } else if (empresa) {
        navigate('/');
      }
    }
  }, [user, empresa, authLoading, empresaLoading, navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      // O useEffect acima cuidará do redirecionamento após o AuthContext atualizar
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message === 'Invalid login credentials') {
        setError('E-mail ou senha incorretos.');
      } else {
        // Mostra a mensagem real do erro para facilitar o diagnóstico
        setError(err.message || 'Ocorreu um erro ao fazer login.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  if (authLoading || (user && empresaLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Se o usuário está logado mas NÃO tem empresa vinculada
  if (user && !empresa && !empresaLoading) {
    // Se for um motoboy, redireciona para a área dele
    if (user.user_metadata?.role === 'motoboy') {
      navigate('/app-motoboy');
      return null;
    }

    // Se for um restaurante, redireciona para a área dele
    if (user.user_metadata?.role === 'restaurante') {
      navigate('/app-restaurante');
      return null;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 text-center"
        >
          <div className="bg-amber-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-amber-600 h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Conta sem Empresa</h1>
          <p className="text-neutral-500 mb-8">
            Seu usuário ({user.email}) está autenticado, mas não está vinculado a nenhuma empresa no sistema.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3 rounded-xl transition-all"
          >
            <LogOut className="h-5 w-5" />
            Sair e tentar outra conta
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-neutral-200"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600 mb-2">DeliveryPlus</h1>
          <p className="text-neutral-500">Acesse o painel da sua empresa</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 bg-neutral-50 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all"
              placeholder="exemplo@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Senha</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 bg-neutral-50 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loginLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Entrar
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-neutral-400">
          Uso restrito para colaboradores autorizados.
        </p>
      </motion.div>
    </div>
  );
}
