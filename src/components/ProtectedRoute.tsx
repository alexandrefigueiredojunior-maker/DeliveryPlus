import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { Lock, LogOut, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export default function ProtectedRoute() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { empresa, loading: empresaLoading, isSuperAdmin, refreshEmpresa } = useEmpresa();

  if (authLoading || (user && empresaLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user || !empresa) {
    return <Navigate to="/login" replace />;
  }

  // Se a empresa estiver bloqueada (ativo === false) e o usuário NÃO for Super Admin
  if (empresa.ativo === false && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-neutral-200/80 text-center space-y-6"
        >
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100 shadow-2xs">
            <Lock className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-neutral-900 tracking-tight">
              Empresa Bloqueada
            </h1>
            <p className="text-sm font-medium text-neutral-600 leading-relaxed">
              Esta empresa está bloqueada. Entre em contato com o administrador.
            </p>
            {empresa.nome && (
              <p className="text-xs font-semibold text-neutral-400 pt-1">
                {empresa.nome}
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => refreshEmpresa()}
              className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Verificar novamente
            </button>

            <button
              type="button"
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <Outlet />;
}
