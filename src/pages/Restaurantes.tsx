import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../components/layout/DashboardLayout';
import RestauranteModal from '../components/restaurantes/RestauranteModal';
import { Restaurante } from '../types';
import { MapPin, Plus, Search, Edit2, AlertCircle, Phone, Ban, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function Restaurantes() {
  const { empresa } = useEmpresa();
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRestaurante, setSelectedRestaurante] = useState<Restaurante | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (empresa) {
      fetchRestaurantes();
    }
  }, [empresa]);

  async function fetchRestaurantes() {
    setLoading(true);
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

  const handleOpenCreate = () => {
    setSelectedRestaurante(null);
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (restaurante: Restaurante) => {
    setSelectedRestaurante(restaurante);
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const handleSaveRestaurante = async (data: Partial<Restaurante> & { password?: string }) => {
    if (!empresa) return;
    setActionLoading(true);
    setError(null);

    try {
      // Destrura a senha de data para separar do objeto 'restauranteData'
      const { password, ...restauranteData } = data;

      if (!selectedRestaurante) {
        // [REGRA 1] CRIAÇÃO: Quando for NOVO restaurante, chamar 'create-user'
        console.log('DEBUG: Iniciando processo de criação de restaurante');
        console.log('DEBUG: empresa_id da empresa logada:', empresa.id);
        console.log('DEBUG: email para registro:', restauranteData.email);

        if (!restauranteData.email || !password) {
          throw new Error('Email e senha são obrigatórios para novos restaurantes.');
        }

        const functionName = 'create-user';
        const payload = { 
          email: restauranteData.email, 
          password: password,
          role: 'restaurante', // [REGRA 2] Enviar role: "restaurante"
          empresa_id: empresa.id, // [REGRA 3] Enviar empresa_id da empresa logada
          data: restauranteData // [REGRA 5] Enviar os dados do restaurante dentro de data
        };

        console.log('DEBUG: Enviando payload para create-user:', payload);

        // Chamar Edge Function para criar Auth + DB
        const { data: response, error: functionError } = await supabase.functions.invoke('create-user', {
          body: payload
        });

        console.log('DEBUG: Resposta de invocação recebida:', { response, functionError });

        if (functionError) {
          console.error('DEBUG: Erro do Supabase ao chamar Edge Function:', functionError);
          throw functionError;
        }
        
        if (response?.error) {
          console.error('DEBUG: Erro lógico retornado pela Edge Function:', response.error);
          throw new Error(response.error);
        }

        console.log('DEBUG: Novo restaurante criado com sucesso via Edge Function!');
      } else {
        // [REGRA] EDIÇÃO: Apenas atualizar dados no banco (SDK padrão) na tabela 'restaurantes'
        console.log('DEBUG [Atualização tabela restaurantes]: Iniciando processo de edição para restaurante ID:', selectedRestaurante.id);
        
        // Define exact allowed fields to update
        const updatePayload: Record<string, any> = {};
        const allowedFields = [
          'nome',
          'telefone',
          'whatsapp',
          'endereco',
          'latitude',
          'longitude',
          'status',
          'ativo',
          'foto_url',
          'email'
        ];

        allowedFields.forEach((field) => {
          const value = (restauranteData as any)[field];
          if (value !== undefined) {
            updatePayload[field] = value;
          }
        });

        // Garantir que email vazio não seja enviado ou seja excluído se não alterado
        if (updatePayload.email === '') {
          delete updatePayload.email;
        }

        // Mostrar no console o objeto final enviado no update
        console.log('DEBUG [Atualização tabela restaurantes]: Objeto final enviado no update da tabela "restaurantes":', updatePayload);

        const { error: updateError } = await supabase
          .from('restaurantes')
          .update(updatePayload)
          .eq('id', selectedRestaurante.id)
          .eq('empresa_id', empresa.id);

        if (updateError) {
          console.error('DEBUG [Atualização tabela restaurantes - Erro]: Erro ao atualizar tabela "restaurantes" no Supabase:', updateError);
          throw new Error(`Erro do Supabase ao atualizar: ${updateError.message} (Código: ${updateError.code})`);
        }

        console.log('DEBUG [Atualização tabela restaurantes]: Restaurante atualizado com sucesso na tabela "restaurantes"!');

        // [NOVA REGRA] Se o e-mail foi alterado OU uma nova senha foi preenchida: chamar também Edge Function
        const emailAltered = restauranteData.email !== undefined && restauranteData.email !== selectedRestaurante.email;
        const hasNewPassword = !!password;

        if (emailAltered || hasNewPassword) {
          console.log('DEBUG [Atualização auth]: Alteração detectada (E-mail alterado:', emailAltered, 'ou Nova senha preenchida:', hasNewPassword, '). Iniciando chamada da Edge Function.');
          try {
            const authPayload = {
              action: 'update',
              user_id: selectedRestaurante.user_id,
              email: restauranteData.email,
              password: password || undefined
            };
            console.log('DEBUG [Atualização auth]: Enviando payload:', authPayload);

            const { data: response, error: functionError } = await supabase.functions.invoke('create-user', {
              body: authPayload
            });

            console.log('DEBUG [Atualização auth]: Resposta de invocação recebida:', { response, functionError });

            if (functionError) {
              console.error('DEBUG [Atualização auth - Erro]: Erro do Supabase ao chamar Edge Function:', functionError);
            } else if (response?.error) {
              console.error('DEBUG [Atualização auth - Erro]: Erro lógico retornado pela Edge Function:', response.error);
            } else {
              console.log('DEBUG [Atualização auth]: Atualização de autenticação realizada com sucesso!');
            }
          } catch (authErr: any) {
            console.error('DEBUG [Atualização auth - Erro]: Exceção ao atualizar auth via Edge Function:', authErr);
          }
        } else {
          console.log('DEBUG [Atualização auth]: Nenhuma alteração de e-mail ou senha detectada para atualização do Auth.');
        }
      }

      await fetchRestaurantes();
      setSuccess(selectedRestaurante ? 'Restaurante atualizado com sucesso!' : 'Restaurante criado com sucesso!');
      setIsModalOpen(false);
      
      // Limpar mensagem de sucesso após 5 segundos
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('ERRO REAL NO CONSOLE:', err);
      setError(err.message || 'Erro ao salvar restaurante. Verifique os dados.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (restaurante: Restaurante) => {
    if (!empresa) return;
    const newStatus = restaurante.status === 'inativo' ? 'ativo' : 'inativo';
    
    try {
      const { error } = await supabase
        .from('restaurantes')
        .update({ status: newStatus })
        .eq('id', restaurante.id)
        .eq('empresa_id', empresa.id);

      if (error) throw error;
      await fetchRestaurantes();
    } catch (err: any) {
      console.error('Toggle status error:', err);
    }
  };

  const filteredRestaurantes = restaurantes.filter(r => 
    r.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.endereco.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">Restaurantes</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Gerencie os estabelecimentos parceiros.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl font-semibold text-xs transition-colors shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Novo Restaurante
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-xs text-green-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="p-3 border-b border-neutral-100 bg-neutral-50/50 flex flex-col md:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou endereço..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
            </div>
          ) : filteredRestaurantes.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Estabelecimento</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Contato</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Endereço</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRestaurantes.map((restaurante, idx) => (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    key={restaurante.id}
                    className="hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        {restaurante.foto_url ? (
                          <img 
                            src={restaurante.foto_url} 
                            alt={restaurante.nome} 
                            className="h-8 w-8 shrink-0 rounded-lg object-cover border border-neutral-200"
                          />
                        ) : (
                          <div className="h-8 w-8 shrink-0 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                            {restaurante.nome.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-neutral-900 leading-tight">{restaurante.nome}</p>
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            <p className="text-[10px] text-neutral-500">ID: {restaurante.id.slice(0, 8)}</p>
                            {restaurante.email && <p className="text-[10px] text-orange-600 font-medium">{restaurante.email}</p>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-1.5 text-neutral-600">
                        <Phone className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                        <span>{restaurante.telefone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-neutral-700 max-w-xs truncate">
                      {restaurante.endereco}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        restaurante.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {restaurante.status === 'ativo' ? 'Aberto' : 'Fechado'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleToggleStatus(restaurante)}
                          title={restaurante.status === 'inativo' ? 'Ativar' : 'Desativar'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            restaurante.status === 'inativo' 
                              ? 'text-green-600 hover:bg-green-50' 
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                        >
                          {restaurante.status === 'inativo' ? <CheckCircle size={16} /> : <Ban size={16} />}
                        </button>
                        <button 
                          onClick={() => handleOpenEdit(restaurante)}
                          className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <MapPin className="h-10 w-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-xs text-neutral-500 font-medium">Nenhum restaurante encontrado.</p>
              {searchTerm && <p className="text-[11px] text-neutral-400 mt-0.5">Tente remover os filtros de busca.</p>}
            </div>
          )}
        </div>
      </div>

      <RestauranteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRestaurante}
        restaurante={selectedRestaurante}
        loading={actionLoading}
      />
    </DashboardLayout>
  );
}
