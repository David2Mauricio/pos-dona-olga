# ADR 0013: Fase 4 — sesión, Fase 2/3 en el flujo de venta y panel de KPIs

## Estado

En progreso — este ADR se amplía a medida que se cierra cada pieza de la Fase 4. Bloque 1 (sesión), Bloque 2 (Fase 2/3 en el flujo de venta, reemplazo de paleta, navegación persistente), Gestión de Productos y Categorías, y Cierre de Caja cerrados; Bloque 3 (KPIs) pendiente — con esto el sistema cubre el 100% de los módulos de backend construidos.

## Contexto

La interfaz de mostrador (`public/`, commit `daa318f`, ADR 0009) se construyó **antes** de que existiera autenticación. Fase 1 (ADR 0010) agregó sesiones de servidor a todo `/api/*` salvo `/api/health` y `/api/auth/*`, así que esa interfaz dejó de poder usarse: no maneja sesión, no expone el override de precios de Fase 2 (ADR 0011) ni el vuelto/anulación de Fase 3 (ADR 0012). Fase 4 extiende esa misma interfaz — no la reconstruye — en tres bloques aprobados por separado: sesión, exponer Fase 2/3 en el flujo de venta, y un panel de KPIs para administrador.

## Bloque 1 — Sesión

### Reutilizar el patrón overlay existente, no un router

La única pieza de "gate de pantalla completa" que ya existía era `#overlay-caja-cerrada` (`hidden` + `.overlay`/`.overlay__panel`, mostrado/ocultado por `main.js` según el estado de la caja). El login es exactamente ese mismo problema (bloquear todo hasta que se cumpla una condición), así que `#overlay-login` replica el mismo patrón en vez de introducir un router de cliente — este proyecto no tiene bundler ni framework (ADR 0009), y una sola pantalla con overlays sigue siendo la solución de menor superficie nueva.

El overlay de login tiene dos sub-estados dentro del mismo panel (formulario de login, formulario de cambio de contraseña obligatorio) alternados por `hidden`, en vez de dos overlays separados — evita duplicar el marcado del panel y del ícono, y el cambio de contraseña es, conceptualmente, un paso intermedio del mismo gate, no un gate distinto.

### Hook de sesión vencida centralizado en `api.js`, no por call site

`api.js` es el único punto por el que pasa cualquier llamada a la API (`peticion()`). En vez de que cada módulo (ventas, caja, productos...) tenga que chequear si su propio error es un `401 SIN_SESION`, `peticion()` dispara un callback registrable (`onSesionExpirada`) apenas detecta ese caso, **antes** de relanzar el error normalmente. `auth.js` es quien se registra ahí. Esto cubre el caso explícitamente pedido de "sesión que expira a mitad de una venta" sin tocar el resto de los módulos: cualquier llamada futura, de cualquier parte del código, dispara el mismo comportamiento automáticamente.

`api.js` sigue sin tocar el DOM directamente (su propio comentario de cabecera ya decía "cliente delgado sobre la API"): el hook solo avisa, quien decide mostrar el overlay es `auth.js`.

### `ErrorApi` gana un campo `codigo`

Antes solo llevaba `status`. Como Fase 1 ya devuelve un `codigo` estable junto al mensaje (`SIN_SESION`, `DEBE_CAMBIAR_PASSWORD`, `ROL_INSUFICIENTE`, `CREDENCIALES_INVALIDAS`, `RATE_LIMITED` — ver ADR 0010), y dos de esos códigos comparten el mismo `status` 403, el frontend necesitaba poder distinguirlos sin parsear el texto del mensaje. `auth.js` usa `error.codigo === 'SIN_SESION'` para decidir si mostrar el login o un error de red genuino.

### La carga inicial ya no dispara nada antes de saber si hay sesión

