# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Corregido (rutas de datos ancladas a la raíz real del proyecto — ver ADR 0008)

- `DB_PATH`, `DIRECTORIO_BACKUPS`, `DIRECTORIO_LOGS`, `DIRECTORIO_ACCESO` y
  `DIRECTORIO_AUDITORIA` resolvían por `process.cwd()`: un arranque desde
  la carpeta equivocada escribía (y podaba por retención) datos reales en
  un lugar accidental, o abría una base de datos vacía nueva enmascarando
  la real. Causó la pérdida real de un backup durante la auditoría final
  de 2026-08-19. Ahora anclados a la raíz real del proyecto (o a `DB_PATH`
  en el caso de los backups), verificado idéntico lanzando el proceso
  desde tres directorios de trabajo distintos. El arranque además logea
  un `WARN` si se lanza desde una carpeta distinta a la esperada.

### Auditoría final previa a instalación real

- Ronda de cierre de pruebas contra copia aislada de la base real:
  seguridad de rutas (matriz completa de middleware por endpoint),
  regresión de los 12 módulos de backend (41/41), simulación de un día
  completo de operación con verificación numérica exacta (32/32),
  accesibilidad de las 10 secciones de la interfaz + login (0 violaciones
  axe-core, Lighthouse accesibilidad 100/100 en las 11), y consistencia de
  esquema aplicando las 16 migraciones desde cero. Reporte completo en
  `docs/auditoria-final/auditoria-final-2026-08-19.md`. Hallazgo real: la
  base de datos de producción todavía no tiene aplicadas las migraciones
  016/017 — confirma que el reinicio del servidor real sigue pendiente.

### Agregado (ayuda contextual — ver ADR 0021)

- Componente reutilizable `InfoTooltip` (ícono "i" con popover corto al
  activarlo, completamente operable por teclado): Stock inicial, Precio y
  Stock actual (formato nuevo) en Productos, Cantidad en Inventario,
  sección "Stock bajo" del panel de alertas, Monto teórico y Ajuste por
  redondeo en Caja, badge "Anulada" en Historial, badge "Por vencer" en
  Vencimientos.

### Quitado (fotos de producto — ver ADR 0020)

- Retirada por completo la funcionalidad de fotos de producto (decisión
  de negocio, no un fallo técnico): columna `foto_nombre_archivo`,
  endpoint `POST /api/productos/foto`, `multer`, carpeta `uploads/`, y
  su visualización en Mostrador/Productos/Inventario.

### Agregado (borrado real de usuarios, trazabilidad de ventas/caja — ver extensión al ADR 0010)

- `ventas` y `caja_sesiones` ahora guardan `usuario_id` (quién creó la
  venta / quién abrió la caja). `NULL` en filas anteriores a esta
  migración — limitación conocida, sin backfill posible.
- `DELETE /api/usuarios/:id` (admin-only): borrado real, solo si el
  usuario nunca tuvo actividad registrada (ventas, caja, auditoría,
  gastos). Con actividad, `409` sugiriendo desactivar en su lugar. Sin
  auto-eliminación (`400`), sin poder borrar al único administrador
  activo (`400`). Auditado (`eliminacion_usuario`).

### Agregado (herramientas de mantenimiento)

- `npm run limpiar:demo` (`limpiar-datos-demo.js`): borra de una sola vez
  todos los datos de demo identificados por el sufijo "(demo)" (productos,
  categorías, proveedor, ventas, movimientos de inventario, gastos).
  Backup de seguridad automático antes de borrar.

### Agregado (exportación CSV, gastos, redondeo de vuelto, gráficos, log de acceso — ver ADR 0019)

- **Exportar ventas a CSV**: nuevo botón en Indicadores, exporta el rango
  actualmente seleccionado (`GET /api/reportes/ventas/exportar`,
  admin-only). Incluye ventas anuladas con su estado y motivo. BOM UTF-8
  para que Excel en Windows no rompa los acentos.
- **Módulo de gastos**: sección nueva en la sidebar (admin-only) para
  registrar gastos (concepto, monto, fecha, categoría opcional) y
  desactivarlos — mismo patrón "no borrar" que proveedores/usuarios.
  Auditado (`registro_gasto`/`baja_gasto`). Dos tarjetas nuevas en
  Indicadores: "Gastos del período" y "Ganancia real" (ventas − gastos).
