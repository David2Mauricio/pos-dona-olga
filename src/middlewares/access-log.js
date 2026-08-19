// Log de acceso HTTP: registra TODA petición, exitosa o no -- a diferencia
// de error-handler.js (solo deja rastro cuando algo falla) y logger.js
// (solo escribe lo que el código llama explícitamente). Motivado por una
// investigación real (ver ADR de exportación CSV/gastos/redondeo/gráficos):
// reconstruir qué pasó y cuándo en el servidor real dependió enteramente de
// timestamps de archivos de prueba, no de evidencia real del servidor —
// este es el hueco que cierra.
//
// Archivo propio (logs/acceso/), separado de logs/app.log a propósito: no
// mezclar el log de aplicación (eventos explícitos, nivel info/warn/error)
// con el de acceso (cada petición, alto volumen).

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const env = require('../config/env');
const logger = require('../utils/logger');

// Anclado a env.raizProyecto, no a process.cwd() (ver ADR 0008, sección
// "Corrección: ruta anclada a DB_PATH" -- mismo defecto, mismo fix).
const DIRECTORIO_ACCESO = path.resolve(env.raizProyecto, 'logs', 'acceso');
const PREFIJO_ARCHIVO = 'acceso-';
const RETENCION_MAXIMA_DIAS = 14; // mismo criterio que backup.service.js

fs.mkdirSync(DIRECTORIO_ACCESO, { recursive: true });

function archivoDeHoy() {
  const hoy = new Date().toISOString().slice(0, 10);
  return path.join(DIRECTORIO_ACCESO, `${PREFIJO_ARCHIVO}${hoy}.log`);
}

// Conserva solo los RETENCION_MAXIMA_DIAS archivos más recientes. Mismo
// criterio de ordenamiento que backup.service.js: el nombre
// (acceso-AAAA-MM-DD.log) ordena alfabéticamente igual que cronológicamente.
async function limpiarAccesoAntiguo() {
  try {
    const archivos = (await fsp.readdir(DIRECTORIO_ACCESO))
      .filter((archivo) => archivo.startsWith(PREFIJO_ARCHIVO) && archivo.endsWith('.log'))
      .sort();

    const cantidadASobrar = archivos.length - RETENCION_MAXIMA_DIAS;
    if (cantidadASobrar <= 0) return;

    for (const archivo of archivos.slice(0, cantidadASobrar)) {
      await fsp.unlink(path.join(DIRECTORIO_ACCESO, archivo));
      logger.info(`Log de acceso antiguo eliminado por retención (máximo ${RETENCION_MAXIMA_DIAS} días): ${archivo}`);
    }
  } catch (error) {
    logger.error(`Error limpiando logs de acceso antiguos: ${error.message}`);
  }
}

// Se engancha a res.on('finish'), no al punto de entrada: así el status
// code final queda siempre correcto sin importar qué capa lo haya decidido
// (una ruta real, el 404 catch-all, o el manejador de errores). req.session
// ya está poblado para cuando 'finish' dispara (pasó toda la cadena de
// middlewares), así que el usuario autenticado -- si lo hay -- queda
// identificado sin depender de parsear el body en ningún punto (nunca se
// loguean credenciales).
function registrarAcceso(req, res, next) {
  const inicio = process.hrtime.bigint();

  res.on('finish', () => {
    const duracionMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    const usuario = req.session?.usuario?.usuario ?? '-';
    const linea = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duracionMs.toFixed(1)}ms) usuario=${usuario}\n`;

    fs.appendFile(archivoDeHoy(), linea, (error) => {
      if (error) logger.error(`No se pudo escribir el log de acceso: ${error.message}`);
    });
  });

  next();
}

module.exports = { registrarAcceso, limpiarAccesoAntiguo, DIRECTORIO_ACCESO, RETENCION_MAXIMA_DIAS };
