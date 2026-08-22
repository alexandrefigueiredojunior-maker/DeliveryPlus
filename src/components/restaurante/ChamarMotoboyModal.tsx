import React, { useState, useEffect } from 'react';
import { X, Bike } from 'lucide-react';
import { Empresa, Restaurante } from '../../types';
import {
  ActiveMotoboyInfo,
  fetchActiveMotoboysForRestaurante,
  despacharEntregaExistente,
} from '../../utils/despachoUtils';
import { OpcoesDespachoSelector } from './OpcoesDespachoSelector';

interface ChamarMotoboyModalProps {
  isOpen: boolean;
  onClose: () => void;
  entregaId: string | null;
  numeroEntrega?: string;
  restaurante: Restaurante | null;
  empresa: Empresa | null;
  configDistribuicao: any;
  onSuccess: () => void;
  onOpenManualSelection?: (entregaId: string) => void;
}

export const ChamarMotoboyModal: React.FC<ChamarMotoboyModalProps> = ({
  isOpen,
  onClose,
  entregaId,
  numeroEntrega,
  restaurante,
  empresa,
  configDistribuicao,
  onSuccess,
  onOpenManualSelection,
}) => {
  const [activeMotoboys, setActiveMotoboys] = useState<ActiveMotoboyInfo[]>([]);
  const [loadingMotoboys, setLoadingMotoboys] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [opcao, setOpcao] = useState<'automatica' | 'mesmo_motoboy'>('automatica');
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && restaurante && entregaId) {
      setLoadingMotoboys(true);
      fetchActiveMotoboysForRestaurante(restaurante.id, empresa)
        .then((motoboys) => {
          setActiveMotoboys(motoboys);
          if (motoboys.length > 0) {
            setOpcao('mesmo_motoboy');
            setSelectedMotoboyId(motoboys[0].id);
          } else {
            setOpcao('automatica');
            setSelectedMotoboyId(null);
          }
        })
        .finally(() => {
          setLoadingMotoboys(false);
        });
    }
  }, [isOpen, restaurante, entregaId, empresa]);

  if (!isOpen || !entregaId || !restaurante || !empresa) return null;

  const handleConfirmar = async () => {
    if (opcao === 'mesmo_motoboy' && activeMotoboys.length > 0 && !selectedMotoboyId) {
      return;
    }

    setSubmitting(true);
    try {
      const modoDistribuicao = configDistribuicao?.modo_distribuicao || 'todos_online';
      const targetMotoboyId = opcao === 'mesmo_motoboy' ? selectedMotoboyId : null;

      const res = await despacharEntregaExistente({
        entregaId,
        empresaId: restaurante.empresa_id,
        restauranteId: restaurante.id,
        motoboyId: targetMotoboyId,
        modoDistribuicao,
      });

      if (res.isManual && onOpenManualSelection) {
        onClose();
        onOpenManualSelection(entregaId);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Erro ao chamar motoboy:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Bike className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight leading-tight">Chamar Motoboy</h2>
              {numeroEntrega && (
                <p className="text-[11px] font-bold text-neutral-400">Entrega #{numeroEntrega}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <OpcoesDespachoSelector
            modoDistribuicao={configDistribuicao?.modo_distribuicao}
            activeMotoboys={activeMotoboys}
            opcao={opcao}
            onChangeOpcao={setOpcao}
            selectedMotoboyId={selectedMotoboyId}
            onChangeMotoboyId={setSelectedMotoboyId}
            loadingActiveMotoboys={loadingMotoboys}
          />
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 text-xs font-black text-neutral-500 hover:text-neutral-800 transition-colors uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={submitting || (opcao === 'mesmo_motoboy' && activeMotoboys.length === 0)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-sm transition-all flex items-center gap-2"
          >
            {submitting ? 'Solicitando...' : 'Confirmar Chamada'}
          </button>
        </div>
      </div>
    </div>
  );
};
