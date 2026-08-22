-- Adicionar coluna mostrar_mapa_motoboys_restaurante na tabela configuracoes_empresas
ALTER TABLE public.configuracoes_empresas 
ADD COLUMN IF NOT EXISTS mostrar_mapa_motoboys_restaurante BOOLEAN DEFAULT false;
