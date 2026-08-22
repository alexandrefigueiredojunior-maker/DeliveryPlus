import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { X, Loader2, MapPin, Camera, UploadCloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Restaurante } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useEmpresa } from '../../contexts/EmpresaContext';

interface RestauranteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Restaurante>) => Promise<void>;
  restaurante?: Restaurante | null;
  loading: boolean;
}

export default function RestauranteModal({ isOpen, onClose, onSave, restaurante, loading }: RestauranteModalProps) {
  const { empresa } = useEmpresa();
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<Partial<Restaurante> & { password?: string }>({
    nome: '',
    telefone: '',
    endereco: '',
    latitude: null,
    longitude: null,
    status: 'ativo',
    foto_url: null,
    email: '',
    password: ''
  });

  useEffect(() => {
    if (restaurante) {
      setFormData({
        nome: restaurante.nome,
        telefone: restaurante.telefone,
        endereco: restaurante.endereco,
        latitude: restaurante.latitude,
        longitude: restaurante.longitude,
        status: restaurante.status,
        foto_url: restaurante.foto_url,
        email: restaurante.email || '',
        password: ''
      });
    } else {
      setFormData({
        nome: '',
        telefone: '',
        endereco: '',
        latitude: null,
        longitude: null,
        status: 'ativo',
        foto_url: null,
        email: '',
        password: ''
      });
    }
  }, [restaurante, isOpen]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empresa) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${empresa.id}/${Date.now()}.${fileExt}`;
      const filePath = `restaurantes/${fileName}`;

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
                {restaurante ? 'Editar Restaurante' : 'Novo Restaurante'}
              </h3>
              <button onClick={onClose} className="p-1 hover:bg-neutral-200 rounded-full transition-colors">
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Upload de Foto */}
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-neutral-100 border-2 border-dashed border-neutral-300 flex items-center justify-center overflow-hidden">
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
                <p className="text-[10px] text-neutral-500 mt-2 uppercase tracking-widest font-bold">Foto do Restaurante</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Nome do Restaurante</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: Pizzaria do Mario"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">E-mail (Login)</label>
                    <input
                      required={!restaurante}
                      type="email"
                      placeholder="restaurante@exemplo.com"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Senha {restaurante && '(Deixe em branco p/ manter)'}</label>
                    <input
                      required={!restaurante}
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    required
                    type="text"
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    value={formData.telefone || ''}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Endereço Completo</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                    <textarea
                      required
                      rows={2}
                      placeholder="Rua, número, bairro, cidade..."
                      className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all resize-none"
                      value={formData.endereco || ''}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Latitude (Opcional)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="-23.5505"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.latitude === null ? '' : formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Longitude (Opcional)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="-46.6333"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.longitude === null ? '' : formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                  <select
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all bg-white"
                    value={formData.status || 'ativo'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="ativo">Ativo / Aberto</option>
                    <option value="inativo">Inativo / Fechado</option>
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
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar Restaurante'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
