-- Drop if exists to avoid errors on reapplying
DROP VIEW IF EXISTS public.motoboys_publico;

-- Create the view with only safe columns
CREATE VIEW public.motoboys_publico AS
SELECT 
    id,
    empresa_id,
    nome,
    telefone,
    foto_url,
    status,
    ativo,
    placa_veiculo
FROM public.motoboys;

-- Grant access to authenticated users
GRANT SELECT ON public.motoboys_publico TO authenticated;
GRANT SELECT ON public.motoboys_publico TO anon;
