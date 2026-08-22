import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Empresa, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const handleAuthError = async (error: any) => {
      const errMsg = error?.message || '';
      const isSessionMissingOrInvalid = 
        errMsg.includes('Refresh Token Not Found') || 
        errMsg.includes('refresh_token_not_found') ||
        errMsg.includes('invalid_grant') ||
        errMsg.includes('Invalid Refresh Token') ||
        errMsg.includes('Auth session missing') ||
        errMsg.includes('session missing') ||
        errMsg.includes('Session not found') ||
        errMsg.includes('session_not_found');

      if (isSessionMissingOrInvalid) {
        console.warn('Sessão expirada ou token inválido. Limpando todos os dados da sessão local:', errMsg);
        try {
          await supabase.auth.signOut();
        } catch (signOutErr) {
          console.error('Erro ao fazer signOut local:', signOutErr);
        }
        
        // Coleta de chaves antes da remoção para evitar problemas de índices mutáveis do localStorage
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        setUser(null);
      } else {
        console.error('Erro de Autenticação Supabase:', error);
        setUser(null);
      }
    };

    // 1. Verificar sessão atual IMEDIATAMENTE
    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          await handleAuthError(error);
          return;
        }

        const session = data?.session;
        if (session) {
          // Chamada verificadora complementar para testar se as credenciais ainda funcionam na API
          const { error: userError } = await supabase.auth.getUser();
          if (userError) {
            await handleAuthError(userError);
            return;
          }
          setUser(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Erro crítico ao inicializar Auth:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Escutar mudanças futuras
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (session) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
