-- Adicionar coluna ativo na tabela empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;
