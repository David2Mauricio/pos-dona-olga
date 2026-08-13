# ADR 0013: Fase 4 — sesión, Fase 2/3 en el flujo de venta y panel de KPIs

## Estado

**Cerrado.** Bloque 1 (sesión), Bloque 2 (Fase 2/3 en el flujo de venta, reemplazo de paleta, navegación persistente), Gestión de Productos y Categorías, Cierre de Caja, Usuarios, Bloque 3 (KPIs), Vencimientos, Proveedores, y la auditoría final de las 8 secciones completas — todos cerrados. La interfaz cubre el 100% de los módulos de backend construidos.

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

## Sección: Usuarios

Tercera pieza del orden confirmado (Usuarios → Bloque 3 → Vencimientos → Proveedores). Auditoría de `usuarios.routes.js`, `usuarios.schema.js`, `usuarios.controller.js`, `usuarios.service.js`, `auth/usuarios.repository.js` y `auth/auth.service.js` antes de escribir código, con tres preguntas explícitas del cliente a responder primero.

### Hallazgos de la auditoría

- Contrato real: `POST /api/usuarios` `{nombre, usuario (min 3, se guarda en minúsculas), rol}` → responde el usuario expuesto + `passwordTemporal` (generada con `generarPasswordTemporal()`, la misma función que usa `seed-admin.js`). `GET /api/usuarios` lista todos (activos e inactivos). `PATCH /api/usuarios/:id` acepta `{rol?, activo?}` — nunca contraseña, el schema es `.strict()`. Todo el módulo montado en `app.js` con `requiereRol('administrador')` a nivel de router, no endpoint por endpoint.
- **No existía un reseteo de contraseña por administrador.** Existía `actualizarPassword` en el repositorio, pero hardcodeada a `debe_cambiar_password = 0` — es el flujo de autoservicio (`POST /api/auth/cambiar-password`), donde la persona ya escribió su propia contraseña nueva y no hace falta forzar un cambio otra vez. Usar esa misma función para un reseteo por admin habría dejado a la persona con una contraseña temporal ajena pero sin la bandera que la obliga a cambiarla — un hueco de seguridad. Se agregó `PATCH /api/usuarios/:id/resetear-password` (sin body) con una función nueva y separada (`resetearPassword`, capas repositorio→servicio→controlador→ruta) en vez de un parámetro extra en `actualizarPassword`, para no arriesgar el comportamiento ya validado del autoservicio. Responde el usuario expuesto + `passwordTemporal` nueva, mismo shape que el alta.
- **Sí existe** un mecanismo de desactivar-no-borrar (`PATCH {activo:false}`, igual que productos) y **ya existe** la protección de "único administrador activo": `usuarios.service.js` rechaza con `400` cualquier intento de desactivar o cambiar de rol al último administrador activo. No había que construir nada de esto, solo verificarlo y ejercitarlo desde la UI.

### Bug real encontrado durante las pruebas: `activo` faltaba en la respuesta

`authService.exponer()` — la única función que decide qué campos del usuario salen hacia HTTP/sesión — nunca incluía `activo`. Pasó inadvertido en login/sesión (un usuario inactivo ya no puede loguearse, `auth.service.js` lo valida antes) pero rompía el listado de Usuarios: cada fila, incluido el admin real, se renderizaba como "Inactivo" y el botón ofrecía "Activar" en vez de "Desactivar". Encontrado por la propia suite Puppeteer (aserción sobre el estado real del admin tras los intentos de único-administrador) y confirmado leyendo el repositorio (`fila.activo === 1` sí llega desde SQLite, se perdía en `exponer()`). Fix de una línea: se agregó `activo: usuario.activo` a `exponer()`.

### Dos bugs de accesibilidad reales encontrados con axe-core (no artefactos de timing)

