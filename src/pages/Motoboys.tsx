import { useEffect, useState } from 'react';
import { useEmpresa } from '../contexts/EmpresaContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../components/layout/DashboardLayout';
import MotoboyModal from '../components/motoboys/MotoboyModal';
import BloqueioRestauranteModal from '../components/motoboys/BloqueioRestauranteModal';
import { Motoboy } from '../types';
import { Bike, Plus, Search, Edit2, AlertCircle, Phone, Ban, CheckCircle, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

export default function Motoboys() {
  const { empresa } = useEmpresa();
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBloqueioModalOpen, setIsBloqueioModalOpen] = useState(false);
  const [selectedMotoboy, setSelectedMotoboy] = useState<Motoboy | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (empresa) {
      fetchMotoboys();
    }
  }, [empresa]);

  async function fetchMotoboys() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('motoboys')
        .select('*')
        .eq('empresa_id', empresa?.id)
        .order('nome');

      if (error) throw error;
      setMotoboys(data || []);
    } catch (error) {
      console.error('Erro ao buscar motoboys:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenCreate = () => {
    setSelectedMotoboy(null);
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (motoboy: Motoboy) => {
    setSelectedMotoboy(motoboy);
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const handleSaveMotoboy = async (data: Partial<Motoboy> & { password?: string }) => {
    if (!empresa) return;
    setActionLoading(true);
    setError(null);

    try {
      const { password, ...motoboyData } = data;

      if (!selectedMotoboy) {
        // CRIAÇÃO: Usar Edge Function para criar Auth + DB
        if (!motoboyData.email || !password) {
          throw new Error('Email e senha são obrigatórios para novos motoboys.');
        }

        const functionName = 'create-user';

         const payload = { 
         email: motoboyData.email, 
         password: password,
         role: 'motoboy',
         empresa_id: empresa.id,
         data: {
         nome: motoboyData.nome,
         telefone: motoboyData.telefone,
         cpf: motoboyData.cpf,
          placa_veiculo: motoboyData.placa_veiculo,
         foto_url: motoboyData.foto_url,
          status: 'offline',
          ativo: true,
         email: motoboyData.email,
         maquininha_serial: motoboyData.maquininha_serial
         }
         };

console.log('Chamando Edge Function:', functionName);
console.log('Dados enviados:', payload);

const { data: response, error: functionError } = await supabase.functions.invoke(functionName, {
  body: payload
});

console.log('Resposta da Function:', response);

if (functionError) {
  console.error('Erro de invocação da Function:', functionError);
  throw functionError;
}

if (response?.error) {
  console.error('Erro lógico na Function:', response.error);
  throw new Error(response.error);
}

      } else {
        // EDIÇÃO: Apenas atualizar dados no banco (SDK padrão)
        // Se o email estiver vazio, removemos para não tentar sobrescrever com null se as RLS proibirem
        if (!motoboyData.email) delete motoboyData.email;

        const { error } = await supabase
          .from('motoboys')
          .update(motoboyData)
          .eq('id', selectedMotoboy.id)
          .eq('empresa_id', empresa.id);

        if (error) throw error;
      }

      await fetchMotoboys();
      setSuccess(selectedMotoboy ? 'Motoboy atualizado com sucesso!' : 'Motoboy criado com sucesso!');
      setIsModalOpen(false);
      
      // Limpar mensagem de sucesso após 5 segundos
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('ERRO REAL NO CONSOLE:', err);
      setError(err.message || 'Erro ao salvar motoboy. Verifique os dados.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (motoboy: Motoboy) => {
    if (!empresa) return;
    const newAtivo = !motoboy.ativo;
    
    try {
      const { error } = await supabase
        .from('motoboys')
        .update({ ativo: newAtivo })
        .eq('id', motoboy.id)
        .eq('empresa_id', empresa.id);

      if (error) throw error;
      await fetchMotoboys();
    } catch (err: any) {
      console.error('Toggle ativo error:', err);
    }
  };

  const filteredMotoboys = motoboys.filter(m => 
    m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.cpf.includes(searchTerm)
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">Motoboys</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Gerencie a equipe de entrega da sua empresa.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl font-semibold text-xs transition-colors shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Novo Motoboy
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
              placeholder="Buscar por nome ou CPF..."
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
          ) : filteredMotoboys.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Nome / CPF</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Contato</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Veículo</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredMotoboys.map((motoboy, idx) => (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    key={motoboy.id}
                    className="hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        {motoboy.foto_url ? (
                          <img 
                            src={motoboy.foto_url} 
                            alt={motoboy.nome} 
                            className="h-8 w-8 shrink-0 rounded-full object-cover border border-neutral-200"
                          />
                        ) : (
                          <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                            {motoboy.nome.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-neutral-900 leading-tight">{motoboy.nome}</p>
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            <p className="text-[10px] text-neutral-500">{motoboy.cpf}</p>
                            {motoboy.email && <p className="text-[10px] text-indigo-600 font-medium">{motoboy.email}</p>}
                            {motoboy.maquininha_serial && (
                              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">
                                Maquininha: {motoboy.maquininha_serial}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-1.5 text-neutral-600">
                        <Phone className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                        <span>{motoboy.telefone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-neutral-700 uppercase">
                      {motoboy.placa_veiculo}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider w-fit ${
                          motoboy.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {motoboy.ativo ? 'Conta Ativa' : 'Conta Inativa'}
                        </span>
                        {motoboy.ativo && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider w-fit ${
                            motoboy.status === 'ativo' ? 'bg-blue-100 text-blue-800' :
                            motoboy.status === 'em_entrega' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-neutral-100 text-neutral-800'
                          }`}>
                            {motoboy.status === 'ativo' ? 'Disponível' :
                             motoboy.status === 'em_entrega' ? 'Em entrega' : 'Offline'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => {
                            setSelectedMotoboy(motoboy);
                            setIsBloqueioModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100"
                        >
                          <ShieldAlert size={12} />
                          Bloqueios
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(motoboy)}
                          title={!motoboy.ativo ? 'Ativar Conta' : 'Desativar Conta'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            !motoboy.ativo 
                              ? 'text-green-600 hover:bg-green-50' 
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                        >
                          {!motoboy.ativo ? <CheckCircle size={16} /> : <Ban size={16} />}
                        </button>
                        <button 
                          onClick={() => handleOpenEdit(motoboy)}
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
              <Bike className="h-10 w-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-xs text-neutral-500 font-medium">Nenhum motoboy encontrado.</p>
              {searchTerm && <p className="text-[11px] text-neutral-400 mt-0.5">Tente remover os filtros de busca.</p>}
            </div>
          )}
        </div>
      </div>

      <MotoboyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMotoboy}
        motoboy={selectedMotoboy}
        loading={actionLoading}
      />

      <BloqueioRestauranteModal
        isOpen={isBloqueioModalOpen}
        onClose={() => setIsBloqueioModalOpen(false)}
        motoboy={selectedMotoboy}
      />
    </DashboardLayout>
  );
}
