import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Save, Settings as SettingsIcon, AlertCircle, CheckCircle2, Loader2, DollarSign, User, Store, MapPin, Upload } from 'lucide-react';
import { motion } from 'motion/react';

interface ConfiguracaoEmpresa {
  id?: string;
  empresa_id: string;
  modo_distribuicao: 'todos_online' | 'raio_progressivo' | 'manual';
  raio_inicial_km: number;
  raio_incremento_km: number;
  tempo_expansao_minutos: number;
  mostrar_mapa_motoboys_restaurante?: boolean;
  mostrar_mapa_motoboys_sem_entrega?: boolean;
  compartilhar_localizacao_cliente?: boolean;
  pagbank_ativo?: boolean;
  latitude_operacao?: number | null;
  longitude_operacao?: number | null;
  raio_operacao_km?: number | null;
}

export default function Configuracoes() {
  const { empresa, refreshEmpresa } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfiguracaoEmpresa | null>(null);
  const [mapSettings, setMapSettings] = useState({
    tipo_icone_motoboy_mapa: 'emoji' as 'emoji' | 'foto',
    tipo_icone_restaurante_mapa: 'icone' as 'icone' | 'logo',
    restaurante_pode_editar_pedido: false,
    limite_entregas_por_motoboy: 1,
    finalizar_somente_no_endereco: false,
    cheguei_somente_no_restaurante: false,
    tempo_maximo_coleta_minutos: 15,
    modelo_cobranca_entrega: 'fixo' as 'fixo' | 'km',
    valor_fixo_entrega: 0,
    valor_por_km: 0,
    valor_minimo_entrega: 0,
    aceita_pagamento_pix: true,
    aceita_pagamento_credito: true,
    aceita_pagamento_debito: true,
    aceita_pagamento_dinheiro: true,
    aceita_pedido_ja_pago: true,
    tempo_limite_cancelamento_restaurante_minutos: 5,
    permitir_observacao_entrega_motoboy: false,
    permitir_agrupar_entregas_mesmo_motoboy: false,
    permitir_chat_entrega: false,
    permite_pedidos_externos: false,
    api_key: '',
    funcionamento_ativo: false,
    funcionamento_inicio: '08:00',
    funcionamento_fim: '23:00',
    funcionamento_dias_semana: [1, 2, 3, 4, 5, 6, 0]
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (empresa) {
      console.log('--- CARREGANDO CONFIGURAÇÕES COMPLETAS ---');
      console.log('Dados da empresa carregados:', empresa);
      console.log('Valor cheguei_somente_no_restaurante carregado:', empresa.cheguei_somente_no_restaurante);
      setLogoPreview(empresa.logo_url || null);
      fetchConfig();
      setMapSettings({
        tipo_icone_motoboy_mapa: empresa.tipo_icone_motoboy_mapa || 'emoji',
        tipo_icone_restaurante_mapa: empresa.tipo_icone_restaurante_mapa || 'icone',
        restaurante_pode_editar_pedido: !!empresa.restaurante_pode_editar_pedido,
        limite_entregas_por_motoboy: empresa.limite_entregas_por_motoboy || 1,
        finalizar_somente_no_endereco: !!empresa.finalizar_somente_no_endereco,
        cheguei_somente_no_restaurante: !!empresa.cheguei_somente_no_restaurante,
        tempo_maximo_coleta_minutos: empresa.tempo_maximo_coleta_minutos || 15,
        modelo_cobranca_entrega: empresa.modelo_cobranca_entrega || 'fixo',
        valor_fixo_entrega: empresa.valor_fixo_entrega || 0,
        valor_por_km: empresa.valor_por_km || 0,
        valor_minimo_entrega: empresa.valor_minimo_entrega || 0,
        aceita_pagamento_pix: empresa.aceita_pagamento_pix ?? true,
        aceita_pagamento_credito: empresa.aceita_pagamento_credito ?? true,
        aceita_pagamento_debito: empresa.aceita_pagamento_debito ?? true,
        aceita_pagamento_dinheiro: empresa.aceita_pagamento_dinheiro ?? true,
        aceita_pedido_ja_pago: empresa.aceita_pedido_ja_pago ?? true,
        tempo_limite_cancelamento_restaurante_minutos: empresa.tempo_limite_cancelamento_restaurante_minutos ?? 5,
        permitir_observacao_entrega_motoboy: !!empresa.permitir_observacao_entrega_motoboy,
        permitir_agrupar_entregas_mesmo_motoboy: !!empresa.permitir_agrupar_entregas_mesmo_motoboy,
        permitir_chat_entrega: !!empresa.permitir_chat_entrega,
        permite_pedidos_externos: !!empresa.permite_pedidos_externos,
        api_key: empresa.api_key || '',
        funcionamento_ativo: !!empresa.funcionamento_ativo,
        funcionamento_inicio: empresa.funcionamento_inicio || '08:00',
        funcionamento_fim: empresa.funcionamento_fim || '23:00',
        funcionamento_dias_semana: empresa.funcionamento_dias_semana || [1, 2, 3, 4, 5, 6, 0]
      });
    }
  }, [empresa]);

  async function fetchConfig() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracoes_empresas')
        .select('*')
        .eq('empresa_id', empresa?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        console.log("Config mapa motoboys sem entrega:", !!data.mostrar_mapa_motoboys_sem_entrega);
        setConfig({
          ...data,
          mostrar_mapa_motoboys_restaurante: !!data.mostrar_mapa_motoboys_restaurante,
          mostrar_mapa_motoboys_sem_entrega: !!data.mostrar_mapa_motoboys_sem_entrega,
          compartilhar_localizacao_cliente: data.compartilhar_localizacao_cliente !== false,
          pagbank_ativo: data.pagbank_ativo !== undefined ? !!data.pagbank_ativo : false
        });
      } else {
        // Padrão caso não exista
        console.log("Config mapa motoboys sem entrega:", false);
        setConfig({
          empresa_id: empresa!.id,
          modo_distribuicao: 'todos_online',
          raio_inicial_km: 3,
          raio_incremento_km: 2,
          tempo_expansao_minutos: 3,
          mostrar_mapa_motoboys_restaurante: false,
          mostrar_mapa_motoboys_sem_entrega: false,
          compartilhar_localizacao_cliente: true,
          pagbank_ativo: false,
          latitude_operacao: null,
          longitude_operacao: null,
          raio_operacao_km: null,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      setMessage({ type: 'error', text: 'Não foi possível carregar as configurações.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!empresa?.id) {
      setMessage({ type: 'error', text: 'Empresa não identificada.' });
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Formato inválido. Selecione uma imagem PNG, JPG ou WEBP.' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Tamanho de arquivo excedido. A imagem deve ter no máximo 5MB.' });
      return;
    }

    const tempPreview = URL.createObjectURL(file);
    setLogoPreview(tempPreview);
    setUploadingLogo(true);
    setMessage(null);

    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `empresas/${empresa.id}/logo_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('imagens')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Erro no upload da logo:', uploadError);
        throw new Error('Erro ao fazer upload da imagem para o storage.');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('imagens')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('empresas')
        .update({ logo_url: publicUrl })
        .eq('id', empresa.id);

      if (updateError) {
        console.error('Erro ao salvar logo_url:', updateError);
        throw new Error('Erro ao salvar URL da logo no banco.');
      }

      await refreshEmpresa();
      setLogoPreview(publicUrl);
      setMessage({ type: 'success', text: 'Logo da empresa atualizada com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao atualizar logo:', err);
      setMessage({ type: 'error', text: err.message || 'Não foi possível atualizar a logo da empresa.' });
      setLogoPreview(empresa?.logo_url || null);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    if (!empresa?.id) return;
    setUploadingLogo(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ logo_url: null })
        .eq('id', empresa.id);

      if (error) throw error;

      await refreshEmpresa();
      setLogoPreview(null);
      setMessage({ type: 'success', text: 'Logo removida com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao remover logo:', err);
      setMessage({ type: 'error', text: 'Erro ao remover a logo.' });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSave(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!config) return;

    setSaving(true);
    setMessage(null);

    console.log('--- INICIANDO SALVAMENTO ---');
    console.log('Valores do estado mapSettings:', mapSettings);

    try {
      let activeEmpresaId = empresa?.id;
      console.log('DEBUG CONSOLE: empresa.id do login/contexto:', activeEmpresaId);

      if (!activeEmpresaId) {
        console.log('DEBUG CONSOLE: Buscando empresa por vinculo...');
        // 1. Pegar usuário logado
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = data?.user;
        if (!user) throw new Error('Usuário não autenticado.');

        console.log('User ID logado:', user.id);

        // 2. Buscar vínculo na tabela usuarios_empresas
        const { data: vinculo, error: vinculoError } = await supabase
          .from('usuarios_empresas')
          .select('empresa_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (vinculoError) throw vinculoError;
        if (!vinculo?.empresa_id) {
          throw new Error('Empresa não encontrada para este usuário.');
        }

        activeEmpresaId = vinculo.empresa_id;
        console.log('Empresa ID encontrado no vinculo:', activeEmpresaId);
      }

      // 3. Salvar configurações de distribuição (tabela configuracoes_empresas)
      const payloadConfig = {
        ...config,
        empresa_id: activeEmpresaId,
        updated_at: new Date().toISOString(),
      };

      console.log('DEBUG CONSOLE: Payload enviado para configuracoes_empresas:', payloadConfig);

      const { error: configError } = await supabase
        .from('configuracoes_empresas')
        .upsert(payloadConfig, { onConflict: 'empresa_id' });

      if (configError) {
        console.error('DEBUG CONSOLE: Erro detalhado do Supabase ao salvar configuracoes_empresas:', configError);
        throw configError;
      }

      // 4. Salvar configurações na tabela empresas
      const updateData = {
        tipo_icone_motoboy_mapa: mapSettings.tipo_icone_motoboy_mapa,
        tipo_icone_restaurante_mapa: mapSettings.tipo_icone_restaurante_mapa,
        restaurante_pode_editar_pedido: mapSettings.restaurante_pode_editar_pedido,
        limite_entregas_por_motoboy: mapSettings.limite_entregas_por_motoboy,
        finalizar_somente_no_endereco: mapSettings.finalizar_somente_no_endereco,
        cheguei_somente_no_restaurante: mapSettings.cheguei_somente_no_restaurante,
        tempo_maximo_coleta_minutos: mapSettings.tempo_maximo_coleta_minutos,
        modelo_cobranca_entrega: mapSettings.modelo_cobranca_entrega,
        valor_fixo_entrega: mapSettings.valor_fixo_entrega,
        valor_por_km: mapSettings.valor_por_km,
        valor_minimo_entrega: mapSettings.valor_minimo_entrega,
        aceita_pagamento_pix: mapSettings.aceita_pagamento_pix,
        aceita_pagamento_credito: mapSettings.aceita_pagamento_credito,
        aceita_pagamento_debito: mapSettings.aceita_pagamento_debito,
        aceita_pagamento_dinheiro: mapSettings.aceita_pagamento_dinheiro,
        aceita_pedido_ja_pago: mapSettings.aceita_pedido_ja_pago,
        tempo_limite_cancelamento_restaurante_minutos: mapSettings.tempo_limite_cancelamento_restaurante_minutos,
        permitir_observacao_entrega_motoboy: mapSettings.permitir_observacao_entrega_motoboy,
        permitir_agrupar_entregas_mesmo_motoboy: mapSettings.permitir_agrupar_entregas_mesmo_motoboy,
        permitir_chat_entrega: mapSettings.permitir_chat_entrega,
        permite_pedidos_externos: mapSettings.permite_pedidos_externos,
        api_key: mapSettings.api_key,
        funcionamento_ativo: mapSettings.funcionamento_ativo,
        funcionamento_inicio: mapSettings.funcionamento_inicio,
        funcionamento_fim: mapSettings.funcionamento_fim,
        funcionamento_dias_semana: mapSettings.funcionamento_dias_semana
      };
      
      console.log('DADOS SENDO SALVOS NA TABELA EMPRESAS:', updateData);
      console.log('Valor cheguei_somente_no_restaurante SENDO SALVO:', updateData.cheguei_somente_no_restaurante);

      const { data: updateResult, error: empresaError } = await supabase
        .from('empresas')
        .update(updateData)
        .eq('id', activeEmpresaId)
        .select()
        .maybeSingle();

      console.log('Retorno do update empresas:', updateResult);
      console.log('Erro do update empresas:', empresaError);

      if (empresaError) throw empresaError;
      if (!updateResult) throw new Error('O registro da empresa não foi retornado após a atualização.');

      // 5. Atualizar contexto global
      await refreshEmpresa();
      
      // 6. Sincronizar estados locais
      setMapSettings({
        tipo_icone_motoboy_mapa: updateResult.tipo_icone_motoboy_mapa || 'emoji',
        tipo_icone_restaurante_mapa: updateResult.tipo_icone_restaurante_mapa || 'icone',
        restaurante_pode_editar_pedido: !!updateResult.restaurante_pode_editar_pedido,
        limite_entregas_por_motoboy: updateResult.limite_entregas_por_motoboy || 1,
        finalizar_somente_no_endereco: !!updateResult.finalizar_somente_no_endereco,
        cheguei_somente_no_restaurante: !!updateResult.cheguei_somente_no_restaurante,
        tempo_maximo_coleta_minutos: updateResult.tempo_maximo_coleta_minutos || 15,
        aceita_pagamento_pix: !!updateResult.aceita_pagamento_pix,
        aceita_pagamento_credito: !!updateResult.aceita_pagamento_credito,
        aceita_pagamento_debito: !!updateResult.aceita_pagamento_debito,
        aceita_pagamento_dinheiro: !!updateResult.aceita_pagamento_dinheiro,
        aceita_pedido_ja_pago: !!updateResult.aceita_pedido_ja_pago,
        tempo_limite_cancelamento_restaurante_minutos: updateResult.tempo_limite_cancelamento_restaurante_minutos || 5,
        permitir_observacao_entrega_motoboy: !!updateResult.permitir_observacao_entrega_motoboy,
        permitir_agrupar_entregas_mesmo_motoboy: !!updateResult.permitir_agrupar_entregas_mesmo_motoboy,
        permitir_chat_entrega: !!updateResult.permitir_chat_entrega,
        permite_pedidos_externos: !!updateResult.permite_pedidos_externos,
        api_key: updateResult.api_key || '',
        funcionamento_ativo: !!updateResult.funcionamento_ativo,
        funcionamento_inicio: updateResult.funcionamento_inicio || '08:00',
        funcionamento_fim: updateResult.funcionamento_fim || '23:00',
        funcionamento_dias_semana: updateResult.funcionamento_dias_semana || [1, 2, 3, 4, 5, 6, 0]
      });

      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error: any) {
      console.error('Erro geral no salvamento:', error);
      setMessage({ 
        type: 'error', 
        text: `Erro ao salvar: ${error.message || 'Erro desconhecido. Tente novamente.'}` 
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <SettingsIcon className="h-6 w-6 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">Configurações do Sistema</h1>
          </div>
          <p className="text-neutral-500">
            Defina as regras de distribuição de pedidos para seus motoboys.
          </p>
        </header>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <p className="font-medium">{message.text}</p>
          </motion.div>
        )}

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 space-y-8">
            {/* Logo da Empresa */}
            <section className="pb-6 border-b border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900 mb-1">Logo da empresa</h2>
              <p className="text-xs text-neutral-500 mb-4 font-medium">
                Esta imagem identifica sua empresa nos painéis do sistema e aplicativos.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-neutral-50/80 rounded-2xl border border-neutral-200/80">
                <div className="relative shrink-0">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt={empresa?.nome || 'Logo da empresa'}
                      className="w-24 h-24 rounded-2xl object-cover border-2 border-white shadow-md bg-white"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-orange-100 border-2 border-orange-200 text-orange-600 font-black text-3xl flex items-center justify-center shadow-xs uppercase">
                      {empresa?.nome ? empresa.nome.trim().charAt(0) : 'E'}
                    </div>
                  )}

                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xs rounded-2xl flex items-center justify-center text-white">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50">
                      <Upload size={16} />
                      {uploadingLogo ? 'Enviando...' : 'Alterar logo'}
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        disabled={uploadingLogo}
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>

                    {logoPreview && (
                      <button
                        type="button"
                        disabled={uploadingLogo}
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-neutral-200 hover:bg-neutral-100 text-neutral-600 font-bold text-xs rounded-xl transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] font-semibold text-neutral-400">
                    Formatos aceitos: PNG, JPG ou WEBP. Tamanho máximo: 5MB.
                  </p>
                </div>
              </div>
            </section>

            {/* Modo de Distribuição */}
            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Modo de Distribuição</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { id: 'todos_online', title: 'Todos Online', desc: 'Chama todos ao mesmo tempo.' },
                  { id: 'raio_progressivo', title: 'Raio Progressivo', desc: 'Expande o alcance se ninguém aceitar.' },
                  { id: 'manual', title: 'Manual', desc: 'O restaurante escolhe diretamente um motoboy online para cada entrega.' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setConfig({ ...config!, modo_distribuicao: item.id as any })}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      config?.modo_distribuicao === item.id
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-neutral-100 hover:border-neutral-200 bg-white'
                    }`}
                  >
                    <p className={`font-bold mb-1 ${config?.modo_distribuicao === item.id ? 'text-indigo-700' : 'text-neutral-900'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-neutral-500 leading-relaxed">{item.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Aparência do Mapa */}
            <section className="pt-8 border-t border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Aparência do Mapa</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-3">Ícone dos motoboys no mapa</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setMapSettings({ ...mapSettings, tipo_icone_motoboy_mapa: 'emoji' })}
                      className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 ${
                        mapSettings.tipo_icone_motoboy_mapa === 'emoji'
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-neutral-100 hover:border-neutral-200 bg-white'
                      }`}
                    >
                      <span className="text-2xl">🏍️</span>
                      <span className="text-xs font-bold">Emoji de moto</span>
                    </button>
                    <button
                      onClick={() => setMapSettings({ ...mapSettings, tipo_icone_motoboy_mapa: 'foto' })}
                      className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 ${
                        mapSettings.tipo_icone_motoboy_mapa === 'foto'
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-neutral-100 hover:border-neutral-200 bg-white'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-200 text-neutral-400">
                        <User size={16} />
                      </div>
                      <span className="text-xs font-bold">Foto do motoboy</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-3">Ícone dos restaurantes no mapa</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setMapSettings({ ...mapSettings, tipo_icone_restaurante_mapa: 'icone' })}
                      className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 ${
                        mapSettings.tipo_icone_restaurante_mapa === 'icone'
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-neutral-100 hover:border-neutral-200 bg-white'
                      }`}
                    >
                      <span className="text-2xl">🏪</span>
                      <span className="text-xs font-bold">Ícone de loja</span>
                    </button>
                    <button
                      onClick={() => setMapSettings({ ...mapSettings, tipo_icone_restaurante_mapa: 'logo' })}
                      className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 ${
                        mapSettings.tipo_icone_restaurante_mapa === 'logo'
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-neutral-100 hover:border-neutral-200 bg-white'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-200 text-neutral-400">
                        <Store size={16} />
                      </div>
                      <span className="text-xs font-bold">Logo do restaurante</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Permissões dos Restaurantes */}
            <section className="pt-8 border-t border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Permissões dos Restaurantes</h2>
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-900">Permitir que restaurantes editem pedidos antes da finalização</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-md">
                      Quando ativo, restaurantes poderão editar dados do pedido (nome, endereço, telefone, valor e obs) enquanto a entrega não estiver finalizada.
                    </p>
                  </div>
                  <button
                    onClick={() => setMapSettings({ ...mapSettings, restaurante_pode_editar_pedido: !mapSettings.restaurante_pode_editar_pedido })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                      mapSettings.restaurante_pode_editar_pedido ? 'bg-indigo-600' : 'bg-neutral-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        mapSettings.restaurante_pode_editar_pedido ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-900">Mostrar mapa de motoboys online para restaurantes</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-md">
                      Quando ativo, o painel do restaurante mostrará um mapa na tela inicial com a localização dos motoboys online da própria empresa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => prev ? { ...prev, mostrar_mapa_motoboys_restaurante: !prev.mostrar_mapa_motoboys_restaurante } : null)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                      config?.mostrar_mapa_motoboys_restaurante ? 'bg-indigo-600' : 'bg-neutral-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config?.mostrar_mapa_motoboys_restaurante ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-900">Mostrar motoboys online no mapa</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-md">
                      Permite visualizar no mapa os motoboys online da empresa mesmo quando eles não possuem nenhuma entrega em andamento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConfig(prev => {
                        if (!prev) return null;
                        const novoValor = !prev.mostrar_mapa_motoboys_sem_entrega;
                        console.log("Config mapa motoboys sem entrega alterado para:", novoValor);
                        return { ...prev, mostrar_mapa_motoboys_sem_entrega: novoValor };
                      });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                      config?.mostrar_mapa_motoboys_sem_entrega ? 'bg-indigo-600' : 'bg-neutral-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config?.mostrar_mapa_motoboys_sem_entrega ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-100 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-neutral-900">Compartilhar localização da entrega com o cliente</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-md">
                      Quando ativado, o cliente recebe um link para acompanhar o motoboy em tempo real. O aplicativo do motoboy também libera a lista para organizar a ordem das entregas. Desativado, os links públicos são bloqueados e o motoboy inicia cada entrega individualmente.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config?.compartilhar_localizacao_cliente !== false}
                    aria-label="Compartilhar localização da entrega com o cliente"
                    onClick={() => setConfig(prev => prev ? {
                      ...prev,
                      compartilhar_localizacao_cliente: !(prev.compartilhar_localizacao_cliente !== false),
                    } : null)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                      config?.compartilhar_localizacao_cliente !== false ? 'bg-indigo-600' : 'bg-neutral-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config?.compartilhar_localizacao_cliente !== false ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-900">Tempo limite para restaurante cancelar pedido (minutos)</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-md">
                      Define quanto tempo o restaurante tem para cancelar uma entrega após a criação.
                    </p>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={mapSettings.tempo_limite_cancelamento_restaurante_minutos}
                    onChange={(e) => setMapSettings({ ...mapSettings, tempo_limite_cancelamento_restaurante_minutos: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-24 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none focus:border-indigo-500 font-bold text-center"
                  />
                </div>
              </div>
            </section>
            
            {/* Formas de Pagamento Permitidas */}
            <section className="pt-8 border-t border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Formas de Pagamento Permitidas</h2>
              <p className="text-sm text-neutral-500 mb-6 font-medium">
                Selecione quais métodos de pagamento os restaurantes podem oferecer ao cadastrar pedidos.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'aceita_pagamento_pix', label: 'PIX' },
                  { id: 'aceita_pagamento_credito', label: 'Cartão de Crédito' },
                  { id: 'aceita_pagamento_debito', label: 'Cartão de Débito' },
                  { id: 'aceita_pagamento_dinheiro', label: 'Dinheiro' },
                  { id: 'aceita_pedido_ja_pago', label: 'Pedido já pago' },
                ].map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <span className="font-bold text-neutral-900">{payment.label}</span>
                    <button
                      onClick={() => setMapSettings({ 
                        ...mapSettings, 
                        [payment.id]: !mapSettings[payment.id as keyof typeof mapSettings] 
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                        mapSettings[payment.id as keyof typeof mapSettings] ? 'bg-indigo-600' : 'bg-neutral-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          mapSettings[payment.id as keyof typeof mapSettings] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Comprovante de entrega */}
            <section className="pt-8 border-t border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Comprovante de entrega</h2>
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-neutral-900">Permitir motoboy adicionar observação e foto na entrega</h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-md">
                    Quando ativo, o motoboy verá uma opção para adicionar um comprovante (texto e/ou imagem) antes de finalizar o pedido.
                  </p>
                </div>
                <button
                  onClick={() => setMapSettings({ ...mapSettings, permitir_observacao_entrega_motoboy: !mapSettings.permitir_observacao_entrega_motoboy })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                    mapSettings.permitir_observacao_entrega_motoboy ? 'bg-indigo-600' : 'bg-neutral-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      mapSettings.permitir_observacao_entrega_motoboy ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </section>

            {/* Comunicação */}
            <section className="pt-8 border-t border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Comunicação</h2>
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-neutral-900">Permitir chat entre empresa, restaurante e motoboy</h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-md">
                    Quando ativo, um chat será liberado para cada entrega em andamento, permitindo a comunicação em tempo real.
                  </p>
                </div>
                <button
                  onClick={() => setMapSettings({ ...mapSettings, permitir_chat_entrega: !mapSettings.permitir_chat_entrega })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                    mapSettings.permitir_chat_entrega ? 'bg-indigo-600' : 'bg-neutral-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      mapSettings.permitir_chat_entrega ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </section>

            {/* Integração API */}
            <section className="pt-8 border-t border-neutral-100">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-neutral-900">Integração API</h2>
                <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">Avançado</span>
              </div>
              
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-900">Permitir recebimento de pedidos externos via API</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-md">
                      Habilita o endpoint da API para que sistemas externos possam criar entregas automaticamente na sua central.
                    </p>
                  </div>
                  <button
                    onClick={() => setMapSettings({ ...mapSettings, permite_pedidos_externos: !mapSettings.permite_pedidos_externos })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                      mapSettings.permite_pedidos_externos ? 'bg-indigo-600' : 'bg-neutral-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        mapSettings.permite_pedidos_externos ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {mapSettings.permite_pedidos_externos && (
                  <div className="pt-6 border-t border-neutral-200 space-y-4">
                    <label className="block text-sm font-bold text-neutral-700">Chave de API da Empresa</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-3 font-mono text-sm overflow-hidden truncate">
                        {mapSettings.api_key || <span className="text-neutral-400 italic">Nenhuma chave gerada</span>}
                      </div>
                      <button
                        onClick={() => {
                          const newKey = `dp_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
                          setMapSettings({ ...mapSettings, api_key: newKey });
                        }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
                      >
                        {mapSettings.api_key ? 'Gerar Nova' : 'Gerar Chave'}
                      </button>
                    </div>
                    <p className="text-[10px] text-neutral-400">
                      Mantenha esta chave em segredo. Ela permite criar entregas em nome da sua empresa.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Integração PagBank */}
            <section className="pt-8 border-t border-neutral-100">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-neutral-900">Integração PagBank</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${config?.pagbank_ativo ? 'bg-indigo-100 text-indigo-600' : 'bg-neutral-100 text-neutral-500'}`}>
                  {config?.pagbank_ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-neutral-900">Ativar Pagamentos via PagBank</h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-md">
                    Habilita ou desabilita botões de cobrança, fluxo de cartão de crédito/débito e todas as configurações relacionadas ao PagBank no aplicativo do restaurante e dos motoboys.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(prev => prev ? { ...prev, pagbank_ativo: !prev.pagbank_ativo } : null)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                    config?.pagbank_ativo ? 'bg-indigo-600' : 'bg-neutral-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config?.pagbank_ativo ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </section>

            {/* Regras de agrupamento */}
            <section className="pt-8 border-t border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Regras de agrupamento</h2>
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-neutral-900">Permitir restaurante enviar nova entrega para motoboy que já está atendendo o restaurante</h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-md">
                    Quando ativo, restaurantes poderão escolher enviar uma nova entrega diretamente para um motoboy que já está com uma entrega ativa daquele estabelecimento.
                  </p>
                </div>
                <button
                  onClick={() => setMapSettings({ ...mapSettings, permitir_agrupar_entregas_mesmo_motoboy: !mapSettings.permitir_agrupar_entregas_mesmo_motoboy })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                    mapSettings.permitir_agrupar_entregas_mesmo_motoboy ? 'bg-indigo-600' : 'bg-neutral-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      mapSettings.permitir_agrupar_entregas_mesmo_motoboy ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </section>

            {/* Horário de funcionamento */}
            <section className="pt-8 border-t border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Horário de funcionamento</h2>
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-900">Ativar controle de horário</h3>
                    <p className="text-xs text-neutral-500 mt-1">
                      Quando ativo, novos pedidos só poderão ser criados dentro do horário e dias permitidos.
                    </p>
                  </div>
                  <button
                    onClick={() => setMapSettings({ ...mapSettings, funcionamento_ativo: !mapSettings.funcionamento_ativo })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                      mapSettings.funcionamento_ativo ? 'bg-indigo-600' : 'bg-neutral-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        mapSettings.funcionamento_ativo ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {mapSettings.funcionamento_ativo && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-6 pt-6 border-t border-neutral-200"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-neutral-700">Horário inicial</label>
                        <input
                          type="time"
                          value={mapSettings.funcionamento_inicio}
                          onChange={(e) => setMapSettings({ ...mapSettings, funcionamento_inicio: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-xl focus:border-indigo-500 outline-none font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-neutral-700">Horário final</label>
                        <input
                          type="time"
                          value={mapSettings.funcionamento_fim}
                          onChange={(e) => setMapSettings({ ...mapSettings, funcionamento_fim: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-xl focus:border-indigo-500 outline-none font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-neutral-700">Dias da semana permitidos</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 1, label: 'Seg' },
                          { id: 2, label: 'Ter' },
                          { id: 3, label: 'Qua' },
                          { id: 4, label: 'Qui' },
                          { id: 5, label: 'Sex' },
                          { id: 6, label: 'Sáb' },
                          { id: 0, label: 'Dom' }
                        ].map((day) => {
                          const isSelected = mapSettings.funcionamento_dias_semana.includes(day.id);
                          return (
                            <button
                              key={day.id}
                              onClick={() => {
                                const newDays = isSelected
                                  ? mapSettings.funcionamento_dias_semana.filter(d => d !== day.id)
                                  : [...mapSettings.funcionamento_dias_semana, day.id];
                                setMapSettings({ ...mapSettings, funcionamento_dias_semana: newDays });
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200'
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </section>

            {/* Regras Operacionais */}
            <section className="pt-8 border-t border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Regras Operacionais</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-2">
                    Máximo de entregas simultâneas por motoboy
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={mapSettings.limite_entregas_por_motoboy}
                      onChange={(e) => setMapSettings({ ...mapSettings, limite_entregas_por_motoboy: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-24 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none focus:border-indigo-500 font-bold"
                    />
                    <p className="text-xs text-neutral-500">
                      Define quantas entregas o motoboy pode aceitar ao mesmo tempo (status: aceita, coletada ou em rota).
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-2">
                    Tempo máximo para chegar ao restaurante (minutos)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={mapSettings.tempo_maximo_coleta_minutos}
                      onChange={(e) => setMapSettings({ ...mapSettings, tempo_maximo_coleta_minutos: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-24 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none focus:border-indigo-500 font-bold"
                    />
                    <p className="text-xs text-neutral-500">
                      Após esse tempo, se o pedido não for coletado, ele volta para a fila de espera.
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-900">Permitir marcar chegada somente no restaurante</h3>
                    <p className="text-xs text-neutral-500">O motoboy deve estar em um raio de 100m do restaurante para clicar em "pedido coletado".</p>
                  </div>
                  <button
                    onClick={() => setMapSettings({ ...mapSettings, cheguei_somente_no_restaurante: !mapSettings.cheguei_somente_no_restaurante })}
                    className={`w-12 h-6 rounded-full transition-all relative ${mapSettings.cheguei_somente_no_restaurante ? 'bg-indigo-600' : 'bg-neutral-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${mapSettings.cheguei_somente_no_restaurante ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-900">Permitir finalizar entrega somente no endereço do cliente</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-md">
                      Quando ativo, o motoboy deve estar em um raio de 100m do destino para concluir o pedido.
                    </p>
                  </div>
                  <button
                    onClick={() => setMapSettings({ ...mapSettings, finalizar_somente_no_endereco: !mapSettings.finalizar_somente_no_endereco })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent ${
                      mapSettings.finalizar_somente_no_endereco ? 'bg-indigo-600' : 'bg-neutral-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        mapSettings.finalizar_somente_no_endereco ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* Área de Operação */}
            <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-100 p-2.5 rounded-2xl">
                  <MapPin className="text-indigo-600 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-neutral-900 tracking-tight">Área de Operação</h2>
                  <p className="text-sm text-neutral-500 font-medium">Defina as coordenadas geográficas centrais e o raio limite que sua empresa atende</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-neutral-50 rounded-2xl border border-neutral-100">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Latitude de Operação</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Ex: -23.550520"
                    value={config?.latitude_operacao ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseFloat(e.target.value);
                      setConfig(prev => prev ? { ...prev, latitude_operacao: val } : null);
                    }}
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:border-indigo-500 outline-none font-bold placeholder:font-normal placeholder:text-neutral-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Longitude de Operação</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Ex: -46.633308"
                    value={config?.longitude_operacao ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseFloat(e.target.value);
                      setConfig(prev => prev ? { ...prev, longitude_operacao: val } : null);
                    }}
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:border-indigo-500 outline-none font-bold placeholder:font-normal placeholder:text-neutral-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700">Raio de Operação (KM)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Ex: 15"
                    value={config?.raio_operacao_km ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseFloat(e.target.value);
                      setConfig(prev => prev ? { ...prev, raio_operacao_km: val } : null);
                    }}
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:border-indigo-500 outline-none font-bold placeholder:font-normal placeholder:text-neutral-400"
                  />
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 p-2.5 rounded-2xl">
                  <DollarSign className="text-amber-600 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-neutral-900 tracking-tight">Modelo de cobrança das entregas</h2>
                  <p className="text-sm text-neutral-500 font-medium">Defina como será calculado o valor pago ao motoboy</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-3">Tipo de cobrança</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setMapSettings({ ...mapSettings, modelo_cobranca_entrega: 'fixo' })}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        mapSettings.modelo_cobranca_entrega === 'fixo'
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-neutral-100 bg-neutral-50 hover:border-neutral-200'
                      }`}
                    >
                      <p className="font-black text-neutral-900">Valor Fixo</p>
                      <p className="text-xs text-neutral-500">Cada entrega tem um valor pré-definido fixo.</p>
                    </button>
                    <button
                      onClick={() => setMapSettings({ ...mapSettings, modelo_cobranca_entrega: 'km' })}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        mapSettings.modelo_cobranca_entrega === 'km'
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-neutral-100 bg-neutral-50 hover:border-neutral-200'
                      }`}
                    >
                      <p className="font-black text-neutral-900">Valor por KM</p>
                      <p className="text-xs text-neutral-500">Calculado com base na distância entre restaurante e cliente.</p>
                    </button>
                  </div>
                </div>

                {mapSettings.modelo_cobranca_entrega === 'fixo' ? (
                  <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-4">
                    <label className="block text-sm font-bold text-neutral-700">Valor fixo da entrega (R$)</label>
                    <div className="relative max-w-xs">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-neutral-400 font-bold">R$</span>
                      </div>
                      <input
                        type="number"
                        step="0.10"
                        value={mapSettings.valor_fixo_entrega}
                        onChange={(e) => setMapSettings({ ...mapSettings, valor_fixo_entrega: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl outline-none focus:border-indigo-500 font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <div className="space-y-4">
                      <label className="block text-sm font-bold text-neutral-700">Valor por KM (R$)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-neutral-400 font-bold">R$</span>
                        </div>
                        <input
                          type="number"
                          step="0.10"
                          value={mapSettings.valor_por_km}
                          onChange={(e) => setMapSettings({ ...mapSettings, valor_por_km: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl outline-none focus:border-indigo-500 font-bold"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="block text-sm font-bold text-neutral-700">Valor mínimo da entrega (R$)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-neutral-400 font-bold">R$</span>
                        </div>
                        <input
                          type="number"
                          step="0.10"
                          value={mapSettings.valor_minimo_entrega}
                          onChange={(e) => setMapSettings({ ...mapSettings, valor_minimo_entrega: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl outline-none focus:border-indigo-500 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Configurações Extra - Condicionais */}
            {config?.modo_distribuicao !== 'todos_online' && config?.modo_distribuicao !== 'manual' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-neutral-100"
              >
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-bold text-neutral-700 block mb-2">Raio Inicial (km)</span>
                    <input
                      type="number"
                      value={config?.raio_inicial_km}
                      onChange={(e) => setConfig({ ...config!, raio_inicial_km: Number(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-neutral-200 focus:border-indigo-500 outline-none transition-all"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">Distância inicial para buscar motoboys.</p>
                  </label>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-bold text-neutral-700 block mb-2">Tempo de Expansão (minutos)</span>
                    <input
                      type="number"
                      value={config?.tempo_expansao_minutos}
                      onChange={(e) => setConfig({ ...config!, tempo_expansao_minutos: Number(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-neutral-200 focus:border-indigo-500 outline-none transition-all"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">Quanto tempo esperar até expandir o raio (se aplicável).</p>
                  </label>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-bold text-neutral-700 block mb-2">Incremento de Raio (km)</span>
                    <input
                      type="number"
                      value={config?.raio_incremento_km}
                      onChange={(e) => setConfig({ ...config!, raio_incremento_km: Number(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-neutral-200 focus:border-indigo-500 outline-none transition-all"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">Quantos km adicionar ao raio a cada expansão.</p>
                  </label>
                </div>
              </motion.div>
            )}
          </div>

          <div className="p-6 bg-neutral-50 flex justify-end gap-3 border-t border-neutral-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              Salvar configurações
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
