// Sesión: gate de login (reutiliza el mismo patrón overlay que
// overlay-caja-cerrada, ver ADR 0009 y Fase 4/Bloque 1), cambio de
// contraseña obligatorio, logout. Dueño de su propio DOM (badge de
// usuario, botón salir, overlay de login) igual que cart.js es dueño del
// estado del carrito y render.js del resto del DOM.

import { api, ErrorApi, registrarOnSesionExpirada } from './api.js';
import { mostrarToast } from './render.js';
import { iconoOjo, iconoOjoTachado } from './icons.js';

const overlayLogin = document.getElementById('overlay-login');
const tituloOverlayLogin = document.getElementById('titulo-overlay-login');
const textoOverlayLogin = document.getElementById('texto-overlay-login');
const formularioLogin = document.getElementById('formulario-login');
const inputUsuario = document.getElementById('input-usuario');
const inputPassword = document.getElementById('input-password');
const formularioCambiarPassword = document.getElementById('formulario-cambiar-password');
const inputPasswordActual = document.getElementById('input-password-actual');
const inputPasswordNueva = document.getElementById('input-password-nueva');
const campoPreguntaSeguridad = document.getElementById('campo-pregunta-seguridad');
const inputPreguntaSeguridad = document.getElementById('input-pregunta-seguridad');
const campoRespuestaSeguridad = document.getElementById('campo-respuesta-seguridad');
const inputRespuestaSeguridad = document.getElementById('input-respuesta-seguridad');
const badgeUsuario = document.getElementById('badge-usuario');
const botonSalir = document.getElementById('boton-salir');

const enlaceOlvidePassword = document.getElementById('enlace-olvide-password');
const formularioRecuperarPassword = document.getElementById('formulario-recuperar-password');
const preguntaRecuperarPassword = document.getElementById('pregunta-recuperar-password');
const inputRecuperarRespuesta = document.getElementById('input-recuperar-respuesta');
const inputRecuperarPasswordNueva = document.getElementById('input-recuperar-password-nueva');
const botonVolverALogin = document.getElementById('boton-volver-a-login');

// Ojo de contraseña: un botón por campo (data-target apunta al id del
// input), genérico para los tres campos de contraseña que existen hoy —
// alterna type="password"/"text" del input al que apunta, nada de
// backend involucrado.
document.querySelectorAll('.campo__boton-ojo').forEach((boton) => {
  const input = document.getElementById(boton.dataset.target);
  boton.innerHTML = iconoOjo;
  boton.addEventListener('click', () => {
    const mostrando = input.type === 'text';
    input.type = mostrando ? 'password' : 'text';
    boton.innerHTML = mostrando ? iconoOjo : iconoOjoTachado;
    boton.setAttribute('aria-label', mostrando ? 'Mostrar contraseña' : 'Ocultar contraseña');
    boton.setAttribute('aria-pressed', String(!mostrando));
  });
});

let usuarioActual = null;
let usuarioPendienteDeCambioPassword = null; // guarda el usuario/id entre el login y el cambio obligatorio
let alListoCallback = null;
let alCerrarSesionCallback = null;

export function obtenerUsuarioActual() {
  return usuarioActual;
}

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo conectar con el servidor. Verificá que esté corriendo.';
}

function mostrarPantallaLogin(usuarioPrellenado) {
  tituloOverlayLogin.textContent = 'Iniciá sesión';
  textoOverlayLogin.textContent = 'Ingresá tu usuario y contraseña para entrar al mostrador.';
  formularioCambiarPassword.hidden = true;
  formularioRecuperarPassword.hidden = true;
  formularioLogin.hidden = false;
  overlayLogin.hidden = false;
  if (usuarioPrellenado) inputUsuario.value = usuarioPrellenado;
  inputPassword.value = '';
  inputUsuario.focus();
}

// El admin sin pregunta configurada todavía tiene que definirla acá
// mismo, autoservicio (ver ADR de cierre del proyecto) — nadie más que
// ella la ve. Un cajero, o un admin que ya la tiene, no ve estos campos.
function actualizarCamposPreguntaSeguridad() {
  const usuario = usuarioPendienteDeCambioPassword;
  const debeConfigurarla = usuario?.rol === 'administrador' && !usuario?.tienePreguntaSeguridad;
  campoPreguntaSeguridad.hidden = !debeConfigurarla;
  campoRespuestaSeguridad.hidden = !debeConfigurarla;
  inputPreguntaSeguridad.required = debeConfigurarla;
  inputRespuestaSeguridad.required = debeConfigurarla;
  inputPreguntaSeguridad.value = '';
  inputRespuestaSeguridad.value = '';
}

function mostrarPantallaCambiarPassword() {
  tituloOverlayLogin.textContent = 'Definí una contraseña nueva';
  textoOverlayLogin.textContent = 'Por seguridad, tenés que cambiar la contraseña temporal antes de continuar.';
  formularioLogin.hidden = true;
  formularioRecuperarPassword.hidden = true;
  formularioCambiarPassword.hidden = false;
  overlayLogin.hidden = false;
  inputPasswordActual.value = '';
  inputPasswordNueva.value = '';
  actualizarCamposPreguntaSeguridad();
  inputPasswordActual.focus();
}

function mostrarPantallaRecuperarPassword(pregunta) {
  tituloOverlayLogin.textContent = 'Recuperar acceso';
  textoOverlayLogin.textContent = '';
  formularioLogin.hidden = true;
  formularioCambiarPassword.hidden = true;
  formularioRecuperarPassword.hidden = false;
  overlayLogin.hidden = false;
  preguntaRecuperarPassword.textContent = pregunta;
  inputRecuperarRespuesta.value = '';
  inputRecuperarPasswordNueva.value = '';
  inputRecuperarRespuesta.focus();
}

