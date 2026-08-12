# ADR 0012: Vuelto en efectivo y anulación de ventas

## Estado

Aceptado.

## Contexto

Fase 3 agrega dos operaciones sobre una venta ya definida: calcular cuánto
vuelto dar cuando el cliente paga en efectivo, y poder anular una venta que
se registró por error o que el cliente no completó — revirtiendo su efecto
sobre el inventario y sacándola de los totales del día, sin borrarla.

## Decisiones

### Vuelto: no se persiste, se deriva

`ventas.monto_recibido` es lo único que se guarda (columna nueva, migración
010). El vuelto (`monto_recibido - total`) se calcula en
`ventas.repository.js` al leer la fila, no se guarda en una columna propia.
Mismo criterio que ADR 0011 con el precio ajustado: un valor derivado de
otros dos que ya están en la misma fila no se duplica, para no arriesgar
que quede inconsistente si alguno de los dos cambiara.

`montoRecibido` es obligatorio si y solo si `medioPago` (comparado tolerante
a mayúsculas/espacios, igual que `abrirCajonSiEsEfectivo` y
`caja.repository.js`) es `'efectivo'`, y debe ser mayor o igual al total —
ambas reglas viven en `ventas.service.js`, no en el schema: la primera
porque `medioPago` es texto libre (ADR 0004) y una comparación exacta en
zod sería frágil; la segunda porque el total recién se conoce después de
resolver los items (no antes, en el momento en que corre la validación del
schema).

### Anulación: bandera de estado, no borrado

`ventas` gana `estado` (`'activa'` | `'anulada'`, default `'activa'`),
`motivo_anulacion` y `anulada_en` (migración 010). Anular nunca borra la
fila — el propósito explícito de esta fase es trazabilidad, no que una
venta problemática desaparezca sin dejar rastro. `GET /api/ventas` y
`GET /api/ventas/:id` siguen mostrándola tal cual; solo los agregados
(`GET /api/reportes/*`, `GET /api/caja/:id` y el cálculo de monto teórico
en efectivo al cerrar caja) dejan de contarla, agregando
`estado = 'activa'` a sus consultas.

### Compensación de inventario: a partir de los movimientos reales, no del flag actual

`env.descontarStockAutomatico` se lee en el momento de **crear** la venta
(ADR 0003); puede haber cambiado para cuando alguien la anula. Asumir su
valor actual para decidir si hay que restituir stock sería adivinar sobre
un estado que ya no existe. En cambio, `anular()` consulta
`movimientos_inventario` filtrando por `referencia_venta_id` — el registro
real de qué se descontó, si es que algo se descontó — y por cada
movimiento encontrado hace un `aumentarStock` + un movimiento `'entrada'`
compensatorio. Si no hay movimientos (el flag estaba apagado al momento de
la venta), no hay nada que compensar, y `anular()` no falla por eso ni
hace nada de más.

### El movimiento compensatorio no lleva `referencia_venta_id`

La migración 004 tiene un `CHECK` explícito:
`(motivo = 'venta' AND referencia_venta_id IS NOT NULL) OR (motivo != 'venta' AND referencia_venta_id IS NULL)`.
El movimiento de reposición no puede tener `motivo = 'venta'` (no es la
venta original, es su reversa), así que por ese mismo `CHECK` tampoco puede
llevar `referencia_venta_id`. Relajar el `CHECK` exigiría reconstruir la
tabla completa (SQLite no permite alterar un `CHECK` existente vía
`ALTER TABLE`) — un cambio desproporcionado para este propósito. En su
lugar, el id de la venta anulada queda en el propio texto del motivo:
`"Anulación de venta #<id>"`. Sigue siendo trazable (basta con leer el
motivo), solo que no es una FK consultable con `JOIN`. Mismo criterio que
usa `'venta'` como motivo reservado (ver ADR 0005): `inventario.service.js`
rechaza que alguien cree a mano un movimiento cuyo motivo empiece con
`"Anulación de venta"`, para que ese texto siga siendo una garantía real de
que vino de una anulación real.

### Anular es solo-administrador

A diferencia del override de precios (Fase 2, disponible para ambos
roles), anular sí queda restringido a `administrador`. La diferencia no es
arbitraria: ajustar un precio ocurre *antes* de cerrar la venta, como parte
de negociarla; anular revierte algo que ya se cobró, ya se imprimió y ya
movió inventario — un impacto mayor que amerita una aprobación de nivel
superior.

### No se valida una venta ya anulada dos veces

`anular()` lanza `400` si la venta ya tiene `estado = 'anulada'` — no
existe "reanular" ni "reactivar" en esta fase. Si hace falta revertir una
anulación por error, es una operación manual sobre la base, no un caso que
el API deba cubrir todavía.

## Consecuencias

- `ventas_items` no cambia en esta fase — la anulación es a nivel de venta
  completa, no por línea.
- Un reporte que sume ventas por rango de fechas o por sesión de caja
  ahora excluye anuladas automáticamente en las tres consultas de
  `reportes.repository.js` que comparten `construirFiltro`, y en las tres
  de `caja.repository.js`. Cualquier consulta agregada **nueva** sobre
  `ventas` que se agregue en el futuro debe recordar excluir
  `estado = 'anulada'` explícitamente — no es automático fuera de esos
  puntos ya cubiertos.
- El recibo térmico no cambia: no se reimprime automáticamente al anular
  (no se pidió), y una venta anulada sigue teniendo su recibo original ya
  impreso como estaba.
