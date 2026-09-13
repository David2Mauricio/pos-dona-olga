# ADR 0022: Indicadores con Chart.js vendorizado

## Estado

Aceptado, cerrado.

## Contexto

Fase 6 del rediseño visual (ver plan) pedía reemplazar las gráficas SVG
dibujadas a mano en Indicadores por gráficas reales, y agregar una fila de
métricas compactas (ticket promedio, rotación de inventario, margen
bruto, unidades vendidas) con variación vs. período anterior.

Dos puntos se auditaron contra el código real antes de programar nada,
según el mismo criterio que ya rindió en las fases anteriores:

- **Margen bruto y rotación de inventario NO son calculables hoy**: no
  existe `precio_costo` ni ningún campo de costo de compra en el esquema
  (`productos`), y `reportes.service.js` ya tenía un comentario propio
  admitiéndolo (`"No es una valorización contable: no considera el costo
  de compra, que el sistema no captura todavía."`). Inventar un
  placeholder o mostrar "No disponible" en dos tarjetas de una pantalla
  nueva se descartó — se preguntó al cliente y se optó por **reemplazar
  esas dos métricas por otras reales y ya disponibles**: unidades
  vendidas (nueva) y ganancia real (`gananciaReal`, ya existía antes de
  esta fase).
- **Ticket promedio** ya lo calculaba el backend — no requirió cambios.

## Decisión

### Chart.js vendorizado, no CDN

`public/js/vendor/chart.umd.min.js` — build UMD minificado 4.4.7,
descargado una sola vez de
`https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js`,
guardado como archivo estático propio del proyecto (mismo trato que las
fuentes), sin CDN en runtime — mantiene el principio de cero
dependencias de terceros en producción que el proyecto sostuvo hasta
ahora. Se quitó a mano el comentario `//# sourceMappingURL=...` del
final del archivo (referencia a un `.map` que no se vendorizó, generaba
un 404 de consola que bajaba el puntaje de "buenas prácticas" de
Lighthouse). Actualizar de versión es un proceso manual — no hay paso de
build que lo traiga solo.

Se carga con un `<script>` clásico (no `type="module"`) antes de
`main.js`, definiendo `window.Chart` global.

### Ciclo de vida de las instancias — destruir antes de recrear

Indicadores ya tenía selector de período (Día/Semana/Mes/Trimestre); cada
cambio reutiliza el mismo `<canvas>`. Chart.js lanza un error si se crea
una instancia nueva sobre un canvas que ya tiene una activa. Se centralizó
en un `Map<canvasId, ChartInstance>` (`graficosChart`, en `kpis.js`) con
una única función `crearOReemplazarChart(canvas, config)` que llama
`.destroy()` sobre cualquier instancia previa antes de crear la nueva —
las cuatro gráficas (tendencia, top productos, medio de pago, categoría)
pasan por esta misma función, no hay un camino alterno que cree un
`new Chart(...)` directo.

Verificado: 4 cambios de período consecutivos sin error de "canvas ya en
uso", y las 4 gráficas quedan con exactamente una instancia activa cada
una después de los cambios (no se acumulan).

### Paleta heredada, no la de Chart.js por defecto

`coloresDelTema()` resuelve los valores reales de los tokens de color ya
establecidos (`--color-acento`, `--color-exito`, `--color-alerta`,
`--color-peligro`, `--color-texto-muted`, `--color-texto`,
`--color-borde`) vía `getComputedStyle(document.documentElement)` en el
momento de renderizar — necesario porque, a diferencia de SVG (que puede
usar `var(--color-x)` directo en `fill`/`stroke`), un `<canvas>` 2D no
puede resolver custom properties de CSS: Chart.js necesita el valor
literal. Como la resolución ocurre en cada render (no una sola vez al
cargar el script), un cambio de tema seguido de un cambio de período
recalcula los colores correctos del tema activo — verificado en ambos
temas, con los valores exactos de cada uno.

La gráfica de "Comparativa contra período anterior" (barras SVG a mano,
`renderizarGraficoComparativa`) **no se tocó** — ya usaba
`var(--color-acento)` directo vía `.style.fill`, así que ya cumplía el
requisito de paleta heredada sin necesidad de migrarla a Chart.js.
Convertir solo lo que hacía falta (3 gráficas grandes existentes + 1
donut nuevo) evitó reescribir código que ya funcionaba y ya era
accesible.

### Accesibilidad de los `<canvas>`