function aplicarSesionLista(usuario) {
  usuarioActual = usuario;
  usuarioPendienteDeCambioPassword = null;
  overlayLogin.hidden = true;
  badgeUsuario.textContent = `${usuario.nombre} · ${usuario.rol === 'administrador' ? 'Administrador' : 'Cajero'}`;
  botonSalir.hidden = false;
  alListoCallback?.(usuario);
}

function cerrarSesionLocal() {
  usuarioActual = null;
  usuarioPendienteDeCambioPassword = null;
  badgeUsuario.textContent = '';
  botonSalir.hidden = true;
  alCerrarSesionCallback?.();
  mostrarPantallaLogin();
}

formularioLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = formularioLogin.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const usuario = await api.login(inputUsuario.value.trim(), inputPassword.value);
    if (usuario.debeCambiarPassword) {
      usuarioPendienteDeCambioPassword = usuario;
      mostrarPantallaCambiarPassword();
    } else {
      aplicarSesionLista(usuario);
    }
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

formularioCambiarPassword.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = formularioCambiarPassword.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const usuario = await api.cambiarPassword(
      inputPasswordActual.value,
      inputPasswordNueva.value,
      campoPreguntaSeguridad.hidden ? null : inputPreguntaSeguridad.value.trim(),
      campoRespuestaSeguridad.hidden ? null : inputRespuestaSeguridad.value.trim()
    );
    aplicarSesionLista(usuario);
    mostrarToast('Contraseña actualizada');
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

// "Olvidé mi contraseña" aparece/desaparece al perder el foco del campo
// usuario, no en cada tecla — solo si ESE usuario tiene una pregunta
// configurada (ver ADR de cierre: es autoservicio, solo para
// administradores). peticionOpcional en api.js ya resuelve "no tiene
// pregunta" como null, no como error.
inputUsuario.addEventListener('blur', async () => {
  const nombreUsuario = inputUsuario.value.trim();
  if (!nombreUsuario) {
    enlaceOlvidePassword.hidden = true;
    return;
  }
  try {
    const resultado = await api.obtenerPreguntaSeguridad(nombreUsuario);
    enlaceOlvidePassword.hidden = !resultado;
  } catch (error) {
    // Rate-limited u otro error real: no mostrar el enlace, pero tampoco
    // interrumpir al usuario con un toast por algo que todavía no pidió.
    enlaceOlvidePassword.hidden = true;
  }
});

enlaceOlvidePassword.addEventListener('click', async () => {
  const nombreUsuario = inputUsuario.value.trim();
  enlaceOlvidePassword.disabled = true;
  try {
    const resultado = await api.obtenerPreguntaSeguridad(nombreUsuario);
    if (!resultado) {
      mostrarToast('No hay recuperación por pregunta de seguridad disponible para este usuario.', 'error');
      return;
    }
    formularioRecuperarPassword.dataset.usuario = nombreUsuario;
    mostrarPantallaRecuperarPassword(resultado.pregunta);
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    enlaceOlvidePassword.disabled = false;
  }
});

botonVolverALogin.addEventListener('click', () => {
  mostrarPantallaLogin(formularioRecuperarPassword.dataset.usuario);
});

formularioRecuperarPassword.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = formularioRecuperarPassword.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    await api.recuperarPassword(
      formularioRecuperarPassword.dataset.usuario,
      inputRecuperarRespuesta.value,
      inputRecuperarPasswordNueva.value
    );
    mostrarToast('Contraseña actualizada. Iniciá sesión con tu contraseña nueva.');
    mostrarPantallaLogin(formularioRecuperarPassword.dataset.usuario);
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

botonSalir.addEventListener('click', async () => {
  botonSalir.disabled = true;
  try {
    await api.logout();
  } catch (error) {
    // Si logout falla (ej. red caída a mitad de camino) igual limpiamos
    // la sesión local: quedarse "logueado" en la UI sin poder confirmarlo
    // contra el servidor es peor que forzar un nuevo login.
  } finally {
    botonSalir.disabled = false;
    cerrarSesionLocal();
  }
});

// api.js dispara esto ante CUALQUIER 401 SIN_SESION de CUALQUIER módulo —
// cubre la sesión que vence a mitad de una venta, no solo la carga inicial.
registrarOnSesionExpirada(() => {
  if (!usuarioActual) return; // ya estábamos en la pantalla de login, nada que hacer
  cerrarSesionLocal();
});

// alListo(usuario): se llama una vez que hay una sesión lista para usar
// (carga inicial exitosa, o justo después de loguear/cambiar contraseña).
// alCerrarSesion(): se llama al cerrar sesión (manual o por expiración) para
// que quien orquesta el resto de la app (main.js) resetee su propio estado.
export async function iniciarAuth({ alListo, alCerrarSesion }) {
  alListoCallback = alListo;
  alCerrarSesionCallback = alCerrarSesion;

  try {
    const usuario = await api.obtenerSesion();
    if (usuario.debeCambiarPassword) {
      usuarioPendienteDeCambioPassword = usuario;
      mostrarPantallaCambiarPassword();
    } else {
      aplicarSesionLista(usuario);
    }
  } catch (error) {
    if (error instanceof ErrorApi && error.codigo === 'SIN_SESION') {
      mostrarPantallaLogin();
    } else {
      // Error de red real (el servidor no respondió) — no es lo mismo que
      // "no hay sesión", así que no tiene sentido mostrar el formulario de
      // login como si el problema fuera la contraseña.
      mostrarToast(mensajeDeError(error), 'error');
    }
  }
}
