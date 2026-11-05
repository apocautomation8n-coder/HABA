-- Migración: Estados de presupuesto
-- borrador | pendiente | aceptado | rechazado. "Vencido" no se guarda: se calcula cuando un
-- presupuesto pendiente pasó su fecha de validez.
-- Los presupuestos existentes quedan como "pendiente".

ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NULL;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes
ADD CONSTRAINT quotes_status_check CHECK (status IN ('borrador', 'pendiente', 'aceptado', 'rechazado'));

CREATE INDEX IF NOT EXISTS idx_quotes_user_status ON public.quotes (user_id, status);

COMMENT ON COLUMN public.quotes.status IS 'Estado del presupuesto: borrador, pendiente, aceptado o rechazado (vencido se calcula)';
COMMENT ON COLUMN public.quotes.status_updated_at IS 'Fecha del último cambio de estado';

NOTIFY pgrst, 'reload schema';
