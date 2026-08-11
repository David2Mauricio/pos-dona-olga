const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/database');
const logger = require('../utils/logger');

const DIRECTORIO_MIGRACIONES = path.resolve(__dirname, '../../migrations');

function asegurarTablaDeControl() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_archivo TEXT NOT NULL UNIQUE,
      aplicada_en TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function obtenerMigracionesAplicadas() {
  const filas = db.prepare('SELECT nombre_archivo FROM schema_migrations').all();
  return new Set(filas.map((fila) => fila.nombre_archivo));
}

function obtenerArchivosDeMigracion() {
  if (!fs.existsSync(DIRECTORIO_MIGRACIONES)) return [];

  // Los archivos se nombran 001_algo.sql, 002_algo.sql... el orden
  // alfabético coincide con el orden en que deben aplicarse.
  return fs
    .readdirSync(DIRECTORIO_MIGRACIONES)
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort();
}

function ejecutarMigracionesPendientes() {
  asegurarTablaDeControl();

  const aplicadas = obtenerMigracionesAplicadas();
  const pendientes = obtenerArchivosDeMigracion().filter((archivo) => !aplicadas.has(archivo));

  if (pendientes.length === 0) {
    logger.info('No hay migraciones pendientes.');
    return;
  }

  for (const archivo of pendientes) {
    const sql = fs.readFileSync(path.join(DIRECTORIO_MIGRACIONES, archivo), 'utf8');

    // Cada migración corre en su propia transacción: si falla a mitad de
    // camino, no queremos dejar el esquema en un estado intermedio.
    const aplicarMigracion = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (nombre_archivo) VALUES (?)').run(archivo);
    });

    try {
      aplicarMigracion();
      logger.info(`Migración aplicada: ${archivo}`);
    } catch (error) {
      logger.error(`Error aplicando migración ${archivo}: ${error.message}`);
      throw error;
    }
  }
}

// Permite ejecutar el runner directo con `npm run migrate`, además de
// importarlo desde server.js para migrar automáticamente al arrancar.
if (require.main === module) {
  ejecutarMigracionesPendientes();
}

module.exports = { ejecutarMigracionesPendientes };
