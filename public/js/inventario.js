// Movimientos de inventario (Fase 4, ver ADR 0015). Mismo patrón que
// vencimientos.js: módulo autocontenido, propio DOM, propias llamadas. De
// ambos roles en el backend para listar (inventario.routes.js: GET
// /movimientos y /alertas sin requiereRol); crear un movimiento manual es
// admin-only (POST /movimientos con requiereRol('administrador'), ya
// existía antes de esta fase — verificado, no agregado acá). El nav de
// esta sección no se oculta por rol en main.js, a propósito: la lista es
// de ambos roles. El formulario de alta sí se oculta acá para cajero
// (mismo patrón que el botón "Anular" en historial.js: obtenerUsuarioActual
// inyectado desde auth.js) — la protección real sigue siendo el 403 del
// backend, esto es solo para no mostrar una acción que va a fallar.
//
// Este formulario solo cubre "entrada" (lo único pedido: registrar
// mercadería entrante) — "salida"/"ajuste" del mismo endpoint existen para
// otros casos (ventas.service.js genera salidas automáticas; ajustes
// manuales de stock quedan fuera de este punto) pero no tienen UI acá.
//
// Cantidad: mismo criterio que Vencimientos/Productos
// (kilosTextoAGramos/gramosAKilosTexto) — para un producto tipo_venta='peso'
// se pide en kg y se convierte a gramos antes de mandar al backend, porque
// inventario_movimientos guarda un entero genérico sin unidad propia,
// igual que lotes_vencimiento.
//
// La lista de movimientos recientes muestra TODOS los tipos (entrada,
// salida, ajuste) que ya existan, no solo los que se registren desde este
// formulario — es la referencia completa del historial real de stock,
// incluida la salida automática que generan las ventas.

import { api, ErrorApi } from './api.js';
import { mostrarToast } from './render.js';
import { kilosTextoAGramos, gramosAKilosTexto } from './utils.js';
import { obtenerUsuarioActual } from './auth.js';
import { crearInfoTooltip } from './info-tooltip.js';

const formularioMovimiento = document.getElementById('formulario-movimiento-inventario');
const inputMovimientoProducto = document.getElementById('input-movimiento-producto');
const labelMovimientoCantidad = document.getElementById('label-movimiento-cantidad');

document.getElementById('ayuda-movimiento-cantidad').appendChild(
  crearInfoTooltip(
    'El stock se muestra en kilogramos para productos que se venden por peso, o en unidades para productos que se venden por pieza.',
    'Ayuda sobre el formato de stock'
  )
);
const inputMovimientoCantidad = document.getElementById('input-movimiento-cantidad');
const inputMovimientoMotivo = document.getElementById('input-movimiento-motivo');
const inputMovimientoProveedor = document.getElementById('input-movimiento-proveedor');
const tablaMovimientos = document.getElementById('tabla-movimientos-inventario');

let mapaProductos = new Map();
let mapaProveedores = new Map();

const MOTIVO_POR_DEFECTO = 'Entrada de mercadería';

const ETIQUETAS_TIPO = {
  entrada: { texto: 'Entrada', clase: 'badge-alerta badge-alerta--exito' },
  salida: { texto: 'Salida', clase: 'badge-alerta badge-alerta--peligro' },
  ajuste: { texto: 'Ajuste', clase: 'badge-alerta' },
};

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

function formatearFecha(creadoEn) {
  return creadoEn.replace('T', ' ').slice(0, 16);
}

// cantidad ya viene como delta con signo desde el backend (ver
// inventario.service.js) — se muestra tal cual, con la unidad del
// producto si se conoce.
function formatearCantidad(movimiento, producto) {
  const esPeso = producto?.tipoVenta === 'peso';
  const magnitud = Math.abs(movimiento.cantidad);
  const texto = esPeso ? `${gramosAKilosTexto(magnitud)} kg` : `${magnitud} u.`;
  const signo = movimiento.cantidad > 0 ? '+' : movimiento.cantidad < 0 ? '-' : '';
  return `${signo}${texto}`;
}

function actualizarCampoCantidadSegunProducto() {
  const producto = mapaProductos.get(Number(inputMovimientoProducto.value));
  const esPeso = producto?.tipoVenta === 'peso';
  labelMovimientoCantidad.textContent = esPeso ? 'Cantidad (kg)' : 'Cantidad (unidades)';
  inputMovimientoCantidad.type = esPeso ? 'text' : 'number';
  inputMovimientoCantidad.inputMode = esPeso ? 'decimal' : 'numeric';
}

inputMovimientoProducto.addEventListener('change', actualizarCampoCantidadSegunProducto);

function poblarSelectProductos(productos) {
  inputMovimientoProducto.innerHTML = '';
  productos.forEach((producto) => {
    const opcion = document.createElement('option');
    opcion.value = String(producto.id);
    opcion.textContent = producto.nombre;
    inputMovimientoProducto.appendChild(opcion);
  });
}

