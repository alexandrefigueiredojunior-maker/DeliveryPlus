import React from 'react';
import { UserCheck, Zap, AlertCircle } from 'lucide-react';
import { ActiveMotoboyInfo } from '../../utils/despachoUtils';

interface OpcoesDespachoSelectorProps {
  modoDistribuicao?: 'todos_online' | 'raio_progressivo' | 'manual';
  activeMotoboys: ActiveMotoboyInfo[];
  opcao: 'automatica' | 'mesmo_motoboy';
  onChangeOpcao: (opcao: 'automatica' | 'mesmo_motoboy') => void;
  selectedMotoboyId: string | null;
  onChangeMotoboyId: (id: string | null) => void;
  loadingActiveMotoboys?: boolean;
}

export const OpcoesDespachoSelector: React.FC<OpcoesDespachoSelectorProps> = ({
  modoDistribuicao = 'todos_online',
  activeMotoboys,
  opcao,
  onChangeOpcao,
  selectedMotoboyId,
  onChangeMotoboyId,
  loadingActiveMotoboys = false,
}) => {
  const getModoDescricao = () => {
    switch (modoDistribuicao) {
      case 'manual':
        return 'Você escolherá manualmente o motoboy para esta entrega.';
      case 'raio_progressivo':
        return 'O sistema expande o raio de busca gradualmente a cada intervalo de tempo.';
      case 'todos_online':
      default:
        return 'Notifica todos os motoboys online simultaneamente.';
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">
        Opção de Despacho
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Opção 1: Distribuição Automática / Normal */}
        <button
          type="button"
          onClick={() => {
            onChangeOpcao('automatica');
            onChangeMotoboyId(null);
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
            opcao === 'automatica'
              ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm ring-1 ring-indigo-600'
              : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Zap size={16} className={opcao === 'automatica' ? 'text-indigo-600' : 'text-neutral-400'} />
            <span className="text-xs font-black uppercase tracking-tight">
              {modoDistribuicao === 'manual' ? 'Despacho Manual' : 'Distribuição Automática'}
            </span>
          </div>
          <p className="text-[10px] font-medium text-neutral-500 leading-snug">
            {getModoDescricao()}
          </p>
        </button>

        {/* Opção 2: Mesmo Motoboy */}
        <button
          type="button"
          onClick={() => {
            onChangeOpcao('mesmo_motoboy');
            if (activeMotoboys.length > 0 && !selectedMotoboyId) {
              onChangeMotoboyId(activeMotoboys[0].id);
            }
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
            opcao === 'mesmo_motoboy'
              ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm ring-1 ring-indigo-600'
              : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <UserCheck size={16} className={opcao === 'mesmo_motoboy' ? 'text-indigo-600' : 'text-neutral-400'} />
            <span className="text-xs font-black uppercase tracking-tight">
              Mesmo Motoboy
            </span>
          </div>
          <p className="text-[10px] font-medium text-neutral-500 leading-snug">
            Enviar para entregador com pedido em andamento no restaurante.
          </p>
        </button>
      </div>

      {/* Se selecionado Mesmo Motoboy */}
      {opcao === 'mesmo_motoboy' && (
        <div className="pt-2">
          {loadingActiveMotoboys ? (
            <div className="p-4 text-center text-xs font-bold text-neutral-400 animate-pulse bg-neutral-50 rounded-xl">
              Buscando motoboys ativos...
            </div>
          ) : activeMotoboys.length > 0 ? (
            <div className="space-y-2 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">
                Selecione o Motoboy Ativo:
              </p>
              <div className="space-y-2">
                {activeMotoboys.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeMotoboyId(m.id)}
                    className={`w-full p-3 rounded-xl border transition-all flex items-center justify-between text-left ${
                      selectedMotoboyId === m.id
                        ? 'border-indigo-600 bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-600'
                        : 'border-indigo-100 bg-white/80 text-neutral-600 hover:bg-white'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight leading-tight">{m.nome}</p>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase leading-tight mt-0.5">
                        {m.count} {m.count === 1 ? 'entrega ativa' : 'entregas ativas'}
                      </p>
                    </div>
                    {selectedMotoboyId === m.id && (
                      <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                        Selecionado
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="text-xs font-bold">Nenhum motoboy realizando entrega neste restaurante no momento.</p>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  Selecione "Distribuição Automática" para chamar um entregador online.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
