import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Empresa } from '../types';
import { useAuth } from './AuthContext';

interface EmpresaContextType {
  empresa: Empresa | null;
  loading: boolean;
  isSuperAdmin: boolean;
  refreshEmpresa: () => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserEmpresa = async (userId: string) => {
    try {
      setLoading(true);

      // Verificar se o usuário é Super Admin
      try {
        const { data: superAdminData } = await supabase.rpc('is_super_admin');
        setIsSuperAdmin(superAdminData === true);
      } catch (saErr) {
        console.error('Erro ao checar is_super_admin no EmpresaContext:', saErr);
        setIsSuperAdmin(false);
      }

      // Buscar em usuarios_empresas (admin/gestor)
      const { data: vinculacao, error: vinculacaoError } = await supabase
        .from('usuarios_empresas')
        .select('empresa_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (vinculacaoError) throw vinculacaoError;

      const empresaId = vinculacao?.empresa_id;

      if (empresaId) {
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresas')
          .select('*')
          .eq('id', empresaId)
          .maybeSingle();

        if (empresaError) throw empresaError;
        console.log('EmpresaContext: Dados carregados da tabela empresas:', empresaData);
        setEmpresa(empresaData);
      } else {
        setEmpresa(null);
      }
    } catch (error) {
      console.error('Erro ao buscar dados da empresa:', error);
      setEmpresa(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserEmpresa(user.id);
    } else {
      setEmpresa(null);
      setIsSuperAdmin(false);
      setLoading(false);
    }
  }, [user]);

  return (
    <EmpresaContext.Provider value={{ empresa, loading, isSuperAdmin, refreshEmpresa: () => user ? fetchUserEmpresa(user.id) : Promise.resolve() }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const context = useContext(EmpresaContext);
  if (context === undefined) {
    throw new Error('useEmpresa must be used within an EmpresaProvider');
  }
  return context;
}
