# ADR 0028: Correcciones de seguimiento — carrito por peso y botón flotante

## Estado

Aceptado, cerrado (con una decisión pendiente marcada explícitamente al
final — ver "Punto abierto").

## Contexto

Dos correcciones de la ADR 0025 (carrito por peso) y la ADR 0026 (botón
flotante) se habían dado por cerradas, pero verificadas contra el
sistema real, no se aplicaron correctamente. Esta ronda exigió evidencia
verificable, no un reporte de texto.

## Tarea 1 — Scroll interno del carrito por peso

### Por qué el cambio anterior (ADR 0025) no tuvo efecto real

El archivo SÍ se editó correctamente (`.lista-carrito` pasó de
`min-height: 3rem` a `min-height: 0`, confirmado releyendo el CSS real
antes de tocar nada de nuevo) — no fue un archivo equivocado ni una
regla más específica pisándolo. El problema fue el diagnóstico original:
ese cambio atacaba un mecanismo de shrink de flexbox que, medido de
nuevo, **no era el que estaba limitando el espacio visible**. La causa
real era más simple y más terca: `.panel-carrito` tenía
`max-height: calc(100vh - 7rem)` y `.lista-carrito` tenía
`overflow-y: auto` — ambos seguían ahí, intactos, después del cambio de
ADR 0025. Con el pie de resumen (~417px: total, medio de pago, monto,
vuelto, botón Cobrar) restándole espacio a un panel ya acotado por
altura de viewport, la ventana visible de la lista seguía siendo chica
(confirmado en ADR 0025 mismo: ~313px, ~2 ítems por peso a la vez) —
technically no rota, pero exactamente el "scroll interno cramped" que
se pidió eliminar. La ADR 0025 documentó ese hallazgo pero no lo
corrigió de raíz: cambió un valor relacionado sin quitar el mecanismo de
scroll en sí.

### Corrección de fondo

- `.panel-carrito`: se quita `max-height: calc(100vh - 7rem)` por
  completo.
- `.lista-carrito`: se quitan `overflow-y: auto`, `flex: 1` y
  `min-height: 0` (el fix de ADR 0025, ahora innecesario). Queda como una
  lista simple que crece con su contenido.
- `#lista-carrito` en `index.html`: se quita `tabindex="0"` (existía
  solo para satisfacer axe-core `scrollable-region-focusable` sobre el
  scroll que ya no existe).
- Nada de esto rompe el layout de la página: ningún ancestro (`#shell`,
  `body`, `#contenido-principal`) tiene una altura fija que atrape el
  contenido — todos usan `min-height`, no `height`. Si el carrito no
  entra en el viewport, scrollea la **página completa**, el mismo
  comportamiento que ya tiene Indicadores cuando sus gráficas la hacen
  más alta que una pantalla (ver fix del fondo navy de la sidebar, Fase
  6).

### Evidencia (viewport 1366×700, más chico que el usado en la
verificación original de ADR 0025, contra una copia aislada de la base
real)

- 1 producto por peso en el carrito: `#lista-carrito` y `.panel-carrito`
  miden `scrollHeight === clientHeight` (168px y 640px respectivamente)
  — **cero scroll propio**.
- 6 productos por peso: `#lista-carrito` creció a 1045px,
  `.panel-carrito` a 1518px, **los 6 ítems están completos en el DOM sin
  recorte**, y siguen sin scroll propio. La página sí scrollea
  (`documento: 1637px` vs. `viewport: 700px`) — comportamiento esperado
  y correcto, no un bug.
- `scrollIntoView()` sobre "Cobrar" funciona: el botón queda alcanzable
  con el scroll normal de la página.
- axe-core sin violaciones en Mostrador con el carrito de 6 ítems,
  ambos temas.
- Capturas reales: `fix1-un-item.png`, `fix1-seis-items-arriba.png`.

## Tarea 2 — Botón flotante superpuesto y su ícono

### Diagnóstico (con evidencia, antes de tocar nada)

- **Qué hace hoy el botón al hacer clic**: togglea tema claro/oscuro.
  Confirmado con un clic real en la copia aislada: `data-tema` cambió de
  `claro` a `oscuro`, y `document.querySelectorAll('.overlay:not([hidden])')`
  devolvió `0` — no abre ningún panel ni overlay, porque **ninguno
  existe en el código**. Se volvió a buscar cualquier componente de
  panel de accesibilidad en `public/js/` y `public/index.html`: los
  únicos 3 archivos que mencionan "accesibilidad" son `main.js`,
  `theme.js` e `index.html`, y los tres son exactamente el mecanismo de
  toggle de tema ya documentado en ADR 0026. **Sigue sin existir ningún
  panel de accesibilidad real en este proyecto** — mismo hallazgo que
  motivó el alcance reducido de la ADR 0026 en su momento.
