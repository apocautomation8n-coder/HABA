-- ====================================================================
-- Migración: Identificador Interno Administrativo / ID de Usuario (01, 02, 03...)
-- ====================================================================

-- 1. Crear secuencia de numeración a partir de 1
CREATE SEQUENCE IF NOT EXISTS public.haba_account_number_seq START WITH 1;

-- 2. Agregar columna account_number en profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_number TEXT;

-- 3. Comentario descriptivo
COMMENT ON COLUMN public.profiles.account_number IS 'Identificador interno administrativo único e inmutable de la cuenta (ej: 01, 02, 03)';

-- 4. Asignar secuencialmente el identificador a las cuentas ya existentes (ordenadas por created_at)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id 
    FROM public.profiles 
    WHERE account_number IS NULL OR account_number = ''
    ORDER BY created_at ASC 
  LOOP
    UPDATE public.profiles
    SET account_number = LPAD(nextval('public.haba_account_number_seq')::TEXT, 2, '0')
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- 5. Aplicar restricciones de integridad: UNIQUE y NOT NULL
ALTER TABLE public.profiles ALTER COLUMN account_number SET NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_number_unique;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_number_unique UNIQUE (account_number);

-- 6. Función y Trigger para autogenerar el número de cuenta al registrarse un nuevo perfil
CREATE OR REPLACE FUNCTION public.generate_haba_account_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_number IS NULL OR NEW.account_number = '' THEN
    NEW.account_number := LPAD(nextval('public.haba_account_number_seq')::TEXT, 2, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_haba_account_number ON public.profiles;
CREATE TRIGGER trg_set_haba_account_number
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.generate_haba_account_number();

-- 7. Función y Trigger de Inmutabilidad: Prohibir cualquier modificación de account_number
CREATE OR REPLACE FUNCTION public.prevent_account_number_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.account_number IS NOT NULL AND NEW.account_number IS DISTINCT FROM OLD.account_number THEN
    RAISE EXCEPTION 'account_number es inmutable y no puede ser modificado una vez asignado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_account_number_update ON public.profiles;
CREATE TRIGGER trg_prevent_account_number_update
BEFORE UPDATE OF account_number ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_account_number_update();
