import { useState, useEffect } from 'react';
import { useEmpresa } from '../contexts/EmpresaContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../components/layout/DashboardLayout';
import { 
  Key, 
  Copy, 
  Check, 
  Link as LinkIcon, 
  Store, 
  Code, 
  Zap, 
  ExternalLink,
  ChevronRight,
  Info,
  RefreshCw,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Integracoes() {
  const { empresa } = useEmpresa();
  const [restaurantes, setRestaurantes] = useState<any[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-entrega`;

  const [selectedRestaurante, setSelectedRestaurante] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (empresa) {
      fetchRestaurantes();
    }
  }, [empresa]);

  async function handleSyncAll() {
    setIsSyncing(true);
    try {
      // Sincronizar Cardápio Web
      const cwPromise = supabase.functions.invoke('sync-cardapio-web');
      // Sincronizar Anota AI
      const aaPromise = supabase.functions.invoke('sync-anota-ai');
      
      const [cwRes, aaRes] = await Promise.all([cwPromise, aaPromise]);
      
      let msg = 'Sincronização concluída!\n';
      if (!cwRes.error) msg += `- Cardápio Web: ${cwRes.data.processados || 0} pedidos\n`;
      if (!aaRes.error) msg += `- Anota AI: ${aaRes.data.processados || 0} pedidos`;
      
      alert(msg);
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      alert('Erro ao sincronizar pedidos. Verifique as configurações das integrações.');
    } finally {
      setIsSyncing(false);
    }
  }

  async function fetchRestaurantes() {
    try {
      const { data, error } = await supabase
        .from('restaurantes')
        .select('*')
        .eq('empresa_id', empresa?.id)
        .order('nome');

      if (error) throw error;
      setRestaurantes(data || []);
    } catch (error) {
      console.error('Erro ao buscar restaurantes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveIntegration() {
    if (!selectedRestaurante) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('restaurantes')
        .update({
          cardapio_web_active: selectedRestaurante.cardapio_web_active,
          cardapio_web_api_key: selectedRestaurante.cardapio_web_api_key,
          cardapio_web_store_id: selectedRestaurante.cardapio_web_store_id,
          cardapio_web_base_url: selectedRestaurante.cardapio_web_base_url,
          anota_ai_active: selectedRestaurante.anota_ai_active,
          anota_ai_client_id: selectedRestaurante.anota_ai_client_id,
          anota_ai_client_secret: selectedRestaurante.anota_ai_client_secret,
          anota_ai_external_id: selectedRestaurante.anota_ai_external_id
        })
        .eq('id', selectedRestaurante.id);

      if (error) throw error;
      await fetchRestaurantes();
      setSelectedRestaurante(null);
    } catch (error) {
      console.error('Erro ao salvar integração:', error);
      alert('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const jsonExample = {
    api_key: empresa?.api_key || "SUA_API_KEY",
    restaurante_id: restaurantes[0]?.id || "ID_DO_RESTAURANTE",
    numero: "12345",
    cliente_nome: "João Silva",
    cliente_telefone: "11999999999",
    endereco_entrega: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
    latitude_entrega: -23.5614,
    longitude_entrega: -46.6558,
    forma_pagamento: "Dinheiro",
    valor_pedido: 45.90,
    observacao: "Entregar na portaria"
  };

  const [activeTab, setActiveTab] = useState<'cardapio_web' | 'anota_ai'>('cardapio_web');

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Zap className="h-6 w-6 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-900">Integrações de Pedidos</h1>
            </div>
            <p className="text-neutral-500">
              Conecte seus cardápios digitais e PDVs diretamente ao DeliveryPlus para automatizar suas entregas.
            </p>
          </div>
          <button 
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando Todas...' : 'Sincronizar Pedidos'}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-8">
            {/* Credenciais */}
            <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-neutral-900">Suas Credenciais</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">URL da API</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-xs overflow-hidden truncate flex items-center">
                      {API_URL}
                    </div>
                    <button
                      onClick={() => copyToClipboard(API_URL, 'url')}
                      className="bg-neutral-900 text-white p-3 rounded-xl hover:bg-neutral-800 transition-colors shrink-0"
                      title="Copiar URL"
                    >
                      {copiedField === 'url' ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Chave de API (Empresa)</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-xs overflow-hidden truncate flex items-center">
                      {empresa?.api_key || 'Nenhuma chave gerada (Vá em Configurações)'}
                    </div>
                    <button
                      onClick={() => copyToClipboard(empresa?.api_key || '', 'key')}
                      disabled={!empresa?.api_key}
                      className="bg-neutral-900 text-white p-3 rounded-xl hover:bg-neutral-800 transition-colors shrink-0 disabled:opacity-50"
                      title="Copiar Chave"
                    >
                      {copiedField === 'key' ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Para gerar ou alterar sua <strong>Chave de API</strong>, acesse o menu <strong>Configurações</strong>. Lembre-se que o recebimento de pedidos externos deve estar habilitado.
                </p>
              </div>
            </section>

            {/* Adaptadores Preparados */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-neutral-900 px-2">Adaptadores Prontos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'Anota AI', icon: '🤖', color: 'bg-green-100 text-green-700' },
                  { name: 'Saipos', icon: '⚡', color: 'bg-blue-100 text-blue-700' },
                  { name: 'Goomer', icon: '🍔', color: 'bg-orange-100 text-orange-700' },
                  { name: 'Cardápio Web', icon: '🌐', color: 'bg-indigo-100 text-indigo-700' },
                  { name: 'Webhook Genérico', icon: '🔗', color: 'bg-neutral-100 text-neutral-700' },
                ].map((adaptador) => (
                  <div key={adaptador.name} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm flex items-center gap-4 group hover:border-indigo-300 transition-all cursor-default">
                    <div className={`w-12 h-12 flex items-center justify-center rounded-2xl text-xl ${adaptador.color}`}>
                      {adaptador.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-neutral-900 text-sm uppercase tracking-tight">{adaptador.name}</h3>
                      <p className="text-[10px] text-neutral-400 font-bold">PRONTO PARA USAR</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-neutral-300 group-hover:text-indigo-600 transition-all" />
                  </div>
                ))}
              </div>
            </section>

            {/* Documentação Rápida */}
            <section className="bg-neutral-900 text-white p-8 rounded-3xl shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Code className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-lg font-bold">Documentação da API</h2>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-green-500/20 text-green-400 rounded">v1.2</span>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-neutral-400 leading-relaxed font-medium">
                  Envie um <code className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">POST</code> para a URL da API com o JSON abaixo.
                </p>

                <div className="bg-black/50 rounded-2xl p-6 font-mono text-xs overflow-x-auto border border-white/5">
                  <pre className="text-indigo-400">
                    {JSON.stringify(jsonExample, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                  Suporta Webhooks e Requisições Diretas
                </p>
                <div className="flex gap-4">
                  <span className="text-[10px] font-bold text-neutral-300 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    SISTEMA ONLINE
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Coluna Lateral */}
          <div className="space-y-6">
            {/* IDs dos Restaurantes e Configurações */}
            <section className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-neutral-900">Restaurantes e IDs</h2>
              </div>
              
              <p className="text-xs text-neutral-500 leading-relaxed font-medium">
                IDs para integração e configurações específicas por loja.
              </p>

              <div className="space-y-3">
                {restaurantes.map((res) => (
                  <div key={res.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-neutral-900 uppercase tracking-tight truncate max-w-[150px]">{res.nome}</span>
                        <div className="flex gap-1">
                          {res.cardapio_web_active && (
                            <span className="bg-green-100 text-green-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">CW</span>
                          )}
                          {res.anota_ai_active && (
                            <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">ANOTA</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedRestaurante(res)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                        >
                          Configurar
                        </button>
                        <button
                          onClick={() => copyToClipboard(res.id, res.id)}
                          className="text-neutral-400 hover:text-indigo-600 transition-colors"
                          title="Copiar ID"
                        >
                          {copiedField === res.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="bg-white border border-neutral-200 rounded-lg px-2 py-1.5 font-mono text-[10px] text-neutral-500 break-all">
                      {res.id}
                    </div>
                  </div>
                ))}

                {restaurantes.length === 0 && !loading && (
                  <div className="text-center py-8">
                    <p className="text-xs text-neutral-400 font-bold italic">Nenhum restaurante encontrado.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Modal de Configuração */}
            <AnimatePresence>
              {selectedRestaurante && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
                  >
                    <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                      <h3 className="font-bold text-neutral-900">Configurar Integrações</h3>
                      <button onClick={() => setSelectedRestaurante(null)} className="text-neutral-400 hover:text-neutral-600">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="flex border-b border-neutral-100">
                      <button 
                        onClick={() => setActiveTab('cardapio_web')}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'cardapio_web' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-neutral-400'}`}
                      >
                        Cardápio Web
                      </button>
                      <button 
                        onClick={() => setActiveTab('anota_ai')}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'anota_ai' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-neutral-400'}`}
                      >
                        Anota AI
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      {activeTab === 'cardapio_web' ? (
                        <>
                          <p className="text-xs text-neutral-500 mb-4">
                            Integração via API (Polling). O sistema buscará pedidos automaticamente no Cardápio Web.
                          </p>

                          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                            <span className="text-sm font-bold text-neutral-700">Ativar integração</span>
                            <button
                              onClick={() => setSelectedRestaurante({...selectedRestaurante, cardapio_web_active: !selectedRestaurante.cardapio_web_active})}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                selectedRestaurante.cardapio_web_active ? 'bg-indigo-600' : 'bg-neutral-200'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedRestaurante.cardapio_web_active ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                          </div>

                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-1.5">API KEY do Cardápio Web</label>
                              <input 
                                type="password"
                                value={selectedRestaurante.cardapio_web_api_key || ''}
                                onChange={(e) => setSelectedRestaurante({...selectedRestaurante, cardapio_web_api_key: e.target.value})}
                                placeholder="Insira a chave da API"
                                className="w-full bg-neutral-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-600 h-11"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-1.5">ID da Loja (Merchant ID)</label>
                              <input 
                                type="text"
                                value={selectedRestaurante.cardapio_web_store_id || ''}
                                onChange={(e) => setSelectedRestaurante({...selectedRestaurante, cardapio_web_store_id: e.target.value})}
                                placeholder="ID único da loja no Cardápio Web"
                                className="w-full bg-neutral-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-600 h-11"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-1.5">URL Base (Opcional)</label>
                              <input 
                                type="text"
                                value={selectedRestaurante.cardapio_web_base_url || ''}
                                onChange={(e) => setSelectedRestaurante({...selectedRestaurante, cardapio_web_base_url: e.target.value})}
                                placeholder="https://api.cardapioweb.com/v1"
                                className="w-full bg-neutral-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-600 h-11"
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-neutral-500 mb-4">
                            Integração Oficial Anota AI. Requer Client ID e Client Secret.
                          </p>

                          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                            <span className="text-sm font-bold text-neutral-700">Ativar integração</span>
                            <button
                              onClick={() => setSelectedRestaurante({...selectedRestaurante, anota_ai_active: !selectedRestaurante.anota_ai_active})}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                selectedRestaurante.anota_ai_active ? 'bg-indigo-600' : 'bg-neutral-200'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedRestaurante.anota_ai_active ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                          </div>

                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-1.5">Client ID</label>
                              <input 
                                type="text"
                                value={selectedRestaurante.anota_ai_client_id || ''}
                                onChange={(e) => setSelectedRestaurante({...selectedRestaurante, anota_ai_client_id: e.target.value})}
                                placeholder="Insira o Client ID"
                                className="w-full bg-neutral-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-600 h-11"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-1.5">Client Secret</label>
                              <input 
                                type="password"
                                value={selectedRestaurante.anota_ai_client_secret || ''}
                                onChange={(e) => setSelectedRestaurante({...selectedRestaurante, anota_ai_client_secret: e.target.value})}
                                placeholder="Insira o Client Secret"
                                className="w-full bg-neutral-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-600 h-11"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-1.5">ID Externo (Opcional)</label>
                              <input 
                                type="text"
                                value={selectedRestaurante.anota_ai_external_id || ''}
                                onChange={(e) => setSelectedRestaurante({...selectedRestaurante, anota_ai_external_id: e.target.value})}
                                placeholder="ID do restaurante no Anota AI"
                                className="w-full bg-neutral-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-600 h-11"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-6 bg-neutral-50 flex gap-3">
                      <button 
                        onClick={() => setSelectedRestaurante(null)}
                        className="flex-1 px-4 py-3 rounded-xl text-neutral-600 font-bold text-sm hover:bg-neutral-200 transition-colors h-12"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleSaveIntegration}
                        disabled={isSaving}
                        className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 h-12"
                      >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <section className="bg-indigo-600 p-6 rounded-3xl text-white space-y-4">
              <h3 className="font-black text-sm uppercase tracking-tight">Ajuda na Integração</h3>
              <p className="text-xs text-indigo-100 leading-relaxed font-medium">
                Dúvidas para configurar seu cardápio? Nossa equipe de suporte técnico pode te ajudar a configurar o Webhook corretamente.
              </p>
              <button className="w-full bg-white text-indigo-600 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors">
                Falar com Suporte
              </button>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
