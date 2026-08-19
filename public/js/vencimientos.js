// Lotes de vencimiento (Fase 4, ver ADR 0013). Mismo patrón que
// catalogo.js/usuarios.js: módulo autocontenido, propio DOM, propias
// llamadas. A diferencia de esas dos secciones, esta es de AMBOS roles en
// el backend (app.js monta /api/vencimientos sin requiereRol) — confirmado
// con el cliente: registrar un lote es documentación aditiva (no tiene el
// riesgo de ocultar una merma o un error, a diferencia de anular una
// venta, editar stock de un producto, resetear una contraseña o un ajuste
// manual de inventario, que sí quedaron restringidos). El nav de esta
// sección no se oculta por rol en main.js.
//
// Cantidad: mismo criterio que el alta de Productos (kilosTextoAGramos/
// gramosAKilosTexto de utils.js) — para un producto tipo_venta='peso', la
// persona escribe kg y acá se convierte a gramos antes de mandar al
// backend, porque la tabla lotes_vencimiento guarda un entero genérico sin
// unidad propia (ver ADR 0006), y el criterio de esta interfaz es que esa
// unidad sea siempre la misma que usa el stock del producto.

import { api, ErrorApi } from './api.js';
import { mostrarToast } from './render.js';
import { kilosTextoAGramos, gramosAKilosTexto } from './utils.js';
import { crearInfoTooltip } from './info-tooltip.js';

const tablaVencimientos = document.getElementById('tabla-vencimientos');
const botonNuevoLote = document.getElementById('boton-nuevo-lote');

const overlayFormLote = document.getElementById('overlay-form-lote');
const tituloFormLote = document.getElementById('titulo-form-lote');
const formularioLote = document.getElementById('formulario-lote');
const inputLoteProducto = document.getElementById('input-lote-producto');
const labelLoteCantidad = document.getElementById('label-lote-cantidad');
const inputLoteCantidad = document.getElementById('input-lote-cantidad');
const inputLoteFecha = document.getElementById('input-lote-fecha');
const botonCancelarLote = document.getElementById('boton-cancelar-lote');

let mapaProductos = new Map();
let loteEnEdicion = null; // null = alta; objeto completo en edición

const DIA_MS = 24 * 60 * 60 * 1000;

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

function fechaDeHoyTexto() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

// Mismo cálculo que vencimientos.service.js:obtenerAlertas() (comparación
// de texto YYYY-MM-DD, ADR 0006) — replicado acá solo para pintar el
// badge de cada fila sin pedir /alertas aparte, ya que el listado
// (/lotes) ya trae fechaVencimiento.
function calcularEstadoLote(fechaVencimiento, hoyTexto) {
  if (fechaVencimiento < hoyTexto) return 'vencido';
  const limite = new Date(hoyTexto);
  limite.setDate(limite.getDate() + 3); // DIAS_ALERTA_VENCIMIENTO por defecto; el badge exacto se recalcula server-side en /alertas
  const limiteTexto = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
  if (fechaVencimiento <= limiteTexto) return 'por-vencer';
  return 'vigente';
}

function formatearCantidad(lote, producto) {
  if (!producto) return String(lote.cantidad);
  return producto.tipoVenta === 'peso' ? `${gramosAKilosTexto(lote.cantidad)} kg` : `${lote.cantidad} u.`;
}

// --- Listado ---

async function cargarLotes() {
  tablaVencimientos.innerHTML = '';
  const cargando = document.createElement('p');
  cargando.className = 'catalogo__vacio';
  cargando.textContent = 'Cargando…';
  tablaVencimientos.appendChild(cargando);

  try {
    const [lotes, productos] = await Promise.all([api.listarLotesVencimiento(), api.listarProductosActivos()]);
    mapaProductos = new Map(productos.map((producto) => [producto.id, producto]));
    poblarSelectProductos(productos);
    renderizarLotes(lotes);
  } catch (error) {
    tablaVencimientos.innerHTML = '';
    mostrarToast(mensajeDeError(error), 'error');
  }
}

function poblarSelectProductos(productos) {
  inputLoteProducto.innerHTML = '';
  productos.forEach((producto) => {
    const opcion = document.createElement('option');
    opcion.value = String(producto.id);
    opcion.textContent = producto.nombre;
    inputLoteProducto.appendChild(opcion);
  });
}

function renderizarLotes(lotes) {
  tablaVencimientos.innerHTML = '';

  if (lotes.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'catalogo__vacio';
    vacio.textContent = 'Todavía no hay lotes registrados.';
    tablaVencimientos.appendChild(vacio);
    return;
  }

  const hoyTexto = fechaDeHoyTexto();
  lotes.forEach((lote) => {
    tablaVencimientos.appendChild(crearFilaLote(lote, hoyTexto));
  });
}

