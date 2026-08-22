-- Adicionar suporte a integração oficial Anota AI na tabela restaurantes
ALTER TABLE restaurantes 
ADD COLUMN IF NOT EXISTS anota_ai_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS anota_ai_client_id TEXT,
ADD COLUMN IF NOT EXISTS anota_ai_client_secret TEXT,
ADD COLUMN IF NOT EXISTS anota_ai_external_id TEXT;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_restaurantes_anota_ai ON restaurantes(anota_ai_active) WHERE anota_ai_active = TRUE;
