# Brief Técnico — Kickoff "HABA" (Amaoto Craft)

**Cliente:** Amaoto Craft — Giulianna "Gio" Penna
**Proyecto:** HABA — app web de costeo, precios y presupuestos para emprendedoras
**Presupuesto cerrado:** $2.000.000 ARS desarrollo + $50.000 ARS/mes mantenimiento
**Plazo comprometido:** ~1 mes
**Contrato:** enviado para firma (pendiente confirmación de pago inicial)
**Fuente:** 2 llamadas comerciales (07/09 y 08/09) + documento funcional "HABA" enviado por la clienta + 17 mockups ilustrativos (no vinculantes al diseño final)

---

## 1. Qué resuelve

Gio vende libretas (cuero/cartón) físicas y también contenido digital para otras emprendedoras. Detectó que la mayoría de sus consultas son "¿cómo pongo precio a mi producto?" — hoy lo resuelven con Excel, pero en el momento (colectivo, changas, celular en mano) no es práctico.

**Loop central de la app (así lo definió el doc funcional):**
`Cuánto te cuesta → cuánto cobrar → cuánto ganás → presupuestá`

**Fuera de alcance explícito:** no es un sistema contable, no factura, no lleva ARCA/monotributo, no registra ventas históricas de ingresos/egresos del negocio.

---

## 2. Tipo de producto

- Aplicación **web responsive (PWA)**, instalable como ícono desde el navegador — **no** app nativa (por costo y por fees de tiendas, ya se lo explicamos así a Gio).
- Multiplataforma: celu, tablet, compu.
- Multi-tenant: cada emprendedora (usuaria) es una cuenta independiente dentro del sistema de Gio. Gio administra altas/bajas de usuarias desde un panel propio (no hay autogestión de pago dentro de la app — eso lo gestiona ella "a mano": si le pagan, la da de alta; si no, la da de baja).
- Dos estados de baja de usuaria: **apagar** (no puede entrar más pero conserva los datos) y **eliminar** (borra todo). Confirmar con Gio si esto lo maneja ella manualmente o si en algún momento se automatiza.

---

## 3. Módulos funcionales

### 3.1 Insumos
- Campos: nombre, unidad de compra, cantidad comprada, precio actual de reposición, unidad utilizada en el producto.
- **El precio que se usa en los cálculos es siempre el de reposición actual**, nunca el de compra original. Al actualizar el precio de un insumo hay que **conservar el histórico** de precios anteriores (no sobreescribir).
- Conversión de unidades automática: m→cm, kg→g, hojas tipo A4, y otras según el insumo. Necesitamos definir con Gio el set de unidades soportadas (no va a ser un conversor universal, sino un catálogo cerrado de unidades típicas de manualidades/gastronomía).
- **Sin merma** — Gio decidió sacarla del alcance para no complicar a la usuaria. No implementar campo de merma en insumos ni en productos.

### 3.2 Packaging
- Se carga como un insumo más (bolsa, caja, sobre, etiqueta, tarjeta, cinta, papel, envoltorio), reutilizable entre productos. No es un módulo aparte, es una categoría de insumo.

### 3.3 Productos
- Campos: nombre, insumos utilizados + cantidad de cada uno, packaging, tiempo de trabajo (minutos), precio de venta.
- **Precio por canal de venta**: un mismo producto puede tener varios precios simultáneos según canal (habitual, mayorista, feria, online, cliente particular, u otro que la usuaria defina). Un solo costo, múltiples precios — no duplicar el producto por canal.
- Acciones sobre un producto: ver, crear, editar, consultar costo, consultar precio, ver ganancia, duplicar, usar en presupuesto.

### 3.4 Gastos fijos
- Alquiler, luz, internet, teléfono, herramientas/servicios digitales, impuestos, otros.
- Cada gasto tiene una periodicidad (mensual, bimestral, trimestral, anual) y el sistema lo **normaliza a un equivalente mensual** para poder usarlo en los cálculos.

### 3.5 Valor de la hora de trabajo (mano de obra) — **opcional, no excluyente**
Esto lo precisó Gio en el último mensaje, es importante que quede bien claro:

