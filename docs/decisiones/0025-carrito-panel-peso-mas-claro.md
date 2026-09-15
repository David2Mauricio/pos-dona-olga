# ADR 0025: Panel de carrito más claro para productos por peso

## Estado

Aceptado, cerrado.

## Contexto

Tarea 2 del rediseño: el panel del carrito en Mostrador se sentía
cramped para productos por peso (cada ítem tiene una fila extra con el
campo de kg, más alto que un ítem por unidad), y el campo de cantidad en
kg quedaba por debajo del alto mínimo de toque (44px, ver ADR de
accesibilidad ya establecido en el proyecto).

Investigación antes de tocar CSS (con un carrito real de 5 productos por
peso, medido con Puppeteer, no a ojo):

- `.item-carrito__detalle input` (el campo de kg) medía **32px** de alto
  real en pantalla — por debajo del mínimo de toque.
- `#lista-carrito` (la lista scrolleable del carrito) tenía
  `min-height: 3rem` en vez de `min-height: 0` — el mismo patrón de bug
  ya documentado en este archivo para `.vista` (línea ~608): un hijo flex
  con `overflow-y: auto` necesita `min-height: 0` explícito para poder
  achicarse por debajo del tamaño de su contenido; sin eso, en un
  escenario donde el contenido excede el espacio disponible, el hijo
  puede forzar overflow del padre en vez de scrollear internamente.
- Medido con 5 productos por peso en el carrito: el panel (`.panel-carrito`,
  `max-height: calc(100vh - 7rem)`) sigue el mismo tamaño total, y
  `#lista-carrito` termina con ~313px visibles de los ~830px de contenido
  real — confirmado que **sí** usa correctamente todo el espacio
  disponible después del pie de resumen (total, medio de pago, monto
  recibido, vuelto, botón Cobrar, que mide ~417px). La sensación de
  "cramped" con productos por peso es real (se ven ~2 ítems a la vez
  antes de tener que scrollear) pero es una consecuencia del tamaño del
  pie fijo del carrito, no de un alto fijo incorrecto en la lista misma
  — no había ningún otro valor de alto fijo/hardcodeado en el camino.

## Decisión

- `.item-carrito__detalle input`: `min-height` de 32px → **40px**.
- `#lista-carrito` (`.lista-carrito`): `min-height` de `3rem` → **`0`**,
  mismo criterio que `.vista` — remueve el único valor de alto
  semi-fijo que existía en la cadena, defensivo ante escenarios con
  viewport más bajo o un pie de resumen más alto donde sí podría causar
  overflow real del panel.
- No se tocó el pie de resumen (`.carrito__resumen`) ni el
  `max-height` de `.panel-carrito` — reducir el pie o agrandar el panel
  es un cambio de proporciones más grande, fuera del alcance puntual de
  esta tarea (removido el alto fijo + alto de toque).

## Verificación

Contra una copia aislada de la base real, carrito con 5 productos por
peso agregados:

- Campo de cantidad en kg: 40px de alto real en los 5 ítems.
- `#lista-carrito` sigue scrolleando correctamente (no se rompió nada),
  usando todo el espacio disponible después del pie.
- axe-core sin violaciones en Mostrador con el carrito lleno, ambos temas.
- Captura visual en ambos temas, paleta terracota consistente.
