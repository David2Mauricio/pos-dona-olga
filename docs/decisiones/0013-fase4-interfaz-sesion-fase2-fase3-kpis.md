# ADR 0013: Fase 4 — sesión, Fase 2/3 en el flujo de venta y panel de KPIs

## Estado

En progreso — este ADR se amplía a medida que se cierra cada bloque de la Fase 4. Bloque 1 (sesión) cerrado; Bloques 2 y 3 pendientes.

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

## Bloques 2 y 3

Pendientes — se documentan acá al cerrarse.
