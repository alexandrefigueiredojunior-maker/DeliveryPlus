-- Tabela de bloqueios de motoboys por restaurante
CREATE TABLE IF NOT EXISTS public.bloqueios_motoboy_restaurante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    motoboy_id UUID NOT NULL REFERENCES public.motoboys(id) ON DELETE CASCADE,
    restaurante_id UUID NOT NULL REFERENCES public.restaurantes(id) ON DELETE CASCADE,
    motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(motoboy_id, restaurante_id)
);

-- Habilitar RLS
ALTER TABLE public.bloqueios_motoboy_restaurante ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Empresa gerencia seus bloqueios)
CREATE POLICY "Empresa gerencia seus bloqueios" 
ON public.bloqueios_motoboy_restaurante
FOR ALL 
USING (
    empresa_id IN (
        SELECT empresa_id FROM public.usuarios_empresa 
        WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    empresa_id IN (
        SELECT empresa_id FROM public.usuarios_empresa 
        WHERE user_id = auth.uid()
    )
);

-- Motoboys podem ler bloqueios para filtrar entregas
CREATE POLICY "Motoboys leem bloqueios"
ON public.bloqueios_motoboy_restaurante
FOR SELECT
USING (
    motoboy_id IN (
        SELECT id FROM public.motoboys 
        WHERE user_id = auth.uid()
    )
);

-- Restaurantes podem ler bloqueios se necessário (opcional)
CREATE POLICY "Restaurantes leem bloqueios"
ON public.bloqueios_motoboy_restaurante
FOR SELECT
USING (
    restaurante_id IN (
        SELECT id FROM public.restaurantes 
        WHERE user_id = auth.uid()
    )
);
