/* HABA — adapter de integración para la Calculadora de impresión
 *
 * Este archivo es una plantilla de contrato. Desarrollo debe conectar estas
 * funciones con los servicios reales de HABA. La calculadora NO debe escribir
 * directamente en la base de datos.
 */

window.HABA_INTEGRATION = {
  context: {
    // "insumos" | "producto"
    origin: "insumos",
    // Obligatorio cuando origin === "producto"
    productId: null,

    // Opcional: mapa entre los configId internos de la calculadora y los IDs
    // reales de Insumos de HABA. Ej.: { cyan: "insumo_123", magenta: "insumo_456" }
    sourceInsumoIdsByConfigId: {}
  },

  async savePrintingInsumo(payload) {
    // POST/servicio real de HABA.
    // Debe persistir el insumo derivado y su composición/dependencias.
    // Debe devolver: { ok: true, insumoId: "..." }
    throw new Error("Implementar savePrintingInsumo en HABA.");
  },

  async onPrintingInsumoSaved({ productId, insumoId, payload }) {
    // Solo para origin === "producto".
    // 1) volver al producto que estaba en edición;
    // 2) agregar/seleccionar insumoId en sus costos/insumos;
    // 3) conservar la edición actual del producto.
    throw new Error("Implementar onPrintingInsumoSaved en HABA.");
  },

  async navigateBack({ origin, productId }) {
    // origin === "insumos": volver a Insumos.
    // origin === "producto": volver al producto en edición.
    throw new Error("Implementar navigateBack en HABA.");
  }
};
