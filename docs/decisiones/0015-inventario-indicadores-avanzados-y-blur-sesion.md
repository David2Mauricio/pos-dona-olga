# ADR 0015: Sección Inventario, gráficos + selector de período en Indicadores, y blur de sesión

## Estado

Aceptado. Tres puntos de una misma ronda de trabajo posterior al cierre de
ADR 0014, más un bug real encontrado (no buscado) durante las pruebas de
esta ronda.

## Contexto

Con el sistema ya cerrado para instalación real (ADR 0014), quedaban tres
piezas pendientes antes de instalar: la sección Inventario (hasta ahora un
"Próximamente" en la sidebar), hacer el panel de Indicadores más visual con
un selector de período, y evitar que datos del mostrador queden visibles
detrás del overlay de sesión cuando esta expira.

## Sección Inventario

Contrato ya auditado y ya correcto desde antes de esta ronda: `POST
/api/inventario/movimientos` ya exigía `requiereRol('administrador')`
(inventario.routes.js) — no hizo falta ningún cambio de backend para eso.
`GET /movimientos` y `GET /alertas` siguen siendo de ambos roles.

`public/js/inventario.js` (nuevo, mismo molde que `vencimientos.js`):
formulario de alta que solo cubre `tipo:'entrada'` (lo único pedido —
registrar mercadería entrante), con motivo pre-cargado en "Entrada de
mercadería" y editable, y cantidad en kg para productos `tipoVenta:'peso'`
(mismo criterio de conversión que Vencimientos/Productos). Debajo, lista de
movimientos recientes que muestra **todos** los tipos (entrada, salida,
ajuste) que ya existan — incluida la salida automática que generan las
ventas — porque es la referencia completa del historial real de stock, no
solo lo que se carga desde este formulario.

`inventario.repository.js` no enriquece los movimientos con nombre de
producto (solo trae `productoId`), así que la lista cruza contra
`mapaProductos` ya cargado — mismo patrón que Vencimientos con sus lotes.

El nav de Inventario queda visible para ambos roles (no se agrega a
`actualizarNavegacionPorRol` en main.js) porque la lista es de ambos, pero
el formulario de alta se oculta para cajero en el propio módulo
(`obtenerUsuarioActual` importado de `auth.js`, mismo patrón que el botón
"Anular" de `historial.js`) — la protección real sigue siendo el 403 del
backend, esto es solo para no mostrar una acción que va a fallar.

## Indicadores: selector de período + gráficos SVG

`reportes.service.js` ya aceptaba cualquier rango `desde`/`hasta` válido y
ya traía `ticketPromedio`/`topProductos` calculados — el selector de
período (Día/Semana/Mes/Trimestre) es enteramente de cliente, sin cambios
de backend.

