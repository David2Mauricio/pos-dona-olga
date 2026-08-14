// Script de emergencia: resetea la contraseña de un usuario existente
// directamente en la base de datos, sin necesitar estar logueado como
// administrador (a diferencia del reseteo desde la sección Usuarios de la
// interfaz, que sí lo requiere — ver docs/primer-arranque.md). Cubre el
// caso que ese camino no cubre: el único administrador activo se queda
// sin poder loguearse.
//
// A diferencia de seed-admin.js, este SÍ opera sobre un usuario
// existente — no crea ni borra nada, solo cambia password_hash y fuerza
// debe_cambiar_password=1 (mismo criterio que usuarios.repository.js:
// resetearPassword, el que ya usa la sección Usuarios de la interfaz).
//
// El gate de seguridad acá es "quien puede ejecutar código en este
// servidor", no una contraseña más — por diseño, requiere acceso directo
// a la máquina (nunca HTTP, nunca Postman).
//
// Uso: node src/auth/emergencia-resetear-password.js <usuario>
//   o: npm run emergencia:resetear-password -- <usuario>

const repository = require('./usuarios.repository');
const authService = require('./auth.service');
const generarPasswordTemporal = require('./generar-password-temporal');
const logger = require('../utils/logger');

function correr(nombreUsuario) {
  if (!nombreUsuario) {
    console.error('Uso: node src/auth/emergencia-resetear-password.js <usuario>');
    process.exitCode = 1;
    return;
  }

  const usuario = repository.obtenerPorUsuario(nombreUsuario);
  if (!usuario) {
    console.error(`No existe ningún usuario con el nombre de usuario "${nombreUsuario}".`);
    process.exitCode = 1;
    return;
  }

  const passwordTemporal = generarPasswordTemporal();
  repository.resetearPassword(usuario.id, authService.crearHash(passwordTemporal));

  logger.info(`Contraseña reseteada de emergencia para "${nombreUsuario}" (id ${usuario.id}, rol ${usuario.rol})`);

  console.log('');
  console.log('========================================');
  console.log('  Contraseña reseteada');
  console.log('========================================');
  console.log(`  Usuario:    ${usuario.usuario}`);
  console.log(`  Rol:        ${usuario.rol}`);
  console.log(`  Contraseña: ${passwordTemporal}`);
  console.log('========================================');
  console.log('  Guardala ahora — no se vuelve a mostrar.');
  console.log('  El sistema va a pedir cambiarla en el próximo ingreso.');
  console.log('========================================');
  console.log('');
}

if (require.main === module) {
  correr(process.argv[2]);
}

module.exports = { correr };