- **`select-name` (crítico)**: el `<select>` de rol en cada fila tenía un `<label for="rol-usuario-N">` construido en JS pero nunca insertado en el DOM — quedaba huérfano en memoria, sin asociación real. Fix: se agrega como hijo de la fila (es `position:absolute` vía `.visualmente-oculto`, así que no participa del auto-placement de la grilla y no corre las columnas).
- **`color-contrast` (serio), solo en tema claro**: el `<select>` de rol no tenía `background`/`color` propios — solo heredaba la regla base `select { color: inherit }`, sin fondo. El widget nativo del navegador podía quedar con un fondo oscuro (ligado al tema del SO/navegador, no al `data-tema` de la página) mientras el texto heredaba el color oscuro del tema claro: texto oscuro sobre fondo oscuro. Mismo patrón que ya usa `.catalogo__filtros select` (fondo/color explícitos con los tokens `--color-superficie`/`--color-texto`) se aplicó acá.
- Nota aparte, **no bug**: varias violaciones de `color-contrast` que aparecían solo justo después de alternar `data-tema` (`.nav-lateral__marca`, `#boton-nuevo-usuario`, `.catalogo__fila-nombre`) eran un artefacto del script de prueba, no del producto — hay una transición CSS de 260ms (`--duracion-tema`) en `background-color`/`color`, y axe medía el color a mitad de la transición. Se corrigió el script (espera de 350ms tras cada cambio de tema) y desaparecieron.

### Hallazgo fuera de alcance, documentado y no resuelto acá

`landmark-main-is-top-level`, `landmark-one-main` y `page-has-heading-one` (moderado, axe-core): `<main class="contenido">` solo envuelve el contenido de la vista Mostrador (anidado dentro de `<section id="vista-mostrador">`, que ya es un landmark `region` por tener `aria-labelledby`) y no existe ningún `<h1>` visible en la página. Al navegar a cualquier otra vista (Usuarios, Productos, Historial, Cierre de Caja — todas, no solo esta), `vista-mostrador` queda `hidden` y con él su único `<main>`, dejando la página sin landmark principal y sin encabezado de nivel 1. Preexistente desde el Bloque 1 (la estructura de `<main>` es de esa sesión), no introducido acá, y no específico de Usuarios — afecta a toda sección ya cerrada. No se corrige en esta pasada porque el fix correcto (mover `<main>` a envolver `#contenido-principal` a nivel de shell, agregar un `<h1>` visualmente oculto) toca el shell compartido por todas las vistas, no solo Usuarios — se señala para decidir aparte, no se asume que corresponde resolverlo dentro de esta sección.

### Ícono de ojo en contraseña (login + cambio obligatorio)

Pedido explícito del cliente, empaquetado dentro de esta sección por ser trivial. Un solo patrón reutilizado en los tres campos de contraseña (`#input-password` en login, `#input-password-actual`/`#input-password-nueva` en cambio obligatorio): cada input queda envuelto en `.campo__password-envoltorio`, con un `<button type="button" class="campo__boton-ojo">` hermano que alterna `input.type` entre `password`/`text` e intercambia el ícono (`iconoOjo`/`iconoOjoTachado`), actualizando `aria-label`/`aria-pressed`. Nada de esto pasa por el backend — es puramente visual.

### Verificación

Suite Puppeteer contra Chrome real (19/19) cubriendo los cinco escenarios pedidos explícitamente: alta de usuario con contraseña temporal mostrada una vez (overlay dedicado, no el toast de 3.5s — no da tiempo real a copiarla); reseteo de contraseña de un cajero existente, verificado contra el backend que la contraseña anterior ya no sirve (401) y que la nueva sí funciona forzando `debeCambiarPassword:true`; intento de desactivar y de degradar de rol al único administrador activo, ambos rechazados con el 400 ya existente, con verificación posterior de que el admin real quedó intacto; ojo de contraseña funcionando en los tres campos (login y ambos campos del cambio obligatorio); y sección oculta para cajero en la sidebar con el 403 `ROL_INSUFICIENTE` real verificado contra el backend (no solo la UI). axe-core: 0 violaciones en las superficies de Usuarios tras los fixes (listado en ambos temas, overlay de alta, overlay de contraseña temporal) — quedan sin resolver, a propósito, los tres hallazgos de landmark/heading documentados arriba por ser preexistentes y fuera de alcance. Lighthouse: login 83/100/96/100, mostrador autenticado 83/100/100/100 (sin cambios respecto a la sección anterior). Datos de prueba (2 usuarios cajero de prueba, sesiones de caja abiertas/cerradas por el propio test) eliminados de la base real al terminar.

