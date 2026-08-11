const bcrypt = require('bcryptjs');
const repository = require('./usuarios.repository');
const AppError = require('../utils/app-error');

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

function cambiarPassword(usuarioId, passwordActual, passwordNueva) {
  const usuario = repository.obtenerPorId(usuarioId);
  if (!usuario) {
    throw new AppError('Usuario no encontrado', 404);
  }

  if (!bcrypt.compareSync(passwordActual, usuario.passwordHash)) {
    throw new AppError('La contraseña actual no es correcta', 400);
  }

  const nuevoHash = bcrypt.hashSync(passwordNueva, RONDAS_SAL);
  const actualizado = repository.actualizarPassword(usuarioId, nuevoHash);
  return exponer(actualizado);
}

function crearHash(password) {
  return bcrypt.hashSync(password, RONDAS_SAL);
}

module.exports = { login, cambiarPassword, exponer, crearHash };
