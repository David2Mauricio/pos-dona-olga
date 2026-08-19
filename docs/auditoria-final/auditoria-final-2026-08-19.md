# Auditoría final — 2026-08-19

**Fecha y hora**: 2026-08-19, 05:04–05:21 UTC.
**Alcance**: sistema completo (12 módulos de backend + interfaz de 10 secciones), contra una copia aislada de `data/pos.sqlite` (puerto 3001), nunca contra el servidor real de producción (puerto 3000).
**No es un ADR**: este documento es un reporte de cierre puntual de esta ronda de pruebas, no una decisión de arquitectura. No reemplaza ningún ADR existente; donde hay una decisión de diseño detrás de algo verificado acá, se referencia el ADR correspondiente en vez de repetirlo.

**Nota sobre lo ocurrido durante esta auditoría — reclasificada**: al arrancar el primer servidor de prueba se lanzó por error desde el directorio del proyecto real en lugar del scratch aislado, y ese arranque escribió un backup real y —por la política de retención (máximo 14)— borró el backup real más antiguo (`pos-backup-2026-08-14-0718.sqlite`), no recuperable (no está en git: `backups/*` está en `.gitignore`, excepto `.gitkeep`). En el momento se registró acá como un error de operación; **no lo era**: la causa es un defecto real de diseño (`DIRECTORIO_BACKUPS` resuelto por `process.cwd()` en vez de anclado a `DB_PATH`), con esta pérdida real como evidencia en vivo de su consecuencia. La corrección — y el mismo defecto encontrado en otros cuatro lugares del código — está documentada como corrección de diseño en **ADR 0008, sección "Corrección: ruta anclada a DB_PATH"**, no acá. Esta nota queda solo como registro de que el hecho ocurrió durante esta sesión.

---

## 1. Auditoría de seguridad de rutas

Inventario completo de `/api/*`, leído directamente de `src/app.js` y de cada `*.routes.js` (no de memoria ni de documentación previa).

**Gate global** (`src/app.js`): todo `/api/*` requiere sesión activa (`requiereSesion`) excepto `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/health`, montados antes del gate. Dentro de `/api/auth` (que vive fuera del gate global), `GET /sesion` y `POST /cambiar-password` llevan `requiereSesion` explícito propio; `GET /pregunta-seguridad/:usuario` y `POST /recuperar-password` no requieren sesión, por diseño (ver ADR 0014: es la vía de recuperación de acceso).

**Módulos montados admin-only completos** (matriz visible de un vistazo en `app.js`): `/api/proveedores`, `/api/reportes`, `/api/usuarios`, `/api/auditoria`, `/api/gastos` — los cuatro con `requiereRol('administrador')` en el punto de montaje, no repetido por ruta.

**Módulos con permisos mixtos** (declarados ruta por ruta):

| Módulo | Ruta | Método | Middleware |
|---|---|---|---|
| categorias | `/` | POST | `requiereRol('administrador')` + validar body |
| categorias | `/` | GET | ambos roles |
| categorias | `/:id` | PATCH | `requiereRol('administrador')` + validar |
| productos | `/` | POST | `requiereRol('administrador')` + validar body |
| productos | `/` | GET | ambos roles |
| productos | `/codigo-barras/:codigo` | GET | ambos roles |
| productos | `/:id` | GET | ambos roles |
| productos | `/:id` | PATCH | `requiereRol('administrador')` + validar |
| ventas | `/` | POST | ambos roles + validar body |
| ventas | `/` | GET | ambos roles |
| ventas | `/:id` | GET | ambos roles |
| ventas | `/:id/reimprimir` | POST | ambos roles |
| ventas | `/:id/anular` | PATCH | `requiereRol('administrador')` + validar |
| caja | `/apertura` | POST | ambos roles |
| caja | `/actual` | GET | ambos roles |
| caja | `/:id` | GET | ambos roles |
| caja | `/:id/cierre` | PATCH | ambos roles |
| inventario | `/movimientos` | POST | `requiereRol('administrador')` + validar |
| inventario | `/movimientos` | GET | ambos roles |
| inventario | `/alertas` | GET | ambos roles |
| vencimientos | `/lotes` | POST | ambos roles + validar |
| vencimientos | `/lotes` | GET | ambos roles |
| vencimientos | `/lotes/:id` | PATCH | ambos roles + validar |
| vencimientos | `/alertas` | GET | ambos roles |