Antes, `main.js:iniciar()` pedía productos, caja y alertas sin haber verificado sesión — esas tres llamadas volvían `401` y un `catch` genérico las convertía todas en el mismo mensaje engañoso: *"No se pudo conectar con el servidor. Verificá que esté corriendo."* (con el servidor corriendo perfectamente). Ahora `auth.iniciarAuth()` corre primero (`GET /api/auth/sesion`); solo si hay una sesión lista, `main.js` recién ahí pide el resto. El `catch` genérico de `iniciarMostrador()` sigue existiendo, pero ahora solo puede dispararse por un error de red real, porque el caso de sesión ya quedó resuelto antes de llegar a ese punto.

### Hallazgo no pedido explícitamente: `GET /api/reportes/inventario` es solo-administrador

Ese endpoint alimentaba el indicador de alertas del mostrador (pensado para ambos roles), pero quedó restringido a administrador desde Fase 1 (ADR 0010 ya había anticipado y decidido este reemplazo, sin implementarlo todavía). `cargarAlertas()` ahora llama `GET /api/inventario/alertas` + `GET /api/vencimientos/alertas` (ambos de ambos roles) y arma localmente el mismo shape que `renderizarAlertas()` ya esperaba — cero cambios en `render.js`.

### Verificación

Suite Puppeteer contra Chrome real (17/17): overlay de login en carga inicial sin sesión (sin el toast viejo), credenciales incorrectas mostrando el mensaje real del backend, login con contraseña temporal → formulario de cambio obligatorio → mostrador, alertas sin 403 para un cajero, logout limpiando el estado visible, login directo de un usuario sin cambio pendiente, y sesión vencida a mitad de uso (cookies borradas manualmente para simularlo) resolviendo al overlay de login en vez del toast genérico viejo.

**Nota de metodología descubierta durante la prueba**: `page.type()` de Puppeteer escribe sin demora entre teclas, lo que dispara el heurístico del lector de código de barras (ADR 0009, umbral de 30ms) como si fuera un escaneo real, interfiriendo con el resultado. No es un bug de la aplicación — se resolvió con `{ delay: 45 }` en el test, por encima del umbral.

## Reemplazo de paleta: navy/blanco/gris en vez de la cálida del ADR 0009

Antes de tocar el resto del Bloque 2, el cliente reemplazó la paleta cálida (crema/vino, Fraunces + Public Sans) del ADR 0009 por una navy/blanco/gris con Montserrat + IBM Plex Mono — la misma dirección visual que ya había fijado como "definitiva" para esta fase antes de arrancarla, revirtiendo la instrucción posterior de "no toques la paleta cálida" que abrió el Bloque 1. No es una corrección técnica ni una decisión mía: es una decisión de dirección visual del cliente, documentada acá porque cambia tokens que el resto de esta interfaz depende.

**Verificación antes de aplicar** (no a ojo, mismo estándar que el ADR 0009 original): 16 combinaciones de contraste WCAG con la fórmula real (texto normal ≥4.5:1, componentes de UI ≥3:1) contra los hex finales, en ambos temas — 0 fallos tras dos rondas de ajuste (`--color-borde-fuerte` estaba en 1.66:1/1.76:1 en claro/oscuro, muy por debajo del mínimo de 3:1 para bordes de input; el acento oscuro sobre su fondo suave daba 4.33:1, un poco corto). Fuentes descargadas como `.woff2` reales desde el origen estático de Google Fonts (mismo criterio que Fraunces/Public Sans: autohospedadas, cero llamada a CDN en tiempo de ejecución) — Montserrat 400/500/700/800 y IBM Plex Mono 400/500/600/700 (la 700 se agregó sobre la spec original porque totales/precios en negrita la necesitaban; sin ella el navegador sintetiza el grosor, lo que se ve mal en una fuente monoespaciada), ambas SIL OFL 1.1 verificadas textualmente (`public/fonts/OFL-*.txt`).

