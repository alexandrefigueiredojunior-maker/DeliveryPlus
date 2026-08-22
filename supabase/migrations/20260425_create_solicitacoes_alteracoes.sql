
-- Tabela de solicitações de alterações
CREATE TABLE IF NOT EXISTS public.solicitacoes_alteracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo_entidade TEXT NOT NULL CHECK (tipo_entidade IN ('motoboy', 'restaurante')),
    entidade_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    dados_anteriores JSONB NOT NULL,
    dados_novos JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
    motivo_rejeicao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.solicitacoes_alteracoes ENABLE ROW LEVEL SECURITY;

-- Policies para solicitacoes_alteracoes
CREATE POLICY "Empresas podem ver todas as solicitacoes da sua empresa"
ON public.solicitacoes_alteracoes
FOR SELECT
TO authenticated
USING (empresa_id IN (
    SELECT empresa_id FROM public.usuarios_empresas WHERE user_id = auth.uid()
));

CREATE POLICY "Empresas podem atualizar solicitacoes da sua empresa"
ON public.solicitacoes_alteracoes
FOR UPDATE
TO authenticated
USING (empresa_id IN (
    SELECT empresa_id FROM public.usuarios_empresas WHERE user_id = auth.uid()
))
WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM public.usuarios_empresas WHERE user_id = auth.uid()
));

CREATE POLICY "Motoboys e Restaurantes podem ver suas próprias solicitacoes"
ON public.solicitacoes_alteracoes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Motoboys e Restaurantes podem criar solicitacoes"
ON public.solicitacoes_alteracoes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_solicitacoes_empresa ON public.solicitacoes_alteracoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON public.solicitacoes_alteracoes(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_user ON public.solicitacoes_alteracoes(user_id);