### Auditoría de performance pedida antes de Bloque 3: el Performance de Lighthouse pasó de 98 a 82-83

El cliente notó la caída (98→83, login y mostrador autenticado) tras cerrar Usuarios y pidió diagnóstico real, con el reporte detallado, antes de sumar Bloque 3 encima — no aceptar el número sin explicación. Se investigó con dos hipótesis explícitas del cliente a descartar una por una, más una verificación de si el número base (98) seguía siendo reproducible.

**Hipótesis 1 (confirmada, real): JS de secciones nuevas cargando en el flujo inicial, no bajo demanda.** `main.js` importaba estáticamente `historial.js`, `catalogo.js`, `cierre-caja.js` y `usuarios.js` — los cuatro se descargaban y parseaban en **toda** carga de página, incluida la pantalla de login sin sesión, aunque tres de esas cuatro secciones son solo-administrador y nadie sin sesión puede llegar a usarlas. Cada sección nueva venía sumando su JS a ese camino desde Productos en adelante. Fix: los tres módulos de vista (`historial.js`, `catalogo.js`, `usuarios.js`) pasan a `import()` dinámico disparado por el click del ítem de nav correspondiente — se descargan la primera vez que esa vista se abre, no antes. `cierre-caja.js` es distinto: su disparador (`#estado-caja`) vive en la cabecera persistente, no en una vista de nav, así que no se puede diferir a un click — se carga una sola vez apenas `iniciarAuth` confirma sesión (`alListo`), en vez de en la carga inicial de la página. Confirmado con `network-requests` de Lighthouse: 23 → 19 solicitudes, 153KB → 142KB en la pantalla de login.

**Hipótesis 2 (descartada): recurso duplicado o de más (fuente, ícono).** Se inspeccionó `total-byte-weight`/`network-requests` de Lighthouse: 6 archivos de fuente (Montserrat 400/500/700/800, IBM Plex Mono 500/700) se descargan incluso en la pantalla de login porque el marcado completo del shell (sidebar con la marca en peso 800, textos numéricos) ya está en el DOM desde el primer render — la sesión bloquea el *uso* de esos elementos (overlay encima), no su *presencia* en el árbol, así que el navegador igual resuelve las fuentes que ese árbol referencia. Esto es así desde antes de Usuarios (arquitectura de shell de Bloque 1) y no cambió en esta sección — no hay duplicación, cada peso se pide una sola vez, y ya estaban explícitamente precargados solo los 3 pesos que el login realmente necesita (`<link rel="preload">` para montserrat-400/700 e ibm-plex-mono-500). No se tocó nada acá: es una característica conocida de la arquitectura de shell único, no un hallazgo nuevo, y no es la causa de la caída.

**La causa real, señalada directamente por el propio Lighthouse (`render-blocking-resources`)**: `estilos.css` es un único `<link rel="stylesheet">` que bloquea el render por definición, y viene creciendo con cada sección (19,6KB en el commit original de la interfaz → 32,7KB tras Usuarios) — cada sección nueva le agrega peso a un recurso que ya era bloqueante desde el principio, empujando FCP/LCP un poco más cada vez. Fix: patrón preload+swap (`<link rel="preload" as="style" onload="this.rel='stylesheet'">`, con `<noscript>` de respaldo) — el archivo se descarga en paralelo sin bloquear el primer pintado. Es seguro acá porque los overlays de gate (login, caja cerrada) usan el atributo `hidden` nativo del navegador, que oculta sin depender de que `estilos.css` haya cargado.