Un solo token de tipografía general (`--fuente-ui`, Montserrat) reemplaza a los dos que había antes (`--fuente-display` para títulos, `--fuente-ui` para el resto) — ya no hay una fuente serif editorial separada para encabezados, así que la distinción por peso alcanza (700/800 para títulos y marca, 400/500 para el resto). Se agrega `--fuente-numerica` (IBM Plex Mono) para `.numero`/`.precio`/`.total`, específicamente para precios/pesos/totales/vueltos — legibilidad y alineación bajo presión, no personalidad, tal como se pidió.

### Dos bugs reales encontrados al verificar visualmente (ninguno causado por la paleta)

El cliente pidió confirmación visual real (no solo el número de contraste) antes de seguir. Al tomar capturas de pantalla reales aparecieron dos bugs preexistentes, invisibles hasta ahora porque nunca se había ejercitado ese camino de código:

1. **Badge de "Stock bajo" mostraba `undefined/5`** en vez de `3/5`: `render.js` leía `producto.stockGramos`/`producto.stockUnidades`, pero `GET /api/inventario/alertas` (el endpoint que reemplazó a `/api/reportes/inventario` en el Bloque 1) devuelve `stockActual` ya resuelto — un campo distinto. Corregido para leer `stockActual` directo.
2. **El formulario de cambio de contraseña quedaba visible encima del de login**: `.overlay__panel form { display: flex }` (una clase + un tipo) es una regla de **autor**, y las reglas de autor con cualquier especificidad ganan contra el `[hidden]` del navegador (regla de **user-agent**) — el origen de la regla decide antes que la especificidad. Nunca se notó porque `overlay-caja-cerrada` solo tenía un `<form>`, nunca alternado por `hidden`. Se agregó `.overlay__panel form[hidden] { display: none }` explícito. El mismo patrón se repitió (y se corrigió igual) en `.item-carrito__ajuste-form` y en `#app` al construir el historial de ventas — cualquier elemento nuevo que se alterne con `hidden` bajo una regla de autor con `display` propio necesita este mismo override explícito.

### Verificación

Lighthouse (login sin sesión y mostrador autenticado, por separado — un visitante anónimo solo ve la pantalla de login): **login 99/100/96/100** (el 96 de best-practices es el 401 esperado de `/api/auth/sesion` en carga anónima, no un bug — Chrome lo loguea como error de red aunque la app lo maneje correctamente); **mostrador autenticado 98/100/100/100**. axe-core: **0 violaciones** en las 4 combinaciones (login × mostrador, claro × oscuro). Capturas de pantalla reales confirmaron que el ámbar de alerta se distingue claramente del navy de marca en ambos temas — no solo por el número de contraste.

## Bloque 2 — Fase 2/3 en el flujo de venta

### Override de precio: el carrito replica el cálculo del backend, ahora con override

`cart.js` ya replicaba el cálculo de `ventas.service.js` (ADR 0009: "el total en pantalla coincida con lo que se va a cobrar de verdad, no una fuente de verdad paralela"). El override se agregó con el mismo criterio: cada item del carrito puede llevar `{ precioUnitarioOverride, motivoAjuste }`, y si existe, gana sobre `resolverPrecioAplicado` — igual regla que `ventas.service.js`. El override es un precio absoluto, no relativo a `tipoPrecio`: cambiar Público↔Mayorista después de fijar un ajuste no lo invalida (mismo comportamiento que el backend).

La UI es un mini-formulario inline por fila (precio + motivo obligatorio), no un overlay — abrirlo no debe interrumpir el flujo de agregar más productos o cobrar. El backend sigue siendo quien valida de verdad (`motivoAjuste` obligatorio junto con el override, ver ADR 0011); el frontend solo replica esa regla para no dejar enviar un formulario a medio llenar.

### Vuelto: validación en cliente ADEMÁS del backend, nunca en vez de

`montoRecibido >= total` se valida en `main.js` antes de habilitar "Cobrar" cuando el medio de pago es efectivo — pero es una comodidad, no la validación real: `ventas.service.js` la vuelve a hacer al recibir el `POST`, y si alguna vez divergen (ej. un ajuste de precio que cambió el total justo antes de enviar), el backend manda. El vuelto mostrado en pantalla antes de cobrar es el mismo cálculo que después queda en la respuesta (`venta.vuelto`, derivado, ver ADR 0012) — se muestra también en el toast de confirmación tras cobrar.

