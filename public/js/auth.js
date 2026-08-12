// Sesión: gate de login (reutiliza el mismo patrón overlay que
// overlay-caja-cerrada, ver ADR 0009 y Fase 4/Bloque 1), cambio de
// contraseña obligatorio, logout. Dueño de su propio DOM (badge de
// usuario, botón salir, overlay de login) igual que cart.js es dueño del
// estado del carrito y render.js del resto del DOM.

import { api, ErrorApi, registrarOnSesionExpirada } from './api.js';
import { mostrarToast } from './render.js';

const overlayLogin = document.getElementById('overlay-login');
const tituloOverlayLogin = document.getElementById('titulo-overlay-login');
const textoOverlayLogin = document.getElementById('texto-overlay-login');
const formularioLogin = document.getElementById('formulario-login');
const inputUsuario = document.getElementById('input-usuario');
const inputPassword = document.getElementById('input-password');
const formularioCambiarPassword = document.getElementById('formulario-cambiar-password');
const inputPasswordActual = document.getElementById('input-password-actual');
const inputPasswordNueva = document.getElementById('input-password-nueva');
const badgeUsuario = document.getElementById('badge-usuario');
const botonSalir = document.getElementById('boton-salir');

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

function mostrarPantallaLogin() {
  tituloOverlayLogin.textContent = 'Iniciá sesión';
  textoOverlayLogin.textContent = 'Ingresá tu usuario y contraseña para entrar al mostrador.';
  formularioCambiarPassword.hidden = true;
  formularioLogin.hidden = false;
  overlayLogin.hidden = false;
  inputPassword.value = '';
  inputUsuario.focus();
}

function mostrarPantallaCambiarPassword() {
  tituloOverlayLogin.textContent = 'Definí una contraseña nueva';
  textoOverlayLogin.textContent = 'Por seguridad, tenés que cambiar la contraseña temporal antes de continuar.';
  formularioLogin.hidden = true;
  formularioCambiarPassword.hidden = false;
  overlayLogin.hidden = false;
  inputPasswordActual.value = '';
  inputPasswordNueva.value = '';
  inputPasswordActual.focus();
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
    const usuario = await api.cambiarPassword(inputPasswordActual.value, inputPasswordNueva.value);
    aplicarSesionLista(usuario);
    mostrarToast('Contraseña actualizada');
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
