const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const env = require('./env');

// Nos aseguramos de que exista la carpeta del archivo .sqlite (ej. ./data)
// antes de que better-sqlite3 intente crearlo.
fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });

const db = new Database(env.dbPath);

// WAL (Write-Ahead Logging): el equipo del negocio no tiene UPS, así que
// priorizamos que un corte de luz a mitad de una escritura no deje la base
// de datos corrupta. WAL además permite seguir leyendo mientras se escribe.
db.pragma('journal_mode = WAL');

// SQLite no valida llaves foráneas por defecto; las activamos porque el
// modelo depende de ellas (ventas -> productos, ventas -> clientes, etc.)
db.pragma('foreign_keys = ON');

module.exports = db;