### Anulación: pantalla de historial, no scoped a la última venta

Decisión inicial (scoped a la última venta cobrada) revertida por el cliente antes de implementar: en el uso real, quien anula revisa el día más tarde, no está parado en el mostrador en el momento exacto del cobro. `public/js/historial.js` (nuevo) es una vista separada (`#vista-historial`, alternada con `#app` por `hidden`, mismo mecanismo que los overlays pero sin backdrop — es una vista propia, no un modal sobre el mostrador), que lista `GET /api/ventas` filtrado a hoy (`desde`/`hasta` ya soportados, sin endpoint nuevo). Cada fila activa tiene un botón "Anular" **solo si el usuario logueado es administrador** — verificado con `PATCH /api/ventas/:id/anular` (motivo obligatorio, mismo mini-formulario inline que el override de precio).

La protección real sigue siendo el backend: el botón "Historial" completo queda oculto para cajero (no solo el botón anular dentro), pero se verificó explícitamente que aunque un cajero llamara al endpoint directo (sin pasar por la UI), sigue recibiendo `403 ROL_INSUFICIENTE` — la ocultación en la UI nunca es la única barrera.

### Verificación

Suite Puppeteer contra Chrome real (14/14): override de precio reflejado en subtotal y badge; vuelto bloqueando "Cobrar" con monto insuficiente y habilitándolo con monto suficiente, mostrado correctamente antes y después de cobrar; historial listando la venta del día, anulación funcionando y reflejando el badge "Anulada"; botón "Historial" oculto para cajero; y la verificación directa del 403 `ROL_INSUFICIENTE` contra el backend descrita arriba. Datos de prueba (producto, categoría, venta, usuario cajero) eliminados de la base real al terminar.

## Reestructuración a navegación persistente (todavía Bloque 2)

Antes de seguir con recibo/ajuste de color y con el Bloque 3, el cliente pidió dos correcciones de estructura sobre lo ya construido: un bug real de fotos rotas, y reemplazar "un botón por sección metido en el header del mostrador" por una navegación persistente de verdad.

### Bug de fotos: dato de prueba viejo, no un fallo de `onerror`

Dos productos ("Pechuga de pollo", "Salchicha paquete x10") mostraban un bloque rojo sólido en vez del placeholder SVG. Diagnóstico antes de tocar código: las imágenes **cargaban perfectamente** — `foto_nombre_archivo` apuntaba a archivos reales (`demo-pechuga.png`, `demo-salchicha.png`, 70 bytes, un PNG válido de **1×1 píxel rojo**), datos de prueba de una fase anterior que nunca se limpiaron de la base real. El bloque rojo era el render correcto de ese contenido, estirado por `object-fit: cover`. Se limpiaron los dos registros (`foto_nombre_archivo = NULL`) y se borraron los archivos.

Separado de eso, sí había un gap real: el `<img>` nunca tuvo `onerror`, así que un archivo genuinamente faltante (404) habría mostrado el ícono roto del navegador en vez del placeholder. Se agregó (`render.js`: `crearPlaceholderFoto()` reemplaza al `<img>` en el evento `error`) — corrección defensiva, no estaba causando el bug reportado pero es la misma clase de problema.

### Sidebar izquierda, no barra horizontal

Con 4 secciones (Mostrador, Historial, Indicadores, Inventario) más los controles de cuenta (usuario, tema, salir), el header horizontal que ya tenía marca+caja+alertas+tema+usuario+salir no tenía lugar para crecer. La sidebar separa navegación entre secciones (izquierda, persistente) de controles de cuenta (agrupados al final de la misma sidebar, en vez de mezclados con la navegación) y de contexto por sección (`.cabecera-contexto`, la franja superior angosta con estado de caja + alertas, que ahora es parte del marco fijo, no del contenido de cada vista).

