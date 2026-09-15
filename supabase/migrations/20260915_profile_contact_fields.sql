-- ==========================================================
-- Migración: Datos de contacto del emprendimiento en profiles
-- ==========================================================

-- Agregar columnas para datos de contacto de presupuestos y PDF
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Comentarios explicativos
COMMENT ON COLUMN public.profiles.phone IS 'Teléfono o WhatsApp principal del usuario';
COMMENT ON COLUMN public.profiles.business_phone IS 'Teléfono o WhatsApp comercial para presupuestos y clientes';
COMMENT ON COLUMN public.profiles.business_email IS 'Correo electrónico comercial o de contacto para presupuestos';
COMMENT ON COLUMN public.profiles.instagram IS 'Usuario o enlace de Instagram / red social del taller';
COMMENT ON COLUMN public.profiles.address IS 'Ubicación, ciudad o taller del emprendimiento';
