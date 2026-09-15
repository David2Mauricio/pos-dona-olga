# ADR 0026: Botón flotante de accesibilidad (alcance reducido)

## Estado

Aceptado, cerrado. Alcance reducido respecto al pedido original —
decisión tomada junto con el cliente, ver Contexto.

## Contexto

Tarea 3 del rediseño pedía un botón circular flotante, presente en las
11 pantallas, que abriera "el panel de accesibilidad existente (Fase
8.3)". Antes de programar nada se auditó el código real: **ese panel no
existe** — ni Fase 8.3, ni ningún componente de panel de accesibilidad en
`public/js/` o `index.html`. Se lo señaló al cliente en vez de
construir un botón que abriera algo inexistente o de inventar un panel
por cuenta propia sin alcance definido.

Se ofrecieron dos caminos: construir el panel ahora (junto con el
botón), o enviar el botón ya mismo con una acción reducida hasta definir
el panel real aparte. El cliente eligió la segunda opción.

## Decisión

El botón flotante existe y cumple los requisitos mecánicos del pedido
original (presente en las 11 pantallas, operable por teclado, sin
conflictos de z-index) pero, sin panel que abrir, su acción actual es
**togglear el tema claro/oscuro** — lo único "de accesibilidad" que ya
existe hoy en la aplicación. Cuando se defina y construya el panel real
(tarea aparte), este mismo botón pasará a abrirlo.

Implementación:

- `public/index.html`: `#boton-accesibilidad-flotante`, hermano de
  `#nav-lateral` dentro de `#shell` (no dentro de ningún
  `<section data-vista-contenido>`) — con `position: fixed` queda
  presente sin importar qué `.vista` esté activa, en las 11 pantallas.
- Es el único de los dos toggles de tema que sigue siendo alcanzable en
  mobile: por debajo de 768px la sidebar (y `#boton-tema`, que vive
  dentro de ella) se esconde detrás del menú hamburguesa (ver ADR 0017,
  Bloque C) — el flotante no depende de esa sidebar.
- `public/js/theme.js`: `iniciarTema()` ahora acepta un botón o una
  lista de botones, para mantener sincronizados el ícono/`aria-pressed`
  de `#boton-tema` y `#boton-accesibilidad-flotante` con una sola fuente
  de lógica de toggle (sin duplicar el manejo de tema en `main.js`).
- CSS: círculo de 48px (por encima del mínimo de toque de 44px),
  `z-index: 35` — por encima del contenido normal (10-30) pero por
  debajo del cajón móvil/su fondo (40/45) y de los overlays modales
  (50), para no tapar ni quedar tapado por ninguno.

## Verificación

Contra una copia aislada de la base real, con sesión inyectada (mismo
usuario admin):

- Presente y visible en las 10 secciones reales de hoy (Vencimientos ya
  no cuenta, ver ADR 0023) — 20/20 checks de presencia + no-tapado.
- En Mostrador con el carrito activo: no se solapa con el botón
  "Cobrar" (coordenadas reales verificadas, no a ojo).
- Clic en el flotante togglea `data-tema` y sincroniza el ícono/
  `aria-pressed` de `#boton-tema`.
- Recibe foco por teclado y Enter dispara el mismo toggle.
- axe-core sin violaciones en Tablero con el botón presente, ambos
  temas.
- Viewport mobile (390px): sidebar colapsada, botón flotante sigue
  visible.
- Sin errores de consola atribuibles (el único 404 visto es un recurso
  preexistente sin relación, ya identificado en rondas anteriores).