Cada gráfica lleva `role="img"` **con `aria-label` (nombre corto) y
`aria-describedby`** apuntando a un `<p class="visualmente-oculto">`
hermano con el resumen de datos en texto. `aria-describedby` por sí solo
no alcanza: la regla `role-img-alt` de axe-core exige que un elemento con
`role="img"` tenga nombre accesible (`aria-label`/`aria-labelledby`), no
solo descripción — se detectó con axe-core durante la verificación de
esta fase y se corrigió antes de cerrarla.

Cuando no hay datos suficientes para graficar (menos de 2 puntos para la
tendencia, o total en cero para top productos/donuts), no se deja un
`<canvas>` vacío: se destruye cualquier instancia previa, se limpia el
canvas, y el mismo párrafo de resumen se vuelve visible (se le quita
`visualmente-oculto` y se le pone `catalogo__vacio`) mostrando el mensaje
correspondiente — mismo patrón de estado vacío ya usado en el resto del
proyecto.

### Backend — dos agregados nuevos, sin migración

`reportes.repository.js` gana `obtenerUnidadesVendidas(filtros)` y
`obtenerVentasPorCategoria(filtros)`, ambos con el mismo molde
(`construirFiltro`, mismo JOIN) que `obtenerTopProductos` ya usaba. No
hizo falta migración: el esquema de `categorias`/`productos`/
`ventas_items` ya soportaba ambas consultas.

- **Unidades vendidas filtra `tipo_venta = 'unidad'`**: sumar unidades
  junto con gramos de productos por peso daría una cifra sin significado
  (2 "unidades" de gaseosa + 500 "unidades" de pechuga no es un número
  que diga nada) — se excluyen los productos por peso del total, sin
  inventar una conversión que no existe en el resto del sistema.
- **Ventas por categoría es un agregado propio, no derivado de
  `topProductos` en el cliente**: `topProductos` trae solo el top 10:
  una categoría con muchos productos chicos podría vender más en total
  que el top 10 combinado y quedar subrepresentada en el donut si se
  calculara a partir de esa lista recortada.

### Hallazgo real durante la verificación: sidebar sticky vs. capturas de página completa

Ver commit aparte y su propio mensaje — no es parte de esta fase, pero lo
expuso: `.nav-lateral` (Fase 1, `position: sticky; height: 100vh`) pinta
navy solo hasta el alto de la ventana, nunca el alto real del documento.
Es invisible para un usuario real (el sticky se ve perfecto scrolleando),
pero Indicadores fue la primera pantalla en medir más que una ventana
(2264px, por las 4 gráficas nuevas) y expuso que una captura de página
completa "aplanada" — la técnica que usan Lighthouse y axe-core para
medir contraste — no puede representar `position: sticky`, y detectaba el
fondo de la página (`--color-fondo`) detrás del badge de usuario en vez
de navy. Se agregó `#shell::before`, una capa decorativa del ancho del
nav que mide el alto real de `#shell` (no el de la ventana) y pinta navy
ahí, sin cambiar el comportamiento ni la apariencia del nav sticky en sí.

## Verificación

Contra una copia aislada de la base real, servidor de prueba en puerto
3001:

- **12/12** verificaciones reales de esta fase (una 13ª falló solo por
  reintentar el setup contra una base ya sembrada de una corrida
  anterior — no es un bug de la aplicación): Chart.js cargado como
  `window.Chart`; KPI de unidades vendidas correcto (excluye productos
  por peso); las 4 gráficas activas con exactamente una instancia cada
  una; resumen accesible presente y oculto en las 4; color de barra/donut
  igual al valor real resuelto de `--color-acento`/`--color-exito` (no un
  color por defecto de Chart.js); **4 cambios de período consecutivos sin
  error de "canvas en uso"**, con las 4 instancias intactas después;
  estado vacío correcto en la tendencia con período "Día"; **axe-core sin
  violaciones en Indicadores con las gráficas reales, ambos temas**;
  color de gráfica coherente y distinto entre tema claro y oscuro.
- Lighthouse (accesibilidad + buenas prácticas, desktop,
  `screenEmulation` deshabilitado): **100/100 en ambas categorías, ambos
  temas**, tras la corrección de `aria-label` y el fix de `#shell::before`.
- Regresión: axe-core sin violaciones en Mostrador, Vencimientos,
  Proveedores, Productos e Inventario (ambos temas cada una) después del
  cambio a `#shell` — el fix del sidebar es compartido por las 10
  pantallas, no solo por Indicadores.
