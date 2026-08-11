# ADR 0006: Lotes de vencimiento como registro informativo, desacoplado del stock

## Estado

Aceptado.

## Contexto

Un mismo producto (ej. pechuga) se compra en distintas fechas, y cada
compra trae su propia fecha de vencimiento. No es un dato del producto en
general — una sola `fecha_vencimiento` en `productos` perdería la
información de qué lote vence primero cuando hay varios en circulación al
mismo tiempo.

La pregunta de diseño real no es "dónde vive la fecha de vencimiento" sino
si el lote gobierna el descuento de inventario (FIFO: cada venta descuenta
del lote más próximo a vencer) o si es un registro aparte, solo para
alertar.

## Decisión

- **`lotes_vencimiento` es informativo y de alerta, desacoplado del stock
  general de `productos`.** No descuenta nada automáticamente, y
  `ventas.service.js` no lo toca en absoluto.
- `cantidad` es un **snapshot** al momento de registrar el lote (cuánto
  llegó en esa compra), no se resincroniza con
  `productos.stock_unidades`/`stock_gramos`. Con el tiempo, la cantidad
  del lote puede quedar desalineada del stock real del producto — es
  aceptable porque el propósito es alertar sobre vencimiento próximo, no
  llevar inventario exacto por lote.
- El operador registra el lote al recibir mercancía y lo marca
  manualmente `activo=0` cuando se agota o se descarta — mismo patrón
  `activo` ya usado en productos y proveedores, sin inventar un enum de
  estados nuevo.
- **FIFO automático (que una venta descuente del lote más próximo a
  vencer) queda fuera de alcance a propósito.** Implementarlo ahora
  significaría que todo el flujo de ventas tendría que decidir de qué
  lote descontar — un cambio de arquitectura grande para un negocio que
  apenas está formalizando su primer sistema. Si el negocio crece y
  necesita trazabilidad real por lote, es una decisión de producto a
  futuro, cotizable como funcionalidad fuera del alcance original (ver
  condiciones acordadas con la dueña).

## Umbral de alerta configurable

"Próximo a vencer" no es un dato que el cliente haya definido. En vez de
un número fijo en el código, `DIAS_ALERTA_VENCIMIENTO` (variable de
entorno, default `3`) — mismo criterio que `DESCONTAR_STOCK_AUTOMATICO`:
un valor razonable por defecto, ajustable sin tocar código cuando la
dueña tenga una preferencia real.

## Consecuencias

- `GET /api/vencimientos/alertas` separa los lotes activos en `vencidos`
  (`fecha_vencimiento < hoy`) y `porVencer` (`fecha_vencimiento` entre hoy
  y hoy + `DIAS_ALERTA_VENCIMIENTO`), ambos calculados al vuelo — no hay
  columna ni tabla que guarde "está por vencer", es una consulta sobre la
  fecha actual en el momento de pedir el reporte.
- `fecha_vencimiento` se guarda como texto `YYYY-MM-DD` (reutilizando
  `fechaSchema` de `schemas-comunes.js`), y las comparaciones de rango se
  hacen como texto — mismo criterio ya usado para `creada_en`/`creado_en`
  en ventas e inventario, válido porque ese formato ordena
  lexicográficamente igual que cronológicamente.
- Si en el futuro se decide implementar FIFO real, esta tabla es la base
  para esa migración, pero requeriría cambios en `ventas.service.js` para
  decidir de qué lote descontar — no es un cambio menor, y no se está
  diseñando para eso ahora.
