const repository = require('../../auth/usuarios.repository');
const authService = require('../../auth/auth.service');
const generarPasswordTemporal = require('../../auth/generar-password-temporal');
const AppError = require('../../utils/app-error');

function traducirErrorSqlite(error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new AppError('Ya existe un usuario con ese nombre de usuario', 409);
  }
  return error;
}

// La contraseña temporal la genera el sistema al azar (ver ADR 0010), no
// quien crea el usuario. Solo existe en texto plano en el momento de esta
// respuesta — nunca se guarda así en ningún lado. Es responsabilidad del
// administrador comunicársela al cajero nuevo.
function crear({ nombre, usuario, rol }) {
  const passwordTemporal = generarPasswordTemporal();
  let creado;

  try {
    creado = repository.crear({
      nombre,
      usuario,
      passwordHash: authService.crearHash(passwordTemporal),
      rol,
      debeCambiarPassword: true,
    });
  } catch (error) {
    throw traducirErrorSqlite(error);
  }

  return { ...authService.exponer(creado), passwordTemporal };
}

function listar() {
  return repository.listar().map(authService.exponer);
}

function obtenerPorId(id) {
  const usuario = repository.obtenerPorId(id);
  if (!usuario) {
    throw new AppError(`No existe un usuario con id ${id}`, 404);
  }
  return usuario;
}

function actualizar(id, cambios) {
  const actual = obtenerPorId(id); // 404 si no existe

  // Salvaguarda: si este cambio dejaría al sistema sin ningún
  // administrador activo, nadie podría volver a gestionar usuarios
  // (habría que tocar la base de datos a mano). No es parte de la
  // instrucción original, pero es la misma lógica de "no permitir un
  // estado sin salida" que ya se aplicó con la sesión única de caja.
  const dejariaDeSerAdminActivo =
    actual.rol === 'administrador' && (cambios.activo === false || (cambios.rol && cambios.rol !== 'administrador'));

  if (dejariaDeSerAdminActivo && repository.contarAdministradoresActivos() <= 1) {
    throw new AppError('No se puede desactivar ni cambiar el rol del único administrador activo', 400);
  }

  const actualizado = repository.actualizar(id, cambios);
  return authService.exponer(actualizado);
}

module.exports = { crear, listar, obtenerPorId, actualizar };
