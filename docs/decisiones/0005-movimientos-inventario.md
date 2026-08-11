# ADR 0005: Movimientos de inventario como ledger único de todo cambio de stock

## Estado

Aceptado.

## Contexto

Hasta ahora, `productos.stock_unidades`/`stock_gramos` cambia en un solo
lugar: `descontarStockPorVenta` dentro de la transacción de creación de
venta (ADR 0003). Eso alcanza para vender, pero no para responder
preguntas reales del negocio: ¿cuánto entró por compra esta semana?,
¿cuánto se perdió por merma?, ¿quién corrigió el stock y por qué bajó de
golpe? Sin un registro de movimientos, esas respuestas no existen.

## Decisión

### 1. Todo cambio de stock pasa por `movimientos_inventario`, sin excepción

Incluidas las ventas. `ventas.service.js` se modifica para que, dentro de
la misma transacción donde hoy llama a `descontarStockPorVenta`, también
inserte un movimiento con `tipo='salida'`, `motivo='venta'` y
`referencia_venta_id` apuntando a la venta recién creada. Sigue gateado
por `DESCONTAR_STOCK_AUTOMATICO`: si el flag está apagado, tampoco se
genera el movimiento.

### 2. `cantidad` es un delta firmado; `stock_resultante` solo existe para ajustes

Primera versión de este ADR asumía "cantidad siempre positiva, el signo lo
da `tipo`" para los tres tipos. Eso se rompe con `ajuste`, porque un
ajuste puede corregir el stock hacia arriba o hacia abajo — no tiene un
signo fijo como sí lo tienen `entrada` (siempre sube) y `salida` (siempre
baja). La corrección:

- **`cantidad`** pasa a ser el **delta firmado que efectivamente se
  aplicó al stock**, para los tres tipos: positivo si subió, negativo si
  bajó. Nunca es 0 (un movimiento con delta 0 no es un movimiento, es
  ruido).
- **`stock_resultante`** (columna nueva, `INTEGER NULLABLE`) solo se puebla
  cuando `tipo='ajuste'`: es el valor absoluto que el operador declaró
  (el conteo físico real), para que el historial se pueda leer sin
  reconstruir el delta mentalmente. Es `NULL` para `entrada`/`salida`.

El contrato de la API refleja esta diferencia en vez de forzar un único
shape de request (validado con `z.discriminatedUnion('tipo', ...)`):

- `tipo='entrada'` o `'salida'`: el cliente manda `cantidad` (positiva,
  la magnitud del movimiento — cuánto entra o cuánto sale). El service la
  convierte a delta firmado antes de guardar (`+cantidad` para entrada,
  `-cantidad` para salida) y `stock_resultante` queda `NULL`.
- `tipo='ajuste'`: el cliente manda `stockNuevo` (el conteo físico real,
  valor absoluto), **no** `cantidad`. El service calcula
  `cantidad = stockNuevo - stockActual`, rechaza el movimiento si da 0
  (nada que ajustar), y guarda ese delta en `cantidad` y el valor
  absoluto en `stock_resultante`.

CHECK a nivel de SQLite (no solo en el código) para que el signo de
`cantidad` sea coherente con `tipo`, y que `stock_resultante` solo exista
donde corresponde:

```sql
CHECK (
  (tipo = 'entrada' AND cantidad > 0 AND stock_resultante IS NULL)
  OR
  (tipo = 'salida' AND cantidad < 0 AND stock_resultante IS NULL)
  OR
  (tipo = 'ajuste' AND stock_resultante IS NOT NULL)
)
```

Mecánicamente, en `productos.repository.js`:
- `entrada`/`salida` siguen usando `aumentarStock`/`descontarStock` (este
  último ya existe, reutilizado tal cual de ventas — incluye el `WHERE`
  que valida stock suficiente).
- `ajuste` usa una función nueva, `fijarStock`, que hace `SET` directo
  al valor absoluto en vez de sumar/restar.

### 3. `movimientos_inventario` es un ledger de auditoría, no editable

- `producto_id` y `referencia_venta_id` son `ON DELETE RESTRICT`: un
  movimiento nunca desaparece porque se borre el producto o la venta que
  lo originó.
- CHECK cruzado: `referencia_venta_id` es obligatorio cuando
  `motivo = 'venta'` y debe ser `NULL` en cualquier otro caso.
- El endpoint público `POST /api/inventario/movimientos` **rechaza**
  `motivo='venta'` explícitamente: ese motivo solo lo genera el sistema
  desde `ventas.service.js`, nunca una llamada manual.
- `motivo` sigue siendo texto libre (igual que `medio_pago`, ADR 0004):
  no hay todavía un catálogo cerrado de motivos de movimiento manual
  ("compra", "merma", "ajuste_manual" son ejemplos, no un enum). Misma
  fragilidad conocida y aceptada.

### 4. `stock_minimo` es nullable y por producto

`productos.stock_minimo` (migración separada, `005`) es `NULL` por
defecto. Mientras sea `NULL`, ese producto **nunca** genera alerta, sin
importar en cuánto esté su stock — incluso en cero. Es la dueña quien
eventualmente define el umbral producto por producto; no hay un valor por
defecto razonable que se pueda inventar.

## Consecuencias

- `productos.repository.js` gana `aumentarStock` y `fijarStock` junto al
  ya existente `descontarStock`. Las tres siguen el mismo patrón de
  `UPDATE` condicionado por `tipo_venta`.
- `GET /api/inventario/alertas` es una lectura directa a `productos`
  filtrando por `stock_minimo IS NOT NULL`, sin tabla ni cálculo
  adicional — el umbral vive en el producto, no se duplica en otro lado.
- `PATCH /api/productos/:id` gana `stockMinimo` como campo opcional (ya
  existe el mecanismo de actualización parcial). También se agrega a la
  creación (`POST /api/productos`) por consistencia con
  `precioMayorista`, que es igual de opcional.
- El historial de movimientos se puede sumar de forma consistente
  (`SUM(cantidad)`) sin importar de qué tipo sea cada fila, porque
  `cantidad` siempre representa el mismo concepto: el efecto neto sobre
  el stock.
