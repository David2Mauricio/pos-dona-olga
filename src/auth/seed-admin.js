// Script de un solo uso: crea el administrador inicial con una
// contraseña temporal generada al azar, mostrada por consola UNA vez.
// Nunca queda hardcodeada en el código ni en el repositorio — ver
// ADR 0010. Se niega a correr si ya existe un administrador activo,
// para no pisar la cuenta real por accidente si alguien lo vuelve a
// correr sin querer.
//
// Uso: npm run seed:admin

const repository = require('./usuarios.repository');
const authService = require('./auth.service');
const generarPasswordTemporal = require('./generar-password-temporal');
const logger = require('../utils/logger');

function correr() {
  if (repository.contarAdministradoresActivos() > 0) {
    console.error('Ya existe al menos un administrador activo. No se creó ninguno nuevo.');
    console.error(
      'Este script no reinicia contraseñas de usuarios existentes (no está en el alcance actual) — ' +
        'solo crea el administrador inicial la primera vez.'
    );
    process.exitCode = 1;
    return;
  }

  const passwordTemporal = generarPasswordTemporal();
  const usuario = repository.crear({
    nombre: 'Administrador',
    usuario: 'admin',
    passwordHash: authService.crearHash(passwordTemporal),
    rol: 'administrador',
    debeCambiarPassword: true,
  });

  logger.info(`Usuario administrador inicial creado (id ${usuario.id})`);

  console.log('');
  console.log('========================================');
  console.log('  Administrador inicial creado');
  console.log('========================================');
  console.log(`  Usuario:    ${usuario.usuario}`);
  console.log(`  Contraseña: ${passwordTemporal}`);
  console.log('========================================');
  console.log('  Guardá esta contraseña ahora — no se puede volver a mostrar.');
  console.log('  El sistema va a pedir cambiarla en el primer ingreso.');
  console.log('========================================');
  console.log('');
}

if (require.main === module) {
  correr();
}

module.exports = { correr };
