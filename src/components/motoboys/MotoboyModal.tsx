import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { X, Loader2, Camera, UploadCloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Motoboy } from '../../types';
import { supabase } from '../../lib/supabase';
import { useEmpresa } from '../../contexts/EmpresaContext';

interface MotoboyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Motoboy>) => Promise<void>;
  motoboy?: Motoboy | null;
  loading: boolean;
}

export default function MotoboyModal({ isOpen, onClose, onSave, motoboy, loading }: MotoboyModalProps) {
  const { empresa } = useEmpresa();
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<Partial<Motoboy> & { password?: string }>({
    nome: '',
    cpf: '',
    telefone: '',
    placa_veiculo: '',
    status: 'offline',
    ativo: true,
    foto_url: null,
    email: '',
    password: '',
    maquininha_serial: ''
  });

  useEffect(() => {
    if (motoboy) {
      setFormData({
        nome: motoboy.nome,
        cpf: motoboy.cpf,
        telefone: motoboy.telefone,
        placa_veiculo: motoboy.placa_veiculo,
        status: motoboy.status,
        ativo: motoboy.ativo,
        foto_url: motoboy.foto_url,
        email: motoboy.email || '',
        password: '', // Não mostramos a senha existente
        maquininha_serial: motoboy.maquininha_serial || ''
      });
    } else {
      setFormData({
        nome: '',
        cpf: '',
        telefone: '',
        placa_veiculo: '',
        status: 'offline',
        ativo: true,
        foto_url: null,
        email: '',
        password: '',
        maquininha_serial: ''
      });
    }
  }, [motoboy, isOpen]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empresa) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${empresa.id}/${Date.now()}.${fileExt}`;
      const filePath = `motoboys/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('imagens')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('imagens')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, foto_url: publicUrl }));
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <h3 className="text-lg font-bold text-neutral-900">
                {motoboy ? 'Editar Motoboy' : 'Novo Motoboy'}
              </h3>
              <button onClick={onClose} className="p-1 hover:bg-neutral-200 rounded-full transition-colors">
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Upload de Foto */}
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-neutral-100 border-2 border-dashed border-neutral-300 flex items-center justify-center overflow-hidden">
                    {formData.foto_url ? (
                      <img src={formData.foto_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-neutral-400" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 rounded-full text-white cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm">
                    <UploadCloud className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                </div>
                <p className="text-[10px] text-neutral-500 mt-2 uppercase tracking-widest font-bold">Foto do Perfil</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Nome Completo</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">E-mail (Login)</label>
                    <input
                      required={!motoboy}
                      type="email"
                      placeholder="exemplo@email.com"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Senha {motoboy && '(Deixe em branco para manter)'}</label>
                    <input
                      required={!motoboy}
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">CPF</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.cpf || ''}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Telefone</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.telefone || ''}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Placa do Veículo</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    value={formData.placa_veiculo || ''}
                    onChange={(e) => setFormData({ ...formData, placa_veiculo: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Número de Série da Maquininha (PagBank)</label>
                  <input
                    type="text"
                    placeholder="Ex: 2221335667"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    value={formData.maquininha_serial || ''}
                    onChange={(e) => setFormData({ ...formData, maquininha_serial: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Status da Conta</label>
                  <select
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all bg-white"
                    value={formData.ativo ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.value === 'true' })}
                  >
                    <option value="true">Ativa (Permite login e entregas)</option>
                    <option value="false">Inativa (Bloqueia acesso)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar Motoboy'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