- **Redondeo de vuelto configurable** (`REDONDEAR_VUELTO`, apagado por
  defecto): redondea el vuelto en efectivo a la unidad de $100. El cierre
  de caja muestra el ajuste agregado como su propio renglón explícito,
  separado de "Sobra/Falta".
- **Indicadores**: gráfico de tendencia (ventas día por día del período) y
  donut de desglose por medio de pago, ambos SVG dibujados a mano, sin
  librería.
- **Log de acceso HTTP** (`logs/acceso/`): registra método, ruta, status,
  timestamp y usuario de cada petición, exitosa o no — cierra un hueco de
  visibilidad real encontrado durante una investigación de esta misma
  ronda (ver ADR 0019).

### Agregado (registro de auditoría inmutable — ver ADR 0018)

- Registro de auditoría centralizado para acciones sensibles: cierre de
  caja, anulación de venta, override de precio, alta/baja/cambio de rol de
  usuarios, los tres caminos de reseteo de contraseña (admin, autoservicio,
  emergencia), y ajuste manual de inventario.
- Inmutable por diseño: no existe ningún endpoint ni función de
  actualización o borrado para esta entidad, en ningún nivel (repository,
  service o ruta) — no hay nada que restringir con un rol.
- Copia en disco independiente además de la fila en SQLite: un archivo
  append-only por día en `auditoria/` (nunca reescrito).
- Nueva sección "Auditoría" (admin-only): listado cronológico filtrable
  por tipo de acción y por usuario, sin ningún botón de borrado.

### Corregido / Quitado (correcciones de UX, precio único — ver ADR 0017)

- Lector de código de barras: completa el campo "Código de barras" con el
  formulario de Productos abierto (antes solo alimentaba el carrito del
  mostrador, sin importar la pantalla activa).
- Formulario de alta de Productos: ya no se desborda del viewport (panel
  sin `max-height`/`overflow-y`, la mitad de arriba quedaba inalcanzable).
- Gráfico "Comparativa" de Indicadores: la etiqueta de monto de la barra
  más alta ya no se recorta contra el badge de variación.
- **Quitado de raíz**: `precio_mayorista` y el selector "Tipo de precio"
  (formulario de Productos, mostrador, schema del backend) — sin datos
  reales afectados, auditado antes de tocar nada.
- Dos bugs de contraste preexistentes (mismo patrón ya documentado en ADR
  0013: opacity sobre fondo sólido) encontrados con axe-core y corregidos:
  filas anuladas de Historial, y la clase compartida de fila inactiva
  (Productos/Usuarios/Vencimientos/Proveedores).

### Agregado (correcciones de UX, precio único — ver ADR 0017)

- **Subida real de imagen de producto**: nuevo endpoint `POST
  /api/productos/foto` (multipart, admin-only, `multer`), guardado en
  `uploads/` con nombre de archivo aleatorio, validación de tipo
  (JPG/PNG) y tamaño (3MB) en cliente y servidor, borrado del archivo
  viejo al reemplazar una foto (solo después de que el guardado en base
  tenga éxito).
- Inventario: cada movimiento muestra la foto del producto o el
  placeholder ya existente, tamaño fijo.
- Indicadores: desglose de ventas (hora, medio de pago, monto) bajo
  "Ventas totales", con link a Historial ya filtrado por ese período, más
  una descripción corta debajo de "Ticket promedio" y "Comparativa".
- Sidebar: por debajo de 768px pasa a cajón (drawer) con botón de
  hamburguesa, en vez de ocupar el 59% de la pantalla a 375px.
- Formulario de Productos: agrupado en tres secciones (Información básica
  → Precio → Stock); `tipoVenta` ahora es editable (alta y edición), con
  reingreso obligatorio del stock actual en el formato nuevo al cambiarlo
  — gramos y unidades no son convertibles entre sí.
- Botones de acción de fila en Usuarios/Proveedores ahora cumplen el
  mínimo táctil de 44x44px (antes 36px).
- Regla de proceso nueva: ningún bloque de backend se da por cerrado sin
  verificar contra el proceso real de la Tarea Programada, no solo una
  instancia temporal (ver el hallazgo que la motivó en ADR 0017).
