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
import { crearInfoTooltip } from './info-tooltip.js';

const listaHistorial = document.getElementById('lista-historial');
const tituloHistorial = document.getElementById('titulo-vista-historial');

let obtenerUsuarioActualFn = null;
let rangoActual = null; // null = "hoy" (comportamiento original); {desde,hasta} = rango pedido desde Indicadores

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

function fechaDeHoy() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

// 'YYYY-MM-DD HH:MM:SS' (ver ventas.repository.js). Cuando el rango pedido
// abarca más de un día (llegando desde Indicadores con semana/mes/trimestre),
// la sola hora sería ambigua -- se antepone la fecha en ese caso.
function formatearHora(creadaEn) {
  const [fecha, hora] = creadaEn.split(' ');
  const horaCorta = hora?.slice(0, 5) ?? creadaEn;
  const esRangoDeUnDia = !rangoActual || rangoActual.desde === rangoActual.hasta;
  return esRangoDeUnDia ? horaCorta : `${fecha} ${horaCorta}`;
}

function actualizarTitulo() {
  if (!tituloHistorial) return;
  const hoy = fechaDeHoy();
  if (!rangoActual || (rangoActual.desde === hoy && rangoActual.hasta === hoy)) {
    tituloHistorial.textContent = 'Historial de ventas de hoy';
  } else if (rangoActual.desde === rangoActual.hasta) {
    tituloHistorial.textContent = `Historial de ventas — ${rangoActual.desde}`;
  } else {
    tituloHistorial.textContent = `Historial de ventas — ${rangoActual.desde} a ${rangoActual.hasta}`;
  }
}

async function cargarVentas() {
  listaHistorial.innerHTML = '<p class="historial__vacio">Cargando…</p>';
  actualizarTitulo();
  try {
    const { desde, hasta } = rangoActual ?? { desde: fechaDeHoy(), hasta: fechaDeHoy() };
    const ventas = await api.listarVentas({ desde, hasta });
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
    vacio.textContent = rangoActual ? 'No hay ventas registradas en ese período.' : 'Todavía no hay ventas registradas hoy.';
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

  const contenedorEstado = document.createElement('span');
  contenedorEstado.className = 'fila-con-ayuda';
  contenedorEstado.appendChild(estado);

  if (venta.estado === 'anulada' && venta.motivoAnulacion) {
    estado.title = venta.motivoAnulacion;
  }

  // Solo en ventas anuladas: explica el concepto general (por qué sigue
  // apareciendo, por qué no afecta los totales) -- distinto del `title`
  // de arriba, que es el motivo puntual de ESTA anulación.
  if (venta.estado === 'anulada') {
    contenedorEstado.appendChild(
      crearInfoTooltip(
        'Una venta anulada no se borra del historial ni se cuenta en los totales de caja o reportes, pero queda registrada para trazabilidad.',
        'Ayuda sobre venta anulada'
      )
    );
  }

  fila.append(hora, medioPago, total, contenedorEstado);

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

// rango: {desde, hasta} en 'YYYY-MM-DD', opcional -- lo manda Indicadores
// (ver kpis.js, link "Ver detalle en Historial") para abrir ya filtrado
// por el período que estaba viendo ahí. Sin argumento, mismo
// comportamiento de siempre: hoy.
export function abrirHistorial(rango) {
  rangoActual = rango ?? null;
  cargarVentas();
}

export function iniciarHistorial({ obtenerUsuarioActual }) {
  obtenerUsuarioActualFn = obtenerUsuarioActual;
}
