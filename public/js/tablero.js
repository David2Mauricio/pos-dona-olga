// Tablero (rediseño visual, Fase 3): pantalla de arranque tras loguearse,
// reemplaza a Mostrador en ese rol -- Mostrador sigue existiendo como una
// sección más del nav (ver main.js). Mismo molde autocontenido que
// inventario.js/vencimientos.js.
//
// Todos los datos vienen de endpoints ya existentes y ya de ambos roles
// (nunca /api/reportes/ventas, que es admin-only): GET /api/caja/actual +
// GET /api/caja/:id (obtenerReporteCaja YA incluye totalVentas y
// desglosePorMedioPago, y ninguna de las dos rutas de caja tiene
// requiereRol -- confirmado leyendo caja.routes.js, no de memoria) para
// el resumen de ventas, y las mismas dos alertas que ya usa el popover
// del Mostrador para la tarjeta de Alertas.

import { api, ErrorApi } from './api.js';
import { obtenerUsuarioActual } from './auth.js';
import { gramosAKilosTexto, formatearMoneda } from './utils.js';
import { iconoCheck, iconoAlerta } from './icons.js';

const botonCobrar = document.getElementById('tablero-boton-cobrar');
const botonNuevoProducto = document.getElementById('tablero-boton-nuevo-producto');
const botonVencimientos = document.getElementById('tablero-boton-vencimientos');
const botonIndicadores = document.getElementById('tablero-boton-indicadores');
const resumenVentas = document.getElementById('tablero-resumen-ventas');
const cajaCerradaAviso = document.getElementById('tablero-caja-cerrada-aviso');
const totalFacturado = document.getElementById('tablero-total-facturado');
const cantidadVentas = document.getElementById('tablero-cantidad-ventas');
const estadoCaja = document.getElementById('tablero-estado-caja');
const listaAlertas = document.getElementById('tablero-lista-alertas');

let wireado = false;

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo cargar la información del tablero.';
}

// mostrarVista se importa dinámicamente en cada handler, no arriba del
// módulo -- mismo patrón que kpis.js ("Ver detalle en Historial"), para
// no crear un import circular estático con main.js (que a su vez importa
// tablero.js dinámicamente al navegar acá).
async function navegarA(nombre) {
  const { mostrarVista } = await import('./main.js');
  mostrarVista(nombre);
}

function wireAccesosRapidos() {
  if (wireado) return;
  wireado = true;

  botonCobrar.addEventListener('click', () => navegarA('mostrador'));
  botonVencimientos.addEventListener('click', () => navegarA('vencimientos'));
  botonIndicadores.addEventListener('click', () => navegarA('indicadores'));
  botonNuevoProducto.addEventListener('click', async () => {
    await navegarA('productos');
    // El botón real de Productos ya tiene toda la lógica de apertura del
    // overlay (categorías cargadas, formulario limpio) -- se dispara ese
    // mismo click en vez de duplicar esa lógica acá.
    document.getElementById('boton-nuevo-producto')?.click();
  });
}

function actualizarVisibilidadPorRol() {
  const usuario = obtenerUsuarioActual();
  const esAdmin = usuario?.rol === 'administrador';
  botonNuevoProducto.hidden = !esAdmin;
  botonIndicadores.hidden = !esAdmin;
}

async function cargarResumenVentas() {
  const sesion = await api.obtenerCajaActual();
  if (!sesion) {
    resumenVentas.hidden = true;
    cajaCerradaAviso.hidden = false;
    return;
  }
  cajaCerradaAviso.hidden = true;
  resumenVentas.hidden = false;

  const reporte = await api.obtenerReporteCaja(sesion.id);
  const totalTransacciones = reporte.desglosePorMedioPago.reduce((suma, item) => suma + item.cantidadVentas, 0);
  totalFacturado.textContent = formatearMoneda(reporte.totalVentas);
  cantidadVentas.textContent = String(totalTransacciones);
  estadoCaja.textContent = 'Abierta';
}

function formatearStock(item) {
  return item.tipoVenta === 'peso' ? `${gramosAKilosTexto(item.stockActual)} kg` : `${item.stockActual} u.`;
}

function crearItemAlerta(texto, tono) {
  const li = document.createElement('li');
  li.className = 'tablero__alerta-item';
  const badge = document.createElement('span');
  // .badge-alerta a secas YA es el tono ámbar (ver estilos.css) -- solo
  // "peligro" necesita el modificador.
  badge.className = tono === 'peligro' ? 'badge-alerta badge-alerta--peligro' : 'badge-alerta';
  badge.innerHTML = iconoAlerta;
  const span = document.createElement('span');
  span.textContent = texto;
  li.append(badge, span);
  return li;
}

async function cargarAlertas() {
  listaAlertas.innerHTML = '';

  const [stockBajo, vencimientosResp, productos] = await Promise.all([
    api.obtenerAlertasInventario(),
    api.obtenerAlertasVencimientos(),
    api.listarProductosActivos(),
  ]);
  const mapaProductos = new Map(productos.map((p) => [p.id, p]));

  const items = [];
  stockBajo.forEach((producto) => {
    items.push(crearItemAlerta(`${producto.nombre} — stock bajo (${formatearStock(producto)})`, 'alerta'));
  });
  (vencimientosResp.vencidos ?? []).forEach((lote) => {
    const nombre = mapaProductos.get(lote.productoId)?.nombre ?? `Producto #${lote.productoId}`;
    items.push(crearItemAlerta(`${nombre} — vencido (${lote.fechaVencimiento})`, 'peligro'));
  });
  (vencimientosResp.porVencer ?? []).forEach((lote) => {
    const nombre = mapaProductos.get(lote.productoId)?.nombre ?? `Producto #${lote.productoId}`;
    items.push(crearItemAlerta(`${nombre} — vence el ${lote.fechaVencimiento}`, 'alerta'));
  });

  if (items.length === 0) {
    const vacio = document.createElement('div');
    vacio.className = 'tablero__sin-alertas';
    const icono = document.createElement('span');
    icono.className = 'tablero__sin-alertas-icono';
    icono.innerHTML = iconoCheck;
    const texto = document.createElement('p');
    texto.textContent = 'Todo en orden. Sin stock bajo ni vencimientos pendientes.';
    vacio.append(icono, texto);
    listaAlertas.appendChild(vacio);
    return;
  }

  const lista = document.createElement('ul');
  lista.className = 'tablero__alertas-lista';
  items.forEach((item) => lista.appendChild(item));
  listaAlertas.appendChild(lista);
}

export async function abrirTablero() {
  wireAccesosRapidos();
  actualizarVisibilidadPorRol();
  try {
    await Promise.all([cargarResumenVentas(), cargarAlertas()]);
  } catch (error) {
    listaAlertas.innerHTML = '';
    const parrafoError = document.createElement('p');
    parrafoError.className = 'carrito-vacio';
    parrafoError.textContent = mensajeDeError(error);
    listaAlertas.appendChild(parrafoError);
  }
}