- Regla de CSS nueva: nunca `opacity` para señalar estado inactivo sobre
  texto o badges — mismo bug de contraste ya visto tres veces (ver ADR
  0017).

### Agregado (proveedor en inventario, borrado real de proveedores — ver ADR 0016)

- Movimientos de inventario admiten un proveedor opcional (solo en
  entradas); el formulario de Inventario y su listado ya lo usan.
- `DELETE /api/proveedores/:id`: borrado real, rechazado con 409 si el
  proveedor tiene movimientos asociados (desactivar sigue siendo la vía
  para esos casos). Botón "Eliminar" nuevo en la sección Proveedores.

### Agregado (NIT en el recibo, checkbox de impresión, fix de tabla responsive)

- NIT del negocio (52.472.991-8) agregado al recibo térmico.
- Checkbox "Imprimir recibo" en el cobro — si no está marcada, la venta se
  registra igual pero no se envía nada a la impresora (el cajón monedero
  sigue abriendo igual en efectivo, es independiente del papel).
- `.catalogo__tabla` (Productos/Usuarios/Proveedores/Inventario) ahora
  scrollea horizontal dentro de su propia región en vez de desbordar toda
  la página en anchos chicos — el markup accesible (`tabindex="0"`,
  `role="region"`) ya estaba, faltaba el `overflow-x` real.

### Agregado (Inventario, Indicadores avanzado, blur de sesión — ver ADR 0015)

- Sección Inventario: alta de entradas de mercadería (producto, cantidad,
  motivo) y listado de movimientos recientes (entrada/salida/ajuste).
  Admin-only para el alta (ya lo era en el backend), ambos roles para el
  listado.
- Indicadores: selector de período (Día/Semana/Mes/Trimestre, comparando
  contra el período anterior equivalente) y dos gráficos de barras en SVG
  dibujado a mano, sin librería ni CDN.
- `backdrop-filter: blur` en el overlay de sesión (login, cambio de
  contraseña obligatorio, recuperación) para no dejar datos del mostrador
  visibles detrás cuando la sesión expira.
- Bug real encontrado y corregido: el lector de código de barras
  interceptaba el tipeo en la pantalla de login y podía forzar un logout
  espurio justo después de un login exitoso (ver ADR 0015).

### Agregado (cierre previo a instalación real — ver ADR 0014)

- Recibo: dirección y teléfono del negocio, quita número de venta y tipo
  de precio.
- Sidebar con fondo navy sólido, contraste verificado con WCAG real.
- Ruta lista para el logo (`public/img/logo.png`), sin bloquear en el
  archivo.
- Recuperación de contraseña sin Postman: pregunta de seguridad
  (autoservicio, administradores) y script de emergencia
  (`emergencia-resetear-password.js`) como respaldo.
- Persistencia del proceso: Tarea Programada de Windows, arranque sin
  sesión gráfica y reinicio automático ante un crash — verificados en vivo
  en la máquina real, no en teoría. Bug real encontrado y corregido en el
  camino: el reintento de Task Scheduler no detecta crashes de la
  aplicación (ver ADR 0014); el reintento real vive en un loop dentro de
  `iniciar-servidor.bat`.
- `docs/primer-arranque.md` completo: arranque, verificación, backups,
  checklist de primer uso, los tres caminos de recuperación de contraseña.
- Limpieza de datos de prueba de la base real (29 sesiones de caja y 1
  lote huérfano) y catálogo de ejemplo vaciado antes de instalar.

### Verificado (Fase 4: auditoría final de las 8 secciones completas)

- Primera pasada de Lighthouse + axe-core sobre el conjunto completo de la
  interfaz (Login, cambio de contraseña obligatorio, Mostrador, Historial,
  Productos, Usuarios, Vencimientos, Indicadores, Proveedores, cierre de
  caja — 21 combinaciones de estado×tema), no sección por sección.
- axe-core: 0 violaciones en las 21 combinaciones. Lighthouse (4 pasadas ×
  3 corridas): Accessibility 100, Best Practices 96–100, SEO 100 estables
  en las 12 mediciones; Performance con la variancia de máquina ya
  documentada (66–86), sin tendencia a la baja entre pasadas.
- Un hallazgo de contraste resultó ser un artefacto de timing del propio
  script de auditoría (medía a mitad de un repintado de la grilla de
  productos), no un bug de la aplicación — sin cambios de código como
  resultado de esta pasada.