- El ícono de luna **no es un error visual aislado**: es el ícono
  correcto para lo que el botón realmente hace (togglear tema), no para
  lo que su nombre/posición sugieren (accesibilidad). El botón sigue
  siendo, en los hechos, un segundo control de tema — no uno de
  accesibilidad con un ícono mal puesto.

### Por qué se solapaba con "Cobrar"

La verificación original de ADR 0026 probó contra un viewport de
1280×900 con un carrito de 5 ítems — en ese punto específico no había
solape. Contra un viewport más realista (1366×700, una laptop común) el
mismo carrito con 1 solo ítem ya alcanza para que el botón (fijo a
`bottom:1.25rem; right:1.25rem`) quede montado sobre la esquina superior
derecha de "Cobrar" — confirmado con una captura real
(`fix2-mostrador-carrito-lleno.png` es la versión ya corregida; el
hallazgo original se reprodujo antes de tocar el CSS). La verificación
original fue insuficiente: probó una sola combinación de viewport +
contenido del carrito, no el caso general.

### Corrección de posición

`right:1.25rem` → `left:1.25rem`, con un ajuste por breakpoint:

- Desktop (`min-width: 769px`, mismo corte que ya usa la sidebar):
  `left: calc(220px + 1.25rem)` — despeja el ancho real de la sidebar
  (220px, no `position:fixed` en desktop, le resta espacio real al
  contenido) para no solaparse con `#boton-tema`/`#boton-salir`, que
  viven en la parte inferior de esa misma sidebar.
- Mobile (`≤768px`): `left: 1.25rem` — ahí la sidebar es
  `position:fixed`, escondida fuera de pantalla salvo que se abra el
  menú, así que no hay nada que despejar.

Bottom-left se eligió porque "Cobrar" es el único botón primario de las
11 pantallas que vive pegado a una esquina inferior (por el pie fijo del
carrito); el resto de las pantallas tiene su botón primario en la
cabecera (arriba), lejos de cualquier esquina inferior.

### Evidencia — contra cuáles pantallas se probó, y con qué

Las 10 pantallas reales (Vencimientos ya no cuenta, ADR 0023), viewport
1366×700, contra el botón primario **real** de cada una (no una revisión
visual):

| Pantalla | Botón primario verificado | Resultado |
|---|---|---|
| Tablero | `#tablero-boton-cobrar` | sin solape |
| Mostrador | `#boton-cobrar` | sin solape |
| Historial | (sin botón primario fijo) | n/a |
| Productos | `#boton-nuevo-producto` | sin solape |
| Usuarios | `#boton-nuevo-usuario` | sin solape |
| Indicadores | (sin botón primario fijo) | n/a |
| Proveedores | `#boton-nuevo-proveedor` | sin solape |
| Inventario | `#boton-movimiento-submit` | sin solape |
| Auditoría | (sin botón primario fijo) | n/a |
| Gastos | `#boton-nuevo-gasto` | sin solape |

Caso más exigente (el que fallaba antes): Mostrador con 6 productos por
peso en el carrito, scrolleado hasta "Cobrar" — sin solape, coordenadas
reales verificadas (`fix2-mostrador-carrito-lleno.png`). Mobile (390px):
el botón vuelve al borde real izquierdo (`left: 20px`), sidebar
colapsada confirmada. axe-core sin violaciones sobre `document.body`
completo con el botón en su nueva posición.

## Punto abierto — no resuelto en esta ronda

El pedido original planteaba: *"si el selector de tema terminó flotando
ahí... crear el botón de accesibilidad correctamente... que abra el
panel ya construido"*. **No hay ningún panel ya construido** — se
verificó de nuevo en esta misma ronda. Construir uno real es una tarea
de alcance propio (qué opciones lleva: tamaño de texto, alto contraste,
algo más) que no se define sola; no se inventó un panel ni se dejó de
mencionar el hallazgo. Se corrigieron los dos bugs concretos y
verificables (posición, y la causa raíz del scroll) sin tocar la
decisión de alcance ya tomada en ADR 0026 hasta que el cliente confirme
cómo seguir.

## Verificación

Ver tablas y capturas arriba, en cada sección. Todo contra una copia
aislada de la base real (nunca la real en sí), servidor de prueba en
puerto 3001.