// La opción "Sin proveedor" (value="") ya está en el HTML -- acá solo se
// agregan los proveedores activos (uno inactivo no debería quedar
// seleccionable para una entrada nueva, aunque sí puede seguir apareciendo
// en la lista de movimientos ya existentes -- ver mapaProveedores, que se
// arma con TODOS, no solo los activos).
function poblarSelectProveedores(proveedoresActivos) {
  proveedoresActivos.forEach((proveedor) => {
    const opcion = document.createElement('option');
    opcion.value = String(proveedor.id);
    opcion.textContent = proveedor.nombre;
    inputMovimientoProveedor.appendChild(opcion);
  });
}

function renderizarMovimientos(movimientos) {
  tablaMovimientos.innerHTML = '';

  if (movimientos.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'catalogo__vacio';
    vacio.textContent = 'Todavía no hay movimientos registrados.';
    tablaMovimientos.appendChild(vacio);
    return;
  }

  movimientos.forEach((movimiento) => {
    tablaMovimientos.appendChild(crearFilaMovimiento(movimiento));
  });
}

function crearFilaMovimiento(movimiento) {
  const producto = mapaProductos.get(movimiento.productoId);

  const fila = document.createElement('div');
  fila.className = 'catalogo__fila catalogo__fila--movimiento';

  const nombre = document.createElement('span');
  nombre.className = 'catalogo__fila-nombre';
  nombre.textContent = producto?.nombre ?? `Producto #${movimiento.productoId}`;

  const badge = document.createElement('span');
  const etiqueta = ETIQUETAS_TIPO[movimiento.tipo] ?? { texto: movimiento.tipo, clase: 'catalogo__fila-muted' };
  badge.className = etiqueta.clase;
  badge.textContent = etiqueta.texto;

  const cantidad = document.createElement('span');
  cantidad.className = 'catalogo__fila-muted';
  cantidad.textContent = formatearCantidad(movimiento, producto);

  const motivo = document.createElement('span');
  motivo.className = 'catalogo__fila-muted';
  motivo.textContent = movimiento.motivo;

  const fecha = document.createElement('span');
  fecha.className = 'catalogo__fila-muted';
  fecha.textContent = formatearFecha(movimiento.creadoEn);

  const proveedor = document.createElement('span');
  proveedor.className = 'catalogo__fila-muted';
  proveedor.textContent = movimiento.proveedorId ? (mapaProveedores.get(movimiento.proveedorId)?.nombre ?? '—') : '—';

  fila.append(nombre, badge, cantidad, motivo, proveedor, fecha);
  return fila;
}

async function cargarMovimientos() {
  tablaMovimientos.innerHTML = '';
  const cargando = document.createElement('p');
  cargando.className = 'catalogo__vacio';
  cargando.textContent = 'Cargando…';
  tablaMovimientos.appendChild(cargando);

  try {
    const movimientos = await api.listarMovimientosInventario();
    renderizarMovimientos(movimientos);
  } catch (error) {
    tablaMovimientos.innerHTML = '';
    mostrarToast(mensajeDeError(error), 'error');
  }
}

async function cargarInventario() {
  const usuarioActual = obtenerUsuarioActual();
  const esAdmin = usuarioActual?.rol === 'administrador';
  formularioMovimiento.hidden = !esAdmin;

  try {
    const productos = await api.listarProductosActivos();
    mapaProductos = new Map(productos.map((producto) => [producto.id, producto]));
    poblarSelectProductos(productos);
    actualizarCampoCantidadSegunProducto();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  }

  // Proveedores es un módulo admin-only en el backend (app.js monta
  // /api/proveedores con requiereRol('administrador')) -- un cajero
  // recibiría 403 acá. Se pide aparte, no en el mismo Promise.all que
  // productos, para que ese 403 no tumbe también la carga de productos
  // (que sí necesita el cajero para ver nombres en la lista de movimientos).
  if (esAdmin) {
    try {
      const proveedores = await api.listarProveedores();
      mapaProveedores = new Map(proveedores.map((proveedor) => [proveedor.id, proveedor]));
      poblarSelectProveedores(proveedores.filter((proveedor) => proveedor.activo));
    } catch (error) {
      mostrarToast(mensajeDeError(error), 'error');
    }
  }
  await cargarMovimientos();
}

formularioMovimiento.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const producto = mapaProductos.get(Number(inputMovimientoProducto.value));
  const esPeso = producto?.tipoVenta === 'peso';
  const cantidad = esPeso ? kilosTextoAGramos(inputMovimientoCantidad.value) : Number.parseInt(inputMovimientoCantidad.value, 10);

  const boton = formularioMovimiento.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    await api.crearMovimientoInventario({
      tipo: 'entrada',
      productoId: Number(inputMovimientoProducto.value),
      cantidad,
      motivo: inputMovimientoMotivo.value.trim(),
      ...(inputMovimientoProveedor.value ? { proveedorId: Number(inputMovimientoProveedor.value) } : {}),
    });
    mostrarToast('Entrada registrada');
    inputMovimientoCantidad.value = '';
    inputMovimientoMotivo.value = MOTIVO_POR_DEFECTO;
    inputMovimientoProveedor.value = '';
    await cargarMovimientos();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

export async function abrirInventario() {
  await cargarInventario();
}
