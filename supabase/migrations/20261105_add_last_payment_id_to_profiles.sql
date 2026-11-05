-- Migración: Agregar columna last_payment_id a profiles
-- Permite almacenar el ID del último pago acreditado de Mercado Pago
-- para prevenir acreditaciones duplicadas de días de acceso (anti-abuso).

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_payment_id TEXT NULL;

COMMENT ON COLUMN public.profiles.last_payment_id IS 'ID de la última operación o cobro de Mercado Pago acreditado a la cuenta';

