-- Migración: Campos de suscripción y Mercado Pago en profiles
-- Permite almacenar la referencia preapproval_id, el estado de Mercado Pago,
-- y el tipo y vigencia del plan en la tabla profiles.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT NULL,
ADD COLUMN IF NOT EXISTS mp_status TEXT NULL,
ADD COLUMN IF NOT EXISTS plan_type TEXT NULL DEFAULT 'prueba',
ADD COLUMN IF NOT EXISTS plan_start_date TEXT NULL,
ADD COLUMN IF NOT EXISTS plan_end_date TEXT NULL,
ADD COLUMN IF NOT EXISTS account_status TEXT NULL DEFAULT 'active';

COMMENT ON COLUMN public.profiles.mp_preapproval_id IS 'ID de suscripción preapproval en Mercado Pago';
COMMENT ON COLUMN public.profiles.mp_status IS 'Estado de la suscripción en Mercado Pago (authorized, paused, cancelled)';
COMMENT ON COLUMN public.profiles.plan_type IS 'Tipo de plan (prueba, mensual, trimestral, anual)';
COMMENT ON COLUMN public.profiles.plan_end_date IS 'Fecha de fin o vencimiento del plan (YYYY-MM-DD)';
COMMENT ON COLUMN public.profiles.account_status IS 'Estado de la cuenta (active, suspended, deactivated)';