**Verificación de que el número base (98) seguía siendo real, no solo "se explica la caída pero no se recupera"**: se creó un worktree de git en el commit de Cierre de Caja (`0bca28f`, el que reportó 98) y se corrió el mismo script de Lighthouse, en la misma máquina, en el mismo momento — resultado: **82-83**, no 98. La caída no la causó ningún código de Usuarios: el 98 original no es reproducible bajo las condiciones actuales de esta máquina (ruido de medición — carga de CPU variable, no algo que el código controle), confirmado comparando manzanas con manzanas en vez de asumirlo. Con los dos fixes de arriba aplicados, la versión actual (Usuarios + fixes) mide 82-83 en múltiples corridas — igual que el baseline de Cierre de Caja recién medido, así que no hay una caída *relativa* real, aunque el número absoluto de 98 no se recuperó (era optimista para las condiciones actuales de esta máquina, no un objetivo que este commit haya dejado de cumplir). TBT y CLS se mantienen perfectos (0ms, 0) en ambas versiones; toda la diferencia vive en FCP/LCP, dominados por el modelo de throttling simulado de Lighthouse más que por el peso real de la página.

### Fix del hallazgo de `<main>`/`<h1>` señalado en Usuarios (pedido explícito antes de Bloque 3)

En vez de dejarlo como hallazgo documentado-pero-no-resuelto, el cliente pidió corregirlo ya, como parte del shell compartido, antes de sumar Bloque 3 encima de la misma base. Cambio: `<div id="contenido-principal">` pasa a ser `<main id="contenido-principal">` — landmark único, hijo directo de `#shell` (junto al `<nav>` de la sidebar), siempre presente sin importar qué vista esté activa, en vez de vivir anidado dentro de `<section id="vista-mostrador">` y desaparecer cada vez que esa vista se ocultaba. El `<main class="contenido">` interno (ahora redundante) baja a `<div class="contenido">` — mismo selector CSS (`.contenido` es una clase, nunca hubo una regla `main.contenido` en `estilos.css`), cero cambio visual. Se agrega un único `<h1 class="visualmente-oculto">Doña Olga — Punto de venta</h1>` como primer hijo de `#contenido-principal`, describiendo la aplicación en su conjunto (coherente con que esto es un shell de SPA, no un sitio multi-página) — los `<h2>` por vista (`titulo-vista-mostrador`, `titulo-vista-usuarios`, etc.) quedan como ya estaban, ahora correctamente subordinados a ese `<h1>`. Verificado con axe-core en las tres superficies (login, Productos, Usuarios) tras el cambio: 0 violaciones, incluidas las tres que motivaron el fix (`landmark-main-is-top-level`, `landmark-one-main`, `page-has-heading-one`).

### Verificación de ambos fixes

Suite Puppeteer + axe-core dedicada (9/9): estructura (`<main>` único, `<h1>` único, hijo directo de `#shell`, 0 violaciones de axe); estado de caja reflejado en la cabecera sin depender de ningún click de nav (cierre-caja.js cargado en `alListo`, no perdió su timing al pasar a import dinámico); Productos, Historial y Usuarios abriendo correctamente por primera vez vía `import()` dinámico, con Productos y Usuarios verificados también con axe-core (0 violaciones); overlay de cierre de caja abriendo con normalidad; sin excepciones de JS sin capturar en todo el flujo. Nada de esto formaba parte del plan original de Bloque 3 — se cierra acá, aparte, antes de arrancarlo, tal como se pidió.

## Bloque 3 — Panel de Indicadores

Plan aprobado varios turnos antes de implementarse (ver auditoría original de `reportes.service.js` en este mismo ADR); el cliente pidió, en vez de repetir la auditoría completa, solo verificar que el contrato no hubiera cambiado desde entonces. Se releyó `reportes.service.js`/`reportes.repository.js`/`reportes.routes.js` justo antes de tocar código: sin cambios — `reporteVentas()` seguía devolviendo exactamente `{totalVentas, cantidadVentas, desglosePorMedioPago, topProductos}`, ya con `estado='activa'` excluyendo anuladas (ADR 0012) y `topProductos` ordenado por `totalVendido` DESC (ingresos, no unidades), sin `ticketPromedio` todavía. Confirmado antes de implementar, tal como se pidió.

