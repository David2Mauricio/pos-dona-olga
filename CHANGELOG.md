# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Cambiado (Fase 4 / Bloque 2: navegación persistente y fixes)

- Interfaz reestructurada de "un botón suelto por sección en el header"
  a una sidebar izquierda persistente con 4 secciones (Mostrador,
  Historial, Indicadores, Inventario), controles de cuenta (usuario,
  tema, salir) agrupados al final de la misma sidebar. Indicadores e
  Inventario quedan visibles como "Próximamente" (deshabilitados,
  visualmente coherentes) hasta que se construyan. `main.js` gana un
  único mecanismo (`mostrarVista`) para alternar secciones.
- Fix: dos productos mostraban un bloque rojo sólido en vez del
  placeholder — no era un fallo de `onerror`, eran fotos de prueba viejas
  (PNG de 1×1 píxel) nunca limpiadas de la base real. Se limpió el dato y,
  aparte, se agregó el `onerror` que nunca existió (fallback real a SVG si
  un archivo referenciado no existe de verdad).
- `POST /api/inventario/movimientos` pasa a ser solo-administrador (mismo
  criterio de riesgo que anular una venta, ADR 0012): un ajuste manual de
  stock sin venta real detrás es una vía para tapar una merma. `GET` sigue
  siendo de ambos roles.
- Bug real de accesibilidad encontrado al correr Lighthouse/axe-core de
  nuevo sobre la superficie con sidebar: `#lista-carrito` (con
  `overflow-y: auto`) no era alcanzable por teclado
  (`scrollable-region-focusable`) — corregido con `tabindex="0"` ahí y,
  proactivamente, en `#grilla-productos`. axe-core: 0 violaciones en 5
  combinaciones tras el fix; Lighthouse sin cambios respecto a antes de la
  reestructuración.
- ADR 0013 ampliado.

### Cambiado (Fase 4 / Bloque 2: paleta navy/blanco/gris)

- Paleta cálida del ADR 0009 (crema/vino, Fraunces + Public Sans)
  reemplazada por navy/blanco/gris con Montserrat (400/500/700/800) +
  IBM Plex Mono (400/500/600/700, específicamente para precios/pesos/
  totales/vueltos). Contraste WCAG real verificado (16 combinaciones,
  0 fallos) y confirmado con capturas de pantalla reales en ambos temas.
- Dos bugs preexistentes encontrados y corregidos durante la verificación
  visual (ninguno causado por la paleta): el badge de "Stock bajo" leía
  un campo (`stockGramos`/`stockUnidades`) que no existe en la respuesta
  de `GET /api/inventario/alertas` (el campo real es `stockActual`); y un
  formulario oculto con `hidden` seguía visible por una regla de autor
  (`display: flex`) que gana contra el `[hidden]` del navegador sin
  importar especificidad — corregido con overrides `[hidden]` explícitos
  en cada punto donde un elemento se alterna así.
- Lighthouse: login sin sesión 99/100/96/100 (96 = 401 esperado en carga
  anónima, no un bug); mostrador autenticado 98/100/100/100. axe-core:
  0 violaciones en las 4 combinaciones (login/mostrador × claro/oscuro).

### Agregado (Fase 4 / Bloque 2: trazabilidad de precios y anulación en el flujo de venta)

- Override de precio por ítem en el carrito (`public/js/cart.js`,
  `render.js`): mini-formulario inline (precio + motivo obligatorio) que
  replica la regla del backend (el override, si existe, siempre gana
  sobre el precio de catálogo, independiente de Público/Mayorista).
- Vuelto: campo "Monto recibido" (solo visible si el medio de pago es
  efectivo) con validación en cliente además de la del backend, y vuelto
  calculado en vivo antes de confirmar el cobro.
- `public/js/historial.js` (nuevo): vista de historial de ventas del día,
  separada del mostrador, con anulación (motivo obligatorio) visible solo
  para administrador — la protección real sigue siendo el 403
  `ROL_INSUFICIENTE` del backend, verificado explícitamente contra el
  endpoint sin pasar por la UI.
- ADR 0013 ampliado con ambos bloques.

### Agregado (Fase 4 / Bloque 1: sesión en la interfaz de mostrador)

