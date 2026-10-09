# Integración HABA — Calculadora de impresión

## Principio

Existe **una sola calculadora**. Puede abrirse desde Insumos o desde Crear/Editar Producto. No duplicar el módulo.

## Entradas

### Desde Insumos
`origin: "insumos"`

Ruta sugerida:
`Insumos → + Agregar → 🖨️ Costo de impresión`

Después de guardar: permanecer en la calculadora para poder crear otro insumo de impresión.

### Desde Producto
`origin: "producto"` + `productId`

Ruta sugerida:
`Producto → + Agregar insumo → Crear nuevo → 🖨️ Costo de impresión`

Después de guardar: volver al producto en edición y agregar/seleccionar automáticamente el insumo creado.

## Puente

La app host debe proveer:

- `context`
- `savePrintingInsumo(payload)`
- `onPrintingInsumoSaved(...)`
- `navigateBack(...)`

La calculadora no accede directamente a la base de datos.

## Insumo derivado

Se guarda como un insumo genérico de HABA:

- cantidad: `1`
- unidad: `u`
- costo/precio de reposición: costo calculado actual
- origen interno: calculadora de impresión

No crear una categoría visible `Impresión`.

## Dependencias

El backend debe guardar la composición y los vínculos con los insumos fuente. El valor actual no puede quedar como número congelado.

Cuando cambie el precio de una tinta/tóner fuente, HABA debe recalcular el insumo derivado y ejecutar su flujo existente de productos afectados/alertas.

## Modo independiente

Fuera de HABA, el HTML puede usar el fallback `localStorage` únicamente para pruebas. Esa confirmación no representa un guardado de producción.