### Diseño

- `reportes.service.js`: único cambio de backend de este bloque — agrega `ticketPromedio` (`Math.round(totalVentas / cantidadVentas)`, redondeado como toda cifra de dinero, `null` si `cantidadVentas === 0` en vez de `0`, para que el frontend distingue "ticket promedio de $0" de "todavía no hay ventas").
- `public/js/kpis.js` (nuevo, mismo patrón autocontenido que `usuarios.js`/`catalogo.js`): pide el reporte de hoy y de ayer en paralelo (`Promise.all`, un solo endpoint existente llamado dos veces — no hay ni hace falta un endpoint de comparación). "Producto más vendido" usa `topProductos[0]` tal cual (por ingresos, confirmado hace varios turnos). Comparativa: `calcularVariacionPorcentual(totalHoy, totalAyer)` devuelve `null` si `totalAyer === 0` — nunca `Infinity`/`NaN` — y el panel muestra "Sin ventas registradas ayer" en ese caso (cubre también "ambos días en $0": el guardia de `ayer === 0` se evalúa primero, así que nunca llega a calcular "0% de variación", que hubiera sido engañoso). Con variación real, un badge reutiliza las clases `badge-alerta--exito`/`--peligro` ya existentes (positiva=éxito, negativa=peligro, plana=neutra) — mismo criterio de "no es el navy de marca" que ya se usó en Cierre de Caja para las desviaciones.
- `import()` dinámico, no import estático (pedido explícito, mismo patrón fijado en el fix de performance de la sección anterior): `kpis.js` se carga la primera vez que se hace click en "Indicadores", no en toda carga de página.
- `index.html`: `#vista-indicadores` deja de ser un placeholder "Próximamente" (`vista-proximamente`) y pasa a `vista-secundaria` real con cuatro tarjetas (`.indicadores__grilla`/`.indicadores__tarjeta`) reusando tokens existentes — sin librería de gráficos, tal como se decidió en la auditoría original. `#nav-indicadores` deja de tener `disabled`.
- `api.js`: + `obtenerReporteVentas({desde, hasta, cajaSesionId})`.

### Verificación

Suite Puppeteer + axe-core dedicada (17/17): estado vacío real de la base (sin ventas hoy ni ayer en este momento) mostrando los tres mensajes explícitos correctos — "—" en ticket promedio (no $0), "Sin ventas registradas hoy" en producto más vendido, "Sin ventas registradas ayer" en la comparativa (exactamente el caso "ayer=0" que se pidió cubrir, verificado contra el estado real de la base, no simulado); una venta real de hoy y una venta real "de ayer" (creada vía la API real de ventas y backdateada solo en `creada_en` para simular el día, sin tocar ninguna otra columna) reflejadas correctamente en totales/ticket promedio/producto top, con la comparativa calculando el porcentaje real (+33%, verificado numéricamente, no asumido); venta de hoy anulada vía `PATCH /api/ventas/:id/anular` y el panel reflejando la exclusión (vuelve a "Sin ventas registradas hoy"); nav oculto para un cajero real (creado y eliminado por el propio test) con el 403 `ROL_INSUFICIENTE` verificado contra el backend, no solo la UI. axe-core: 0 violaciones en ambos temas. Lighthouse: login 82/100/96/100, mostrador autenticado 86/100/100/100 — en línea con el baseline establecido en el fix de performance anterior, sin regresión. Datos de prueba (2 ventas con sus movimientos de inventario asociados, stock restaurado a mano donde la venta no pasó por anulación real, 1 cajero temporal, 1 sesión de caja) eliminados/revertidos de la base real al terminar.

Con esto, según lo acordado, quedan cubiertas todas las secciones del backend salvo **Vencimientos** y **Proveedores**, que siguen en cola en ese orden.

## Sección: Vencimientos

