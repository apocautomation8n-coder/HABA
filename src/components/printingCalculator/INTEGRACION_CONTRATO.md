# Contrato de integración HABA — Calculadora de impresión

## 1. Contexto

La calculadora es un único módulo reutilizable.

```js
window.HABA_INTEGRATION.context = {
  origin: "insumos" | "producto",
  productId: string | null,
  sourceInsumoIdsByConfigId: Record<string, string>
};
```

`productId` es obligatorio cuando `origin === "producto"`.

`sourceInsumoIdsByConfigId` permite vincular las tintas/tóneres con los IDs reales de HABA. Es opcional en modo independiente.

## 2. Guardado

La calculadora llama:

```js
await window.HABA_INTEGRATION.savePrintingInsumo(payload)
```

Respuesta exitosa:

```js
{ ok: true, insumoId: "..." }
```

Cuando `origin === "producto"`, `insumoId` real es obligatorio. El guardado exitoso no debe considerarse fallido si posteriormente falla la navegación de retorno al Producto; no se debe repetir el guardado.

Respuesta de error:

```js
{ ok: false, message: "..." }
```

También puede rechazarse mediante excepción.

## 3. Payload mínimo esperado

El payload contiene, como mínimo:

- `name`
- `quantity: 1`
- `unit: "u"`
- `replacementCost`
- `currency: "ARS"`
- `technology`
- `printConfiguration`
- `calculation`
- `sourceConsumables[]`
- `dependency`
- `entryContext`

`sourceConsumables[]` debe conservar los IDs reales de HABA cuando estén disponibles.

## 4. Reglas de persistencia

El resultado es un **insumo genérico**, no una nueva categoría visible.

No crear `Impresión` como tipo/categoría de Insumos.

El backend debe conservar composición/dependencias y recalcular el costo cuando cambien las fuentes.

## 5. Flujo desde Insumos

Guardar → confirmar guardado real → permanecer en calculadora.

`← Volver a HABA` → `navigateBack({ origin: "insumos", productId: null })`.

## 6. Flujo desde Producto

Guardar → obtener `insumoId` real → llamar:

```js
await window.HABA_INTEGRATION.onPrintingInsumoSaved({
  origin: "producto",
  productId,
  insumoId,
  payload
})
```

HABA vuelve al producto en edición y agrega/selecciona el nuevo insumo sin obligar al usuario a buscarlo otra vez.

## 7. Salida con cambios pendientes

Si hay datos modificados sin guardar, mostrar:

> ¿Querés salir de la calculadora?
> Los datos que cargaste no se guardarán.

`Seguir en calculadora` cancela la salida. `Salir` llama a `navigateBack`.

## 8. Responsabilidades

**Calculadora:** lógica específica de impresión, UI, cálculo, composición y payload.

**HABA:** autenticación/contexto, IDs reales de Insumos, persistencia, relaciones de dependencia, recálculo y alertas de productos afectados, navegación e integración con Producto.


## 9. Parámetros técnicos de impresión
La configuración puede conservar formato de papel (incluido Personalizado), superficie, simple/doble faz y base de referencia modificable. Estos datos sirven para estimar superficie y cobertura. **El precio del papel no forma parte de esta calculadora y nunca debe sumarse al costo calculado.**
