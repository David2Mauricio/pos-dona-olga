# ADR 0023: Ocultar Vencimientos de la interfaz (sin tocar backend ni datos)

## Estado

Aceptado, cerrado.

## Contexto

El módulo de Vencimientos (pantalla, ítem del sidebar, formulario de
lotes) no se está usando en el negocio real. Se pidió retirarlo de la
interfaz, de forma reversible: la tabla `lotes_vencimiento` y el endpoint
`/api/vencimientos/*` no se tocan — solo la UI que los consumía.

Antes de tocar código se mapearon **todos** los puntos reales que
consumían datos de vencimientos (no solo los mencionados en el pedido
original, que solo nombraba al Tablero):

1. La pantalla propia de Vencimientos (`vencimientos.js`, la sección del
   sidebar, el formulario de lotes).
2. La tarjeta "Alertas" del Tablero (`tablero.js`) — combinaba stock bajo
   + vencidos/por vencer.
3. **El panel de alertas del header ("campanita") en Mostrador**
   (`main.js:cargarAlertas` + `render.js:renderizarAlertas`) — el mismo
   patrón combinado, en una pantalla que el pedido original no nombraba.
   Encontrado leyendo el código real antes de asumir que el Tablero era
   el único punto, tal como pide la disciplina de este proyecto.

## Decisión

**Solo la interfaz se retira, nada del lado del servidor.**
`src/modules/vencimientos/*` (rutas, servicio, repositorio, schema) y la
migración `007_lotes_vencimiento.sql` quedan intactos — sin ellos no hay
forma de reactivar esto sin escribir código de nuevo, lo que contradice
"reversible".

Cambios del lado del frontend:

- `public/js/vencimientos.js` — eliminado (296 líneas, ya no lo importa
  nadie).
- `public/index.html` — el ítem del sidebar, la sección
  `<section id="vista-vencimientos">`, el botón "Ver vencimientos" del
  Tablero, y el modal `overlay-form-lote`.
- `public/js/main.js` — la rama `nombre === 'vencimientos'` del
  despachador de navegación; `cargarAlertas()` (panel del header) ya no
  pide `/vencimientos/alertas`, solo `/inventario/alertas`.
- `public/js/render.js` — `renderizarAlertas()` simplificada: ya no arma
  una sección "Vencimientos" en el panel, ni necesita `mapaProductos`
  (solo se usaba para nombrar lotes).
- `public/js/tablero.js` — mismo criterio: `cargarAlertas()` deja de
  pedir `/vencimientos/alertas` y `listarProductosActivos()` (ese
  segundo pedido solo existía para nombrar lotes); el botón "Ver
  vencimientos" y su listener se quitan; el texto de "todo en orden" ya
  no menciona vencimientos.
- `public/js/api.js` — se quitan los 4 wrappers de `/vencimientos/*` que
  quedaron sin ningún llamador en el frontend (confirmado con grep antes
  de borrar). El backend real sigue respondiendo si algo los llama
  directo.
- `public/css/estilos.css` — se retiran las reglas exclusivas de la
  pantalla eliminada (`.vencimientos__grupo-titulo`,
  `.catalogo__fila--vencido/--por-vencer/--vigente/--lote`), confirmado
  sin otro selector JS que las use.

Comentarios que solo mencionaban "Vencimientos" como punto de
comparación histórico (ej. "mismo bug de contraste ya corregido en
Vencimientos") se dejaron como están — documentan una decisión de diseño
real que sigue vigente en otras pantallas, no una afirmación falsa sobre
la interfaz actual.

## Verificación

Contra una copia aislada de la base real: 16/16 checks —

- El backend de vencimientos (`POST /api/vencimientos/lotes`,
  `GET /api/vencimientos/alertas`) sigue respondiendo con datos reales,
  confirmando que la funcionalidad sigue ahí, solo oculta.
- Sidebar sin el ítem "Vencimientos" (10 secciones, no 11).
- Tablero: sin el botón "Ver vencimientos"; la tarjeta de Alertas muestra
  el producto con stock bajo real y no menciona vencidos/por vencer.
- Panel del header en Mostrador: mismo criterio, solo "Stock bajo".
- Sin `<section id="vista-vencimientos">` en el DOM.
- Cero errores de consola en todo el recorrido.
- axe-core sin violaciones en Tablero y Mostrador, ambos temas.