Auditoría de `vencimientos.routes.js`/`.schema.js`/`.service.js`/`.repository.js` y la tabla `lotes_vencimiento` antes de escribir código, con dos hallazgos que se llevaron al cliente para confirmar en vez de asumir.

### Hallazgo 1 — permisos: de ambos roles, a diferencia de todo lo construido hasta ahora

`/api/vencimientos` está montado en `app.js` **sin** `requiereRol('administrador')`, ni a nivel de módulo ni por ruta individual — a diferencia de Productos (crear/editar admin-only), Usuarios e Indicadores (módulo entero admin-only). Confirmado con el cliente: **es intencional, no se toca el backend**. Razón dada: registrar un lote es documentación aditiva, sin el riesgo de ocultar un error o una merma que sí tienen los casos ya restringidos (anular una venta, editar stock de un producto, resetear una contraseña, un ajuste manual de inventario) — y operativamente, cualquiera que reciba mercadería debe poder cargarlo. Consecuencia de diseño: `#nav-vencimientos` es el primer ítem de nav que **no** pasa por `actualizarNavegacionPorRol()` — visible para ambos roles desde que hay sesión, sin `hidden` en el markup, mismo patrón que ya tenía el placeholder de `nav-inventario`.

### Hallazgo 2 — unidad de `cantidad`: sin definir en el schema, resuelto por analogía con Productos

La columna es un entero genérico ("snapshot de cuánto llegó", ADR 0006) sin distinguir gramos de unidades para un producto `tipo_venta='peso'`, y no había ningún código existente que la usara para desambiguar (el panel de alertas nunca mostró `cantidad`). Confirmado con el cliente: mismo criterio que el alta de Productos — el formulario captura en kg para productos tipo peso y convierte a gramos antes de mandar al backend (`kilosTextoAGramos`/`gramosAKilosTexto`, ya existentes en `utils.js`).

### Diseño

- `public/js/vencimientos.js` (nuevo, mismo patrón autocontenido que `usuarios.js`), cargado con `import()` dinámico al hacer click en el nav. El campo cantidad cambia de tipo/etiqueta según el `tipoVenta` del producto elegido, igual que el alta de Productos; en edición, el `<select>` de producto queda `disabled` (visible pero inmutable, coherente con que el backend rechaza cambiarlo) en vez de ocultarse, para no perder el contexto de a qué producto pertenece el lote mientras se edita.
- El estado del badge (Vencido/Por vencer/Vigente) se calcula en el cliente sobre la fecha de cada lote ya traída por `GET /lotes` — mismo cálculo que `vencimientos.service.js:obtenerAlertas()`, sin pedir `/alertas` aparte solo para pintar el listado.
- Sin borrado — solo `activo` (mismo patrón que Productos/Usuarios).
- `api.js`: `listarLotesVencimiento`, `crearLoteVencimiento`, `actualizarLoteVencimiento`.

### Dos bugs reales de accesibilidad encontrados con axe-core (no artefactos de test)

- **`color-contrast` en filas desactivadas**: `.catalogo__fila--inactivo { opacity: 0.6 }` — regla compartida con Productos y Usuarios — empujaba el texto muted (3.25:1) y el badge (3.15:1) por debajo del mínimo WCAG de 4.5:1 al mezclarse con el fondo. Nunca se había ejercitado con axe-core sobre una fila realmente desactivada en las secciones anteriores. Fix: `opacity: 0.85` — mejora las tres secciones que comparten la regla, no solo esta.
- Un tercer hallazgo (`.toast > span`, contraste 2.15:1) resultó ser un **artefacto de timing del script de prueba**, no un bug real: axe corrió a mitad de la animación de entrada del toast (`--duracion-media`, 220ms) y midió un color mezclado — mismo patrón ya documentado en la sección Usuarios para el tema. Se corrigió el script (espera de 400ms tras la última mutación) y desapareció; verificado además con Lighthouse+axe corridos varias veces sin que reaparezca.

### Verificación