**Verificación real de esta matriz**: sección 2 (regresión por módulo) prueba, con evidencia HTTP real, cada frontera admin-only (403 `ROL_INSUFICIENTE` para cajero, 2xx para admin) y cada endpoint declarado de ambos roles.

**Hallazgo, no una alarma nueva**: `GET /api/reportes/inventario` sigue existiendo, admin-only, heredado de antes de que existieran `/api/inventario/alertas` y `/api/vencimientos/alertas` (ambos de ambos roles) — el reemplazo para que un cajero no dependa de un endpoint admin-only para ver alertas de stock ya está hecho (Fase 4), el endpoint viejo simplemente no se borró. Sigue respondiendo 200 para admin (verificado en la sección 2), no es una ruta rota ni un agujero de permisos — es una ruta legacy sin consumidor en la interfaz actual. Sin acción requerida, se deja constancia.

**Errores estructurados**: `AppError` con `codigo` confirmado en los casos probados (`ROL_INSUFICIENTE`, `SIN_SESION`, `CREDENCIALES_INVALIDAS`) — el frontend puede (y debe, ver `docs/decisiones/0013-...md`) distinguir por `codigo`, no solo por status HTTP, ya que 403 se comparte entre `ROL_INSUFICIENTE` y `DEBE_CAMBIAR_PASSWORD`.

---

## 2. Regresión por módulo

**41/41 verificaciones pasaron.**

Cubre los 12 módulos de backend contra la copia aislada, con dos sesiones reales (admin y cajero) por HTTP: login/logout, fronteras de rol en cada módulo mixto y en cada módulo admin-only completo, creación/lectura en cada uno, y las piezas específicas de rondas de trabajo recientes:

- `usuarioId` queda registrado tanto en la apertura de caja como en la creación de una venta (extensión al ADR 0010).
- La respuesta de un producto creado ya **no** incluye `fotoNombreArchivo` (ADR 0020) y `POST /api/productos/foto` responde 404 (endpoint removido).
- `ticketPromedio` presente en el reporte de ventas, con guarda de división por cero (`null` sin ventas).
- El registro de auditoría de una anulación de venta ocurrida en la misma corrida aparece en `GET /api/auditoria`.

Tres fallas iniciales en la primera corrida (14/41 fallidas) fueron **bugs del script de prueba, no de la aplicación** — confirmado leyendo el schema/servicio real antes de asumir un defecto:
1. Cierre de caja: el campo correcto es `montoCierre` (`caja.schema.js:10`), el script usaba `montoContado`.
2. Reporte de ventas: `desde`/`hasta` son obligatorios (`reportes.schema.js:4`), el script los omitía.
3. Gastos: el campo es `concepto` (no `descripcion`) y `fecha` es obligatoria (`gastos.schema.js`), el script mandaba campos distintos.

Corregidos los tres, la segunda corrida dio 41/41 limpio.

---

## 3. Flujo de día completo simulado

**32/32 pasos verificados**, contra la copia aislada, con productos y montos reales (no sintéticos): "Coca Cola" (unidad) y "Cerdo" (peso).