- `public/js/auth.js` (nuevo): pantalla de login reutilizando el patrón
  overlay ya existente (`#overlay-login`, mismo mecanismo que
  `overlay-caja-cerrada`), con sub-estado de cambio de contraseña
  obligatorio y logout.
- `public/js/api.js`: `ErrorApi` gana un campo `codigo` (el que ya
  devolvía el backend desde Fase 1); hook central `onSesionExpirada` en
  `peticion()` — cualquier 401 `SIN_SESION` de cualquier módulo dispara el
  mismo flujo (incluida una sesión que vence a mitad de una venta), sin
  que cada call site tenga que chequearlo.
- `main.js`: la carga inicial ya no pide productos/caja/alertas a ciegas
  antes de saber si hay sesión — corrige el bug donde cualquier 401 de
  sesión se mostraba como "No se pudo conectar con el servidor".
- Fix no pedido explícitamente, hallado en la auditoría: el indicador de
  alertas usaba `GET /api/reportes/inventario` (solo-administrador desde
  Fase 1), lo que le daba 403 a un cajero. Ahora usa
  `GET /api/inventario/alertas` + `GET /api/vencimientos/alertas` (ambos
  de ambos roles), tal como ya había anticipado el ADR 0010.
- ADR 0013 (en progreso, se amplía en los próximos bloques de Fase 4).

### Agregado (Fase 3: vuelto y anulación)

- Migración `010_vuelto_y_anulacion_ventas.sql`: columnas `monto_recibido`,
  `estado` (`'activa'`/`'anulada'`, default `'activa'`), `motivo_anulacion`
  y `anulada_en` en `ventas`.
- `POST /api/ventas`: admite `montoRecibido` cuando el medio de pago es
  efectivo (comparación tolerante a mayúsculas/espacios); obligatorio y
  debe cubrir el total en ese caso, y rechazado si el medio de pago no es
  efectivo. `GET /api/ventas`/`GET /api/ventas/:id` exponen `montoRecibido`
  y `vuelto` (este último calculado al leer, nunca guardado — ver ADR 0012).
- `PATCH /api/ventas/:id/anular` (solo administrador): marca la venta como
  anulada con motivo obligatorio, y repone el inventario exactamente según
  los movimientos reales que esa venta había generado (no según el flag
  `DESCONTAR_STOCK_AUTOMATICO` actual, que pudo cambiar desde entonces). Una
  venta ya anulada no se puede volver a anular.
- Las ventas anuladas siguen visibles en `GET /api/ventas`/`GET /api/ventas/:id`
  (no se borran), pero quedan excluidas de los totales agregados:
  `GET /api/reportes/ventas`, `GET /api/reportes/inventario` (indirectamente,
  vía top de productos) y `GET /api/caja/:id` / cálculo de monto teórico en
  efectivo al cerrar caja.
- ADR 0012: por qué el vuelto se deriva y no se guarda; por qué la
  compensación de inventario lee los movimientos reales en vez de asumir el
  flag actual; por qué el movimiento de reposición no puede llevar
  `referencia_venta_id` (CHECK de la migración 004) y por qué el id de la
  venta queda en el texto del motivo en su lugar; por qué anular es
  solo-administrador a diferencia del override de precios de la Fase 2.

### Agregado (Fase 2: trazabilidad de precios)

- Migración `009_trazabilidad_precios_venta.sql`: columnas `precio_modificado`
  (bandera) y `motivo_ajuste` (texto) en `ventas_items`.
- ADR 0011: por qué es una bandera + motivo y no una segunda columna de
  precio (`precio_unitario_aplicado` ya es el snapshot del precio
  realmente cobrado, con o sin ajuste); por qué la consistencia
  motivo↔bandera se valida en la aplicación y no con un `CHECK` cruzado en
  SQLite (mismo límite de `ALTER TABLE ADD COLUMN` ya documentado en la
  migración 005); por qué el ajuste no queda restringido a administrador
  ni a ningún rango de precio.
- `POST /api/ventas`: cada item admite opcionalmente `precioUnitarioOverride`
  (reemplaza el precio de catálogo para esa línea) y `motivoAjuste`
  (obligatorio si y solo si viene el override — `ventas.schema.js` lo
  valida con un `.refine()`). `GET /api/ventas/:id` expone `precioModificado`
  y `motivoAjuste` en cada item.