- Se calcula a partir de: gastos fijos mensuales + sueldo pretendido por mes, en relación a días trabajados por mes y horas trabajadas por día.
- Con eso se obtiene un **valor de referencia por hora** (y de ahí, por minuto).
- Ese valor por minuto se aplica **proporcionalmente a los minutos que la usuaria carga al crear cada producto** (ej: producto tarda 45 min → 45 × valor-por-minuto = costo de mano de obra de ese producto).
- **Clave:** esta función tiene que ser opcional a nivel producto. Hay emprendedoras que solo quieren ver su costo variable (insumos + packaging), sin mano de obra. El cálculo de costo del producto no puede depender de que este módulo esté configurado.

### 3.6 Cálculo de costos y precios
- Costo de producto = insumos + packaging + otros costos directos + (mano de obra, si está activada) + (parte proporcional de gastos fijos, cuando corresponda — a definir con Gio el criterio de prorrateo).
- Cuando cambia el precio de un insumo, el sistema **recalcula automáticamente el costo actual** de los productos que lo usan. El precio de venta **nunca se modifica solo** — la usuaria decide si lo actualiza o no.
- Mostrar: costo, precio, ganancia ($ y %), y ganancia por hora cuando aplica.
- **Alertas**: avisar a la usuaria cuando la actualización de un insumo impacta el precio de uno o más productos que lo usan.

### 3.7 Presupuestos
- Flujo: crear presupuesto → elegir productos → cantidades → elegir precio (según canal) → aplicar descuento → total.
- Mostrar: productos, cantidades, precio unitario, subtotal, descuento, total. Dato opcional de cliente (nombre/razón social, fecha de entrega).
- Exportable / compartible en formato presentable (el mockup muestra "Descargar PDF" y "Compartir" — confirmar con Gio el formato final).
- **Los presupuestos congelan los valores al momento de creación.** Si después cambia el costo o precio del producto, el presupuesto ya emitido no se recalcula ni se altera.

### 3.8 Catálogo / Historial de productos
- Listado de productos con precio y % de rentabilidad visible por ítem (así lo muestra el mockup: "Rentabilidad 40%", etc.).

### 3.9 Panel de administración (solo Gio)
- Alta y baja de usuarias/clientas (emprendedoras que pagan la suscripción/licencia de uso).
- Sin límite de usuarias en el alcance inicial. Si el uso escala a volumen masivo (~5.000+ usuarias activas), hay que revisar infraestructura — ya está aclarado en el contrato que eso se conversa antes de aplicar costo adicional, no es bloqueante para el desarrollo ahora.

---

## 4. Identidad / UX

- Estética **kawaii**, "cute", botones redondeados, tipografía amigable — la idea es que **no se sienta como un Excel**.
- Mascota de la app: **HABA**, un personaje tipo poroto/palta con carita, distinto de "Amaotito" (la mascota de su marca personal Amaoto Craft). Ya viene con arte propio (ver mockups adjuntos).
- Paleta de colores: Gio todavía tiene que mandar los códigos hex exactos (le sugerimos la app "Colors" de Google para definirlos). Hasta que no llegue eso, usar la paleta del mockup (verdes/beige suaves) como placeholder.
- Los 17 mockups que mandó son **ilustrativos** — dan una idea de flujo y tono visual, pero el contenido real de las pantallas puede diferir (ella misma lo aclaró). Como referencia de flujo son útiles: onboarding → login → home con accesos directos → alta de insumo → catálogo de insumos → alta de producto (paso a paso: ingredientes, mano de obra, gastos indirectos) → resultado de costo → precio de venta sugerido → presupuesto → vista previa → historial de productos → perfil.

---

## 5. Preguntas abiertas para la reunión de kickoff

1. Paleta de colores y tipografía definitiva (pendiente de Gio).
2. Criterio exacto de prorrateo de gastos fijos sobre cada producto (¿manual, por %, automático según ventas estimadas?).
3. Set cerrado de unidades de medida a soportar en la conversión automática.
4. Formato final de exportación/compartido de presupuestos (¿PDF nativo, link, WhatsApp?).
5. Confirmar si alta/baja de usuarias la hace Gio 100% manual o si a futuro se conecta a algún medio de pago (por ahora, según lo hablado, es manual).

---

*Documento interno de preparación técnica — no enviar al cliente.*
