-- ==========================================================
-- Migración: Validez y vigencia del presupuesto en quotes
-- ==========================================================

-- Agregar columnas para validez y fecha límite en quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 15;

-- Comentarios descriptivos
COMMENT ON COLUMN public.quotes.valid_until IS 'Fecha límite de validez del presupuesto comercial';
COMMENT ON COLUMN public.quotes.validity_days IS 'Cantidad de días corridos de vigencia desde la emisión del presupuesto';
