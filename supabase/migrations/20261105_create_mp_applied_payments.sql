-- Migración: Registro único de pagos de Mercado Pago acreditados
-- Cada pago aprobado se puede acreditar una sola vez y a una sola cuenta.
-- La clave primaria sobre payment_id hace que un segundo intento (repetir el mismo pago,
-- alternar entre pagos viejos o reclamar el pago de otra persona) falle en la base.
-- Solo el servidor (service_role) lee y escribe: RLS activo y sin políticas.

CREATE TABLE IF NOT EXISTS public.mp_applied_payments (
    payment_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    amount NUMERIC NULL,
    currency TEXT NULL,
    source TEXT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_applied_payments_user_id ON public.mp_applied_payments (user_id);

ALTER TABLE public.mp_applied_payments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.mp_applied_payments IS 'Pagos de Mercado Pago ya acreditados (uno por pago, para evitar acreditaciones duplicadas)';

NOTIFY pgrst, 'reload schema';
