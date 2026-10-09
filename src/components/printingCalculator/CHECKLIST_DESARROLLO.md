# Checklist de desarrollo — HABA Calculadora de impresión

## Entrada y navegación
- [ ] Abrir la misma calculadora desde Insumos.
- [ ] Abrir la misma calculadora desde Crear/Editar Producto.
- [ ] Pasar `origin` correctamente.
- [ ] Pasar `productId` cuando `origin === "producto"`.
- [ ] Pasar `sourceInsumoIdsByConfigId` cuando HABA ya conoce los insumos fuente.
- [ ] Implementar `navigateBack`.
- [ ] Probar salida con datos sin guardar.

## Guardado
- [ ] Implementar `savePrintingInsumo` contra el backend real.
- [ ] La respuesta exitosa debe devolver `insumoId` real.
- [ ] La confirmación visual debe depender de la respuesta real del backend.
- [ ] Un error no debe crear un insumo parcial ni borrar los datos de la calculadora.

## Insumo derivado
- [ ] Guardar como insumo genérico: cantidad 1, unidad u.
- [ ] No crear categoría visible `Impresión`.
- [ ] Persistir composición y parámetros necesarios para recalcular.
- [ ] Persistir vínculos con los IDs reales de los insumos fuente.

## Dependencias
- [ ] Cuando cambie una tinta/tóner fuente, recalcular el insumo derivado.
- [ ] Ejecutar el mecanismo existente de productos afectados/alertas.
- [ ] Verificar que el producto no quede con un costo congelado.

## Flujo desde Insumos
- [ ] Guardar y permanecer en la calculadora.
- [ ] Poder guardar varios insumos de impresión en la misma sesión.
- [ ] `← Volver a HABA` devuelve a Insumos.

## Flujo desde Producto
- [ ] Guardar y volver al producto que se estaba editando.
- [ ] Agregar/seleccionar automáticamente el nuevo insumo.
- [ ] No obligar al usuario a buscarlo nuevamente.

## Cálculo y referencias
- [ ] Tank 4: rendimiento base 4000.
- [ ] Tank 6: rendimiento base 4000.
- [ ] Sublimación: rendimiento base 4000.
- [ ] Láser monocromo: rendimiento base 2500.
- [ ] Láser color: rendimiento base 1800.
- [ ] Coberturas exactas: 5 / 10 / 25 / 50 / 75 / 100.
- [ ] Textos exactos: Texto / renglones; Imagen pequeña; Imagen mediana; Imagen con bastante cobertura; Imagen grande; Imagen completa.
- [ ] Multiplicadores: 1 / 2 / 5 / 10 / 15 / 20.
- [ ] Permitir modificar la base de referencia cuando el usuario lo desee.
- [ ] El formato de papel, incluido Personalizado, se usa solo para determinar superficie/cobertura; nunca se suma costo de papel.
- [ ] Permitir simple faz / doble faz y conservarlo como parámetro técnico de impresión.
- [ ] No permitir NaN, Infinity, división por cero ni costos negativos.

## Fuera de alcance
- [ ] No agregar margen, mano de obra, electricidad, desperdicio, stock, ventas, facturación, proveedores, reportes o conexión a impresoras.
- [ ] No convertir el módulo en una categoría contable de Insumos.