- El recibo térmico no necesitó cambios: ya imprimía `precioUnitarioAplicado`,
  que refleja el precio ajustado automáticamente.

### Agregado (Fase 1: autenticación)

- Migración `008_usuarios.sql`: tabla `usuarios` (nombre, usuario único,
  hash de contraseña, rol fijo `administrador`/`cajero`,
  `debe_cambiar_password`, activo).
- ADR 0010: sesiones de servidor (`express-session`, en memoria del
  proceso) en vez de JWT — un solo proceso, sin servidores distribuidos
  que sincronizar; `bcryptjs` en vez de `bcrypt` (JS puro, mismo criterio
  que `better-sqlite3`); dos roles fijos en vez de permisos granulares
  (sobre-ingeniería para el tamaño real del negocio).
- `src/auth/`: `POST /api/auth/login` (rate limiting de 5 intentos
  fallidos por usuario en 15 minutos, con un `Map` en memoria, sin
  librería externa), `POST /api/auth/logout`, `GET /api/auth/sesion`,
  `POST /api/auth/cambiar-password`. Middleware `requiereSesion` (aplica
  a todo `/api/*` excepto `/api/health` y `/api/auth/*`) y `requiereRol`.
  Mientras `debeCambiarPassword` esté activo, el usuario queda bloqueado
  del resto del sistema hasta cambiarla.
- `src/auth/seed-admin.js` (`npm run seed:admin`): crea el administrador
  inicial con contraseña temporal generada al azar, mostrada por consola
  una sola vez — nunca hardcodeada. Se niega a correr si ya existe un
  administrador activo.
- Módulo de **usuarios** (solo administrador): `POST /api/usuarios`
  (contraseña temporal generada por el sistema, nunca elegida por quien
  crea la cuenta), `GET /api/usuarios`, `PATCH /api/usuarios/:id`
  (rol/activo) — con salvaguarda contra desactivar o cambiarle el rol al
  único administrador activo.
- Matriz de permisos aplicada a los módulos existentes: crear/editar
  productos y categorías, proveedores (módulo completo) y reportes
  completos quedan solo-administrador; el resto (ventas, caja,
  inventario, vencimientos, listar productos/categorías) queda para
  ambos roles. Dos casos no cubiertos por la instrucción original se
  confirmaron antes de implementar (no se asumieron): proveedores →
  solo-administrador; el indicador de alertas del mostrador deja de
  depender de `GET /api/reportes/inventario` (ahora solo-administrador) y
  pasa a usar `GET /api/inventario/alertas` + `GET /api/vencimientos/alertas`
  directamente cuando se reconstruya la interfaz (Fase 4).
- `AppError` gana un tercer parámetro opcional, `codigo` (ej.
  `SIN_SESION`, `DEBE_CAMBIAR_PASSWORD`, `ROL_INSUFICIENTE`,
  `RATE_LIMITED`, `CREDENCIALES_INVALIDAS`), incluido en la respuesta de
  error cuando está presente — para que el frontend distinga
  programáticamente entre errores con el mismo `statusCode`.
- `SESSION_SECRET` (variable de entorno nueva, obligatoria, sin valor por
  defecto — el proceso no arranca sin ella).

**Nota**: la interfaz de mostrador construida antes de esta fase (ADR
0009) deja de funcionar tal cual con estos cambios (no tiene pantalla de
login ni maneja sesiones) — comportamiento esperado, la Fase 4 la
reemplaza por completo.

### Agregado

- Estructura base del proyecto (Node.js + Express 5).
- Conexión a SQLite vía `better-sqlite3`, con `journal_mode = WAL` y
  `foreign_keys = ON`.
- Runner de migraciones propio (`src/db/migrate.js`) con tabla de control
  `schema_migrations`.
- Middleware central de manejo de errores y clase `AppError`.
- Middleware de validación genérico con `zod`.
- Logger propio a archivo (`logs/app.log`).
- Endpoint `GET /api/health` para verificar que el servidor está vivo.
- Documentación base: README, ARCHITECTURE, y primer ADR sobre la arquitectura
  general del proyecto.