function crearFilaLote(lote, hoyTexto) {
  const producto = mapaProductos.get(lote.productoId);
  const estado = calcularEstadoLote(lote.fechaVencimiento, hoyTexto);

  const fila = document.createElement('div');
  fila.className = lote.activo ? 'catalogo__fila catalogo__fila--lote' : 'catalogo__fila catalogo__fila--lote catalogo__fila--inactivo';

  const nombre = document.createElement('span');
  nombre.className = 'catalogo__fila-nombre';
  nombre.textContent = producto?.nombre ?? `Producto #${lote.productoId}`;

  const cantidad = document.createElement('span');
  cantidad.className = 'catalogo__fila-muted';
  cantidad.textContent = formatearCantidad(lote, producto);

  const fecha = document.createElement('span');
  fecha.className = 'catalogo__fila-muted';
  fecha.textContent = lote.fechaVencimiento;

  const badge = document.createElement('span');
  const contenedorBadge = document.createElement('span');
  contenedorBadge.className = 'fila-con-ayuda';
  contenedorBadge.appendChild(badge);
  if (estado === 'vencido') {
    badge.className = 'badge-alerta badge-alerta--peligro';
    badge.textContent = 'Vencido';
  } else if (estado === 'por-vencer') {
    badge.className = 'badge-alerta';
    badge.textContent = 'Por vencer';
    contenedorBadge.appendChild(
      crearInfoTooltip(
        'Se muestra cuando la fecha de vencimiento del lote está dentro del rango de días configurado en el sistema.',
        'Ayuda sobre próximo a vencer'
      )
    );
  } else {
    badge.className = 'catalogo__fila-muted';
    badge.textContent = 'Vigente';
  }

  const acciones = document.createElement('div');
  acciones.className = 'catalogo__fila-acciones';

  const botonEditar = document.createElement('button');
  botonEditar.type = 'button';
  botonEditar.className = 'boton-secundario';
  botonEditar.textContent = 'Editar';
  botonEditar.addEventListener('click', () => abrirFormularioLote(lote));

  const botonToggleActivo = document.createElement('button');
  botonToggleActivo.type = 'button';
  botonToggleActivo.className = 'boton-secundario';
  botonToggleActivo.textContent = lote.activo ? 'Desactivar' : 'Activar';
  botonToggleActivo.addEventListener('click', async () => {
    botonToggleActivo.disabled = true;
    try {
      await api.actualizarLoteVencimiento(lote.id, { activo: !lote.activo });
      mostrarToast(lote.activo ? 'Lote desactivado' : 'Lote activado');
      await cargarLotes();
    } catch (error) {
      mostrarToast(mensajeDeError(error), 'error');
      botonToggleActivo.disabled = false;
    }
  });

  acciones.append(botonEditar, botonToggleActivo);
  fila.append(nombre, cantidad, fecha, contenedorBadge, acciones);
  return fila;
}

// --- Alta / edición ---

function actualizarCampoCantidadSegunProducto() {
  const producto = mapaProductos.get(Number(inputLoteProducto.value));
  const esPeso = producto?.tipoVenta === 'peso';
  labelLoteCantidad.textContent = esPeso ? 'Cantidad (kg)' : 'Cantidad (unidades)';
  inputLoteCantidad.type = esPeso ? 'text' : 'number';
  inputLoteCantidad.inputMode = esPeso ? 'decimal' : 'numeric';
}

inputLoteProducto.addEventListener('change', actualizarCampoCantidadSegunProducto);

function abrirFormularioLote(lote) {
  loteEnEdicion = lote ?? null;
  const esAlta = loteEnEdicion === null;

  tituloFormLote.textContent = esAlta ? 'Nuevo lote' : 'Editar lote';
  formularioLote.querySelector('button[type="submit"]').textContent = esAlta ? 'Crear' : 'Guardar';
  inputLoteProducto.disabled = !esAlta;

  if (esAlta) {
    inputLoteProducto.selectedIndex = 0;
    inputLoteCantidad.value = '';
    inputLoteFecha.value = '';
  } else {
    inputLoteProducto.value = String(lote.productoId);
    const producto = mapaProductos.get(lote.productoId);
    inputLoteCantidad.value = producto?.tipoVenta === 'peso' ? gramosAKilosTexto(lote.cantidad) : String(lote.cantidad);
    inputLoteFecha.value = lote.fechaVencimiento;
  }
  actualizarCampoCantidadSegunProducto();

  overlayFormLote.hidden = false;
}

function cerrarFormularioLote() {
  overlayFormLote.hidden = true;
  loteEnEdicion = null;
  formularioLote.reset();
}

botonNuevoLote.addEventListener('click', () => abrirFormularioLote(null));
botonCancelarLote.addEventListener('click', cerrarFormularioLote);

formularioLote.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const producto = mapaProductos.get(Number(inputLoteProducto.value));
  const esPeso = producto?.tipoVenta === 'peso';
  const cantidad = esPeso ? kilosTextoAGramos(inputLoteCantidad.value) : Number.parseInt(inputLoteCantidad.value, 10);

  const boton = formularioLote.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    if (loteEnEdicion) {
      await api.actualizarLoteVencimiento(loteEnEdicion.id, { cantidad, fechaVencimiento: inputLoteFecha.value });
      mostrarToast('Lote actualizado');
    } else {
      await api.crearLoteVencimiento({ productoId: Number(inputLoteProducto.value), cantidad, fechaVencimiento: inputLoteFecha.value });
      mostrarToast('Lote registrado');
    }
    cerrarFormularioLote();
    await cargarLotes();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

export async function abrirVencimientos() {
  await cargarLotes();
}
