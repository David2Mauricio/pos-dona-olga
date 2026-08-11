# ADR 0003: Ventas — dependencias provisionales y snapshot de precio

## Estado

Aceptado.

## Contexto

Ventas es el primer módulo que depende de otras dos piezas que todavía no
existen como módulos completos: caja (apertura/cierre) y clientes. Construir
ventas correctamente sin bloquearse en esas dependencias exige decisiones
explícitas, no supuestos silenciosos.

## Decisiones

### 1. Dependencia provisional a caja

La migración 003 crea **ambas** tablas, `caja_sesiones` y `ventas`/`ventas_items`,
porque `ventas.caja_sesion_id` es una FK obligatoria y no tiene sentido
diferir esa relación. Pero el **módulo de caja** (endpoints de apertura,
cierre, reporte diario) es el siguiente paso, no este — hoy solo se
construye el módulo de ventas.

Mientras no exista el módulo de caja, las pruebas end-to-end de ventas
insertan una `caja_sesion` directo por SQL, igual que se hizo con
`categorias` para poder probar `productos` antes de que existiera el
módulo de categorías. No es deuda técnica nueva, es la misma estrategia ya
usada y ya aceptada en este proyecto.

### 2. `tipo_precio` sin cliente

El módulo de clientes/proveedores va después de inventario en el orden
acordado, así que `ventas` no puede tener una FK a una tabla `clientes` que
no existe todavía. En su lugar, cada venta recibe un campo explícito
`tipo_precio` (`'publico' | 'mayorista'`) elegido en el momento de la venta,
que determina qué precio de `productos` se aplica.

**Esto es una solución provisional.** Cuando se construya el módulo de
clientes, se evaluará si conviene vincular la venta a un cliente concreto
(y posiblemente inferir `tipo_precio` desde el cliente en vez de pedirlo
explícito en cada venta). No se decide eso ahora.

### 3. Snapshot del precio aplicado

`ventas_items.precio_unitario_aplicado` es una **copia congelada** del
precio de `productos` en el momento exacto de la venta — nunca se relee de
`productos` para generar reportes o recalcular montos históricos.

Esto no es un detalle de implementación, es una regla de integridad de
datos: si mañana cambia el precio de un producto, las ventas ya registradas
no pueden cambiar de valor. Cualquier reporte futuro sobre ventas debe leer
`precio_unitario_aplicado` y `subtotal` directamente de `ventas_items`, y
**nunca** hacer `JOIN` con `productos.precio_publico`/`precio_mayorista`
para recalcular el valor de una venta pasada.

### 4. Redondeo (aplicando ADR 0002)

`subtotal = Math.round(precio_unitario_aplicado * cantidad / divisor)`,
donde `divisor` es 1000 si el producto es `tipo_venta = 'peso'` (porque el
precio es por kilo y `cantidad` está en gramos) y 1 si es `'unidad'`. El
redondeo se aplica **una sola vez por línea**, en el momento de calcular
ese subtotal.

`ventas.total` es la **suma de los subtotales ya redondeados** de cada
línea — nunca se suma primero y se redondea al final, porque eso puede dar
un resultado distinto (y contradiría el ADR 0002).

### 5. Descuento de inventario: automático hoy, pero reversible

La dueña todavía no ha confirmado si el descuento de stock por venta debe
ser automático o manual (sigue en la lista de datos pendientes del
cliente). No se decide eso aquí de forma irreversible.

Se implementa **automático por defecto**, pero:

- Aislado en una función con nombre propio (`descontarStockPorVenta`),
  definida en `ventas.service.js`, que no hace nada más que descontar
  stock — llama directo a `productosRepository.descontarStock(...)` (no a
  `productos.service`, para no arrastrar validaciones de negocio de
  productos que ya no aplican en este punto del flujo) y no calcula
  precios ni valida reglas de venta.
- Controlado por una variable de entorno nueva,
  `DESCONTAR_STOCK_AUTOMATICO` (por defecto `true`), leída una sola vez en
  el service de ventas al decidir si invoca esa función. El resto del flujo
  de creación de venta (calcular subtotales, guardar la venta y sus items)
  no cambia si el flag se apaga.

Cuando la dueña confirme su preferencia real, apagar el descuento
automático es cambiar una variable de entorno, no reescribir el service.

## Consecuencias

- `ventas.caja_sesion_id` seguirá apuntando a una tabla sin API propia
  hasta el siguiente paso (módulo de caja). Es un estado intermedio
  esperado, no un error.
- El campo `tipo_precio` es una simplificación temporal que probablemente
  se revise cuando exista el módulo de clientes.
- La atomicidad de "crear venta + items + descontar stock" es
  responsabilidad del **service** de ventas, no del repository:
  `ventas.service.js` define la función transaccional
  (`db.transaction(...)`) y, dentro de ella, orquesta llamadas tanto a
  `ventasRepository` (crear venta, crear items) como a
  `productosRepository.descontarStock` (directo, sin pasar por
  `productos.service`). Esto no es una excepción al patrón de capas: sigue
  siendo el service el que orquesta repositories, solo que en este caso
  orquesta más de uno. `ventas.repository.js` no conoce nada de productos.
