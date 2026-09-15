-- Migración: Tabla de Subproductos / Componentes de Productos (HABA)
-- Permite que un producto registrado pueda ser utilizado como componente de otro producto,
-- sumando estrictamente su costo base de fabricación (sin precios de venta ni márgenes).

CREATE TABLE IF NOT EXISTS public.product_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    component_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Restricción 1: Un producto no puede contenerse a sí mismo
    CONSTRAINT chk_no_self_component CHECK (parent_product_id <> component_product_id),
    
    -- Restricción 2: Evitar filas duplicadas para el mismo componente dentro de un producto padre
    CONSTRAINT uq_parent_component UNIQUE (parent_product_id, component_product_id)
);

-- Índices de búsqueda para optimizar uniones y consultas
CREATE INDEX IF NOT EXISTS idx_product_components_parent ON public.product_components(parent_product_id);
CREATE INDEX IF NOT EXISTS idx_product_components_component ON public.product_components(component_product_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS vinculadas a la propiedad del producto padre por el usuario autenticado
CREATE POLICY "Users can view components of their own products"
ON public.product_components
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_components.parent_product_id
          AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert components into their own products"
ON public.product_components
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_components.parent_product_id
          AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update components of their own products"
ON public.product_components
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_components.parent_product_id
          AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete components of their own products"
ON public.product_components
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_components.parent_product_id
          AND p.user_id = auth.uid()
    )
);
