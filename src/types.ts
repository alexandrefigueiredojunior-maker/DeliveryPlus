export interface Empresa {
  id: string;
  nome: string;
  ativo?: boolean;
  logo_url?: string | null;
  foto_url?: string | null;
  logo?: string | null;
  tipo_icone_motoboy_mapa?: 'emoji' | 'foto';
  tipo_icone_restaurante_mapa?: 'icone' | 'logo';
  restaurante_pode_editar_pedido?: boolean;
  limite_entregas_por_motoboy?: number;
  finalizar_somente_no_endereco?: boolean;
  cheguei_somente_no_restaurante?: boolean;
  tempo_maximo_coleta_minutos?: number;
  modelo_cobranca_entrega?: 'fixo' | 'km';
  valor_fixo_entrega?: number;
  valor_por_km?: number;
  valor_minimo_entrega?: number;
  aceita_pagamento_pix?: boolean;
  aceita_pagamento_credito?: boolean;
  aceita_pagamento_debito?: boolean;
  aceita_pagamento_dinheiro?: boolean;
  aceita_pedido_ja_pago?: boolean;
  tempo_limite_cancelamento_restaurante_minutos?: number;
  permitir_observacao_entrega_motoboy?: boolean;
  permitir_agrupar_entregas_mesmo_motoboy?: boolean;
  permitir_chat_entrega?: boolean;
  funcionamento_ativo?: boolean;
  funcionamento_inicio?: string;
  funcionamento_fim?: string;
  funcionamento_dias_semana?: number[];
  created_at: string;
}

export interface UsuarioEmpresa {
  id: string;
  user_id: string;
  empresa_id: string;
  role: string;
}

export interface Motoboy {
  id: string;
  empresa_id: string;
  user_id?: string | null;
  email?: string | null;
  nome: string;
  cpf: string;
  telefone: string;
  placa_veiculo: string;
  status: 'ativo' | 'offline' | 'em_entrega';
  ativo: boolean;
  foto_url?: string | null;
  entrega_ativa_id?: string | null;
  maquininha_serial?: string | null;
  fcm_token?: string | null;
  created_at: string;
}

export interface Restaurante {
  id: string;
  empresa_id: string;
  user_id?: string | null;
  email?: string | null;
  nome: string;
  telefone: string;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: 'ativo' | 'inativo';
  foto_url?: string | null;
  pode_editar_pedido?: boolean;
  pix_nome_completo?: string | null;
  pix_cpf?: string | null;
  pix_chave?: string | null;
  pagbank_conta?: string | null;
  pagbank_digito?: string | null;
  created_at: string;
}

export interface Entrega {
  id: string;
  empresa_id: string;
  restaurante_id: string;
  motoboy_id: string | null;
  endereco_entrega: string;
  valor: number | null;
  valor_pedido?: number | null;
  observacao: string | null;
  observacao_motoboy?: string | null;
  comprovante_entrega_url?: string | null;
  comprovante_entrega_em?: string | null;
  status: 'aguardando_despacho' | 'pendente' | 'aceita' | 'coletada' | 'em_rota' | 'entregue' | 'cancelada';
  numero: string;
  numero_externo?: string | null;
  origem_integracao?: string | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  latitude_entrega?: number | null;
  longitude_entrega?: number | null;
  ordem_rota?: number | null;
  aceita_em?: string | null;
  coleta_expira_em?: string | null;
  motoboy_chegou_em?: string | null;
  entregue_em?: string | null;
  acertada: boolean;
  acertada_em?: string | null;
  acertada_por?: string | null;
  forma_pagamento?: string | null;
  valor_pago_dinheiro?: number | null;
  pagamento_status?: string | null;
  ifood_localizador?: string | null;
  ifood_order_id?: string | null;
  created_at: string;
  ultima_tentativa_distribuicao_em?: string | null;
  restaurantes?: { nome: string };
  motoboys?: { nome: string };
}

export interface SolicitacaoAlteracao {
  id: string;
  empresa_id: string;
  tipo_entidade: 'motoboy' | 'restaurante';
  entidade_id: string;
  user_id: string;
  dados_anteriores: any;
  dados_novos: any;
  status: 'pendente' | 'aprovada' | 'rejeitada';
  motivo_rejeicao?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  motoboys?: { nome: string; foto_url?: string };
  restaurantes?: { nome: string; foto_url?: string };
}

export interface BloqueioMotoboyRestaurante {
  id: string;
  empresa_id: string;
  motoboy_id: string;
  restaurante_id: string;
  motivo: string | null;
  created_at: string;
  restaurantes?: { nome: string };
  motoboys?: { nome: string };
}

export interface HistoricoEntrega {
  id: string;
  entrega_id: string;
  empresa_id: string;
  restaurante_id: string;
  motoboy_id: string | null;
  status: string;
  descricao: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  entrega_id: string;
  empresa_id: string;
  restaurante_id: string;
  motoboy_id: string | null;
  remetente_id: string;
  remetente_tipo: 'empresa' | 'restaurante' | 'motoboy';
  remetente_nome: string;
  mensagem: string;
  created_at: string;
  lida: boolean;
}

export interface AuthContextType {
  user: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export interface LoteRepasse {
  id: string;
  restaurante_id: string;
  data_inicio: string;
  data_fim: string;
  valor_pago?: number | null;
  valor_total?: number | null;
  status_repasse: string;
  pago_em?: string | null;
  comprovante_url?: string | null;
  created_at: string;
}

export interface PagamentoPagbank {
  id: string;
  entrega_id?: string | null;
  restaurante_id: string;
  empresa_id?: string | null;
  valor_total: number;
  valor_restaurante: number;
  valor_plataforma: number;
  status_pagamento?: string | null;
  status_repasse?: string | null;
  lote_repasse_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}
