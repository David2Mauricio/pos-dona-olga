# ADR 0013: Fase 4 — sesión, Fase 2/3 en el flujo de venta y panel de KPIs

## Estado

En progreso — este ADR se amplía a medida que se cierra cada bloque de la Fase 4. Bloque 1 (sesión) y Bloque 2 (Fase 2/3 en el flujo de venta, más el reemplazo de paleta) cerrados; Bloque 3 pendiente.

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

## Bloque 3

Pendiente — se documenta acá al cerrarse.
