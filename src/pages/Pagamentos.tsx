import { useState, useEffect } from 'react';
import { useEmpresa } from '../contexts/EmpresaContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../components/layout/DashboardLayout';
import { 
  CreditCard, 
  Check, 
  X, 
  AlertCircle, 
  Save, 
  Play, 
  Loader2, 
  ShieldCheck, 
  Info, 
  QrCode, 
  Eye, 
  EyeOff,
  ExternalLink
} from 'lucide-react';

export default function Pagamentos() {
  const { empresa } = useEmpresa();
  const [restaurantes, setRestaurantes] = useState<any[]>([]);
  const [loadingRestaurantes, setLoadingRestaurantes] = useState(true);
  const [selectedRestauranteId, setSelectedRestauranteId] = useState<string>('');
  
  // Form states
  const [accessToken, setAccessToken] = useState<string>('');
  const [terminalId, setTerminalId] = useState<string>('');
  const [ambiente, setAmbiente] = useState<'sandbox' | 'producao'>('sandbox');
  const [ativo, setAtivo] = useState<boolean>(false);
  const [showToken, setShowToken] = useState<boolean>(false);

  // Status states
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingCharge, setTestingCharge] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  useEffect(() => {
    if (empresa) {
      fetchRestaurantes();
    }
  }, [empresa]);

  useEffect(() => {
    if (selectedRestauranteId) {
      fetchIntegrationConfig(selectedRestauranteId);
    } else {
      // Clear fields if no restaurant is selected
      setAccessToken('');
      setTerminalId('');
      setAmbiente('sandbox');
      setAtivo(false);
      setTestResult(null);
      setErrorStatus(null);
    }
  }, [selectedRestauranteId]);

  async function fetchRestaurantes() {
    setLoadingRestaurantes(true);
    try {
      const { data, error } = await supabase
        .from('restaurantes')
        .select('id, nome, status')
        .eq('empresa_id', empresa?.id)
        .order('nome');

      if (error) throw error;
      setRestaurantes(data || []);
      
      // Auto-select first restaurant if available
      if (data && data.length > 0) {
        setSelectedRestauranteId(data[0].id);
      }
    } catch (err: any) {
      console.error('DEBUG [Mercado Pago - Buscar Restaurantes]: Erro:', err);
      setErrorStatus('Erro ao carregar lista de restaurantes: ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoadingRestaurantes(false);
    }
  }

  async function fetchIntegrationConfig(restauranteId: string) {
    setLoadingConfig(true);
    setErrorStatus(null);
    setTestResult(null);
    try {
      const { data, error } = await supabase
        .from('integracoes_mercado_pago')
        .select('*')
        .eq('restaurante_id', restauranteId)
        .maybeSingle();

      if (error) {
        // Table might not have columns or RLS might block, let's log and keep continuing gracefully
        console.warn('DEBUG [Mercado Pago - Buscar Config]: Erro na consulta (pode ser ausência de dados):', error);
        throw error;
      }

      if (data) {
        setTerminalId(data.terminal_id || '');
        setAmbiente(data.ambiente === 'producao' ? 'producao' : 'sandbox');
        setAtivo(data.ativo || false);
        
        // Securely mask access token if it exists
        const tokenValue = data.access_token || '';
        if (tokenValue) {
          const masked = tokenValue.length > 8 
            ? `••••••••••••••••${tokenValue.slice(-4)}` 
            : '••••••••••••••••';
          setAccessToken(masked);
        } else {
          setAccessToken('');
        }
      } else {
        // No integration existing yet, set defaults
        setAccessToken('');
        setTerminalId('');
        setAmbiente('sandbox');
        setAtivo(false);
      }
    } catch (err: any) {
      console.error('DEBUG [Mercado Pago - Buscar Config - Erro]:', err);
      // Clean defaults in case of error
      setAccessToken('');
      setTerminalId('');
      setAmbiente('sandbox');
      setAtivo(false);
      
      // We don't hard block the UI because the user might be setting up the table for the first time
      setErrorStatus(`Nenhuma configuração anterior carregável ou erro de tabela: ${err.message || JSON.stringify(err)}`);
    } finally {
      setLoadingConfig(false);
    }
  }

  const handleTokenFocus = () => {
    // Clear token display if it consists purely of masked bullet points to let users paste their token directly
    if (accessToken.includes('•')) {
      setAccessToken('');
    }
  };

  async function handleSave() {
    if (!selectedRestauranteId) {
      alert('Por favor, selecione um restaurante antes de salvar.');
      return;
    }
    
    setIsSaving(true);
    setErrorStatus(null);
    
    try {
      const payload: any = {
        restaurante_id: selectedRestauranteId,
        empresa_id: empresa.id,
        terminal_id: terminalId,
        ambiente,
        ativo,
      };

      // Only send access_token if it was edited (i.e. does not contain mask characters)
      if (accessToken && !accessToken.includes('•')) {
        payload.access_token = accessToken;
      }

      console.log('DEBUG [Mercado Pago Save]: Enviando payload:', payload);

      const { data, error } = await supabase
        .from('integracoes_mercado_pago')
        .upsert(payload, { onConflict: 'restaurante_id' });

      if (error) throw error;

      console.log('DEBUG [Mercado Pago Save]: Sucesso ao gravar:', data);
      alert('Configuração de pagamento salva com sucesso!');
      
      // Re-fetch to refresh the state with masks safely
      await fetchIntegrationConfig(selectedRestauranteId);
    } catch (err: any) {
      console.error('DEBUG [Mercado Pago Save - Erro]:', err);
      setErrorStatus(`Erro ao salvar no banco de dados: ${err.message || JSON.stringify(err)}`);
      alert(`Erro ao salvar: ${err.message || 'Verifique o console para detalhes.'}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestCharge() {
    if (!selectedRestauranteId) {
      alert('Selecione um restaurante antes de testar a cobrança.');
      return;
    }

    setTestingCharge(true);
    setTestResult(null);

    try {
      console.log('DEBUG [Mercado Pago Test]: Invocando Edge Function mercado-pago-create-order');
      
      const payload = {
        restaurante_id: selectedRestauranteId,
        valor: 1.00,
        amount: 1.00,
        value: 1.00
      };

      const { data, error } = await supabase.functions.invoke('mercado-pago-create-order', {
        body: payload
      });

      console.log('DEBUG [Mercado Pago Test - Resposta]:', { data, error });

      if (error) {
        throw new Error(error.message || 'Erro desconhecido na chamada da Edge Function');
      }

      if (data?.error || data?.status === 'error') {
        throw new Error(data?.error || data?.message || 'Erro reportado pela Edge Function');
      }

      setTestResult({
        success: true,
        qr_code: data?.qr_code || data?.qrCode || data?.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: data?.qr_code_base64 || data?.qrCodeBase64 || data?.point_of_interaction?.transaction_data?.qr_code_base64,
        payment_id: data?.payment_id || data?.id,
        raw: data
      });

      alert('Cobrança de teste gerada com sucesso via Mercado Pago!');
    } catch (err: any) {
      console.error('DEBUG [Mercado Pago Test - Erro]:', err);
      setTestResult({
        success: false,
        error: err.message || 'Houve um problema de conexão com a Edge Function'
      });
      alert(`Erro no teste: ${err.message || 'Veja os logs do console.'}`);
    } finally {
      setTestingCharge(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header da Página */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-blue-100 rounded-2xl text-blue-600 shadow-sm">
                <CreditCard className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Integração Mercado Pago</h1>
            </div>
            <p className="text-neutral-500 text-sm">
              Configure as credenciais e terminais de pagamento integrados de cada restaurante parceiro.
            </p>
          </div>
          
          <div className="flex items-center gap-2 self-start bg-blue-50 border border-blue-100 px-4 py-2 rounded-2xl">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-blue-800">Conexão Segura SSL</span>
          </div>
        </header>

        {errorStatus && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1 font-medium">
              <p className="font-bold">Aviso sobre o ambiente:</p>
              <p className="leading-relaxed">{errorStatus}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Formulário de Configurações */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              
              {/* Seleção do Restaurante */}
              <div>
                <label className="block text-xs font-black text-neutral-400 uppercase tracking-wider mb-2">
                  Selecione o Restaurante
                </label>
                {loadingRestaurantes ? (
                  <div className="flex items-center gap-2 text-sm text-neutral-500 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    Carregando restaurantes...
                  </div>
                ) : (
                  <select
                    value={selectedRestauranteId}
                    onChange={(e) => setSelectedRestauranteId(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {restaurantes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome} {r.status === 'inativo' ? '(Inativo)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-neutral-400 mt-1.5 font-medium">
                  Selecione para qual estabelecimento deseja gerenciar ou registrar as credenciais de pagamento.
                </p>
              </div>

              {selectedRestauranteId && (
                <div className="space-y-6 pt-4 border-t border-neutral-100">
                  
                  {/* Status da Integração */}
                  <div className="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-2xl transition-all">
                    <div>
                      <span className="text-sm font-bold text-neutral-800 block">Status da Integração</span>
                      <span className="text-[11px] text-neutral-400 font-medium">
                        Ativa ou suspende os pagamentos via Mercado Pago para este restaurante.
                      </span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setAtivo(!ativo)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        ativo ? 'bg-green-600' : 'bg-neutral-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ativo ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Access Token */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black text-neutral-400 uppercase tracking-wider">
                        Access Token (Mercado Pago)
                      </label>
                      <span className="text-[10px] bg-neutral-100 px-2 py-0.5 rounded text-neutral-500 font-bold uppercase">
                        Obrigatório
                      </span>
                    </div>
                    
                    <div className="relative flex gap-2">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={accessToken}
                        onFocus={handleTokenFocus}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder="Ex: APP_USR-1234567890-..."
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                        title={showToken ? 'Ocultar código' : 'Visualizar código'}
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                      Sua credencial de produção ou sandbox do Mercado Pago. <strong className="text-neutral-500">Dica:</strong> Toque para digitar ou colar. Caso já possua um token cadastrado, ele é mostrado de forma mascarada por segurança.
                    </p>
                  </div>

                  {/* Terminal ID */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-neutral-400 uppercase tracking-wider">
                      Terminal ID (ID Caixa ou ID Dispositivo)
                    </label>
                    <input
                      type="text"
                      value={terminalId}
                      onChange={(e) => setTerminalId(e.target.value)}
                      placeholder="Ex: TERM12345678"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                    />
                    <p className="text-[10px] text-neutral-400">
                      O ID do terminal de ponto de venda ou caixa vinculado à conta do Mercado Pago para gerar QR Code do PDV físico desejado.
                    </p>
                  </div>

                  {/* Escolha de Ambiente */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-neutral-400 uppercase tracking-wider mb-2">
                      Ambiente de Operação
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setAmbiente('sandbox')}
                        className={`p-4 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                          ambiente === 'sandbox'
                            ? 'bg-blue-50/50 border-blue-500 text-blue-900 ring-1 ring-blue-500'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        <span className="text-xs font-black uppercase tracking-wider">Sandbox</span>
                        <span className="text-[10px] text-neutral-400 font-medium">Ambiente de Testes sem custos reais</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setAmbiente('producao')}
                        className={`p-4 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                          ambiente === 'producao'
                            ? 'bg-blue-50/50 border-blue-500 text-blue-900 ring-1 ring-blue-500'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        <span className="text-xs font-black uppercase tracking-wider">Produção</span>
                        <span className="text-[10px] text-neutral-400 font-medium">A transações reais serão cobradas</span>
                      </button>
                    </div>
                  </div>

                  {/* Ações do Formulário */}
                  <div className="pt-6 border-t border-neutral-100 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      disabled={loadingConfig || testingCharge || isSaving}
                      onClick={handleTestCharge}
                      className="flex items-center gap-2 bg-neutral-900 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-50 transition-all shadow-sm"
                    >
                      {testingCharge ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Testar Cobrança
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={loadingConfig || isSaving || testingCharge}
                      onClick={handleSave}
                      className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Salvar Configuração
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}

              {!selectedRestauranteId && (
                <div className="text-center py-12 text-neutral-400 italic text-sm font-medium">
                  Selecione um restaurante acima para configurar as credenciais do Mercado Pago.
                </div>
              )}

            </div>
          </div>

          {/* Dicas / Resultado do Teste */}
          <div className="space-y-6">
            
            {/* Resultados de Teste */}
            {testResult && (
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-green-600" />
                  <h3 className="font-bold text-neutral-900 text-sm">Resultado do Teste (R$ 1,00)</h3>
                </div>
                
                {testResult.success ? (
                  <div className="space-y-4 text-xs font-medium text-neutral-600">
                    <div className="bg-green-50 border border-green-100 p-3 rounded-2xl text-green-800 leading-relaxed text-[11px]">
                      Ordem criada com sucesso no Mercado Pago! A integração está comunicando corretamente com os servidores.
                    </div>
                    {testResult.payment_id && (
                      <p><strong>ID Pagamento:</strong> <span className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">{testResult.payment_id}</span></p>
                    )}
                    {testResult.qr_code && (
                      <div className="space-y-1">
                        <span className="block text-[10px] font-black text-neutral-400 uppercase">Cadeia do QR Code Pix:</span>
                        <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 font-mono text-[9px] break-all max-h-24 overflow-y-auto">
                          {testResult.qr_code}
                        </div>
                      </div>
                    )}
                    {testResult.qr_code_base64 && (
                      <div className="flex flex-col items-center gap-2 pt-2">
                        <span className="text-[10px] font-black text-neutral-400 uppercase self-start">Imagem do QR Code gerado:</span>
                        <img 
                          src={`data:image/png;base64,${testResult.qr_code_base64}`} 
                          alt="QR Code Mercado Pago" 
                          className="w-40 h-40 border border-neutral-100 rounded-lg shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <details className="mt-2 text-[10px]">
                      <summary className="cursor-pointer font-bold text-neutral-400 hover:text-neutral-600">Ver resposta raw JSON</summary>
                      <div className="bg-neutral-900 text-indigo-400 p-2 rounded-lg font-mono text-[8px] overflow-x-auto mt-2 max-h-40">
                        <pre>{JSON.stringify(testResult.raw, null, 2)}</pre>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-red-50 border border-red-100 p-3 rounded-2xl text-red-800 leading-relaxed text-[11px]">
                      Falha ao invocar ou processar a cobrança do Mercado Pago.
                    </div>
                    <div className="bg-neutral-900 text-red-400 p-3 rounded-2xl font-mono text-[10px] break-all">
                      {testResult.error}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Documentação / Passos Mercado Pago */}
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600 animate-pulse" />
                <h3 className="font-bold text-neutral-900 text-sm">Passo a Passo Mercado Pago</h3>
              </div>
              <ul className="text-xs font-medium text-neutral-500 space-y-3 list-decimal pl-4 leading-relaxed">
                <li>
                  Acesse o painel do <a href="https://developers.mercadopago.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold inline-flex items-center gap-0.5">Mercado Pago Developers <ExternalLink className="h-2.5 w-2.5" /></a>.
                </li>
                <li>
                  Crie ou acesse suas credenciais de produção / homologação para obter o <strong>Access Token</strong>.
                </li>
                <li>
                  Com o Access Token cadastrado, registre o respectivo <strong>ID de Caixa (Terminal)</strong> de destino dos pagamentos.
                </li>
                <li>
                  Clique em <strong>Salvar Configuração</strong> para persistir a integração.
                </li>
                <li>
                  Use o botão <strong>Testar Cobrança</strong> para confirmar que a comunicação entre o DeliveryJunior e os servidores do Mercado Pago está 100% funcional.
                </li>
              </ul>
            </div>

          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
