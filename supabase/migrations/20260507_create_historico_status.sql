-- Tabela de histórico de status das entregas
CREATE TABLE IF NOT EXISTS public.historico_status_entregas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entrega_id UUID NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    restaurante_id UUID NOT NULL REFERENCES public.restaurantes(id) ON DELETE CASCADE,
    motoboy_id UUID REFERENCES public.motoboys(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    descricao TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.historico_status_entregas ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
CREATE POLICY "Empresa pode ver histórico das suas entregas"
ON public.historico_status_entregas
FOR SELECT
USING (
    empresa_id IN (
        SELECT empresa_id FROM public.usuarios_empresa 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Restaurante pode ver histórico das suas entregas"
ON public.historico_status_entregas
FOR SELECT
USING (
    restaurante_id IN (
        SELECT id FROM public.restaurantes 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Motoboy pode ver histórico das suas entregas"
ON public.historico_status_entregas
FOR SELECT
USING (
    motoboy_id IN (
        SELECT id FROM public.motoboys 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Qualquer um logado pode inserir histórico (temporário para facilitar devs)"
ON public.historico_status_entregas
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
