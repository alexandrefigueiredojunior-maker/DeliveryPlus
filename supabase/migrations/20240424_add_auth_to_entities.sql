-- Migração para suporte a Login de Motoboys e Restaurantes

-- Adicionar colunas email e user_id na tabela motoboys
ALTER TABLE motoboys ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE motoboys ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id);

-- Adicionar colunas email e user_id na tabela restaurantes
ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id);

-- Adicionar políticas de segurança se necessário
-- Exemplo: apenas a empresa dona pode ver o email
-- ALTER TABLE motoboys ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Empresas podem ver emails de seus motoboys" ON motoboys
--   FOR SELECT USING (auth.uid() IN (SELECT user_id FROM usuarios_empresas WHERE empresa_id = motoboys.empresa_id));
