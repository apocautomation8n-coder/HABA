-- Migración: Preferencias de moneda y formato numérico por usuaria (T4)
-- Permite que cada usuaria configure su moneda (ARS, MXN, CLP, USD, etc.),
-- su locale numérico (es-AR, es-MX, es-CL, en-US, etc.) y cantidad de decimales (0 o 2).

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS currency TEXT NULL DEFAULT 'ARS',
ADD COLUMN IF NOT EXISTS number_locale TEXT NULL DEFAULT 'es-AR',
ADD COLUMN IF NOT EXISTS decimals INTEGER NULL DEFAULT 2;

-- Documentación de columnas
COMMENT ON COLUMN public.profiles.currency IS 'Código ISO de la moneda de la usuaria (ARS, MXN, CLP, USD, etc.)';
COMMENT ON COLUMN public.profiles.number_locale IS 'Locale estándar para formato de números y moneda (es-AR, es-MX, es-CL, en-US, etc.)';
COMMENT ON COLUMN public.profiles.decimals IS 'Cantidad de decimales para presentación y totales de presupuestos (0 para CLP/COP o 2 estándar)';

-- Asegurar valores por defecto en registros existentes
UPDATE public.profiles
SET
  currency = COALESCE(currency, 'ARS'),
  number_locale = COALESCE(number_locale, 'es-AR'),
  decimals = COALESCE(decimals, 2)
WHERE currency IS NULL OR number_locale IS NULL OR decimals IS NULL;
