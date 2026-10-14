-- Migración: Agregar medidas dimensionales opcionales para insumos por unidad en HABA
-- Permite fraccionar insumos comprados por unidad (ej. planchas de goma, acrílico, placas)
-- mediante cortes de ancho x largo en recetas de productos.

ALTER TABLE public.supplies
ADD COLUMN IF NOT EXISTS unit_width NUMERIC NULL,
ADD COLUMN IF NOT EXISTS unit_length NUMERIC NULL,
ADD COLUMN IF NOT EXISTS unit_dimension_unit TEXT NULL DEFAULT 'cm';

-- Comentarios documentando las columnas
COMMENT ON COLUMN public.supplies.unit_width IS 'Ancho base de la unidad de compra cuando se adquiere por unidad y se fracciona por corte';
COMMENT ON COLUMN public.supplies.unit_length IS 'Largo base de la unidad de compra cuando se adquiere por unidad y se fracciona por corte';
COMMENT ON COLUMN public.supplies.unit_dimension_unit IS 'Unidad de medida de ancho y largo de la unidad: cm, mm, o m (por defecto cm)';
