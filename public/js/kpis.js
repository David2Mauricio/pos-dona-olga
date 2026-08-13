// Panel de Indicadores (Fase 4/Bloque 3, ver ADR 0013). Mismo patrón que
// usuarios.js/catalogo.js: módulo autocontenido, propio DOM, propias
// llamadas. Solo-administrador en el backend (app.js monta /api/reportes
// con requiereRol('administrador')) — main.js oculta el nav para cajero,
// pero eso es ayuda de UI, no la protección real.
//
// Sin librería de gráficos: cuatro tarjetas reusando los mismos tokens de
// color/tipografía que el resto de la interfaz (ver ADR 0013 original de
// este bloque). ticketPromedio y la exclusión de anuladas ya vienen
// calculados por el backend (reportes.service.js) — este módulo no repite
// esa aritmética. La única cuenta que sí hace en el cliente es la
// comparativa contra ayer, porque no hay ningún endpoint que compare dos
// rangos: se pide el mismo reporte dos veces (hoy, ayer) en paralelo.

import { api, ErrorApi } from './api.js';
import { mostrarToast } from './render.js';
import { formatearMoneda } from './utils.js';

const contenedorCargando = document.getElementById('indicadores-cargando');
const grilla = document.getElementById('indicadores-grilla');
const elementoTotalVentas = document.getElementById('indicadores-total-ventas');
const elementoCantidadVentas = document.getElementById('indicadores-cantidad-ventas');
const elementoTicketPromedio = document.getElementById('indicadores-ticket-promedio');
const elementoProductoTop = document.getElementById('indicadores-producto-top');
const elementoProductoTopMonto = document.getElementById('indicadores-producto-top-monto');
const elementoComparativa = document.getElementById('indicadores-comparativa');

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo cargar el panel de indicadores. Intentá de nuevo.';
}

// Fecha local (no UTC) para no correr el día por el huso horario — mismo
// criterio que historial.js:fechaDeHoy().
function fechaISO(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function fechaDeHoy() {
  return fechaISO(new Date());
}

function fechaDeAyer() {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  return fechaISO(ayer);
}

// null si no se puede calcular (sin base contra la que comparar) — nunca
// Infinity/NaN. Pedido explícito: "ayer sin ventas" no es "0% de
// variación", es "no hay con qué comparar".
function calcularVariacionPorcentual(totalHoy, totalAyer) {
  if (totalAyer === 0) return null;
  return Math.round(((totalHoy - totalAyer) / totalAyer) * 100);
}

function renderizarComparativa(totalHoy, totalAyer) {
  const variacion = calcularVariacionPorcentual(totalHoy, totalAyer);

  if (variacion === null) {
    elementoComparativa.innerHTML = '';
    const texto = document.createElement('span');
    texto.className = 'indicadores__detalle';
    texto.textContent = 'Sin ventas registradas ayer';
    elementoComparativa.appendChild(texto);
    return;
  }

  const badge = document.createElement('span');
  const tono = variacion > 0 ? 'exito' : variacion < 0 ? 'peligro' : '';
  badge.className = tono ? `badge-alerta badge-alerta--${tono}` : 'badge-alerta';
  const signo = variacion > 0 ? '+' : '';
  badge.textContent = `${signo}${variacion}% vs ayer`;
  elementoComparativa.innerHTML = '';
  elementoComparativa.appendChild(badge);
}

function renderizar(reporteHoy, reporteAyer) {
  elementoTotalVentas.textContent = formatearMoneda(reporteHoy.totalVentas);
  elementoCantidadVentas.textContent =
    reporteHoy.cantidadVentas === 1 ? '1 venta' : `${reporteHoy.cantidadVentas} ventas`;

  elementoTicketPromedio.textContent =
    reporteHoy.ticketPromedio === null ? '—' : formatearMoneda(reporteHoy.ticketPromedio);

  const masVendido = reporteHoy.topProductos[0];
  if (masVendido) {
    elementoProductoTop.textContent = masVendido.nombre;
    elementoProductoTopMonto.textContent = `${formatearMoneda(masVendido.totalVendido)} vendidos`;
  } else {
    elementoProductoTop.textContent = 'Sin ventas registradas hoy';
    elementoProductoTopMonto.textContent = '';
  }

  renderizarComparativa(reporteHoy.totalVentas, reporteAyer.totalVentas);

  contenedorCargando.hidden = true;
  grilla.hidden = false;
}

export async function abrirIndicadores() {
  contenedorCargando.hidden = false;
  contenedorCargando.textContent = 'Cargando…';
  grilla.hidden = true;

  try {
    const hoy = fechaDeHoy();
    const ayer = fechaDeAyer();
    const [reporteHoy, reporteAyer] = await Promise.all([
      api.obtenerReporteVentas({ desde: hoy, hasta: hoy }),
      api.obtenerReporteVentas({ desde: ayer, hasta: ayer }),
    ]);
    renderizar(reporteHoy, reporteAyer);
  } catch (error) {
    contenedorCargando.textContent = 'No se pudo cargar el panel de indicadores.';
    mostrarToast(mensajeDeError(error), 'error');
  }
}
