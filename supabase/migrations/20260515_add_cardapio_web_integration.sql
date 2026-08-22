-- Adicionar suporte a integração Cardápio Web na tabela restaurantes
ALTER TABLE restaurantes 
ADD COLUMN IF NOT EXISTS cardapio_web_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cardapio_web_api_key TEXT,
ADD COLUMN IF NOT EXISTS cardapio_web_store_id TEXT,
ADD COLUMN IF NOT EXISTS cardapio_web_base_url TEXT DEFAULT 'https://api.cardapioweb.com/v1';

-- Índice para busca rápida (opcional, mas bom para performance se houver muitos)
CREATE INDEX IF NOT EXISTS idx_restaurantes_cardapio_web ON restaurantes(cardapio_web_active) WHERE cardapio_web_active = TRUE;
