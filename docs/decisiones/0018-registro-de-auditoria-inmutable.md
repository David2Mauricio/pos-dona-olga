# ADR 0018: Registro de auditoría inmutable

## Estado

Aceptado, cerrado. Mismas reglas de proceso y de CSS que ADR 0017 (verificar
contra el proceso real de la Tarea Programada antes de cerrar, nunca
`opacity` sobre texto/badges para señalar estado) — no se repiten acá, ver
ese ADR para el porqué de cada una.

## Requerimiento

Registro de auditoría centralizado e inmutable — quién hizo qué y cuándo —
para las acciones sensibles del sistema: cierres de caja, anulaciones de
venta, overrides de precio, reseteos de contraseña, alta/baja/cambio de rol
de usuarios, ajustes manuales de inventario. "Inmutable" definido por el
cliente de forma explícita: ni la aplicación ni un administrador tienen
manera de borrar o modificar un registro una vez creado, ni por la interfaz
ni por la API.

## Verificación previa (antes de diseñar nada)

Pedida explícitamente por el cliente como paso obligatorio:

1. **¿Existía ya algún mecanismo de auditoría?** No — grep de
   `auditoria`/`audit_log`/`registrarAuditoria` en `src/` antes de este
   trabajo: cero resultados.
2. **¿Existía algún DELETE sobre `caja_sesiones`, `ventas` o
   `movimientos_inventario`?** No — cero `router.delete` fuera del ya
   existente en `proveedores.routes.js` (una entidad no listada como
   sensible), y cero `DELETE FROM` crudo apuntando a esas tres tablas en
   todo `src/`. Tampoco `seed-admin.js` ni ningún script de limpieza las
   toca.

Sin hallazgos que cerrar antes de diseñar.

## Diseño

**Tabla nueva** (`migrations/013_auditoria.sql`): `auditoria(id, usuario_id,
accion, entidad_tipo, entidad_id, detalle JSON, creado_en)`. Sin
`editado_en` ni `activo` — no hay ningún estado que editar.

**Inmutabilidad por ausencia, no por permiso**: `auditoria.repository.js`
solo define `crear`, `obtenerPorId` y `listar` — no existe ninguna función
de actualización o borrado en el archivo, así que no hay nada que
deshabilitar ni proteger con un rol: la operación simplemente no está
escrita en ningún nivel (ni repository, ni service, ni ruta).

**Punto único de escritura**: `registrarAuditoria()` en
`auditoria.service.js`, llamado explícitamente desde el service de cada
acción sensible — nunca desde un middleware genérico de logging de
requests. La escritura en la tabla corre **dentro de la misma transacción**
que la acción que audita: para acciones ya transaccionales (anulación de
venta, ajuste de inventario) queda anidada en la transacción existente;
para las que no lo eran (cierre de caja) se envolvió una transacción nueva.
Así "la acción se ejecutó pero no quedó auditada" no puede pasar por una
falla parcial.

**Defensa en profundidad — copia en disco**: además de la fila en SQLite,
cada escritura agrega una línea JSON a `auditoria/AAAA-MM-DD.log` (un
archivo por día, `fs.appendFileSync`, nunca reescrito). Esta copia es
best-effort y nunca transaccional — un fallo al escribir el archivo se
loguea con `logger.error` pero nunca revierte ni bloquea la acción real
(mismo criterio que `impresion.service.js`: una acción de negocio ya
confirmada no puede depender de un paso secundario). Directorio excluido
de git (`auditoria/*` + `.gitkeep`, mismo patrón que `logs/`/`uploads/`).

**UI**: sección "Auditoría" nueva, admin-only (`app.js` monta
`/api/auditoria` con `requiereRol('administrador')`, igual que Usuarios y
Proveedores). Listado cronológico (más reciente primero), filtrable por
tipo de acción y por usuario, con el detalle de cada entrada colapsado
detrás de un `<details>` nativo. Sin ningún botón de borrado en ningún
lado de la pantalla — no habría nada real detrás.

## Decisiones confirmadas con el cliente

1. **Script de emergencia** (`emergencia-resetear-password.js`, que
   bypasea `usuarios.service.js` y llama al repository directo): instrumentado
   aparte, con `usuarioId: null` (no hay sesión ni administrador logueado —
   el actor real es "quien tiene acceso a la máquina") y
   `detalle: { via: 'emergencia' }`.
2. **`cambio_rol_usuario`** sumada como acción nueva; una reactivación
   (`activo: false → true`) se audita como `alta_usuario` de nuevo, con
   `detalle.via: 'reactivacion'` para distinguirla del alta original.
3. Los tres caminos de reseteo de contraseña (admin, autoservicio,
   emergencia) comparten la misma acción `reseteo_password`, distinguidos
   solo por `detalle.via` (`admin` / `autoservicio` / `emergencia`) — no
   tres acciones separadas, para que filtrar por "reseteo_password" en la
   UI muestre los tres caminos juntos.
