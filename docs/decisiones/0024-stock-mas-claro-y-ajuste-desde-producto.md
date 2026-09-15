# ADR 0024: Stock más claro en Productos + ajustar stock desde el mismo formulario

## Estado

Aceptado, cerrado.

## Contexto

Dos pedidos relacionados sobre el formulario de Producto:

1. **Tarea 5 (stock más claro)**: el label "Stock actual (formato nuevo)"
   (visible solo cuando se cambia el tipo de venta al editar, ver ADR 0017)
   es jerga interna que no le dice nada a quien usa el sistema.
2. **Tarea 6 (ajustar stock desde Producto)**: hoy, para corregir el stock
   de un producto activo hay que salir del formulario de edición, ir a
   Inventario, y buscar el producto de nuevo en el formulario de
   movimientos. Se pidió un atajo directo desde el propio formulario de
   Producto, **sin crear una segunda fuente de verdad** — tiene que disparar
   exactamente el mismo movimiento de `ajuste` que ya usa Inventario (ADR
   0005: `movimientos_inventario` es la única fuente de verdad del stock).

## Decisión

### Tarea 5

- `label-producto-stock-nuevo`: "Stock actual (formato nuevo)" → "Stock
  actual, en kg" / "Stock actual, en unidades" según corresponda. El
  "por qué" de que aparezca este campo ya lo explica la advertencia visible
  de al lado (`#advertencia-tipo-venta`) y su tooltip ⓘ — no hacía falta
  repetirlo en el label.
- `label-producto-stock-minimo` no tenía tooltip propio (el label ya es
  claro), pero faltaba decir **qué pasa** cuando el stock cae debajo del
  mínimo. Se agregó un tooltip que lo explica (dónde aparece la alerta:
  Tablero y la campanita de Mostrador).

### Tarea 6

Un bloque nuevo "Ajustar stock", visible **solo en edición** (nunca en
alta, donde el stock inicial ya lo pide el campo de arriba), que vive como
**hermano de `<form id="formulario-producto">`**, no dentro de él — un
`<input type="number">` adicional dentro del mismo `<form>` dispararía su
`submit` (Guardar producto) con Enter, no el ajuste. Al vivir afuera,
usa un botón `type="button"` con su propio listener de `click`, sin tocar
el flujo de guardado del producto.

Reusa el **mismo mecanismo que Inventario**: `POST
/api/inventario/movimientos` con `tipo:'ajuste'`, `productoId`,
`stockNuevo` (el conteo físico completo, no un delta) y `motivo`
(obligatorio, igual que en Inventario). Nunca escribe
`productos.stock_*` directo — el backend ya se encarga de eso a través del
ledger, igual que el resto de la app.

El campo de conteo físico precarga con el stock actual (en la unidad
correcta según `tipoVenta`, usando `gramosAKilosTexto`/`kilosTextoAGramos`,
igual que el resto del formulario) para que la persona corrija sobre ese
valor en vez de escribir de cero. Usa el `tipoVenta` **ya guardado** del
producto, no el valor que pueda estar seleccionado en el `<select>` de
arriba en ese momento — el ajuste es una acción independiente que se
dispara de inmediato, no debe depender de cambios sin guardar en el resto
del formulario.

Tras guardar, el overlay **no se cierra**: se refresca el texto de stock
actual y el valor precargado con el dato real recién guardado (se puede
seguir editando el producto o hacer otro ajuste), y se limpia el campo de
motivo. El backend ya rechaza un ajuste a un valor idéntico al actual
("ya es N, no hay ajuste que aplicar") — comportamiento correcto del
ledger que no hacía falta replicar en el cliente.

## Verificación

Contra una copia aislada de la base real (puerto 3001/3002, `admin` con
password reseteado solo en la copia de scratch, nunca en la real):

- Producto por unidad: precarga correcta (20), ajuste a 17 vía UI, toast
  de éxito, overlay sigue abierto, stock reflejado (17), motivo se limpia.
- Movimiento verificado en la API (`GET /api/inventario/movimientos`):
  `tipo:'ajuste'`, `motivo` y `productoId` correctos; `productos.stockUnidades`
  quedó en 17 (vía el ledger).
- Mismo movimiento visible en la pantalla de Inventario (misma fuente,
  sin duplicar UI).
- Producto por peso: precarga en kg con el formato ya usado en el resto
  de la app (coma decimal, 3 decimales — ej. `5,000`), ajuste a `3.5`
  guarda `stockGramos: 3500` (conversión correcta kg→gramos).
- Bloque oculto al crear un producto nuevo (alta).
- axe-core sin violaciones en el formulario de Producto con el bloque de
  ajuste visible, ambos temas.
- Cero errores de consola atribuibles al flujo nuevo (se aisló y confirmó
  que un 404 de `logo.png` y un 401 de `/api/auth/sesion` preexistentes
  ocurren en la carga de página, antes del login, no relacionados con
  Tarea 5/6).
