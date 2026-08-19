const bcrypt = require('bcryptjs');
const db = require('../config/database');
const repository = require('./usuarios.repository');
const AppError = require('../utils/app-error');
const { registrarAuditoria } = require('../modules/auditoria/auditoria.service');

const RONDAS_SAL = 10;
const MAX_INTENTOS_FALLIDOS = 5;
const VENTANA_BLOQUEO_MS = 15 * 60 * 1000;

// Rate limiting en memoria del proceso (ver ADR 0010): un Map por
// usuario con las marcas de tiempo de sus intentos fallidos recientes.
// Se reinicia si el proceso se reinicia — aceptable para un POS de un
// solo punto de venta que no tiene un atacante externo real al que
// defender (sin exposición a internet).
const intentosFallidosPorUsuario = new Map();

function intentosRecientes(usuario) {
  const ahora = Date.now();
  const previos = intentosFallidosPorUsuario.get(usuario) || [];
  const vigentes = previos.filter((marca) => ahora - marca < VENTANA_BLOQUEO_MS);
  intentosFallidosPorUsuario.set(usuario, vigentes);
  return vigentes;
}

function registrarIntentoFallido(usuario) {
  const vigentes = intentosRecientes(usuario);
  vigentes.push(Date.now());
  intentosFallidosPorUsuario.set(usuario, vigentes);
}

function estaBloqueado(usuario) {
  return intentosRecientes(usuario).length >= MAX_INTENTOS_FALLIDOS;
}

function limpiarIntentos(usuario) {
  intentosFallidosPorUsuario.delete(usuario);
}

// Forma segura de exponer un usuario: nunca el hash. Es la única función
// que decide qué campos salen de este módulo hacia la sesión/HTTP.
function exponer(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    usuario: usuario.usuario,
    rol: usuario.rol,
    debeCambiarPassword: usuario.debeCambiarPassword,
    activo: usuario.activo,
    // Nunca la pregunta ni el hash de la respuesta acá — solo si existe,
    // para que el frontend sepa si tiene que pedirla (ver
    // cambiarPassword). La pregunta en sí se expone aparte, en
    // obtenerPreguntaSeguridad, que es pública mientras que esto viaja
    // en la sesión de un usuario ya logueado.
    tienePreguntaSeguridad: Boolean(usuario.preguntaSeguridad),
  };
}

function login(usuarioTexto, password) {
  if (estaBloqueado(usuarioTexto)) {
    throw new AppError(
      'Demasiados intentos fallidos. Esperá 15 minutos antes de volver a intentar.',
      429,
      'RATE_LIMITED'
    );
  }

  const usuario = repository.obtenerPorUsuario(usuarioTexto);

  // Mismo mensaje genérico exista o no el usuario, y sin importar si lo
  // que falló fue el usuario o la contraseña — no darle a quien intenta
  // entrar pistas de qué usuarios existen en el sistema.
  if (!usuario || !usuario.activo || !bcrypt.compareSync(password, usuario.passwordHash)) {
    registrarIntentoFallido(usuarioTexto);
    throw new AppError('Usuario o contraseña incorrectos', 401, 'CREDENCIALES_INVALIDAS');
  }

  limpiarIntentos(usuarioTexto);
  return exponer(usuario);
}

