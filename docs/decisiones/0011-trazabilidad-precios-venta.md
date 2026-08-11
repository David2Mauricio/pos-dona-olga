# ADR 0011: Trazabilidad de precios en ventas (override con justificación)

## Estado

Aceptado.

## Contexto

En el mostrador real, a veces se cobra un precio distinto al de catálogo
(un cliente frecuente, un producto con algún defecto menor, un ajuste
negociado). Hasta ahora eso no tenía forma de registrarse: el cajero solo
podía vender al precio público o mayorista tal cual estaban en `productos`.
Sin trazabilidad, esos ajustes o bien no se hacían, o se hacían "por fuera"
del sistema (efectivo que no cuadra con lo registrado). Fase 2 agrega la
posibilidad de ajustar el precio de un item puntual, exigiendo siempre un
motivo explícito.

## Decisión

### Bandera + motivo, no un precio "de reemplazo" en columnas nuevas

La migración 009 agrega dos columnas a `ventas_items`:

- `precio_modificado` (`0`/`1`, default `0`): indica si esta línea se
  cobró distinto al precio de catálogo.
- `motivo_ajuste` (texto, `NULL` si no hubo ajuste): la justificación.

**No** se agrega una columna para "el precio ajustado" — `precio_unitario_aplicado`
ya cumple ese rol (ADR 0003: es el snapshot del precio realmente cobrado,
venga de catálogo o de un override). Agregar una segunda columna de precio
duplicaría el dato y abriría la puerta a que ambas queden inconsistentes.
`precio_modificado` es solo una bandera de auditoría: "esta línea es una
excepción, andá a ver por qué".

### Consistencia motivo↔bandera: validada en la aplicación, no en SQLite

Un `CHECK` que exija "`motivo_ajuste` no es `NULL` si y solo si
`precio_modificado = 1`" tendría que referenciar ambas columnas a la vez.
SQLite no permite agregar ese tipo de `CHECK` cruzado vía
`ALTER TABLE ADD COLUMN` (mismo límite ya documentado en la migración
005, `stock_minimo`) — cada `ADD COLUMN` solo puede validarse a sí mismo.
La consistencia se garantiza en la capa de aplicación:

- `ventas.schema.js`: el item de venta acepta `precioUnitarioOverride`
  (entero, en la misma unidad que el precio de catálogo) y `motivoAjuste`
  (texto no vacío), pero un `.refine()` exige que ambos vengan juntos o
  ninguno — nunca uno sin el otro.
- `ventas.service.js` es la única pieza que decide `precioModificado` (lo
  deriva de si vino `precioUnitarioOverride`, no se recibe como bandera
  suelta del cliente) y usa el override como `precioUnitarioAplicado`
  cuando está presente.

### Sin restricción de rol ni de rango

El override no queda limitado a `administrador`: lo puede aplicar
cualquiera que ya pueda crear una venta (ambos roles, ver ADR 0010), igual
que hoy. El propósito de esta fase es trazabilidad — que quede registrado
qué se ajustó y por qué — no restringir quién puede ajustar. Tampoco se
valida que el override sea menor, mayor, o esté dentro de algún rango
respecto al precio de catálogo: cualquier entero no negativo es válido
mientras venga con su motivo. Restringir eso no se pidió y agregaría una
regla de negocio (¿cuánto de descuento es razonable?) que no es parte del
alcance de esta fase.

### El recibo no necesitó cambios

`comandos-escpos.js` ya imprime `item.precioUnitarioAplicado` (no relee
`productos`), así que un item con override se imprime automáticamente con
el precio realmente cobrado, sin tocar el módulo de impresión.

## Consecuencias

- `ventas_items` ahora tiene dos columnas más; `GET /api/ventas/:id`
  expone `precioModificado` y `motivoAjuste` en cada item, para que un
  reporte futuro (o la Fase 4) pueda listar/filtrar ventas con ajustes de
  precio sin tener que inferirlo comparando contra `productos`.
- No hay endpoint ni reporte específico de "ventas con precio ajustado"
  en esta fase — el dato queda registrado y disponible, construir esa
  vista es una decisión de una fase futura, no de esta.