1. Cajero abre caja con $50.000.
2. Venta 1: 2× Coca Cola, efectivo, $100.000 recibidos → total $80.000, vuelto $20.000 exacto.
3. Venta 2: 500g de Cerdo, efectivo exacto → total $500 (precio por kilo × gramos/1000), vuelto $0.
4. Venta 3: 1× Coca Cola, transferencia, sin `montoRecibido` → total $40.000, vuelto `null` (no aplica a no-efectivo).
5. Stock verificado tras las tres ventas: Coca Cola bajó exactamente 3 unidades, Cerdo bajó exactamente 500g.
6. Movimiento de inventario (admin): entrada de 5.000g a Cerdo → stock refleja el reabastecimiento exacto.
7. Venta 4 con override de precio justificado (trazabilidad, Fase 2): 1× Coca Cola a $35.000 con motivo → `precioModificado:true`, `motivoAjuste` guardado.
8. Anulación de la venta 1 (admin, con motivo) → estado `anulada`, stock de Coca Cola restituido exactamente en las 2 unidades de esa venta.
9. Registro de un gasto del día ($8.000, categoría "otro").
10. Cierre de caja: efectivo contado = apertura + ventas en efectivo **activas** (venta 2 + venta 4, la venta 1 anulada no cuenta, la venta 3 fue transferencia) → `montoTeoricoEfectivo` coincide exacto, `diferencia:0`.
11. Reporte de ventas del día: `totalVentas` y `cantidadVentas` (3, no 4) excluyen correctamente la venta anulada; `ticketPromedio` correcto; `topProductos` cuenta Coca Cola con cantidad 2 (la unidad de la venta anulada no se cuenta).
12. Auditoría: quedan registradas `ajuste_inventario`, `override_precio`, `anulacion_venta`, `registro_gasto`, `cierre_caja` — las cinco acciones de la jornada.
13. Logout de ambas sesiones, sesión invalidada confirmada después.

Ningún paso reveló inconsistencia numérica entre lo esperado (calculado a mano antes de cada verificación) y lo que devolvió el sistema.

---

## 4. Pruebas de hardware real

**No re-verificado en esta ronda: no hay impresora térmica ni lector de código de barras conectados a esta máquina.** No se inventa ni se asume un resultado — se documenta el estado real y lo ya verificado en rondas anteriores:

- Protocolo ESC/POS, CP850, ancho de 32 caracteres, impresora térmica de 58mm compartida: verificado contra hardware físico real (ver ADR 0007).
- Contenido del recibo (líneas quitadas/agregadas: dirección, teléfono; se sacó `Venta #` y el desglose público/mayorista): verificado simulando `construirRecibo()` sin la impresora física, porque el cambio es de contenido, no de protocolo (ver ADR 0014).
- Impresión de imágenes (para el logo en el recibo): explícitamente no implementada todavía — no hay código de impresión de imágenes construido, se verificará cuando exista el archivo real del logo (ver ADR 0014, mismo criterio de "no asumir el hardware" del ADR 0007).
- Lector de código de barras: sin una prueba dedicada registrada en un ADR anterior con evidencia física propia — queda como pendiente real, no como "probado".

**Pendiente explícito**: cuando haya impresora y lector conectados, repetir esta sección con evidencia de primera mano (ticket impreso real, escaneo real de un código conocido).

---

## 5. Lighthouse y axe-core — 10 pantallas + login

Contra la copia aislada, sesión de administrador (con caja abierta, para que ninguna de las 10 secciones quede tapada por el gate `#overlay-caja-cerrada`), viewport de escritorio 1280×900.

| Pantalla | axe-core (violaciones) | Lighthouse accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| Login | 0 | 100 | 100 | 100 |
| Mostrador | 0 | 100 | 100 | 100 |
| Historial | 0 | 100 | 100 | 100 |
| Productos | 0 | 100 | 100 | 100 |
| Usuarios | 0 | 100 | 100 | 100 |
| Vencimientos | 0 | 100 | 100 | 100 |
| Indicadores | 0 | 100 | 100 | 100 |
| Proveedores | 0 | 100 | 100 | 100 |
| Inventario | 0 | 100 | 100 | 100 |
| Auditoría | 0 | 100 | 100 | 100 |
| Gastos | 0 | 100 | 100 | 100 |

**0 violaciones de axe-core en las 11 superficies.** Accesibilidad Lighthouse 100/100 en las 11.