- Migración `002_categorias_y_productos.sql`: tablas `categorias` y
  `productos`, con peso en gramos y precios en pesos COP (ambos enteros),
  CHECK constraints para que `stock_unidades`/`stock_gramos` sean exclusivos
  según `tipo_venta`, `codigo_barras` único y opcional, e índice en
  `categoria_id`.
- ADR sobre precisión numérica: peso en gramos, dinero en pesos COP, y regla
  de redondeo único por línea de venta.
- Módulo de **productos** (route/controller/service/repository), plantilla
  para los demás módulos de negocio:
  - `POST /api/productos`, `GET /api/productos` (filtros `categoriaId` y
    `activo`), `GET /api/productos/:id`,
    `GET /api/productos/codigo-barras/:codigo`, `PATCH /api/productos/:id`.
  - Validación con `zod`: esquemas separados para creación/actualización;
    `tipoVenta` no se puede modificar después de creado.
  - El service valida `stock_unidades`/`stock_gramos` contra `tipo_venta` y
    la existencia de `categoria_id` antes de tocar la base de datos, y
    traduce los códigos de error de `better-sqlite3`
    (`SQLITE_CONSTRAINT_UNIQUE`/`FOREIGNKEY`/`CHECK`) a errores de negocio
    con mensaje claro.
- Módulo de **categorías** (misma plantilla de 4 capas que productos, alcance
  mínimo): `POST /api/categorias`, `GET /api/categorias`,
  `PATCH /api/categorias/:id` (renombrar). Nombre único, duplicados
  traducidos a 409. Sin `DELETE` por ahora: la FK `ON DELETE RESTRICT` desde
  `productos` ya impide borrar una categoría en uso, y no hay necesidad de
  negocio confirmada para borrar una que no lo esté.
- `src/utils/schemas-comunes.js`: `idParamsSchema` extraído de
  `productos.schema.js` para reutilizarse también en categorías (y en los
  módulos que siguen).
- Migración `003_caja_y_ventas.sql`: tablas `caja_sesiones` (con CHECK
  cruzado estado↔cerrada_en↔monto_cierre), `ventas` y `ventas_items`.
  `caja_sesiones` completa aunque el módulo de caja todavía no existe (ver
  ADR 0003).
- ADR 0003 sobre las decisiones provisionales de ventas: dependencia a
  `caja_sesiones` sin módulo de caja, `tipo_precio` sin módulo de clientes,
  snapshot de `precio_unitario_aplicado`, y descuento de stock reversible
  por variable de entorno.
- Módulo de **ventas**: `POST /api/ventas`, `GET /api/ventas` (filtros
  `cajaSesionId`, `desde`/`hasta`), `GET /api/ventas/:id` (con items).
  - El service resuelve cada item (precio según `tipoPrecio`, con fallback
    a `precio_publico` si el producto no tiene `precio_mayorista`), calcula
    subtotales con redondeo único por línea (ADR 0002) y rechaza productos
    inexistentes o inactivos, todo antes de escribir en la base de datos.
  - Crear venta + items + descuento de stock es una transacción atómica
    (`db.transaction`) definida en `ventas.service.js`, que orquesta el
    repository de ventas y el de productos — sin romper la separación de
    capas (ver ARCHITECTURE.md y ADR 0003).
  - El descuento de stock vive aislado en `descontarStockPorVenta` y se
    activa/desactiva con la variable de entorno
    `DESCONTAR_STOCK_AUTOMATICO` (pendiente de confirmación de la dueña).
- `productos.repository.js`: `descontarStock(id, cantidad)`, UPDATE
  condicionado a stock suficiente (0 filas afectadas = sin stock o producto
  inexistente).
- ADR 0004 sobre el cierre de caja: el monto teórico de efectivo se calcula
  como `monto_apertura + ventas con TRIM(LOWER(medio_pago)) = 'efectivo'`,
  deuda técnica intencional mientras no exista un catálogo cerrado de
  medios de pago (a revisar cuando el cliente lo confirme). El monto
  teórico y la diferencia contra lo declarado no se persisten, se calculan
  al vuelo.
