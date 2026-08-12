// Historial de ventas del día, con anulación (Fase 3, ver ADR 0012/0013).
// Vista dentro de la navegación persistente (ver ADR 0013, Bloque 2):
// mostrar/ocultar la sección en sí es responsabilidad de main.js
// (mostrarVista) — este módulo solo carga y renderiza sus datos.
//
// El botón "Anular" solo se RENDERIZA si el usuario es administrador y la
// venta sigue activa — es una ayuda de UI, no la protección real: el
// backend sigue devolviendo 403 ROL_INSUFICIENTE si alguien igual llega a
// llamar el endpoint sin ser administrador (ver ventas.routes.js).

import { api, ErrorApi } from './api.js';
import { formatearMoneda } from './utils.js';
import { mostrarToast } from './render.js';
import { iconoAnular } from './icons.js';

const listaHistorial = document.getElementById('lista-historial');

let obtenerUsuarioActualFn = null;

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

function fechaDeHoy() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

function formatearHora(creadaEn) {
  // 'YYYY-MM-DD HH:MM:SS' (ver ventas.repository.js) — solo se muestra la hora,
  // la fecha ya está implícita en que esta vista es "de hoy".
  return creadaEn.split(' ')[1]?.slice(0, 5) ?? creadaEn;
}

async function cargarVentas() {
  listaHistorial.innerHTML = '<p class="historial__vacio">Cargando…</p>';
  try {
    const hoy = fechaDeHoy();
    const ventas = await api.listarVentas({ desde: hoy, hasta: hoy });
    renderizarVentas(ventas);
  } catch (error) {
    listaHistorial.innerHTML = '';
    mostrarToast(mensajeDeError(error), 'error');
  }
}

function renderizarVentas(ventas) {
  listaHistorial.innerHTML = '';

  if (ventas.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'historial__vacio';
    vacio.textContent = 'Todavía no hay ventas registradas hoy.';
    listaHistorial.appendChild(vacio);
    return;
  }

  const usuarioActual = obtenerUsuarioActualFn?.();
  const esAdmin = usuarioActual?.rol === 'administrador';

  // Más reciente primero (igual orden que ya devuelve GET /api/ventas).
  ventas.forEach((venta) => {
    listaHistorial.appendChild(crearFilaVenta(venta, esAdmin));
  });
}

function crearFilaVenta(venta, esAdmin) {
  const fila = document.createElement('div');
  fila.className = `historial__fila historial__fila--${venta.estado}`;

  const hora = document.createElement('span');
  hora.className = 'historial__hora numero';
  hora.textContent = formatearHora(venta.creadaEn);

  const medioPago = document.createElement('span');
  medioPago.className = 'historial__medio-pago';
  medioPago.textContent = venta.medioPago;

  const total = document.createElement('span');
  total.className = 'historial__total numero';
  total.textContent = formatearMoneda(venta.total);

  const estado = document.createElement('span');
  estado.className = venta.estado === 'anulada' ? 'badge-alerta badge-alerta--peligro' : 'badge-alerta badge-alerta--exito';
  estado.textContent = venta.estado === 'anulada' ? 'Anulada' : 'Activa';

  fila.append(hora, medioPago, total, estado);

  if (venta.estado === 'anulada' && venta.motivoAnulacion) {
    estado.title = venta.motivoAnulacion;
  }

  if (venta.estado === 'activa' && esAdmin) {
    fila.appendChild(crearAccionAnular(venta));
  }

  return fila;
}

function crearAccionAnular(venta) {
  const contenedor = document.createElement('div');
  contenedor.className = 'historial__accion';

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'boton-icono';
  boton.setAttribute('aria-label', `Anular venta de ${formatearMoneda(venta.total)} a las ${formatearHora(venta.creadaEn)}`);
  boton.innerHTML = iconoAnular;

  const formulario = document.createElement('form');
  formulario.className = 'historial__anular-form';
  formulario.hidden = true;

  const idMotivo = `motivo-anulacion-${venta.id}`;
  const campo = document.createElement('div');
  campo.className = 'campo';
  const label = document.createElement('label');
  label.setAttribute('for', idMotivo);
  label.textContent = 'Motivo de la anulación';
  const inputMotivo = document.createElement('input');
  inputMotivo.id = idMotivo;
  inputMotivo.type = 'text';
  inputMotivo.required = true;
  campo.append(label, inputMotivo);

  const acciones = document.createElement('div');
  acciones.className = 'historial__anular-acciones';

  const botonConfirmar = document.createElement('button');
  botonConfirmar.type = 'submit';
  botonConfirmar.className = 'boton-secundario';
  botonConfirmar.textContent = 'Confirmar anulación';

  const botonCancelar = document.createElement('button');
  botonCancelar.type = 'button';
  botonCancelar.className = 'boton-secundario';
  botonCancelar.textContent = 'Cancelar';
  botonCancelar.addEventListener('click', () => {
    formulario.hidden = true;
  });

  acciones.append(botonConfirmar, botonCancelar);
  formulario.append(campo, acciones);

  boton.addEventListener('click', () => {
    formulario.hidden = !formulario.hidden;
    if (!formulario.hidden) inputMotivo.focus();
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const motivo = inputMotivo.value.trim();
    if (!motivo) return;

    botonConfirmar.disabled = true;
    try {
      await api.anularVenta(venta.id, motivo);
      mostrarToast('Venta anulada');
      await cargarVentas();
    } catch (error) {
      mostrarToast(mensajeDeError(error), 'error');
      botonConfirmar.disabled = false;
    }
  });

  contenedor.append(boton, formulario);
  return contenedor;
}

export function abrirHistorial() {
  cargarVentas();
}

export function iniciarHistorial({ obtenerUsuarioActual }) {
  obtenerUsuarioActualFn = obtenerUsuarioActual;
}