**Único puntaje por debajo de 100 en todo el bloque**: la navegación inicial (antes de login) marcó 96/100 en "buenas prácticas" por el audit `errors-in-console`, causado por dos respuestas no-2xx que el propio código ya maneja como flujo normal, no como fallo:
- `GET /img/logo.png` → 404: comportamiento intencional y ya documentado (ADR 0014) — el `onerror` saca el logo del documento y cae al nombre en texto hasta que el archivo real exista.
- `GET /api/auth/pregunta-seguridad/:usuario` → 404 al perder foco el campo usuario: comportamiento intencional (`public/js/auth.js`, comentario explícito en el código) — `peticionOpcional` en `api.js` ya resuelve "este usuario no tiene pregunta de seguridad configurada" como `null`, no como error; Lighthouse igual cuenta la respuesta HTTP no-2xx como "error en consola" aunque la aplicación la maneje bien. No requiere cambio de código — es una limitación conocida de cómo Lighthouse cuenta este audit, no un defecto real.

**Nota de proceso, no de la aplicación**: durante la construcción de este bloque, un click de Puppeteer en un ítem de navegación aterrizó en `#overlay-caja-cerrada` (el gate de pantalla completa que se muestra sin caja abierta) en vez del botón real, porque la caja había quedado cerrada al final del bloque 3. Confirmado con `elementFromPoint` que no era un problema de superposición CSS real sino de la propia caja cerrada al momento de esa prueba — se corrigió abriendo caja antes de navegar entre pantallas, no fue necesario tocar código de la aplicación.

---

## 6. Consistencia de esquema (migraciones desde cero)

Base nueva, vacía, en el scratch de pruebas — `node src/db/migrate.js` contra ella, sin ningún dato preexistente.

- **16/16 migraciones se aplicaron limpias, en orden, sin ningún error** (002 a 017; no existe un archivo `001_...`, la tabla de control `schema_migrations` se crea aparte en código, no como migración numerada — así fue desde el primer commit de migraciones, no es un archivo faltante).
- Comparación del esquema resultante (`sqlite_master`, tablas e índices) contra `data/pos.sqlite` real: **0 diferencias de definición en las tablas ya migradas al día**, con **un hallazgo real**:

  La base real (`data/pos.sqlite`) todavía **no tiene aplicadas las migraciones 016 (`usuario_id` en `ventas`/`caja_sesiones`) ni 017 (columna `foto_nombre_archivo` todavía presente)**. `src/server.js` migra automáticamente al arrancar (`ejecutarMigracionesPendientes()` en el arranque) — esto confirma, con evidencia directa del propio archivo de base de datos, que el servidor real (proceso de producción) sigue sin reiniciarse desde que esas dos migraciones se escribieron. No es una inconsistencia del esquema en sí ni un defecto de las migraciones: es el estado operativo pendiente ya señalado en rondas anteriores de este proyecto.

---

## Resumen final

**No está listo para el reinicio final sin antes hacer lo siguiente** (nada de esto es un defecto encontrado en el código — son acciones operativas pendientes, ya conocidas antes de esta auditoría y confirmadas de nuevo acá con evidencia fresca):

1. **Reiniciar el servidor real** (para aplicar las migraciones 016 y 017 a `data/pos.sqlite`) — confirmado como pendiente por el propio esquema de la base real en la sección 6.
2. **Pruebas de hardware real** (impresora térmica, lector de código de barras) — no hay hardware conectado hoy; repetir la sección 4 cuando lo haya.
3. Puntos ya en la cola de trabajo, sin relación con esta auditoría de cierre: alerta de vencimiento de backups, logo real, botón "Eliminar" de usuario en la interfaz de Usuarios, auditoría sistemática de reglas de texto en el resto de la interfaz.

**Todo lo demás — seguridad de rutas, los 12 módulos de backend, un día completo de operación simulado de punta a punta con verificación numérica exacta en cada paso, accesibilidad de las 11 superficies de la interfaz, e integridad del esquema de base de datos desde cero — pasó sin ningún hallazgo que requiera un cambio de código.**

**Actualización posterior a este reporte**: la pérdida de backup registrada arriba resultó ser un defecto real de diseño, no un error de operación aislado — corregido junto con cuatro casos idénticos más (`DB_PATH`, logs, log de acceso, copia en disco de auditoría), todos resolviendo su ubicación por `process.cwd()` en vez de una raíz estable. Ver ADR 0008, sección "Corrección: ruta anclada a DB_PATH", para el defecto, el fix y su verificación — no se repite acá.
