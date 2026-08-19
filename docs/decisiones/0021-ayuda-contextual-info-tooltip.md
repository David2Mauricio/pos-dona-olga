# ADR 0021: Ayuda contextual (componente InfoTooltip)

## Estado

Aceptado, cerrado.

## Contexto

Varios campos del sistema no son intuitivos a primera vista para alguien
nuevo usándolo — el caso que lo originó es el formato de stock (gramos
guardados internamente, mostrados en kilogramos o en unidades según el
producto). Se pidió un componente único y reutilizable, no una
implementación distinta por pantalla.

## Decisión

`public/js/info-tooltip.js`, una sola función `crearInfoTooltip(texto,
etiqueta)` que devuelve el DOM completo (ícono + popover) listo para
insertar donde haga falta.

- **Ícono propio** (`iconoInfo` en `icons.js`): una "i" en círculo, mismo
  trazo (1.75, `currentColor`) que el resto del set de íconos del
  proyecto.
- **Un solo popover abierto a la vez en toda la interfaz** — abrir uno
  cierra cualquier otro (un solo listener global de `click`/`Escape` en
  `document`, no uno por instancia).
- **`role="tooltip"`, no `"dialog"`**: los seis textos son de solo
  lectura, sin nada interactivo adentro. Si algún día hiciera falta un
  popover con un link o botón dentro, ese caso necesitaría `role="dialog"`
  (foco atrapado, cierre distinto) — no es lo que este componente
  resuelve.
- **Área de toque 44×44px sin agrandar el ícono visualmente**: el botón
  visual mide 20px, con un `::after` invisible que expande el área
  clickeable/tocable real a 44×44 (`inset: -12px`). Un ícono de ayuda
  inline junto a un label de 44px se vería desproporcionado si el
  elemento entero midiera eso.
- **El popover nunca vive dentro del `<label>` que describe**: varios de
  los labels donde se usa (Stock, Cantidad) cambian de texto
  dinámicamente según `tipoVenta` (`label.textContent = ...`) — meter el
  ícono ahí se lo llevaría puesto en cada actualización. Vive como
  `<span>` hermano, dentro de un contenedor `.fila-con-ayuda`
  (`display: inline-flex`) que alinea label/badge + ícono en la misma
  línea.
- **Texto**: mismas reglas de calidad ya vigentes en todo el proyecto
  (mayúscula inicial, tildes correctas, punto final, una o dos frases) —
  y nunca justificado, por ser texto corto de una sola idea.

## Dónde se aplicó

| Pantalla | Campo | Condición |
|---|---|---|
| Productos | Stock inicial | siempre |
| Productos | Precio | solo si `tipoVenta === 'peso'` (se oculta/muestra junto con el resto de los campos que dependen del tipo de venta) |
| Productos | Stock actual (formato nuevo) | solo al editar un producto existente y cambiar su tipo de venta — vive dentro de `#campo-producto-stock-nuevo`, ya oculto/mostrado por `actualizarVisibilidadCambioTipoVenta()`, sin lógica de visibilidad propia. Texto distinto del de la advertencia permanente (`#advertencia-tipo-venta`) que ya explica la regla de negocio: este tooltip explica el campo puntual (qué cargar y cuándo aparece) |
| Inventario | Cantidad del movimiento | siempre |
| Mostrador | Sección "Stock bajo" del panel de alertas | siempre |
| Caja | Monto teórico en efectivo | siempre |
| Caja | Ajuste por redondeo de vuelto | mismo criterio que el renglón que explica (oculto si el ajuste es 0) |
| Historial | Badge "Anulada" | solo en ventas anuladas — distinto del `title` nativo que ya mostraba el motivo puntual de esa anulación; este explica el concepto general |
| Vencimientos | Badge "Por vencer" | solo en lotes con ese estado (no en "Vencido" ni "Vigente") |

**Un campo pedido no se implementó**: "Tipo de precio (público/mayorista)
en Ventas" — ese selector no existe más en el sistema, se eliminó por
completo en ADR 0017 (`precio_mayorista` quitado). Confirmado antes de
tocar nada, no hay ningún resto de ese campo en el código actual.

**No se agregó** en Indicadores (Ticket promedio, Comparativa, Ganancia
real): esas tarjetas ya tienen una descripción de una línea siempre
visible (`.indicadores__descripcion`, ver ADR 0017 Bloque H2) — agregar
un tooltip encima sería un segundo mecanismo para resolver el mismo
problema que esa pantalla ya resuelve de otra forma.

## Verificación

Contra una copia aislada de la base real, primero un solo campo (Stock en
Productos) mostrado y confirmado antes de replicar al resto:

- **19/19** verificaciones del primer campo: presencia, `aria-expanded`/
  `aria-describedby`/`role="tooltip"` correctos, tamaño de toque, abrir/
  cerrar por click (ícono, afuera, ícono de nuevo), teclado completo
  (Tab alcanza el botón, Enter y Espacio lo activan, Escape cierra,
  foco visible), axe-core sin violaciones.
- **Contraste verificado por medición directa** (`getComputedStyle`), no
  por lectura visual de capturas — la lectura visual de las capturas no
  daba la misma certeza que la medición mecánica, así que se reportó esa
  limitación en vez de afirmar algo no verificado con confianza. Oscuro:
  panel `#14171d` con texto `#f2f4f7`; claro: panel `#ffffff` con texto
  `#12151c`. axe-core: 0 violaciones en ambos estados.
- **18/18** verificaciones tras replicar a las siete pantallas restantes:
  texto correcto en cada campo, visibilidad condicional del tooltip de
  Precio según `tipoVenta`, el renglón de redondeo oculto por defecto
  (`REDONDEAR_VUELTO` apagado), el ícono en Historial sin superponerse
  con el badge "Anulada", axe-core sin violaciones en las seis pantallas
  tocadas.
- Lighthouse: accesibilidad 100 en Productos (con tooltip abierto) y
  Vencimientos (con el tooltip de "Por vencer" presente).

**Campo agregado después del cierre inicial**: Stock actual (formato
nuevo), a pedido explícito — se le pidió un texto distinto al de la
advertencia permanente ya existente para el mismo campo, con detalle de
cuándo aparece. **5/5** verificaciones contra la misma copia aislada: el
campo (y su tooltip) empiezan ocultos en modo alta o al editar sin cambiar
el tipo de venta, cambiar el tipo de venta al editar los muestra, texto
exacto (incluye el "cuándo"), axe-core sin violaciones con el campo y el
tooltip visibles.
