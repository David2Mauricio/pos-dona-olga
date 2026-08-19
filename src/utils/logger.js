const fs = require('node:fs');
const path = require('node:path');
const env = require('../config/env');

// Anclado a env.raizProyecto, no a process.cwd() (ver ADR 0008, sección
// "Corrección: ruta anclada a DB_PATH" -- mismo defecto, mismo fix).
const DIRECTORIO_LOGS = path.resolve(env.raizProyecto, 'logs');
fs.mkdirSync(DIRECTORIO_LOGS, { recursive: true });

const ARCHIVO_LOG = path.join(DIRECTORIO_LOGS, 'app.log');

function escribir(nivel, mensaje) {
  const linea = `[${new Date().toISOString()}] [${nivel}] ${mensaje}\n`;
  fs.appendFileSync(ARCHIVO_LOG, linea);

  // En desarrollo también mostramos en consola, para no tener que abrir
  // el archivo de logs constantemente mientras se programa.
  if (!env.isProduction) {
    const metodoConsola = nivel === 'ERROR' ? console.error : console.log;
    metodoConsola(linea.trim());
  }
}

module.exports = {
  info: (mensaje) => escribir('INFO', mensaje),
  warn: (mensaje) => escribir('WARN', mensaje),
  error: (mensaje) => escribir('ERROR', mensaje),
};
