// Gestión de proveedores (Fase 4, ver ADR 0013). Mismo patrón que
// usuarios.js/catalogo.js: módulo autocontenido, propio DOM, propias
// llamadas. Módulo entero solo-administrador en el backend (app.js monta
// /api/proveedores con requiereRol('administrador'), ya documentado desde
// ADR 0010) — la sección queda oculta para cajero en la sidebar, pero eso
// es ayuda de UI, no la protección real.
//
// A diferencia de Vencimientos, acá SÍ hay un badge explícito de
// activo/inactivo (no solo la opacidad de .catalogo__fila--inactivo) —
// mismo criterio que ya usaba usuarios.js.

import { api, ErrorApi } from './api.js';
import { mostrarToast } from './render.js';

const tablaProveedores = document.getElementById('tabla-proveedores');
const botonNuevoProveedor = document.getElementById('boton-nuevo-proveedor');

const overlayFormProveedor = document.getElementById('overlay-form-proveedor');
const tituloFormProveedor = document.getElementById('titulo-form-proveedor');
const formularioProveedor = document.getElementById('formulario-proveedor');
const inputProveedorNombre = document.getElementById('input-proveedor-nombre');
const inputProveedorNit = document.getElementById('input-proveedor-nit');
const inputProveedorTelefono = document.getElementById('input-proveedor-telefono');
const inputProveedorDireccion = document.getElementById('input-proveedor-direccion');
const campoProveedorActivo = document.getElementById('campo-proveedor-activo');
const inputProveedorActivo = document.getElementById('input-proveedor-activo');
const botonCancelarProveedor = document.getElementById('boton-cancelar-proveedor');

let proveedorEnEdicion = null; // null = alta; objeto completo en edición

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

// --- Listado ---

async function cargarProveedores() {
  tablaProveedores.innerHTML = '';
  const cargando = document.createElement('p');
  cargando.className = 'catalogo__vacio';
  cargando.textContent = 'Cargando…';
  tablaProveedores.appendChild(cargando);

  try {
    const proveedores = await api.listarProveedores();
    renderizarProveedores(proveedores);
  } catch (error) {
    tablaProveedores.innerHTML = '';
    mostrarToast(mensajeDeError(error), 'error');
  }
}

function renderizarProveedores(proveedores) {
  tablaProveedores.innerHTML = '';

  if (proveedores.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'catalogo__vacio';
    vacio.textContent = 'Todavía no hay proveedores registrados.';
    tablaProveedores.appendChild(vacio);
    return;
  }

  proveedores.forEach((proveedor) => {
    tablaProveedores.appendChild(crearFilaProveedor(proveedor));
  });
}

function crearFilaProveedor(proveedor) {
  const fila = document.createElement('div');
  fila.className = proveedor.activo
    ? 'catalogo__fila catalogo__fila--proveedor'
    : 'catalogo__fila catalogo__fila--proveedor catalogo__fila--inactivo';

  const nombre = document.createElement('span');
  nombre.className = 'catalogo__fila-nombre';
  nombre.textContent = proveedor.nombre;

  const nit = document.createElement('span');
  nit.className = 'catalogo__fila-muted';
  nit.textContent = proveedor.nit || '—';

  const telefono = document.createElement('span');
  telefono.className = 'catalogo__fila-muted';
  telefono.textContent = proveedor.telefono || '—';

  const direccion = document.createElement('span');
  direccion.className = 'catalogo__fila-muted';
  direccion.textContent = proveedor.direccion || '—';

  const estado = document.createElement('span');
  estado.className = proveedor.activo ? 'badge-alerta badge-alerta--exito' : 'badge-alerta badge-alerta--peligro';
  estado.textContent = proveedor.activo ? 'Activo' : 'Inactivo';

  const acciones = document.createElement('div');
  acciones.className = 'catalogo__fila-acciones';

  const botonEditar = document.createElement('button');
  botonEditar.type = 'button';
  botonEditar.className = 'boton-secundario';
  botonEditar.textContent = 'Editar';
  botonEditar.addEventListener('click', () => abrirFormularioProveedor(proveedor));

  const botonToggleActivo = document.createElement('button');
  botonToggleActivo.type = 'button';
  botonToggleActivo.className = 'boton-secundario';
  botonToggleActivo.textContent = proveedor.activo ? 'Desactivar' : 'Activar';
  botonToggleActivo.addEventListener('click', async () => {
    botonToggleActivo.disabled = true;
    try {
      await api.actualizarProveedor(proveedor.id, { activo: !proveedor.activo });
      mostrarToast(proveedor.activo ? 'Proveedor desactivado' : 'Proveedor activado');
      await cargarProveedores();
    } catch (error) {
      mostrarToast(mensajeDeError(error), 'error');
      botonToggleActivo.disabled = false;
    }
  });

  acciones.append(botonEditar, botonToggleActivo);
  fila.append(nombre, nit, telefono, direccion, estado, acciones);
  return fila;
}

// --- Alta / edición ---

function abrirFormularioProveedor(proveedor) {
  proveedorEnEdicion = proveedor ?? null;
  const esAlta = proveedorEnEdicion === null;

  tituloFormProveedor.textContent = esAlta ? 'Nuevo proveedor' : 'Editar proveedor';
  formularioProveedor.querySelector('button[type="submit"]').textContent = esAlta ? 'Crear' : 'Guardar';
  campoProveedorActivo.hidden = esAlta;

  if (esAlta) {
    formularioProveedor.reset();
  } else {
    inputProveedorNombre.value = proveedor.nombre;
    inputProveedorNit.value = proveedor.nit ?? '';
    inputProveedorTelefono.value = proveedor.telefono ?? '';
    inputProveedorDireccion.value = proveedor.direccion ?? '';
    inputProveedorActivo.checked = proveedor.activo;
  }

  overlayFormProveedor.hidden = false;
  inputProveedorNombre.focus();
}

function cerrarFormularioProveedor() {
  overlayFormProveedor.hidden = true;
  proveedorEnEdicion = null;
  formularioProveedor.reset();
}

botonNuevoProveedor.addEventListener('click', () => abrirFormularioProveedor(null));
botonCancelarProveedor.addEventListener('click', cerrarFormularioProveedor);

// Campos opcionales: string vacío se manda como null, no como '' (mismo
// criterio que el schema del backend, que los acepta nullish).
function valorOpcional(input) {
  const valor = input.value.trim();
  return valor === '' ? null : valor;
}

formularioProveedor.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const boton = formularioProveedor.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    if (proveedorEnEdicion) {
      await api.actualizarProveedor(proveedorEnEdicion.id, {
        nombre: inputProveedorNombre.value.trim(),
        nit: valorOpcional(inputProveedorNit),
        telefono: valorOpcional(inputProveedorTelefono),
        direccion: valorOpcional(inputProveedorDireccion),
        activo: inputProveedorActivo.checked,
      });
      mostrarToast('Proveedor actualizado');
    } else {
      await api.crearProveedor({
        nombre: inputProveedorNombre.value.trim(),
        nit: valorOpcional(inputProveedorNit),
        telefono: valorOpcional(inputProveedorTelefono),
        direccion: valorOpcional(inputProveedorDireccion),
      });
      mostrarToast('Proveedor creado');
    }
    cerrarFormularioProveedor();
    await cargarProveedores();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

export async function abrirProveedores() {
  await cargarProveedores();
}
