import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { EmpresaProvider } from './contexts/EmpresaContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Motoboys from './pages/Motoboys';
import Restaurantes from './pages/Restaurantes';
import Entregas from './pages/Entregas';
import Aprovacoes from './pages/Aprovacoes';
import Configuracoes from './pages/Configuracoes';
import Integracoes from './pages/Integracoes';
import Pagamentos from './pages/Pagamentos';
import Chats from './pages/Chats';
import MotoboyApp from './pages/MotoboyApp';
import PublicTrackingPage from './pages/PublicTrackingPage';
import MotoboyLogin from './pages/MotoboyLogin';
import MotoboyProtectedRoute from './components/MotoboyProtectedRoute';
import RestauranteApp from './pages/RestauranteApp';
import RestauranteMobileApp from './pages/RestauranteMobileApp';
import RestauranteLogin from './pages/RestauranteLogin';
import SuperAdmin from './pages/SuperAdmin';
import RestauranteProtectedRoute from './components/RestauranteProtectedRoute';
import { isSupabaseConfigured } from './lib/supabase';
import { AlertTriangle } from 'lucide-react';

const isElectron = window.navigator.userAgent.includes('Electron');
const Router = isElectron ? HashRouter : BrowserRouter;

function ConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 text-center">
        <div className="bg-amber-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="text-amber-600 h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Configuração Necessária</h1>
        <p className="text-neutral-500 mb-6">
          As variáveis de ambiente do Supabase não foram encontradas.
        </p>
        <div className="bg-neutral-50 p-4 rounded-lg text-left text-xs font-mono text-neutral-600 mb-6 space-y-2 overflow-x-auto">
          <p>VITE_SUPABASE_URL=...</p>
          <p>VITE_SUPABASE_ANON_KEY=...</p>
        </div>
        <p className="text-sm text-neutral-400">
          Adicione estas chaves no painel do Vercel ou no seu arquivo .env local.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigError />;
  }

  return (
    <AuthProvider>
      <Router
       basename={!isElectron ? import.meta.env.BASE_URL : undefined}
       >
        <Routes>
          <Route path="/login" element={<EmpresaProvider><Login /></EmpresaProvider>} />
          <Route path="/super-admin" element={<SuperAdmin />} />
          <Route path="/app-motoboy/login" element={<MotoboyLogin />} />
          <Route path="/rastreio/:token" element={<PublicTrackingPage />} />
          <Route path="/app-restaurante/login" element={<RestauranteLogin />} />
          
          {/* Dashboard/Admin Routes */}
          <Route element={<EmpresaProvider><ProtectedRoute /></EmpresaProvider>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/motoboys" element={<Motoboys />} />
            <Route path="/restaurantes" element={<Restaurantes />} />
            <Route path="/aprovacoes" element={<Aprovacoes />} />
            <Route path="/entregas" element={<Entregas />} />
            <Route path="/chats" element={<Chats />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/integracoes" element={<Integracoes />} />
            <Route path="/pagamentos" element={<Pagamentos />} />
          </Route>

          {/* Motoboy App Routes */}
          <Route element={<MotoboyProtectedRoute />}>
            <Route path="/app-motoboy" element={<MotoboyApp />} />
          </Route>

          {/* Restaurante App Routes */}
          <Route element={<RestauranteProtectedRoute />}>
            <Route path="/app-restaurante" element={<RestauranteApp />} />
            <Route path="/app-restaurante-mobile" element={<RestauranteMobileApp />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