Mecanismo único: `main.js:mostrarVista(nombre)` es el único lugar que decide qué `<section data-vista-contenido>` queda visible — reemplaza el patrón anterior (`#app`/`#vista-historial` como hermanos sueltos, cada uno con su propio botón de entrada/salida). `historial.js` dejó de manejar su propio cierre (`alCerrar`, `botonCerrar`) porque ya no tiene sentido — la sidebar es la única forma de navegar entre secciones, siempre.

**Indicadores** e **Inventario** quedan en la sidebar como "Próximamente" (visibles pero `disabled`, con una vista de marcador de posición coherente con el resto del sistema — mismo ícono, misma tipografía, no un placeholder genérico) en vez de aparecer de golpe cuando estén listos. Indicadores queda oculto por completo para cajero (es Bloque 3, admin-only, igual que Historial); Inventario queda visible para ambos roles.

### Inventario: `POST /movimientos` pasa a ser solo-administrador

El cliente señaló, antes de construir nada de UI sobre este endpoint, que `POST /api/inventario/movimientos` no tenía restricción de rol — cualquiera con sesión podía registrar un ajuste manual de stock. Mismo criterio de riesgo que anular una venta (ADR 0012): un ajuste manual sin venta real detrás es una vía para tapar una merma o un faltante. Se agregó `requiereRol('administrador')` en `inventario.routes.js`, mismo patrón que `ventas.routes.js` usa para anular. `GET /movimientos` y `GET /alertas` siguen siendo de ambos roles — un cajero necesita poder consultarlo, la restricción es solo sobre crear.

### Bug real encontrado por el pedido explícito de correr Lighthouse/axe-core de nuevo

axe-core encontró `scrollable-region-focusable` en `#lista-carrito` en las 4 combinaciones que incluían el mostrador (no en historial, porque ahí `#vista-mostrador` queda `hidden` y sus descendientes no se evalúan). Investigado con `getComputedStyle`/`clientHeight`/`scrollHeight` antes de asumir la causa: **no** era el problema de especificidad de `[hidden]` ya conocido — el `<section>` nuevo que envuelve cada vista (`#vista-mostrador`) no participaba del contexto flex que antes hacía que `.contenido`/`.panel-carrito` se acotaran correctamente cuando `.contenido` era hijo directo de `#app`. Se agregó `flex:1; min-height:0; display:flex; flex-direction:column` a `.vista` (y `min-height:0` a `.contenido`) para restaurar esa cadena de altura.

Aun con la cadena de altura corregida (`#lista-carrito` sin overflow real, `clientHeight === scrollHeight`), axe seguía marcando la violación: la regla no depende de si hay overflow en este instante, sino de que cualquier región con `overflow-y: auto` sea alcanzable por teclado — un carrito real se llena de items y sí vuelve a tener scroll. Se agregó `tabindex="0"` a `#lista-carrito` (con `aria-label`) y, proactivamente por el mismo riesgo, a `#grilla-productos` (que ya tenía `role="region"`/`aria-label` pero no `tabindex`). 0 violaciones tras el fix.

### Verificación

Suite Puppeteer contra Chrome real (18/18) cubriendo el flujo completo pedido explícitamente (no solo la sidebar aislada): login → sidebar con las 4 secciones correctas por rol → navegar a Historial y volver a Mostrador vía sidebar → tema/badge/salir funcionando desde su nueva ubicación → logout → login como cajero confirmando Historial/Indicadores ocultos e Inventario visible → verificación directa contra el backend de que `POST /api/inventario/movimientos` rechaza a un cajero con 403 `ROL_INSUFICIENTE` mientras `GET` sí le responde 200. Lighthouse: login 98/100/96/100 (96 = 401 esperado, no un bug), mostrador 98/100/100/100 — sin cambios respecto a antes de la reestructuración. axe-core: 0 violaciones en 5 combinaciones (login × mostrador × historial, ambos temas) tras corregir la regresión real encontrada.

