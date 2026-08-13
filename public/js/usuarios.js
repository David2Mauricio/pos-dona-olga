// Gestión de usuarios (Fase 4, ver ADR 0013). Mismo patrón que
// catalogo.js/historial.js: módulo autocontenido, propio DOM, propias
// llamadas. Módulo entero solo-administrador en el backend (app.js monta
// /api/usuarios con requiereRol('administrador')) — la sección queda
// oculta para cajero en la sidebar (main.js), pero eso es ayuda de UI, no
// la protección real.
//
// La contraseña temporal (alta o reseteo) se muestra en un overlay propio
// que hay que cerrar a mano — no en el toast de 3.5s, que no da tiempo
// real a copiarla.

import { api, ErrorApi } from './api.js';
import { mostrarToast } from './render.js';

const tablaUsuarios = document.getElementById('tabla-usuarios');
const botonNuevoUsuario = document.getElementById('boton-nuevo-usuario');

const overlayFormUsuario = document.getElementById('overlay-form-usuario');
const formularioUsuario = document.getElementById('formulario-usuario');
const inputUsuarioNombre = document.getElementById('input-usuario-nombre');
const inputUsuarioUsuario = document.getElementById('input-usuario-usuario');
const inputUsuarioRol = document.getElementById('input-usuario-rol');
const botonCancelarUsuario = document.getElementById('boton-cancelar-usuario');

const overlayPasswordTemporal = document.getElementById('overlay-password-temporal');
const valorPasswordTemporal = document.getElementById('valor-password-temporal');
const botonCerrarPasswordTemporal = document.getElementById('boton-cerrar-password-temporal');

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

function mostrarPasswordTemporal(passwordTemporal) {
  valorPasswordTemporal.textContent = passwordTemporal;
  overlayPasswordTemporal.hidden = false;
}

botonCerrarPasswordTemporal.addEventListener('click', () => {
  overlayPasswordTemporal.hidden = true;
  valorPasswordTemporal.textContent = '';
});

// --- Listado ---

async function cargarUsuarios() {
  tablaUsuarios.innerHTML = '';
  const cargando = document.createElement('p');
  cargando.className = 'catalogo__vacio';
  cargando.textContent = 'Cargando…';
  tablaUsuarios.appendChild(cargando);

  try {
    const usuarios = await api.listarUsuarios();
    renderizarUsuarios(usuarios);
  } catch (error) {
    tablaUsuarios.innerHTML = '';
    mostrarToast(mensajeDeError(error), 'error');
  }
}

function renderizarUsuarios(usuarios) {
  tablaUsuarios.innerHTML = '';

  if (usuarios.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'catalogo__vacio';
    vacio.textContent = 'Todavía no hay usuarios creados.';
    tablaUsuarios.appendChild(vacio);
    return;
  }

  usuarios.forEach((usuario) => {
    tablaUsuarios.appendChild(crearFilaUsuario(usuario));
  });
}

function crearFilaUsuario(usuario) {
  const fila = document.createElement('div');
  fila.className = usuario.activo ? 'catalogo__fila catalogo__fila--usuario' : 'catalogo__fila catalogo__fila--usuario catalogo__fila--inactivo';

  const nombre = document.createElement('span');
  nombre.className = 'catalogo__fila-nombre';
  nombre.textContent = usuario.nombre;

  const nombreUsuario = document.createElement('span');
  nombreUsuario.className = 'catalogo__fila-muted';
  nombreUsuario.textContent = usuario.usuario;

  const idSelectRol = `rol-usuario-${usuario.id}`;
  const etiquetaRol = document.createElement('label');
  etiquetaRol.setAttribute('for', idSelectRol);
  etiquetaRol.className = 'visualmente-oculto';
  etiquetaRol.textContent = `Rol de ${usuario.nombre}`;
  const selectRol = document.createElement('select');
  selectRol.id = idSelectRol;
  selectRol.appendChild(nuevaOpcion('cajero', 'Cajero'));
  selectRol.appendChild(nuevaOpcion('administrador', 'Administrador'));
  selectRol.value = usuario.rol;
  selectRol.addEventListener('change', async () => {
    selectRol.disabled = true;
    try {
      await api.actualizarUsuario(usuario.id, { rol: selectRol.value });
      mostrarToast('Rol actualizado');
      await cargarUsuarios();
    } catch (error) {
      mostrarToast(mensajeDeError(error), 'error');
      selectRol.value = usuario.rol; // revierte el <select> si el backend lo rechazó (ej. único admin)
      selectRol.disabled = false;
    }
  });

  const estado = document.createElement('span');
  estado.className = usuario.activo ? 'badge-alerta badge-alerta--exito' : 'badge-alerta badge-alerta--peligro';
  estado.textContent = usuario.activo ? 'Activo' : 'Inactivo';

  const acciones = document.createElement('div');
  acciones.className = 'catalogo__fila-acciones';

  const botonToggleActivo = document.createElement('button');
  botonToggleActivo.type = 'button';
  botonToggleActivo.className = 'boton-secundario';
  botonToggleActivo.textContent = usuario.activo ? 'Desactivar' : 'Activar';
  botonToggleActivo.addEventListener('click', async () => {
    botonToggleActivo.disabled = true;
    try {
      await api.actualizarUsuario(usuario.id, { activo: !usuario.activo });
      mostrarToast(usuario.activo ? 'Usuario desactivado' : 'Usuario activado');
      await cargarUsuarios();
    } catch (error) {
      mostrarToast(mensajeDeError(error), 'error');
      botonToggleActivo.disabled = false;
    }
  });

  const botonResetear = document.createElement('button');
  botonResetear.type = 'button';
  botonResetear.className = 'boton-secundario';
  botonResetear.textContent = 'Resetear contraseña';
  botonResetear.addEventListener('click', async () => {
    botonResetear.disabled = true;
    try {
      const resultado = await api.resetearPasswordUsuario(usuario.id);
      mostrarPasswordTemporal(resultado.passwordTemporal);
    } catch (error) {
      mostrarToast(mensajeDeError(error), 'error');
    } finally {
      botonResetear.disabled = false;
    }
  });

  acciones.append(botonResetear, botonToggleActivo);
  // etiquetaRol es position:absolute (.visualmente-oculto) — no participa
  // del auto-placement de la grilla, así que no corre las 5 columnas de
  // .catalogo__fila--usuario aunque quede como hijo directo de fila.
  fila.append(nombre, nombreUsuario, etiquetaRol, selectRol, estado, acciones);
  return fila;
}

function nuevaOpcion(valor, texto) {
  const opcion = document.createElement('option');
  opcion.value = valor;
  opcion.textContent = texto;
  return opcion;
}

// --- Alta ---

function abrirFormularioUsuario() {
  formularioUsuario.reset();
  inputUsuarioRol.value = 'cajero';
  overlayFormUsuario.hidden = false;
  inputUsuarioNombre.focus();
}

function cerrarFormularioUsuario() {
  overlayFormUsuario.hidden = true;
  formularioUsuario.reset();
}

botonNuevoUsuario.addEventListener('click', abrirFormularioUsuario);
botonCancelarUsuario.addEventListener('click', cerrarFormularioUsuario);

formularioUsuario.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const boton = formularioUsuario.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    const resultado = await api.crearUsuario({
      nombre: inputUsuarioNombre.value.trim(),
      usuario: inputUsuarioUsuario.value.trim(),
      rol: inputUsuarioRol.value,
    });
    cerrarFormularioUsuario();
    await cargarUsuarios();
    mostrarPasswordTemporal(resultado.passwordTemporal);
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

export async function abrirUsuarios() {
  await cargarUsuarios();
}