// pregunta/respuesta son opcionales EXCEPTO para un administrador que
// todavía no tiene una configurada (ver ADR de cierre del proyecto): se
// pide en el primer cambio de contraseña obligatorio, autoservicio, para
// que nadie más que la propia persona la vea. Si ya la tiene, mandarlas
// de nuevo la redefine — no hace falta una pantalla de edición aparte.
function cambiarPassword(usuarioId, passwordActual, passwordNueva, pregunta, respuesta) {
  const usuario = repository.obtenerPorId(usuarioId);
  if (!usuario) {
    throw new AppError('Usuario no encontrado', 404);
  }

  if (!bcrypt.compareSync(passwordActual, usuario.passwordHash)) {
    throw new AppError('La contraseña actual no es correcta', 400);
  }

  if (usuario.rol === 'administrador' && !usuario.preguntaSeguridad && !(pregunta && respuesta)) {
    throw new AppError(
      'Como administrador, definí una pregunta de seguridad y su respuesta al cambiar la contraseña.',
      400
    );
  }

  const nuevoHash = bcrypt.hashSync(passwordNueva, RONDAS_SAL);
  repository.actualizarPassword(usuarioId, nuevoHash);

  const actualizado =
    pregunta && respuesta
      ? repository.establecerPreguntaSeguridad(usuarioId, pregunta, bcrypt.hashSync(respuesta, RONDAS_SAL))
      : repository.obtenerPorId(usuarioId);

  return exponer(actualizado);
}

function crearHash(password) {
  return bcrypt.hashSync(password, RONDAS_SAL);
}

// Pública a propósito (sin sesión, ver auth.routes.js): es el primer paso
// de "olvidé mi contraseña". Un solo mensaje/404 para las cuatro causas
// posibles (no existe, inactivo, no es administrador, no tiene pregunta
// configurada) — no darle a quien pregunta pistas de cuál fue. Consulta
// el mismo contador de rate-limit que login/recuperarPassword pero sin
// incrementarlo: preguntar si existe una pregunta no es un intento de
// adivinar nada.
function obtenerPreguntaSeguridad(usuarioTexto) {
  if (estaBloqueado(usuarioTexto)) {
    throw new AppError(
      'Demasiados intentos fallidos. Esperá 15 minutos antes de volver a intentar.',
      429,
      'RATE_LIMITED'
    );
  }

  const usuario = repository.obtenerPorUsuario(usuarioTexto);
  if (!usuario || !usuario.activo || usuario.rol !== 'administrador' || !usuario.preguntaSeguridad) {
    throw new AppError('No hay recuperación por pregunta de seguridad disponible para este usuario.', 404);
  }

  return { pregunta: usuario.preguntaSeguridad };
}

// Segundo paso de "olvidé mi contraseña": compara la respuesta contra el
// hash guardado y, si coincide, define la contraseña nueva ahí mismo. Sin
// auto-login a propósito (ver ADR de cierre) — confirma y la persona
// entra de nuevo por el login normal, ya con su contraseña nueva.
function recuperarPassword(usuarioTexto, respuesta, passwordNueva) {
  if (estaBloqueado(usuarioTexto)) {
    throw new AppError(
      'Demasiados intentos fallidos. Esperá 15 minutos antes de volver a intentar.',
      429,
      'RATE_LIMITED'
    );
  }

  const usuario = repository.obtenerPorUsuario(usuarioTexto);

  // Mismo criterio que login: un solo mensaje genérico sin importar cuál
  // de las condiciones falló, para no revelar de más.
  if (
    !usuario ||
    !usuario.activo ||
    usuario.rol !== 'administrador' ||
    !usuario.respuestaSeguridadHash ||
    !bcrypt.compareSync(respuesta, usuario.respuestaSeguridadHash)
  ) {
    registrarIntentoFallido(usuarioTexto);
    throw new AppError('Usuario o respuesta incorrectos', 401, 'RESPUESTA_INVALIDA');
  }

  limpiarIntentos(usuarioTexto);
  const nuevoHash = bcrypt.hashSync(passwordNueva, RONDAS_SAL);

  db.transaction(() => {
    repository.actualizarPassword(usuario.id, nuevoHash);
    registrarAuditoria({
      usuarioId: usuario.id,
      accion: 'reseteo_password',
      entidadTipo: 'usuario',
      entidadId: usuario.id,
      detalle: { nombre: usuario.nombre, usuario: usuario.usuario, via: 'autoservicio' },
    });
  })();
}

module.exports = {
  login,
  cambiarPassword,
  exponer,
  crearHash,
  obtenerPreguntaSeguridad,
  recuperarPassword,
};