- Módulo de **caja**: `POST /api/caja/apertura`, `PATCH /api/caja/:id/cierre`,
  `GET /api/caja/:id` (reporte: total de ventas, desglose por medio de
  pago, monto teórico de efectivo, diferencia), `GET /api/caja/actual`.
  - Regla de negocio: solo puede haber una sesión de caja abierta a la
    vez; abrir una segunda mientras hay una abierta responde 409.
  - Cerrar una sesión inexistente responde 404; cerrar una ya cerrada
    responde 400.
- Migración `004_movimientos_inventario.sql`: tabla `movimientos_inventario`
  como ledger único de todo cambio de stock, con `cantidad` como delta
  firmado (positivo/negativo) y `stock_resultante` poblado solo en
  ajustes. CHECK cruzado de signo según `tipo`, y de
  `referencia_venta_id` según `motivo`.
- Migración `005_stock_minimo_productos.sql`: agrega `stock_minimo`
  (nullable) a `productos` — mientras sea `NULL`, el producto nunca genera
  alerta.
- ADR 0005 sobre movimientos de inventario: todo cambio de stock pasa por
  el ledger (incluidas las ventas), `ajuste` fija un valor absoluto de
  stock en vez de sumar/restar, y `stock_minimo` es un umbral opcional por
  producto sin valor por defecto inventado.
- Módulo de **inventario**: `POST /api/inventario/movimientos` (discrimina
  por `tipo` con `z.discriminatedUnion`: `entrada`/`salida` reciben
  `cantidad`, `ajuste` recibe `stockNuevo`), `GET /api/inventario/movimientos`
  (filtros `productoId`, `desde`/`hasta`), `GET /api/inventario/alertas`.
  - El service relee el stock actual **dentro** de la transacción para
    calcular el delta de un ajuste (no antes de abrirla), mismo estándar
    de atomicidad que ventas.
  - Rechaza (400) intentos de crear manualmente un movimiento con
    `motivo='venta'`: ese motivo solo lo genera `ventas.service.js`.
- `ventas.service.js` ahora registra el movimiento de inventario
  (`tipo='salida'`, `motivo='venta'`, `referencia_venta_id`) dentro de la
  misma transacción que descuenta stock, gateado por
  `DESCONTAR_STOCK_AUTOMATICO`.
- `productos.repository.js`: `aumentarStock` y `fijarStock`, junto al ya
  existente `descontarStock`. `PATCH`/`POST /api/productos` aceptan
  `stockMinimo` opcional.
- `src/utils/schemas-comunes.js`: `fechaSchema` extraído de
  `ventas.schema.js` para reutilizarse también en inventario.
- Migración `006_proveedores.sql` y módulo de **proveedores** (alcance
  mínimo, directorio de contacto sin vincular todavía a productos ni a
  movimientos de inventario): `POST /api/proveedores`,
  `GET /api/proveedores` (filtro `activo`), `GET /api/proveedores/:id`,
  `PATCH /api/proveedores/:id`. `nombre` sin `UNIQUE` (dos proveedores
  pueden compartir nombre comercial); `nit` opcional pero único cuando se
  informa, duplicados traducidos a 409. Sin `DELETE`: se desactiva
  (`activo=false`), mismo criterio que productos.
- ADR 0006 sobre lotes de vencimiento: registro informativo y de alerta,
  desacoplado del stock general de `productos` (sin FIFO automático,
  fuera de alcance a propósito). `cantidad` es un snapshot al registrar
  el lote, no se resincroniza con el stock. Umbral de "próximo a vencer"
  configurable vía `DIAS_ALERTA_VENCIMIENTO` (default `3`).
- Migración `007_lotes_vencimiento.sql`: tabla `lotes_vencimiento`, con
  índices en `producto_id` y `fecha_vencimiento`.
- Módulo de **vencimientos**: `POST /api/vencimientos/lotes`,
  `GET /api/vencimientos/lotes` (filtros `productoId`, `activo`),
  `PATCH /api/vencimientos/lotes/:id` (corregir cantidad/fecha o marcar
  `activo=false` al agotarse/descartarse — `productoId` no es
  actualizable), `GET /api/vencimientos/alertas` (agrupa en `vencidos` y
  `porVencer`, calculado al vuelo contra la fecha actual).