4. **Una entrada de auditoría por venta, no por ítem**: si una venta tiene
   varios ítems con override de precio, es una sola entrada
   `override_precio` con todos los ítems ajustados dentro del `detalle`
   JSON — no una entrada por ítem.

## Puntos de escritura instrumentados

| Acción | Hook | Actor |
|---|---|---|
| `cierre_caja` | `caja.service.js:cerrar()` | admin/cajero que cierra |
| `anulacion_venta` | `ventas.service.js:anular()` | admin que anula |
| `override_precio` | `ventas.service.js:crear()`, solo si algún ítem trae `precioModificado` | quien cobra |
| `alta_usuario` | `usuarios.service.js:crear()`, y `actualizar()` cuando `activo: false→true` | admin |
| `baja_usuario` | `usuarios.service.js:actualizar()` cuando `activo: true→false` | admin |
| `cambio_rol_usuario` | `usuarios.service.js:actualizar()` cuando `rol` cambia | admin |
| `reseteo_password` | `usuarios.service.js:resetearPassword()`, `auth.service.js:recuperarPassword()`, `emergencia-resetear-password.js` | admin / el propio usuario / `null` |
| `ajuste_inventario` | `inventario.service.js:crear()` | admin |

`inventario.service.js:crear()` es el único punto donde se crean
movimientos manuales (entrada/salida/ajuste desde la sección Inventario);
los movimientos automáticos de venta/anulación llaman a
`repository.crearMovimiento()` directo, sin pasar por acá — auditar esta
función alcanza para cubrir "ajustes manuales" sin filtrar nada aparte.

Seis controladores tuvieron que empezar a pasar `req.session.usuario.id`
a su service correspondiente (caja, ventas ×2, usuarios ×3, inventario) —
antes de este trabajo ningún controller threadeaba el actor de sesión hacia
la capa de servicio.

## Verificación

Contra una copia aislada de la base real (puerto 3001, nunca contra
`caja_sesiones` id 52 real ni contra ventas/usuarios reales — ver regla de
proceso de ADR 0017, aplicada acá también para no cerrar la caja real ni
crear ventas reales solo para probar):

- **31/31 verificaciones funcionales**: los ocho tipos de acción
  disparados y confirmados en el listado con su `detalle` correcto,
  incluyendo el camino de emergencia (`usuario_id NULL`, `via: emergencia`,
  confirmado tanto en la fila SQLite como en la línea del log en disco),
  filtros por acción y por usuario, y `403 ROL_INSUFICIENTE` real para un
  cajero pidiendo `/api/auditoria`.
- **11/11 verificaciones de UI** (Puppeteer + axe-core, ambos temas): listado
  renderiza, filtros poblados y funcionales, detalle expandible, cero
  botones de borrado en toda la sección, nav oculto para cajero.
- **Lighthouse** (user-flow `snapshot`, no `navigation` — es una SPA sin
  router, la vista se muestra/oculta con `hidden`): accesibilidad 100,
  mejores prácticas 100, SEO 100 sobre la vista de Auditoría con datos
  reales cargados.
- **Servidor real, tras reiniciar el proceso de la Tarea Programada**:
  8/8 verificaciones de solo lectura — listado renderiza (vacío, esperado:
  es una función nueva, todavía no hay acciones sensibles reales
  registradas), axe-core sin violaciones en la vista y en la página
  completa.

## Nota aparte, misma ronda: dos reportes urgentes, ninguno requirió cambio de código

Durante el cierre de este bloque el cliente reportó dos problemas que
resultaron no ser regresiones de este ni de ningún trabajo previo — se
investigaron con el mismo rigor pero no generaron cambios, así que no
ameritan su propio ADR:

- **Badge de estado de caja "invisible"**: auditado el markup, CSS y JS
  (incluido `cierre-caja.js`, sin diff contra HEAD en toda la ronda de
  rediseño de sidebar) y verificado visible, dentro de la cabecera y
  funcional en 1280/768/375px contra el servidor real recién reiniciado.
  Sin causa raíz de código encontrada; hipótesis más probable es una
  pestaña de navegador sin recargar desde el rediseño (sin paso de build,
  una pestaña ya abierta sigue sirviendo el JS/CSS viejo desde memoria).
- **Apertura del cajón acoplada a la impresión del recibo**: revisado
  `ventas.service.js` — el cajón ya se abría de forma incondicional cuando
  `medioPago === 'efectivo'`, fuera del `if (imprimir)`, con un comentario
  preexistente documentando la decisión. Confirmado con una venta real en
  efectivo con `imprimir:false` contra la copia aislada (mismo canal físico
  de impresora que producción): sin errores en el log, consistente con que
  el pulso de apertura se envió sin el recibo.

## Cierre de la ronda

Los diez pasos del orden confirmado por el cliente (migración → punto de
escritura → cierre de caja → anulación → override de precio → usuarios →
los 3 caminos de reseteo → ajuste de inventario → UI → pruebas) están
cerrados. Sin trabajo pendiente conocido de esta ronda.
