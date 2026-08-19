// Script de UN SOLO USO, para el día de instalación real -- ver README.md
// y docs/primer-arranque.md. Vacía todas las tablas de negocio (nunca la
// estructura) para que el sistema arranque desde cero con el catálogo y
// las ventas reales del negocio, sin ningún residuo de desarrollo o de
// pruebas. Preserva la tabla `usuarios` intacta (el/los administrador/es
// existentes siguen pudiendo loguearse después de correr esto).
//
// NUNCA correr esto después de que el negocio tenga datos reales cargados
// -- borra ventas, caja, inventario y catálogo sin posibilidad de deshacer
// más allá del backup de seguridad que este mismo script crea antes de
// borrar nada.
//
// Deliberadamente fuera del alcance: `gastos` y `auditoria`. `auditoria`
// es un registro inmutable por diseño (ver ADR 0018) -- un script de
// limpieza no es una excepción a esa regla. `gastos` no se pidió en el
// alcance original; si hace falta vaciarla también, es una decisión
// aparte, no algo que este script asuma.
//
// Uso: npm run limpiar-datos-prueba
// Pide escribir "CONFIRMAR" por stdin antes de tocar nada -- a propósito
// no acepta un flag para saltarse esto (ej. --si), para que no pueda
// correr sin que un humano vea el aviso al menos una vez.

const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const db = require('./src/config/database');
// Reutiliza el mismo DIRECTORIO_BACKUPS que el backup automático (ver ADR
// 0008): anclado a la ubicación real de la base de datos que este script
// está tocando, no a env.raizProyecto -- si no, un backup de seguridad
// contra una base de prueba terminaría escrito en la carpeta de backups
// del proyecto real en vez de junto a la base que de verdad se está
// limpiando.
const { DIRECTORIO_BACKUPS } = require('./src/backup/backup.service');

const PALABRA_CONFIRMACION = 'CONFIRMAR';

// Orden que respeta las FK con ON DELETE RESTRICT (ver PRAGMA
// foreign_key_list de cada tabla): los movimientos y lotes van antes que
// los productos a los que apuntan; las ventas van antes que la caja que
// las contiene (ventas_items se borra solo, tiene ON DELETE CASCADE hacia
// ventas); productos va antes que categorías; proveedores al final,
// porque movimientos_inventario.proveedor_id también apunta ahí.
const TABLAS_EN_ORDEN = [
  'movimientos_inventario',
  'lotes_vencimiento',
  'ventas', // ventas_items se borra en cascada
  'caja_sesiones',
  'productos',
  'categorias',
  'proveedores',
];

async function confirmar() {
  console.log('');
  console.log('=== LIMPIEZA DE DATOS DE PRUEBA -- OPERACIÓN DESTRUCTIVA ===');
  console.log('');
  console.log('Esto borra TODO el contenido de estas tablas (nunca su estructura):');
  console.log(`  ${TABLAS_EN_ORDEN.join(', ')}`);
  console.log('');
  console.log('NO se toca: usuarios (el/los administrador/es siguen existiendo),');
  console.log('gastos, auditoria (registro inmutable, ver ADR 0018).');
  console.log('');
  console.log('Se crea un backup de seguridad ANTES de borrar nada.');
  console.log('');
  console.log('Correr esto es para el día de instalación real, UNA SOLA VEZ.');
  console.log('Nunca lo corras si el negocio ya tiene ventas o catálogo reales cargados.');
  console.log('');

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const respuesta = await rl.question(`Escribí "${PALABRA_CONFIRMACION}" para continuar (cualquier otra cosa cancela): `);
  rl.close();

  return respuesta.trim() === PALABRA_CONFIRMACION;
}

async function main() {
  const listo = await confirmar();
  if (!listo) {
    console.log('\nCancelado. No se tocó ningún dato.');
    process.exit(0);
  }

  const rutaBackup = path.join(DIRECTORIO_BACKUPS, `pre-limpieza-instalacion-${Date.now()}.sqlite`);
  await db.backup(rutaBackup);
  console.log(`\nBackup de seguridad creado: ${rutaBackup}`);

  const conteos = {};
  const transaccion = db.transaction(() => {
    for (const tabla of TABLAS_EN_ORDEN) {
      const resultado = db.prepare(`DELETE FROM ${tabla}`).run();
      conteos[tabla] = resultado.changes;
    }
  });
  transaccion();

  console.log('\nFilas borradas por tabla:');
  for (const tabla of TABLAS_EN_ORDEN) {
    console.log(`  ${tabla}: ${conteos[tabla]}`);
  }

  const cantidadUsuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
  console.log(`\nusuarios preservados: ${cantidadUsuarios}`);
  console.log('\nLimpieza completa. El sistema queda listo para cargar el catálogo real.');
}

main().catch((error) => {
  console.error('\nERROR: la limpieza no se completó.', error);
  process.exit(1);
});
