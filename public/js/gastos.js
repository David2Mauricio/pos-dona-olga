// Gestión de gastos (ver ADR de exportación CSV/gastos/redondeo/gráficos).
// Mismo patrón que proveedores.js/usuarios.js: módulo autocontenido, propio
// DOM, propias llamadas. Módulo entero solo-administrador en el backend
// (app.js monta /api/gastos con requiereRol('administrador')) — la sección
// queda oculta para cajero en la sidebar, pero eso es ayuda de UI, no la
// protección real.
//
// Sin edición: un gasto se registra o se desactiva (mismo patrón "no
// borrar" que proveedores/usuarios/productos), pero no se corrige en el
// mismo registro una vez creado — mismo criterio de integridad que
// justifica que todo el módulo sea admin-only.

import { api, ErrorApi } from './api.js';
import { mostrarToast } from './render.js';
import { formatearMoneda } from './utils.js';

const ETIQUETAS_CATEGORIA = {
  proveedores: 'Proveedores',
  servicios: 'Servicios',
  arriendo: 'Arriendo',
  otro: 'Otro',
};

const tablaGastos = document.getElementById('tabla-gastos');
const botonNuevoGasto = document.getElementById('boton-nuevo-gasto');
const selectCategoria = document.getElementById('select-gastos-categoria');

const overlayFormGasto = document.getElementById('overlay-form-gasto');
const formularioGasto = document.getElementById('formulario-gasto');
const inputGastoConcepto = document.getElementById('input-gasto-concepto');
const inputGastoMonto = document.getElementById('input-gasto-monto');
const inputGastoFecha = document.getElementById('input-gasto-fecha');
const inputGastoCategoria = document.getElementById('input-gasto-categoria');
const botonCancelarGasto = document.getElementById('boton-cancelar-gasto');

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

function etiquetaCategoria(categoria) {
  return categoria ? (ETIQUETAS_CATEGORIA[categoria] ?? categoria) : '—';
}

function fechaDeHoy() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// --- Listado ---

async function cargarGastos() {
  tablaGastos.innerHTML = '';
  const cargando = document.createElement('p');
  cargando.className = 'catalogo__vacio';
  cargando.textContent = 'Cargando…';
  tablaGastos.appendChild(cargando);

  try {
    const filtros = {};
    if (selectCategoria.value) filtros.categoria = selectCategoria.value;
    const gastos = await api.listarGastos(filtros);
    renderizarGastos(gastos);
  } catch (error) {
    tablaGastos.innerHTML = '';
    mostrarToast(mensajeDeError(error), 'error');
  }
}

function renderizarGastos(gastos) {
  tablaGastos.innerHTML = '';

  if (gastos.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'catalogo__vacio';
    vacio.textContent = 'Todavía no hay gastos registrados.';
    tablaGastos.appendChild(vacio);
    return;
  }

  gastos.forEach((gasto) => {
    tablaGastos.appendChild(crearFilaGasto(gasto));
  });
}

function crearFilaGasto(gasto) {
  const fila = document.createElement('div');
  fila.className = gasto.activo ? 'catalogo__fila catalogo__fila--gasto' : 'catalogo__fila catalogo__fila--gasto catalogo__fila--inactivo';

  const fecha = document.createElement('span');
  fecha.className = 'catalogo__fila-muted';
  fecha.textContent = gasto.fecha;

  const concepto = document.createElement('span');
  concepto.className = 'catalogo__fila-nombre';
  concepto.textContent = gasto.concepto;

  const categoria = document.createElement('span');
  categoria.className = 'catalogo__fila-muted';
  categoria.textContent = etiquetaCategoria(gasto.categoria);

  const monto = document.createElement('span');
  monto.className = 'numero';
  monto.textContent = formatearMoneda(gasto.monto);

  const estado = document.createElement('span');
  estado.className = gasto.activo ? 'badge-alerta badge-alerta--exito' : 'badge-alerta badge-alerta--peligro';
  estado.textContent = gasto.activo ? 'Activo' : 'Inactivo';

  const acciones = document.createElement('div');
  acciones.className = 'catalogo__fila-acciones';

  if (gasto.activo) {
    const botonDesactivar = document.createElement('button');
    botonDesactivar.type = 'button';
    botonDesactivar.className = 'boton-secundario';
    botonDesactivar.textContent = 'Desactivar';
    botonDesactivar.addEventListener('click', async () => {
      botonDesactivar.disabled = true;
      try {
        await api.desactivarGasto(gasto.id);
        mostrarToast('Gasto desactivado');
        await cargarGastos();
      } catch (error) {
        mostrarToast(mensajeDeError(error), 'error');
        botonDesactivar.disabled = false;
      }
    });
    acciones.appendChild(botonDesactivar);
  }

  fila.append(fecha, concepto, categoria, monto, estado, acciones);
  return fila;
}

// --- Alta ---

function abrirFormularioGasto() {
  formularioGasto.reset();
  inputGastoFecha.value = fechaDeHoy();
  overlayFormGasto.hidden = false;
  inputGastoConcepto.focus();
}

function cerrarFormularioGasto() {
  overlayFormGasto.hidden = true;
  formularioGasto.reset();
}

botonNuevoGasto.addEventListener('click', abrirFormularioGasto);
botonCancelarGasto.addEventListener('click', cerrarFormularioGasto);
selectCategoria.addEventListener('change', cargarGastos);

formularioGasto.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const boton = formularioGasto.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    await api.crearGasto({
      concepto: inputGastoConcepto.value.trim(),
      monto: Number.parseInt(inputGastoMonto.value, 10),
      fecha: inputGastoFecha.value,
      ...(inputGastoCategoria.value ? { categoria: inputGastoCategoria.value } : {}),
    });
    mostrarToast('Gasto registrado');
    cerrarFormularioGasto();
    await cargarGastos();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

export async function abrirGastos() {
  await cargarGastos();
}