- Módulo de **reportes** (solo lectura, sin migración ni tablas nuevas):
  - `GET /api/reportes/ventas` (`desde`/`hasta` obligatorios, `cajaSesionId`
    opcional, rechaza `desde > hasta`): totales, desglose por medio de pago
    (mismo criterio `TRIM(LOWER(medio_pago))` que caja) y top 10 productos
    por `subtotal` acumulado.
  - `GET /api/reportes/inventario`: valor estimado del inventario
    (`stock_actual × precio_publico`, con conversión ÷1000 para productos
    por peso — el precio es por kilo pero el stock está en gramos, mismo
    criterio del ADR 0002 — y una nota explícita aclarando que es
    estimación de venta potencial, no valorización contable), más
    `productosStockBajo` y `lotesPorVencer` reutilizando los services de
    inventario y vencimientos en vez de duplicar su lógica.
- Hardware confirmado con pruebas físicas reales: lector de código de
  barras (HID, sin integración de backend adicional — usa
  `GET /api/productos/codigo-barras/:codigo` ya existente); impresora
  térmica compartida en Windows como `POS58`; cajón monedero **no
  funcional** (puerto DK dañado, confirmado por descarte), fuera de
  alcance de software, documentado en ARCHITECTURE.md.
- ADR 0007 e integración de impresión térmica: `src/hardware/` (funciones
  puras + comando de sistema, sin base de datos ni patrón CRUD).
  - `comandos-escpos.js`: arma buffers ESC/POS a mano
    (inicializar/texto/negrita/cortar/`construirRecibo`), formato de 32
    caracteres de ancho, sin librería con compilación nativa (misma razón
    que `better-sqlite3` sobre un driver que la necesitara).
  - `impresion.service.js`: escribe el buffer a archivo temporal y lo
    envía con `copy /b` hacia `\\localhost\${NOMBRE_IMPRESORA_COMPARTIDA}`
    (variable de entorno nueva, default `'POS58'`). Su promesa nunca
    rechaza — cualquier error se logea con el logger central.
  - `ventas.service.js` llama a `imprimirReciboDeVenta` **después** de que
    la transacción de venta ya hizo commit, sin `await` (fire-and-forget):
    una venta nunca falla ni se revierte por un problema de impresión.
  - Nuevo endpoint `POST /api/ventas/:id/reimprimir` (404 si la venta no
    existe).
- `iconv-lite` como dependencia nueva (JS puro, sin compilación nativa)
  para codificar el texto del recibo a CP850, la tabla de caracteres fija
  de fábrica de la impresora física (diagnosticada empíricamente, ver
  ADR 0007 — el comando `ESC t` no tiene ningún efecto en este modelo).
- `src/hardware/diagnostico-codepages.js` y
  `src/hardware/diagnostico-encoding.js`: herramientas manuales
  permanentes para repetir el diagnóstico de codepage si se cambia de
  impresora en el futuro.
- Cajón monedero integrado: `abrirCajon()` en `comandos-escpos.js` (pulso
  `ESC p 0 25 250`, pin confirmado con prueba física aislada mandando un
  solo pin a la vez — `src/hardware/diagnostico-cajon.js`, herramienta
  permanente igual que las de codepage) y `abrirCajonMonedero()` en
  `impresion.service.js` (mismo patrón best-effort que `imprimir()`).
  `ventas.service.js` lo activa solo cuando `medioPago` es efectivo
  (`TRIM(LOWER(...))`, mismo criterio que caja/reportes) — Nequi,
  Daviplata o tarjeta no lo activan. Verificado con conteo explícito de
  llamadas (no por ausencia de error) que abre en efectivo, no abre en
  otros medios, y no se reabre al reimprimir. Ver ADR 0007.
