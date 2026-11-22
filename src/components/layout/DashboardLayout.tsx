import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Bike, MapPin, ShoppingBag, LogOut, Menu, X, Settings, CheckSquare, MessageSquare, Zap, CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useEmpresa } from '../../contexts/EmpresaContext';
import { motion, AnimatePresence } from 'motion/react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { empresa } = useEmpresa();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Entregas', href: '/entregas', icon: ShoppingBag },
    { name: 'Chats', href: '/chats', icon: MessageSquare },
    { name: 'Aprovações', href: '/aprovacoes', icon: CheckSquare },
    { name: 'Motoboys', href: '/motoboys', icon: Bike },
    { name: 'Restaurantes', href: '/restaurantes', icon: MapPin },
    { name: 'Integrações', href: '/integracoes', icon: Zap },
    { name: 'Pagamentos MP', href: '/pagamentos', icon: CreditCard },
    { name: 'Configurações', href: '/configuracoes', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Sidebar Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 bg-white border-r border-neutral-200 lg:block z-50">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-neutral-100 flex items-center gap-3">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nome}
                className="w-8 h-8 rounded-lg object-cover border border-neutral-200 shrink-0 bg-white"
              />
            ) : null}
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-indigo-600">
                Delivery<span className="text-neutral-900">Junior</span>
              </h1>
              <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-widest mt-0.5 truncate">
                {empresa?.nome}
              </p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-neutral-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-neutral-100">
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-neutral-600 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              <LogOut className="h-4 w-4 text-neutral-400 shrink-0" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Header Mobile */}
      <header className="lg:hidden sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between z-40">
        <h1 className="text-lg font-bold text-indigo-600">DeliveryJunior</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-neutral-600">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed inset-0 bg-white z-30 lg:hidden p-6 pt-20"
          >
            <nav className="space-y-4">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-4 text-lg font-medium ${
                      isActive ? 'text-indigo-600' : 'text-neutral-600'
                    }`}
                  >
                    <item.icon className="h-6 w-6" />
                    {item.name}
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  signOut();
                }}
                className="flex items-center gap-4 text-lg font-medium text-red-600 pt-4 border-t border-neutral-100 w-full"
              >
                <LogOut className="h-6 w-6" />
                Sair
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="lg:pl-60 min-h-screen">
        <div className="max-w-[1600px] mx-auto p-3 sm:p-4 md:p-5 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