Cada período calcula su propio rango actual y el **rango anterior
equivalente en días transcurridos** ("period-to-date"): si hoy es el
tercer día de la semana/mes/trimestre actual, se compara contra los
primeros tres días del período anterior, no contra el período anterior
completo — evita que la comparación se vea artificialmente mala mientras
el período actual sigue en curso (mismo espíritu que ya regía "hoy vs.
ayer": comparar cosas comparables). Con tope explícito para no cruzar
hacia atrás del propio período anterior en meses/trimestres más cortos que
el actual.

Gráficos: SVG dibujado a mano y generado dinámicamente en JS a partir de
los datos reales, sin librería ni CDN — mismo criterio que los íconos SVG
inline hechos a mano en el resto de la interfaz. El proyecto no tiene paso
de build, así que una librería de gráficos instalada por npm no tendría
forma de llegar al navegador sin bundlear; eso hubiera sido un cambio de
arquitectura mucho más grande que lo que este punto pedía. Cada `<svg>`
lleva `role="img"` y un `aria-label` con los valores reales en texto (no
solo "gráfico de barras"), para que un lector de pantalla tenga la misma
información que alguien viendo las barras.

## Blur del overlay de sesión

`#overlay-login` es el único contenedor de las tres pantallas de sesión
(login, cambio de contraseña obligatorio, recuperación por pregunta de
seguridad — las tres son sub-estados del mismo `<div>`), así que un solo
selector CSS (`backdrop-filter: blur(8px)`) cubre las tres. Para que datos
del mostrador que quedaron en pantalla (carrito, totales) no se alcancen a
leer detrás cuando la sesión expira o alguien se desloguea sin cerrar la
pantalla.

## Bug real encontrado durante las pruebas (no buscado): lector de código de barras interfería con el login

`barcode-scanner.js` escucha `keydown` globalmente desde la carga de la
página, sin ninguna condición — incluida la pantalla de login, antes de
que exista sesión. Tipear usuario/contraseña rápido (o pegar una
contraseña) se leía como una ráfaga de lector de código de barras y
disparaba `GET /api/productos/codigo-barras/...` sin sesión todavía. Esa
búsqueda fallaba con `401 SIN_SESION` — y si esa respuesta llegaba
**después** de que el login ya había resuelto bien, disparaba el hook
global de sesión expirada (`onSesionExpirada`, ver `api.js`) y devolvía a
la pantalla de login a alguien que sí acababa de entrar.

Encontrado con evidencia real (no hipótesis): trazando cada request de red
durante un login automatizado se vio `GET /api/productos/codigo-barras/...
-> 401` disparado por el tipeo de la contraseña, llegando justo después del
`POST /api/auth/login -> 200`. Reproducido y confirmado antes de tocar
nada, mismo criterio de este proyecto.

**Fix**: `barcode-scanner.js` ahora ignora cualquier tecla mientras
`#overlay-login` está visible (login, cambio de contraseña, o
recuperación) — no hay ningún caso de uso real para escanear un código en
esas pantallas. Fix acotado al lector, no al hook global de sesión
expirada (que sigue siendo correcto para su propósito real: detectar una
sesión que sí expiró).

## Verificación

Puppeteer + axe-core, con un catálogo y ventas de demo generados para
poder probar Inventario e Indicadores con datos reales en varios rangos de
fecha (ver sección siguiente sobre esos datos): 22/22 verificaciones,
incluidas ambas superficies nuevas en tema claro y oscuro, con y sin rol
administrador. Lighthouse: accesibilidad 100, mejores prácticas 96
(el único hallazgo, `errors-in-console`, son el 401/404 ya esperados y
documentados en ADR 0014 — sesión sin loguear todavía, logo ausente),
rendimiento 98-99 (una corrida aislada dio un CLS anómalo por ruido de
máquina — 30+ procesos de Chrome del usuario corriendo en simultáneo con
la corrida de pruebas — descartado al no reproducirse en una segunda
corrida limpia).

## Incidente real durante las pruebas: venta de un producto de demo

Los 13 productos de catálogo de demo generados para esta ronda de pruebas
se crearon `activo:true`, lo que los hizo aparecer de inmediato en la
grilla real del mostrador — la misma que usa el negocio. Mientras se
armaban las pruebas, alguien (no identificado con certeza) vendió
"Chorizo x5 (demo)" por $7.000 bajo la sesión de caja real (venta #48,
caja #52), con `montoRecibido: 50.000`. Detectado por auditoría directa de
la base antes de seguir, no asumido. Resuelto anulando la venta por el
mecanismo real de la aplicación (mismo botón que usa Historial — repone
stock, motivo documentado, sin borrar el registro), confirmado con el
cliente antes de tocarla. Los 13 productos de demo se dejaron
**inactivos** desde entonces, y solo se reactivan brevemente (con
desactivación garantizada al final, incluso si la prueba falla a mitad de
camino) durante una corrida de Puppeteer ya en marcha, nunca fuera de eso.

## Pendiente, fuera de este cierre

Datos de demo (catálogo, movimientos, ventas, usuarios de prueba) — ver
instrucción de limpieza entregada aparte al cliente, mismo criterio de
borrado directo por SQL que las rondas anteriores.