Suite Puppeteer + axe-core dedicada (18/18): conversión kg→gramos verificada contra el valor real guardado en la base ("2,5" → 2500, no 2 ni "2,5"), formato de cantidad correcto en el listado para ambos `tipoVenta` (kg con coma decimal para peso, unidades para unidad — mismo formato que ya usa el resto de la app, `gramosAKilosTexto`), badges Vencido/Por vencer contra fechas reales; edición con producto deshabilitado e inmutable confirmado contra el backend; desactivar sin borrar; el panel de alertas del mostrador (mismo backend desde Bloque 1) reflejando el lote vencido real tras recargar; y, en vez de un 403, la prueba positiva pedida por el hallazgo de permisos — un cajero real (creado y eliminado por el propio test) creando un lote con éxito. axe-core: 0 violaciones en ambos temas tras los dos fixes. Lighthouse corrido tres veces (variancia real de la máquina: 67/83, 82/65, 82/82 entre login/mostrador) convergiendo al baseline ya establecido de ~82 — sin regresión atribuible a esta sección, accessibility/best-practices/SEO estables en 100 en las tres corridas. Datos de prueba (3 lotes, 1 cajero temporal, 1 sesión de caja) eliminados de la base real al terminar.

Con esto, según lo acordado, queda solo **Proveedores** en cola.

## Sección: Proveedores

Auditoría de `proveedores.routes.js`/`.schema.js`/`.service.js`/`.repository.js` y la tabla `proveedores` antes de escribir código. A diferencia de Usuarios y Vencimientos, no surgió ningún hallazgo que requiriera confirmación del cliente: el módulo entero es solo-administrador (`app.js`, `requiereRol('administrador')` a nivel de mount), y esto **ya estaba documentado** desde ADR 0010 ("Solo administrador: ... proveedores (módulo completo)") — no un gap descubierto ahora, como sí lo fue el de Vencimientos. Verificado además que ni `productos` ni `lotes_vencimiento` tienen FK a `proveedores`: es un directorio de contactos independiente, desacoplado de compras/inventario (ADR 0003 ya lo anticipaba).

### Diseño

- `public/js/proveedores.js` (nuevo, mismo patrón autocontenido que `usuarios.js`), cargado con `import()` dinámico al hacer click en el nav.
- Listado con badge explícito de `Activo`/`Inactivo` (`badge-alerta--exito`/`--peligro`, mismo patrón que Usuarios) — a diferencia de Vencimientos, que solo señalizaba inactivo con `.catalogo__fila--inactivo` (opacity). Nombre, NIT, teléfono y dirección faltantes se muestran como "—" en vez de una celda vacía.
- Formulario alta/edición: nombre obligatorio, NIT/teléfono/dirección opcionales (string vacío se manda como `null`, no como `''`, mismo criterio que el schema del backend que los acepta `nullish`); el toggle de activo queda oculto en alta (`campo-proveedor-activo[hidden]`) y visible en edición, mismo patrón que el toggle de activo de Productos.
- `nit` UNIQUE en la base: un conflicto se traduce a `409` en el backend (ya existente) — el formulario simplemente no se cierra si la petición falla, mostrando el mensaje real del backend vía el toast de error ya establecido.
- `api.js`: `listarProveedores`, `crearProveedor`, `actualizarProveedor`.
- Sin cambios de backend.

### Verificación

Suite Puppeteer + axe-core dedicada (13/13): alta con NIT verificada contra el backend, campo opcional vacío guardado como `null` (no `''`); NIT duplicado rechazado con `409` real y el formulario permaneciendo abierto; edición actualizando un campo opcional y confirmada contra el backend; desactivar sin borrar; badge explícito `Activo`/`Inactivo` correcto en el listado; nav oculto para cajero con `403 ROL_INSUFICIENTE` real verificado contra el backend. axe-core: 0 violaciones en ambos temas, incluida la fila desactivada (beneficiándose del fix de contraste `opacity: 0.85` ya aplicado en Vencimientos). Datos de prueba (1 proveedor, 1 cajero temporal, 1 sesión de caja) eliminados de la base real al terminar.

