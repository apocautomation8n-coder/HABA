// Ejemplo conceptual para el equipo HABA.
window.HABA_INTEGRATION = {
  context: { origin: "insumos", productId: null },

  savePrintingInsumo: async (payload) => {
    // Reemplazar por el servicio real de HABA.
    // Debe crear/actualizar el insumo derivado y devolver su ID.
    return { ok: true, insumoId: "INSUMO_GENERADO_ID" };
  },

  navigateBack: async ({ origin, productId }) => {
    // origin=insumos: volver a Insumos.
    // origin=producto: volver al producto en edición.
  },

  onPrintingInsumoSaved: async ({ productId, insumoId, payload }) => {
    // Volver al producto y agregar/seleccionar insumoId.
  }
};