- Con esto, la Fase 4 queda cerrada.

### Agregado (Fase 4: Proveedores)

- Nueva sección "Proveedores" en la sidebar (solo administrador, ya
  documentado desde ADR 0010): listado con nombre, NIT, teléfono,
  dirección y badge explícito Activo/Inactivo; alta y edición; desactivar
  sin borrar.
- Conflicto de NIT duplicado (`UNIQUE` en la base) mostrado como error real
  del backend (`409`), sin cerrar el formulario.
- `public/js/proveedores.js` (nuevo), cargado con `import()` dinámico al
  abrir la sección.
- Sin cambios de backend.
- Con esto se cierra la cola completa de secciones (Usuarios, Bloque 3,
  Vencimientos, Proveedores) — la interfaz cubre el 100% de los módulos de
  backend construidos.

### Agregado (Fase 4: Vencimientos)

- Nueva sección "Vencimientos" en la sidebar — primera sección de gestión
  visible para **ambos roles** (confirmado: registrar un lote es
  documentación aditiva, sin el riesgo de ocultar una merma o un error que
  sí tienen las secciones restringidas a administrador). Listado con
  cantidad, fecha, estado (Vencido/Por vencer/Vigente); alta y edición de
  lotes; desactivar sin borrar.
- Cantidad en kg para productos de tipo peso, convertida a gramos antes de
  enviar al backend (mismo criterio que el alta de Productos).
- `public/js/vencimientos.js` (nuevo), cargado con `import()` dinámico al
  abrir la sección.
- Fix de accesibilidad: `.catalogo__fila--inactivo` (compartida con
  Productos y Usuarios) bajaba el contraste de texto/badges por debajo del
  mínimo WCAG al aplicar `opacity: 0.6`; ajustado a `0.85`.
- Sin cambios de backend en esta sección.
- Con esto, según lo acordado, queda solo Proveedores en cola.

### Agregado (Fase 4: Bloque 3 — panel de Indicadores)

- Nueva sección "Indicadores" en la sidebar (solo administrador): ventas
  totales de hoy, ticket promedio, producto más vendido (por ingresos) y
  comparativa contra el día anterior — cuatro tarjetas, sin librería de
  gráficos.
- Backend: `reportes.service.js` agrega `ticketPromedio` a
  `GET /api/reportes/ventas` (`null` si no hubo ventas, no `0`).
- Comparativa contra ayer resuelta en el cliente (dos llamadas en paralelo
  al mismo endpoint, sin endpoint nuevo) con manejo explícito de "ayer sin
  ventas": muestra un mensaje claro en vez de `Infinity`/`NaN`/"0%"
  engañoso.
- `public/js/kpis.js` (nuevo), cargado con `import()` dinámico al abrir la
  sección — mismo patrón que Historial/Productos/Usuarios.
- Con esto, la interfaz cubre todas las secciones del backend salvo
  Vencimientos y Proveedores.

### Corregido (Fase 4: performance y estructura del shell, tras Usuarios)

- JS de vista bajo demanda: `historial.js`, `catalogo.js` y `usuarios.js`
  pasan de `import` estático a `import()` dinámico disparado por el click
  del ítem de nav correspondiente — antes se descargaban en toda carga de
  página, incluida la pantalla de login sin sesión, aunque son
  solo-administrador. `cierre-caja.js` pasa a cargarse una sola vez apenas
  hay sesión confirmada, no en la carga inicial de la página (su disparador
  vive en la cabecera persistente, no en una vista de nav, así que no se
  puede diferir a un click). 23 → 19 solicitudes, 153KB → 142KB en login.
- `estilos.css` deja de ser render-blocking: pasa al patrón
  preload+swap (`rel="preload" as="style"` con swap a `stylesheet` en
  `onload`, más `<noscript>` de respaldo) — el archivo venía creciendo con
  cada sección y Lighthouse ya lo señalaba como la causa directa
  (`render-blocking-resources`).
- `<main>`/`<h1>` únicos para toda la aplicación: `#contenido-principal`
  pasa de `<div>` a `<main>`, hijo directo del shell (antes vivía anidado
  dentro de la vista Mostrador y desaparecía en cualquier otra vista); se
  agrega un `<h1>` visualmente oculto a nivel de shell. Corrige el hallazgo
  de accesibilidad señalado (no resuelto) al cerrar Usuarios.