## Sección: Gestión de Productos y Categorías

Primera de las dos secciones agregadas a la cola después de la navegación persistente. Se auditó el contrato real (`productos.routes.js`, `productos.schema.js`, `productos.service.js`, `categorias.routes.js`, `categorias.schema.js`) antes de escribir código, sin asumir nada.

### Hallazgos de la auditoría

- Crear/editar producto y categoría: **solo administrador**. Listar: ambos roles. Sección entera oculta para cajero en la sidebar (gestión completa no tiene sentido para un cajero, que ya tiene su propio buscador en el mostrador).
- **No hay borrado** — ni de productos ni de categorías. "Desactivar" un producto es `PATCH` con `activo:false`; una categoría no tiene ningún mecanismo de baja, así que la pregunta de "¿se puede borrar una categoría con productos activos?" no aplica: no se puede borrar, punto.
- `tipoVenta` es inmutable después de crear — el schema de `PATCH` ni lo acepta.
- **No existe ningún endpoint de subida de fotos** (`grep` de `multer`/`upload` en todo `src/`: sin resultados). `fotoNombreArchivo` es texto plano; el backend asume que el archivo ya está en `uploads/`. Confirmado con el cliente: **no se construye nada de fotos en esta pasada** (ni campo de texto ni upload) — queda documentado como gap conocido, no resuelto acá.
- **Hallazgo señalado antes de construir la UI, no descubierto después**: `PATCH /api/productos/:id` permite editar `stockUnidades`/`stockGramos` directo, sin pasar por `movimientos_inventario` — contradice el principio explícito del ADR 0005 ("todo cambio de stock pasa por el ledger, sin excepción"). Es comportamiento ya existente del backend, no algo introducido acá. Decisión (confirmada): el formulario de **edición** no expone stock como campo editable — corregir stock de un producto activo es tarea de un movimiento de `ajuste` (Inventario, todavía no construido), no de este formulario. El formulario de **alta** sí pide stock inicial (un producto nuevo no tiene historial que romper).

### Diseño

`public/js/catalogo.js` (nuevo, mismo patrón que `historial.js`: módulo autocontenido, propio DOM, propias llamadas). Una sola sección en la sidebar ("Productos") con dos pestañas internas — Productos y Categorías — en vez de dos secciones separadas: categorías es demasiado simple (crear + renombrar, nada más) para justificar su propio lugar en la navegación.

Formulario de producto (mismo para alta/edición, campos condicionales por contexto):
- **Alta**: categoría, nombre, tipo de venta, código de barras (opcional), precio público, precio mayorista (opcional), stock inicial (unidades o kg según tipo de venta — el campo cambia de tipo/etiqueta en vivo al elegir tipo de venta, reutilizando `kilosTextoAGramos`/`gramosAKilosTexto` de `utils.js`, mismo criterio que el peso en el carrito), stock mínimo (opcional).
- **Edición**: igual, sin tipo de venta ni stock (ver hallazgo arriba), con el toggle de activo/inactivo agregado.

Todo el DOM se construye con `createElement`/`textContent`, nunca `innerHTML` interpolado con datos de la API — mismo criterio de seguridad que ya establecía `render.js`.

### Verificación

Suite Puppeteer contra Chrome real (20/20): categoría creada y renombrada reflejándose en el listado; alta de producto (tipo unidad) con los campos correctos visibles/ocultos; buscador por nombre filtrando en cliente; edición confirmando que tipo de venta y stock quedan ocultos y que activo sí se puede togglear; alta de producto tipo "peso" con conversión real de "2,5" (texto, coma decimal) a 2500 gramos verificada contra el backend; sección e ítem de nav ocultos para cajero; y el 403 `ROL_INSUFICIENTE` verificado contra el backend igual que en las secciones anteriores. axe-core: 0 violaciones en 6 combinaciones (listado de productos/categorías, ambos formularios abiertos, alta en modo peso, ambos temas). Lighthouse sobre el mostrador autenticado: 98/100/100/100, sin cambios. Datos de prueba (3 categorías, 4 productos, usuario cajero) eliminados de la base real al terminar.

