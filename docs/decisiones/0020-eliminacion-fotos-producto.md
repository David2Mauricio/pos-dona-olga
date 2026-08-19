# ADR 0020: Eliminación completa de fotos de producto

## Estado

Aceptado, cerrado.

## Contexto

La funcionalidad de fotos de producto (`foto_nombre_archivo` en
`productos`, subida vía `multer` a `/uploads`, mostrada en Mostrador/
Productos/Inventario) se implementó y se probó con el mismo rigor que el
resto del proyecto (ver ADR 0017, Bloque G: Puppeteer + axe-core +
Lighthouse contra el servidor real). Funcionaba correctamente.

Se retira por completo — **decisión de negocio, no un descarte de trabajo
inconcluso ni un fallo técnico**. La complejidad operativa real de
fotografiar el catálogo completo del negocio (decenas de productos, cada
uno necesitando una foto tomada, recortada y cargada, y mantenida
actualizada cuando cambia el empaque o el corte) no se justifica frente
al valor que aporta en un mostrador donde el cajero ya conoce el producto
por nombre y precio. Ningún producto real del negocio llegó a tener una
foto cargada nunca — los únicos tres registros con `foto_nombre_archivo`
eran datos de demostración (`activo:0`), generados para probar el
sistema de punta a punta, no datos reales.

## Decisión

Eliminar toda referencia a fotos de producto, en las tres pantallas donde
llegó a integrarse, backend y frontend, sin dejar código muerto ni
rastros:

- **Migración 017**: `ALTER TABLE productos DROP COLUMN
  foto_nombre_archivo`. `DROP COLUMN` nativo — SQLite 3.35.0+ lo soporta
  directo (confirmado 3.53.4 en este proyecto), sin el truco de recrear
  la tabla completa. Los tres productos demo con foto se van con la
  columna, sin necesidad de preservarlos.
- **Backend**: `productos.foto.js` (el middleware de `multer` completo)
  eliminado como archivo. `POST /api/productos/foto` y su controller
  eliminados. `fotoNombreArchivo` sacado de los schemas de zod
  (crear/actualizar), del `mapearFila`/`COLUMNA_POR_CAMPO`/`INSERT` de
  `productos.repository.js`, y de la lógica de borrado de foto huérfana
  en `productos.service.js:actualizar()`. `multer` desinstalado
  (`npm uninstall multer`) — confirmado que no se usaba en ninguna otra
  ruta del proyecto antes de sacarlo. El mount estático
  `app.use('/uploads', ...)` en `app.js` eliminado junto con la carpeta
  `uploads/` y su entrada en `.gitignore`.
- **Frontend, en las tres pantallas reales**:
  - Mostrador (`render.js`): la tarjeta de producto en la grilla de
    búsqueda ya no incluye imagen ni placeholder — solo nombre, badge de
    stock bajo si aplica, y precio. `crearPlaceholderFoto()` y la lógica
    de `<img>`/`onerror` eliminadas; `UMBRAL_FOTOS_EAGER` (ya sin uso)
    también.
  - Productos (`catalogo.js` + `index.html`): el campo de carga de foto
    con su preview, el botón "Quitar", y la subida previa al
    guardar (`api.subirFotoProducto`) eliminados del formulario.
  - Inventario (`inventario.js`): la foto/placeholder en cada fila de
    movimiento reciente eliminada — la fila pasó de 7 a 6 columnas.
  - `iconoPaqueteVacio` (`icons.js`) eliminado tras confirmar que no
    quedaba ningún otro consumidor.
  - `api.js`: `subirFotoProducto` eliminado; la rama especial de
    `FormData` en `peticion()` (agregada solo para este caso) también,
    ya que no queda ningún otro consumidor de `multipart/form-data` en
    el cliente.
  - CSS: `.formulario__foto-preview`, `.movimiento__foto` (+ variantes),
    `.tarjeta-producto__foto` (+ variantes) eliminadas.
- **Documentación**: `ARCHITECTURE.md` y los ADR 0009/0013 actualizados
  con una nota apuntando acá donde describían la funcionalidad como
  vigente — sin reescribir el registro histórico de lo que pasó en su
  momento (ej. el bug real de fotos rotas documentado en ADR 0013 sigue
  intacto, con una nota aclarando que la funcionalidad que ese bug
  afectaba ya no existe). ADR 0017 (Bloque G, la implementación original)
  editado con la misma nota, sin borrar la sección.

## Verificación

Contra una copia aislada de la base real: crear y editar un producto sin
el campo funciona sin errores; `POST /api/productos/foto` ya no existe
(404 de ruta); las tres pantallas (Mostrador, Productos, Inventario)
renderizan correctamente sin ningún rastro visual de fotos ni
placeholder; grep exhaustivo de `fotoNombreArchivo`, `foto_nombre_archivo`,
`multer`, `/uploads`, `productos.foto`, `iconoPaqueteVacio` en todo
`src/` y `public/` sin resultados.
