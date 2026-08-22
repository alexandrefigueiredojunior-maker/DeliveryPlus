-- Migração para liberar leitura de repasses e configurações PagBank para o Restaurante autenticado

-- 1. Tabela configuracoes_empresas: permitir que o restaurante leia a configuração da sua própria empresa
ALTER TABLE public.configuracoes_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurante ve configuracoes da sua empresa" ON public.configuracoes_empresas;
DROP POLICY IF EXISTS "Restaurantes podem ler configuracoes da sua empresa" ON public.configuracoes_empresas;
CREATE POLICY "restaurante ve configuracoes da sua empresa"
ON public.configuracoes_empresas
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id
    FROM public.restaurantes
    WHERE user_id = auth.uid()
  )
);

-- 2. Tabela pagamentos_pagbank: permitir que o restaurante leia exclusivamente seus próprios pagamentos
ALTER TABLE public.pagamentos_pagbank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurante ve seus pagamentos pagbank" ON public.pagamentos_pagbank;
DROP POLICY IF EXISTS "Restaurantes podem ler seus proprios pagamentos pagbank" ON public.pagamentos_pagbank;
CREATE POLICY "restaurante ve seus pagamentos pagbank"
ON public.pagamentos_pagbank
FOR SELECT
TO authenticated
USING (
  restaurante_id IN (
    SELECT id
    FROM public.restaurantes
    WHERE user_id = auth.uid()
  )
);

-- 3. Tabela lotes_repasse: permitir que o restaurante leia exclusivamente seus próprios lotes de repasse
ALTER TABLE public.lotes_repasse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurante ve seus lotes de repasse" ON public.lotes_repasse;
DROP POLICY IF EXISTS "Restaurantes podem ler seus proprios lotes de repasse" ON public.lotes_repasse;
CREATE POLICY "restaurante ve seus lotes de repasse"
ON public.lotes_repasse
FOR SELECT
TO authenticated
USING (
  restaurante_id IN (
    SELECT id
    FROM public.restaurantes
    WHERE user_id = auth.uid()
  )
);

