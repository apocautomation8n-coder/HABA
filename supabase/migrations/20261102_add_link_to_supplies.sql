-- Migración: Link de referencia opcional para cada insumo
-- Permite guardar dónde se compra el insumo (ej. una publicación de AliExpress o Mercado Libre)
-- sin tener que pegarlo en el nombre.

ALTER TABLE public.supplies
ADD COLUMN IF NOT EXISTS link TEXT NULL;

COMMENT ON COLUMN public.supplies.link IS 'Link de referencia o de compra del insumo (opcional, solo http/https)';

-- Refrescar la caché de esquema de la API para que la columna se pueda usar al instante
NOTIFY pgrst, 'reload schema';