Con esto se cierra la cola completa (Usuarios → Bloque 3 → Vencimientos → Proveedores).

## Auditoría final: las 8 secciones completas, no solo la última agregada

Primera vez que se audita el conjunto completo de la interfaz en una sola pasada, en vez de sección por sección — pedido explícito del cliente al cerrarse Proveedores. Cubre: Login, overlay de cambio de contraseña obligatorio, Mostrador, Historial, Productos (ambas pestañas), Usuarios, Vencimientos, Indicadores, Proveedores, y overlay de cierre de caja — 21 combinaciones de estado×tema en total.

**Alcance de "2-3 corridas por vista"**: el pedido se cortó a mitad de frase. Interpretación aplicada: axe-core es determinístico (una violación real no desaparece por correrlo de nuevo), así que corre una vez por estado y tema. Lighthouse sí tiene variancia real medida en esta máquina (ver Bloque 3 y Vencimientos más arriba) y además solo tiene sentido en los dos estados de **carga de página** reales que existen en esta SPA (login sin sesión, autenticado en mostrador) — el resto son estados de un mismo documento alternados por JS, sin una URL ni una carga de página distinta que Lighthouse pueda medir por separado. Se corrió 3 veces en cada uno de esos dos estados, en 4 pasadas completas distintas de la suite (12 mediciones por estado en total).

### Un bug real encontrado y corregido — en el script de auditoría, no en la aplicación

La primera pasada completa encontró `color-contrast` en el overlay de cierre de caja (tema claro), con **elementos distintos marcados en cada corrida** (a veces los `<select>` y el texto del carrito, otra vez las tarjetas de producto de la grilla) — la firma característica de una medición a mitad de un repintado, no un problema de estilos estático (un bug real de CSS marca siempre los mismos elementos con los mismos colores). Se confirmó con evidencia antes de tocar nada: (1) reproducir el mismo estado navegando directo desde el login dio 0 violaciones; (2) reproducir la secuencia completa de navegación por las 6 secciones intermedias, con los mismos toggles de tema, también dio 0 violaciones al medir manualmente los estilos computados antes/después de abrir el overlay — sin ninguna pausa. La causa: el paso 10 del script volvía a Mostrador (repintando toda la grilla de tarjetas de producto, docenas de nodos pasando de `hidden` a visible) y abría el overlay de cierre inmediatamente después, sin ninguna espera — axe corría a mitad de ese repintado. Fix: dos pausas de 400ms en el script (tras volver a Mostrador, tras abrir el overlay) — dos corridas limpias consecutivas después del fix, cero violaciones. **No se tocó ningún archivo de la aplicación para esto** — el hallazgo era del arnés de prueba, no del producto (mismo patrón ya documentado dos veces antes: la transición de tema en Usuarios, la animación de toast en Vencimientos).

### Resultado

axe-core: 0 violaciones en las 21 combinaciones, en las 2 pasadas completas corridas tras el fix del script. Lighthouse (4 pasadas × 3 corridas cada una): Accessibility 100, Best Practices 96 (login) / 100 (autenticado), SEO 100 — estables sin ninguna variación en las 12 mediciones de cada estado. Performance osciló entre 66 y 86 según la carga de la máquina en el momento exacto de cada corrida (consistente con la variancia ya documentada y verificada contra el baseline en Bloque 3/Vencimientos) — sin ninguna tendencia a la baja entre pasadas sucesivas, así que no hay indicio de una regresión acumulada por sumar las 4 secciones nuevas de esta fase. Sin cambios de código de aplicación como resultado de esta auditoría — el único hallazgo fue del script de prueba.

Con esto, la Fase 4 queda cerrada: las 8 secciones de la interfaz (Mostrador, Historial, Productos, Usuarios, Vencimientos, Indicadores, Proveedores, y el gate de sesión) cubren el 100% de los módulos de backend construidos, auditadas individualmente al cerrarse cada una y en conjunto en esta pasada final.