- Diagnosticado con evidencia (pedido explícito del cliente antes de
  Bloque 3): la caída de Performance de Lighthouse (98→82-83) no la causó
  código de Usuarios — medida de nuevo la versión de Cierre de Caja en la
  misma máquina, mismo momento, dio el mismo 82-83. Ver ADR 0013 para el
  detalle completo (candidatos descartados uno por uno, comparación
  directa contra el commit anterior).

### Agregado (Fase 4: Usuarios)

- Nueva sección "Usuarios" en la sidebar (solo administrador): listado,
  alta de cajero/administrador con contraseña temporal mostrada una vez
  (overlay dedicado, no el toast), reseteo de contraseña de cualquier
  usuario, cambio de rol y activar/desactivar en línea.
- Backend nuevo: `PATCH /api/usuarios/:id/resetear-password` — genera una
  contraseña temporal y fuerza `debeCambiarPassword:true`, separado del
  autoservicio (`POST /api/auth/cambiar-password`), que nunca fuerza esa
  bandera.
- Ícono de ojo para mostrar/ocultar contraseña en los tres campos de
  contraseña de la aplicación (login, cambio obligatorio actual y nuevo).
- Fix: `authService.exponer()` no incluía `activo`, así que el listado de
  usuarios mostraba a todos como inactivos (incluido el propio admin) sin
  importar su estado real.
- Fix de accesibilidad: el `<select>` de rol no tenía una etiqueta
  asociada en el DOM (crítico, axe `select-name`) ni fondo/color propios
  — heredaba el widget nativo del navegador, que podía quedar con texto
  oscuro sobre fondo oscuro en tema claro (axe `color-contrast`).
- `public/js/usuarios.js` (nuevo), métodos nuevos en `api.js`.
- ADR 0013 ampliado, incluyendo un hallazgo de accesibilidad preexistente
  (falta de `<main>`/`<h1>` únicos fuera de la vista Mostrador) señalado
  como fuera de alcance de esta sección, no resuelto acá.

### Agregado (Fase 4: Cierre de Caja)

- El indicador "Caja abierta · $X" en la barra de contexto pasa a ser un
  botón: abre el flujo de cierre (ambos roles — quien cierra cierra su
  propio turno y el cálculo lo hace el backend, sin margen para manipularlo).
- Resumen antes de cerrar: total de ventas, desglose por medio de pago,
  monto teórico en efectivo — todo ya calculado por el backend
  (`caja.service.js`), mismo criterio que vuelto/ticketPromedio.
- La diferencia se etiqueta "Sobra $X" / "Falta $X" / "Cuadra" (no un
  número con signo suelto), en color de éxito o peligro — nunca el navy
  de marca.
- Mientras el cierre está en proceso, "Cobrar" queda bloqueado (mismo
  bloqueo total que sin caja abierta) — evita que una venta en efectivo
  cambie el monto teórico entre que se cuenta el efectivo y se confirma.
- `public/js/cierre-caja.js` (nuevo), métodos nuevos en `api.js`.
- ADR 0013 ampliado. Con esta sección más las anteriores, la interfaz
  cubre el 100% de los módulos de backend construidos (salvo el panel de
  KPIs, Bloque 3, todavía pendiente).

### Agregado (Fase 4: gestión de Productos y Categorías)

- Nueva sección "Productos" en la sidebar (solo administrador), con dos
  pestañas: Productos (listado con búsqueda/filtro por categoría/estado,
  alta, edición) y Categorías (listado, alta, renombrar — no hay borrado
  de ninguna de las dos entidades en el backend).
- Formulario de producto condicional por contexto: alta pide tipo de
  venta y stock inicial; edición no expone ninguno de los dos (tipo de
  venta es inmutable en el backend; stock, si se editara acá, evitaría el
  ledger de `movimientos_inventario` — ver ADR 0005 — así que corregir
  stock de un producto activo queda para un futuro movimiento de ajuste,
  no para este formulario).
- Sin manejo de fotos en esta pasada (confirmado con el cliente): no
  existe endpoint de subida en el backend, documentado como gap conocido.
- `public/js/catalogo.js` (nuevo), métodos nuevos en `api.js`.
- ADR 0013 ampliado con la auditoría completa del contrato.

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
