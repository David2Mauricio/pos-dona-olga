const fs = require('node:fs');
const path = require('node:path');
const repository = require('./auditoria.repository');
const env = require('../../config/env');
const logger = require('../../utils/logger');

// Defensa en profundidad (ver ADR 0018): además de la fila en la base
// (ya cubierta por el backup automático cada 6h, ADR 0008, al ser parte
// del mismo archivo .sqlite), una segunda copia en disco, append-only,
// un archivo de texto por día. Si alguien borra filas directo en el
// .sqlite con acceso al archivo, esta copia queda intacta. Mismo patrón
// que logger.js: fs.appendFileSync, directorio anclado a env.raizProyecto
// (ver ADR 0008, sección "Corrección: ruta anclada a DB_PATH" -- mismo
// defecto de resolverlo desde process.cwd(), mismo fix).
const DIRECTORIO_AUDITORIA = path.resolve(env.raizProyecto, 'auditoria');
fs.mkdirSync(DIRECTORIO_AUDITORIA, { recursive: true });

function archivoDeHoy() {
  const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(DIRECTORIO_AUDITORIA, `${hoy}.log`);
}

// Best-effort a propósito: la copia en disco es una defensa adicional,
// nunca puede ser la razón de que una acción sensible real (cerrar una
// caja, anular una venta) falle. Si escribir el archivo falla (disco
// lleno, permisos), se loguea el error y se sigue -- la fila en la base,
// que sí es transaccional con la acción que audita, ya quedó guardada.
function escribirCopiaEnDisco(entrada) {
  try {
    const linea = `${JSON.stringify({ ...entrada, creadoEn: new Date().toISOString() })}\n`;
    fs.appendFileSync(archivoDeHoy(), linea);
  } catch (error) {
    logger.error(`No se pudo escribir la copia en disco de auditoría: ${error.message}`);
  }
}

// Único punto de escritura de todo el sistema (ver ADR 0018) -- cada
// acción sensible lo llama explícitamente, con su propio detalle humano.
// Se llama DESDE DENTRO de la misma transacción que la acción que audita
// dondequiera que esa acción ya sea transaccional (anular venta, ajuste
// de inventario) -- para las que no lo eran, se las envolvió en una
// transacción nueva junto con este INSERT, para que "la acción pasó pero
// no quedó auditada" no sea un estado posible por una falla a mitad de
// camino. La copia en disco es lo único que queda fuera de esa garantía
// (ver comentario de escribirCopiaEnDisco).
function registrarAuditoria({ usuarioId, accion, entidadTipo, entidadId, detalle }) {
  const id = repository.crear({ usuarioId, accion, entidadTipo, entidadId, detalle });
  escribirCopiaEnDisco({ id, usuarioId, accion, entidadTipo, entidadId, detalle });
  return id;
}

function listar(filtros) {
  return repository.listar(filtros);
}

module.exports = { registrarAuditoria, listar };