## Sección: Cierre de Caja

Segunda y última de las dos secciones agregadas a la cola. Auditoría de `caja.routes.js`, `caja.schema.js`, `caja.service.js`, `caja.repository.js` antes de escribir código.

### Hallazgos de la auditoría

- `PATCH /api/caja/:id/cierre` es de **ambos roles** — a diferencia de anular una venta o crear un movimiento manual de inventario, acá quien cierra cierra su propio turno y el cálculo de la diferencia lo hace el backend de forma transparente; no hay una vía para que el cajero lo manipule a su favor. Confirmado con el cliente antes de implementar.
- El backend ya calcula `montoTeoricoEfectivo` y `diferencia` (`caja.service.js`: `diferencia: montoCierre - montoTeoricoEfectivo`) — mismo criterio que `vuelto` (ADR 0012) y `ticketPromedio`: el frontend no resta nada, solo muestra lo que ya viene.
- `GET /api/caja/:id` expone además `totalVentas` y `desglosePorMedioPago`, disponibles en cualquier momento (sesión abierta o cerrada).

### Bloqueo del mostrador durante el cierre

Decisión (mi criterio, confirmado con el cliente antes de implementar): mientras el overlay de cierre está abierto, "Cobrar" queda bloqueado — mismo bloqueo total que ya existe para "sin caja abierta", no un bloqueo parcial. Razón: `montoTeoricoEfectivo` se recalcula en el momento exacto del `PATCH`; si se permitieran ventas en efectivo mientras alguien cuenta el cajón físicamente, el monto contado quedaría desactualizado respecto al teórico que el backend calcula al confirmar, generando una `diferencia` que refleja un desfase de tiempo, no un error real de caja. Esto además es lo que hace confiable la **vista previa de la diferencia** que se muestra mientras se escribe el conteo (antes de confirmar): es aritmética simple hecha en el cliente (`montoContado - montoTeorico`, ambos ya obtenidos del backend), pero solo es válida porque no puede haber cambiado nada de por medio — la venta bloqueada garantiza eso.

`estado-caja` pasó de ser un `<p>` a un `<button>` (reset de estilos nativos para que se siga viendo igual) — es la entrada al flujo de cierre cuando hay una sesión abierta.

### "Sobra $X" / "Falta $X", no solo el signo

Pedido explícito del cliente: la diferencia se etiqueta como "Sobra $X" o "Falta $X" según el signo (y "Cuadra" si es 0), no un número con signo suelto — más rápido de leer al cerrar un turno. Color semántico: éxito si cuadra, peligro tanto si sobra como si falta (ambos son desviaciones que ameritan revisión, nunca el navy de marca).

### Verificación

Suite Puppeteer contra Chrome real (15/15) cubriendo los tres escenarios pedidos explícitamente: diferencia en 0 ("Cuadra", badge de éxito), sobrante ("Sobra $5.000", badge de peligro), y faltante ("Falta $3.000"). Además: "Cobrar" bloqueado mientras el overlay está abierto (con un producto real en el carrito, no solo verificado en abstracto) y bloqueado también después de confirmar (por falta de caja, ya no por el cierre); tras confirmar, el overlay de "caja cerrada" aparece solo, sin código nuevo; cancelar el cierre deja la sesión abierta; y verificación directa contra el backend de que un cajero puede cerrar su propia caja (200, no 403). axe-core: 0 violaciones en 4 combinaciones (mostrador con caja abierta, overlay de cierre con y sin diferencia visible, ambos temas). Lighthouse sin cambios (login 98/100/96/100, mostrador 98/100/100/100). Datos de prueba (producto, categoría, sesiones de caja, usuario cajero) eliminados de la base real al terminar.

## Bloque 3

Pendiente — se documenta acá al cerrarse.
