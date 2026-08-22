import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Previne o Chrome 67 e anteriores de mostrar automaticamente o prompt
      e.preventDefault();
      // Guarda o evento para ser disparado depois
      setDeferredPrompt(e);
      // Mostra o nosso banner de instalação
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostra o prompt nativo
    deferredPrompt.prompt();

    // Aguarda a resposta do usuário
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuário aceitou a instalação');
    } else {
      console.log('Usuário recusou a instalação');
    }

    // Limpa o prompt
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-24 left-4 right-4 z-[90] bg-neutral-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-neutral-800"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-xl">
            <Download size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-tight">Instalar Aplicativo</p>
            <p className="text-[10px] text-neutral-400 font-bold">Acesse o painel direto do seu computador.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="bg-white text-neutral-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          >
            Instalar
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 text-neutral-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
