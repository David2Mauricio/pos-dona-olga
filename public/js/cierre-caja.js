// Cierre de caja (Fase 4, ver ADR 0013). Mismo patrón que historial.js/
// catalogo.js: módulo autocontenido, propio DOM, propias llamadas.
//
// El backend calcula montoTeoricoEfectivo y diferencia (caja.service.js) —
// este módulo no resta nada, solo muestra lo que ya viene, mismo criterio
// que vuelto/ticketPromedio. La única aritmética que sí hace acá es la
// VISTA PREVIA de la diferencia mientras se escribe el conteo (antes de
// confirmar) — válida porque main.js bloquea "Cobrar" mientras este
// overlay está abierto, así que el monto teórico no puede cambiar entre
// que se abre el cierre y se confirma.

import { api, ErrorApi } from './api.js';
import { formatearMoneda } from './utils.js';
import { mostrarToast } from './render.js';

const botonEstadoCaja = document.getElementById('estado-caja');
const overlayCierre = document.getElementById('overlay-cierre-caja');
const cierreTotalVentas = document.getElementById('cierre-total-ventas');
const cierreDesglose = document.getElementById('cierre-desglose');
const cierreMontoTeorico = document.getElementById('cierre-monto-teorico');
const formularioCierre = document.getElementById('formulario-cierre-caja');
const inputMontoCierre = document.getElementById('input-monto-cierre');
const diferenciaContenedor = document.getElementById('cierre-diferencia-contenedor');
const diferenciaBadge = document.getElementById('cierre-diferencia-badge');
const botonCancelarCierre = document.getElementById('boton-cancelar-cierre');

let cajaSesionId = null;
let montoTeoricoActual = 0;
let alAbrirCallback = null;
let alCerrarCallback = null; // se llama al cancelar Y al confirmar con éxito

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "Sobra $X" / "Falta $X" en vez de solo el número con signo — más rápido
// de leer al final de un turno (pedido explícito del cliente).
function formatearDiferencia(diferencia) {
  if (diferencia === 0) return { texto: 'Cuadra', clase: 'badge-alerta--exito' };
  if (diferencia > 0) return { texto: `Sobra ${formatearMoneda(diferencia)}`, clase: 'badge-alerta--peligro' };
  return { texto: `Falta ${formatearMoneda(Math.abs(diferencia))}`, clase: 'badge-alerta--peligro' };
}

function actualizarPreviaDiferencia() {
  const montoContado = Number.parseInt(inputMontoCierre.value, 10);
  if (!Number.isFinite(montoContado)) {
    diferenciaContenedor.hidden = true;
    return;
  }
  const { texto, clase } = formatearDiferencia(montoContado - montoTeoricoActual);
  diferenciaBadge.textContent = texto;
  diferenciaBadge.className = `badge-alerta ${clase}`;
  diferenciaContenedor.hidden = false;
}

inputMontoCierre.addEventListener('input', actualizarPreviaDiferencia);

async function abrirCierre() {
  if (!cajaSesionId) return;

  try {
    const reporte = await api.obtenerReporteCaja(cajaSesionId);
    montoTeoricoActual = reporte.montoTeoricoEfectivo;
    cierreTotalVentas.textContent = formatearMoneda(reporte.totalVentas);
    cierreMontoTeorico.textContent = formatearMoneda(reporte.montoTeoricoEfectivo);

    cierreDesglose.innerHTML = '';
    reporte.desglosePorMedioPago.forEach((linea) => {
      const fila = document.createElement('div');
      fila.className = 'cierre-caja__fila';
      const medio = document.createElement('span');
      medio.textContent = capitalizar(linea.medioPago);
      const total = document.createElement('span');
      total.className = 'numero';
      total.textContent = formatearMoneda(linea.total);
      fila.append(medio, total);
      cierreDesglose.appendChild(fila);
    });

    inputMontoCierre.value = '';
    diferenciaContenedor.hidden = true;
    overlayCierre.hidden = false;
    alAbrirCallback?.();
    inputMontoCierre.focus();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  }
}

function cerrarOverlay() {
  overlayCierre.hidden = true;
  formularioCierre.reset();
  alCerrarCallback?.();
}

botonEstadoCaja.addEventListener('click', abrirCierre);
botonCancelarCierre.addEventListener('click', cerrarOverlay);

formularioCierre.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const montoCierre = Number.parseInt(inputMontoCierre.value, 10);
  if (!Number.isFinite(montoCierre) || montoCierre < 0) return;

  const boton = formularioCierre.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    const resultado = await api.cerrarCaja(cajaSesionId, montoCierre);
    const { texto } = formatearDiferencia(resultado.diferencia);
    mostrarToast(`Caja cerrada — ${texto}`);
    cerrarOverlay();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

// alAbrir/alCerrar: main.js bloquea/desbloquea "Cobrar" y refresca el
// estado de caja (ver comentario de cabecera — por qué la vista previa de
// la diferencia es confiable mientras esto está abierto).
export function iniciarCierreCaja({ alAbrir, alCerrar }) {
  alAbrirCallback = alAbrir;
  alCerrarCallback = alCerrar;
}

export function establecerCajaSesionId(id) {
  cajaSesionId = id;
  botonEstadoCaja.disabled = !id;
}
