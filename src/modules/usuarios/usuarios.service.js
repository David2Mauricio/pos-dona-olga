const db = require('../../config/database');
const repository = require('../../auth/usuarios.repository');
const authService = require('../../auth/auth.service');
const generarPasswordTemporal = require('../../auth/generar-password-temporal');
const AppError = require('../../utils/app-error');
const { registrarAuditoria } = require('../auditoria/auditoria.service');

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
function crear({ nombre, usuario, rol }, usuarioIdActor) {
  const passwordTemporal = generarPasswordTemporal();
  let creado;

  try {
    creado = db.transaction(() => {
      const filaCreada = repository.crear({
        nombre,
        usuario,
        passwordHash: authService.crearHash(passwordTemporal),
        rol,
        debeCambiarPassword: true,
      });
      registrarAuditoria({
        usuarioId: usuarioIdActor,
        accion: 'alta_usuario',
        entidadTipo: 'usuario',
        entidadId: filaCreada.id,
        detalle: { nombre: filaCreada.nombre, usuario: filaCreada.usuario, rol: filaCreada.rol },
      });
      return filaCreada;
    })();
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

function actualizar(id, cambios, usuarioIdActor) {
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

  // ADR 0018: baja/reactivación y cambio de rol quedan auditados como
  // acciones separadas si ambas ocurren en el mismo PATCH (caso raro pero
  // posible) — cada una es sensible por su cuenta, no hay motivo para
  // fusionarlas en una sola entrada.
  const actualizarTransaccional = db.transaction(() => {
    const actualizado = repository.actualizar(id, cambios);

    if (cambios.activo === false && actual.activo !== false) {
      registrarAuditoria({
        usuarioId: usuarioIdActor,
        accion: 'baja_usuario',
        entidadTipo: 'usuario',
        entidadId: id,
        detalle: { nombre: actual.nombre, usuario: actual.usuario },
      });
    } else if (cambios.activo === true && actual.activo === false) {
      registrarAuditoria({
        usuarioId: usuarioIdActor,
        accion: 'alta_usuario',
        entidadTipo: 'usuario',
        entidadId: id,
        detalle: { nombre: actual.nombre, usuario: actual.usuario, rol: actualizado.rol, via: 'reactivacion' },
      });
    }

    if (cambios.rol && cambios.rol !== actual.rol) {
      registrarAuditoria({
        usuarioId: usuarioIdActor,
        accion: 'cambio_rol_usuario',
        entidadTipo: 'usuario',
        entidadId: id,
        detalle: { nombre: actual.nombre, usuario: actual.usuario, rolAnterior: actual.rol, rolNuevo: cambios.rol },
      });
    }

    return actualizado;
  });

  const actualizado = actualizarTransaccional();
  return authService.exponer(actualizado);
}

// Fase 4 (ver ADR 0013): mismo criterio que crear() — la contraseña
// temporal siempre la genera el sistema al azar, nunca se recibe del
// administrador que resetea. Fuerza debeCambiarPassword:true (a
// diferencia del cambio de contraseña por autoservicio, que lo apaga).
function resetearPassword(id, usuarioIdActor) {
  const objetivo = obtenerPorId(id); // 404 si no existe

  const passwordTemporal = generarPasswordTemporal();
  const actualizado = db.transaction(() => {
    const fila = repository.resetearPassword(id, authService.crearHash(passwordTemporal));
    registrarAuditoria({
      usuarioId: usuarioIdActor,
      accion: 'reseteo_password',
      entidadTipo: 'usuario',
      entidadId: id,
      detalle: { nombre: objetivo.nombre, usuario: objetivo.usuario, via: 'admin' },
    });
    return fila;
  })();
  return { ...authService.exponer(actualizado), passwordTemporal };
}

// Borrado real (ver extensión al ADR 0010): a diferencia de baja_usuario
// (desactivar, reversible), esto saca la fila de la tabla — solo permitido
// si el usuario nunca tuvo actividad real (ver
// usuarios.repository.js:tieneActividad, que consulta las cuatro tablas
// con FK usuario_id -> usuarios ON DELETE RESTRICT). Si tiene actividad,
// el 409 explícito de acá siempre dispara antes que el motor rechace el
// DELETE por su cuenta -- la FK sigue ahí como segunda capa, no como la
// única.
function borrar(id, usuarioIdActor) {
  const usuario = obtenerPorId(id); // 404 si no existe

  if (String(id) === String(usuarioIdActor)) {
    throw new AppError('No podés eliminar tu propio usuario mientras tenés la sesión activa', 400);
  }

  // Misma salvaguarda que actualizar(): no dejar el sistema sin ningún
  // administrador activo.
  if (usuario.rol === 'administrador' && usuario.activo && repository.contarAdministradoresActivos() <= 1) {
    throw new AppError('No se puede eliminar el único administrador activo', 400);
  }

  if (repository.tieneActividad(id)) {
    throw new AppError(
      `El usuario "${usuario.nombre}" tiene actividad registrada en el sistema y no se puede eliminar. Desactivalo en su lugar (PATCH /api/usuarios/${id} con activo:false).`,
      409
    );
  }

  db.transaction(() => {
    repository.borrar(id);
    registrarAuditoria({
      usuarioId: usuarioIdActor,
      accion: 'eliminacion_usuario',
      entidadTipo: 'usuario',
      entidadId: id,
      detalle: { nombre: usuario.nombre, usuario: usuario.usuario, rol: usuario.rol },
    });
  })();
}

module.exports = { crear, listar, obtenerPorId, actualizar, resetearPassword, borrar };