- ADR 0008 y backup automático de SQLite (`src/backup/backup.service.js`,
  sin ruta HTTP, arrancado una sola vez desde `server.js`): usa
  `db.backup()` nativo de better-sqlite3 (no `fs.copyFile`, que con WAL
  activo podría copiar un estado a medio escribir), un backup al iniciar
  la aplicación + cada 6 horas (`setInterval` simple, sin librería de
  cron externa), archivos `pos-backup-YYYY-MM-DD-HHmm.sqlite` en
  `/backups`, y retención de los 14 más recientes (borra los más viejos
  automáticamente). Todo asíncrono y best-effort: un fallo se logea con
  el logger central sin tumbar la aplicación, mismo criterio que
  impresión/cajón (ADR 0007). Verificado abriendo un backup real con
  better-sqlite3 y leyendo datos reales de él (no solo confirmando que el
  archivo existe), y probando la retención con 16 backups de prueba.
- ADR 0009 e **interfaz de mostrador** (`public/`, HTML/CSS/JS vanilla,
  módulos ES por responsabilidad, sin build ni framework): SPA de una
  sola página, sin ningún recurso por CDN (fuentes Fraunces/Public Sans
  autohospedadas como `.woff2`, licencia SIL OFL 1.1 verificada; íconos
  SVG inline escritos a mano, sin emojis ni librerías de íconos).
  - Paleta cálida (claro/oscuro) verificada con la fórmula de contraste
    WCAG real antes de usarse, y de nuevo con `axe-core` contra el DOM
    renderizado: 0 violaciones WCAG 2.0/2.1 A+AA en ambos temas.
  - Captura del lector de código de barras HID por velocidad entre
    teclas (sin campo dedicado), búsqueda manual con filtro en cliente
    (sin inventar un endpoint de búsqueda que no existe en el backend),
    carrito que replica los cálculos de `ventas.service.js` (ADR 0002 y
    0003) para que el total en pantalla coincida con lo que se cobra,
    panel de caja que bloquea la venta si no hay sesión abierta, alertas
    de stock bajo/vencimientos reutilizando `GET /api/reportes/inventario`,
    toggle de tema persistido en `localStorage` sin parpadeo (aplicado
    antes del primer paint).
  - Impresión y apertura de cajón siguen siendo best-effort del backend
    (ADR 0007): la interfaz confirma la venta apenas `POST /api/ventas`
    responde, sin esperar nada más.
  - Verificado con tres herramientas independientes (ninguna quedó como
    dependencia del proyecto): Puppeteer (Chrome real, flujo completo de
    principio a fin, 31/31), Lighthouse (Performance 99, Accessibility
    100, Best Practices 100, SEO 100), y `axe-core`.
  - `compression` (gzip) como dependencia nueva, agregada tras la primera
    auditoría Lighthouse; los 5 archivos CSS se combinaron en uno solo
    (`estilos.css`, con comentarios de sección) para reducir peticiones
    que bloquean el render.

### Corregido

- `src/middlewares/validate.js`: en Express 5, `req.query` es un getter sin
  setter (se recalcula desde la URL cruda en cada acceso), así que
  `req.query = datosValidados` fallaba en silencio y el cuerpo validado por
  zod nunca llegaba al controller. Se corrigió usando
  `Object.defineProperty` para los tres orígenes (`body`/`params`/`query`).
- `comandos-escpos.js`: `texto()` codificaba con `'latin1'` en vez de
  `'cp850'` (la tabla real de la impresora), lo que imprimía tildes y `ñ`
  incorrectas — incluido el nombre del negocio en el encabezado del
  recibo. Diagnosticado empíricamente contra la impresora física antes de
  corregir (ver ADR 0007), no por prueba y error a ciegas.
- Corrección sobre un diagnóstico anterior, no sobre código: el cajón
  monedero se había documentado como hardware no funcional (puerto DK
  dañado). La causa real era el cable en el puerto equivocado del equipo,
  no un circuito dañado — con el cable en el puerto correcto, el cajón
  abre sin problema. ADR 0007 y ARCHITECTURE.md corregidos.
- `render.js` (interfaz de mostrador): la cantidad de productos por peso
  usaba `<input type="number">`, que el navegador rechaza en silencio si
  se escribe con coma decimal (el estándar HTML solo acepta punto,
  aunque la convención colombiana —y el resto del sistema, incluido el
  recibo— use coma). El peso editado nunca se aplicaba y el total
  quedaba mal. Encontrado probando el flujo completo con Chrome real
  (Puppeteer), no asumido. Se cambió a `type="text"` con
  `inputmode="decimal"` para ese campo específico.
