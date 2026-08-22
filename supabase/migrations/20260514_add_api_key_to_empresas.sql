-- Adicionar suporte a pedidos externos na tabela empresas
ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS permite_pedidos_externos BOOLEAN DEFAULT FALSE;

-- Criar um índice para busca rápida por api_key
CREATE INDEX IF NOT EXISTS idx_empresas_api_key ON empresas(api_key);
