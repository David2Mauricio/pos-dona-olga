// Proceso interno de backup, arrancado una sola vez desde server.js — no
// tiene ruta HTTP ni patrón de capas de módulo de negocio, mismo criterio
// que src/hardware/. Ver ADR 0008.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const db = require('../config/database');
const env = require('../config/env');
const logger = require('../utils/logger');

// Anclado a la ubicación real de la base de datos (env.dbPath), no a
// process.cwd(): un backup es tan crítico como el dato que respalda, y no
// puede depender de desde qué carpeta se haya lanzado el proceso. Lanzar
// el servidor mal ubicado alguna vez escribió (y podó por retención) un
// backup real en una carpeta "backups" accidental creada donde fuera que
// corriera el comando -- ver ADR 0008, sección "Corrección: ruta anclada
// a DB_PATH", y la auditoría final 2026-08-19 que lo encontró en vivo.
const DIRECTORIO_BACKUPS = path.resolve(path.dirname(env.dbPath), '..', 'backups');
const PREFIJO_ARCHIVO = 'pos-backup-';
const RETENCION_MAXIMA = 14;
const INTERVALO_POR_DEFECTO_MS = 6 * 60 * 60 * 1000; // 6 horas

// Mismo criterio que database.js con /data: crear el directorio una vez
// al cargar el módulo, de forma síncrona (arranque del proceso, no una
// petición en curso).
fs.mkdirSync(DIRECTORIO_BACKUPS, { recursive: true });

function formatearNombreArchivo(fecha) {
  const dosDigitos = (numero) => String(numero).padStart(2, '0');
  const aaaa = fecha.getFullYear();
  const mm = dosDigitos(fecha.getMonth() + 1);
  const dd = dosDigitos(fecha.getDate());
  const hh = dosDigitos(fecha.getHours());
  const min = dosDigitos(fecha.getMinutes());
  return `${PREFIJO_ARCHIVO}${aaaa}-${mm}-${dd}-${hh}${min}.sqlite`;
}

// El nombre incluye fecha/hora real de creación (no un nombre fijo que se
// sobrescriba). Usa db.backup(), no fs.copyFile: con WAL activo, copiar
// el archivo a mano puede capturar un estado a medio escribir si hay una
// transacción en curso — .backup() lo maneja correctamente a nivel de
// motor (ver ADR 0008). Nunca lanza: cualquier fallo se logea y la
// función retorna, mismo criterio best-effort que impresión/cajón
// (ADR 0007).
async function ejecutarBackup() {
  const rutaDestino = path.join(DIRECTORIO_BACKUPS, formatearNombreArchivo(new Date()));

  try {
    await db.backup(rutaDestino);
    logger.info(`Backup creado: ${rutaDestino}`);
  } catch (error) {
    logger.error(`Error creando backup de la base de datos: ${error.message}`);
    return;
  }

  await limpiarBackupsAntiguos();
}

// Conserva solo los RETENCION_MAXIMA backups más recientes. El formato de
// nombre (pos-backup-AAAA-MM-DD-HHmm.sqlite) ordena alfabéticamente igual
// que cronológicamente, así que un sort() simple basta para saber cuáles
// son los más viejos.
async function limpiarBackupsAntiguos() {
  try {
    const archivos = (await fsp.readdir(DIRECTORIO_BACKUPS))
      .filter((archivo) => archivo.startsWith(PREFIJO_ARCHIVO) && archivo.endsWith('.sqlite'))
      .sort();

    const cantidadASobrar = archivos.length - RETENCION_MAXIMA;
    if (cantidadASobrar <= 0) return;

    for (const archivo of archivos.slice(0, cantidadASobrar)) {
      await fsp.unlink(path.join(DIRECTORIO_BACKUPS, archivo));
      logger.info(`Backup antiguo eliminado por retención (máximo ${RETENCION_MAXIMA}): ${archivo}`);
    }
  } catch (error) {
    logger.error(`Error limpiando backups antiguos: ${error.message}`);
  }
}

// `intervaloMs` es parámetro (no constante interna) a propósito: permite
// probar el intervalo real con un valor corto sin esperar 6 horas ni
// tocar código de producción (ver ADR 0008). Devuelve el handle del
// setInterval para que quien lo llame pueda detenerlo (útil en pruebas).
function iniciarBackupsAutomaticos(intervaloMs = INTERVALO_POR_DEFECTO_MS) {
  ejecutarBackup(); // uno al iniciar, sin esperar el primer intervalo
  return setInterval(ejecutarBackup, intervaloMs);
}

module.exports = {
  ejecutarBackup,
  limpiarBackupsAntiguos,
  iniciarBackupsAutomaticos,
  DIRECTORIO_BACKUPS,
  RETENCION_MAXIMA,
};
