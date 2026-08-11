import { api, ErrorApi } from './api.js';
import { carrito } from './cart.js';
import { iniciarTema } from './theme.js';
import { iniciarLectorCodigoBarras } from './barcode-scanner.js';
import { renderizarGrillaProductos, renderizarCarrito, actualizarEstadoCaja, renderizarAlertas, mostrarToast } from './render.js';
import { debounce } from './utils.js';

const elementoEstadoCaja = document.getElementById('estado-caja');
const botonTema = document.getElementById('boton-tema');
const botonAlertas = document.getElementById('boton-alertas');
const panelAlertas = document.getElementById('panel-alertas');
const inputBusqueda = document.getElementById('input-busqueda');
const anuncioLector = document.getElementById('anuncio-lector');
const grillaProductos = document.getElementById('grilla-productos');
const listaCarrito = document.getElementById('lista-carrito');
const totalCarrito = document.getElementById('total-carrito');
const selectTipoPrecio = document.getElementById('select-tipo-precio');
const selectMedioPago = document.getElementById('select-medio-pago');
const botonCobrar = document.getElementById('boton-cobrar');
const overlayCaja = document.getElementById('overlay-caja-cerrada');
const formularioAbrirCaja = document.getElementById('formulario-abrir-caja');
const inputMontoApertura = document.getElementById('input-monto-apertura');

let productosActivos = [];
let mapaProductos = new Map();
let cajaSesionActual = null;
let ultimoIdAgregado = null;

// Quita tildes/diéresis para que buscar "polllo" o "pechuga" encuentre
// resultados sin importar si el cajero escribe los acentos o no.
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

function anunciar(mensaje) {
  anuncioLector.textContent = '';
  window.requestAnimationFrame(() => {
    anuncioLector.textContent = mensaje;
  });
}

// --- Carrito ---

function reRenderizarCarrito() {
  renderizarCarrito({
    contenedorLista: listaCarrito,
    elementoTotal: totalCarrito,
    alCambiarCantidad: (productoId, cantidad) => {
      carrito.actualizarCantidad(productoId, cantidad);
      reRenderizarCarrito();
    },
    alQuitar: (productoId) => {
      carrito.quitarProducto(productoId);
      reRenderizarCarrito();
    },
    idRecienAgregado: ultimoIdAgregado,
  });
  botonCobrar.disabled = carrito.estaVacio() || !cajaSesionActual;
}

function agregarProductoAlCarrito(producto) {
  carrito.agregarProducto(producto);
  ultimoIdAgregado = producto.id;
  reRenderizarCarrito();
  anunciar(`${producto.nombre} agregado al carrito`);
}

selectTipoPrecio.addEventListener('change', () => {
  carrito.establecerTipoPrecio(selectTipoPrecio.value);
  reRenderizarCarrito();
});

// --- Búsqueda manual (filtro en cliente sobre los productos activos ya
// cargados — el backend no expone búsqueda por nombre, y no hay razón
// para inventar un endpoint nuevo solo para esto con un catálogo de este
// tamaño). ---

function renderizarBusquedaActual() {
  const consulta = normalizar(inputBusqueda.value);
  const resultado = consulta ? productosActivos.filter((producto) => normalizar(producto.nombre).includes(consulta)) : productosActivos;
  renderizarGrillaProductos(resultado, grillaProductos, agregarProductoAlCarrito);
}

inputBusqueda.addEventListener('input', debounce(renderizarBusquedaActual, 200));

// --- Lector de código de barras (HID, ver ADR de la interfaz) ---

iniciarLectorCodigoBarras(async (codigo) => {
  try {
    const producto = await api.buscarProductoPorCodigoBarras(codigo);
    if (producto) {
      agregarProductoAlCarrito(producto);
    } else {
      anunciar(`No se encontró ningún producto con el código ${codigo}`);
      mostrarToast(`Código ${codigo} no encontrado`, 'error');
    }
  } catch (error) {
    anunciar('Error buscando el producto escaneado');
    mostrarToast(mensajeDeError(error), 'error');
  }
});

// --- Cobro ---

botonCobrar.addEventListener('click', async () => {
  if (carrito.estaVacio() || !cajaSesionActual) return;

  botonCobrar.disabled = true;
  const textoOriginal = botonCobrar.textContent;
  botonCobrar.textContent = 'Procesando...';

  try {
    // La impresión del recibo y la apertura del cajón son best-effort del
    // backend (ver ADR 0007): esta venta ya quedó registrada apenas la
    // respuesta llega, sin importar si imprimir tarda o falla — por eso
    // el éxito se confirma acá, no se espera nada más.
    await api.crearVenta({
      cajaSesionId: cajaSesionActual.id,
      tipoPrecio: carrito.obtenerTipoPrecio(),
      medioPago: selectMedioPago.value,
      items: carrito.obtenerItemsParaVenta(),
    });

    mostrarToast('Venta registrada con éxito');
    carrito.vaciar();
    ultimoIdAgregado = null;
    selectTipoPrecio.value = 'publico';
    reRenderizarCarrito();
    cargarProductos();
    cargarAlertas();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    botonCobrar.textContent = textoOriginal;
    botonCobrar.disabled = carrito.estaVacio() || !cajaSesionActual;
  }
});

// --- Caja ---

async function verificarCaja() {
  cajaSesionActual = await api.obtenerCajaActual();
  actualizarEstadoCaja(elementoEstadoCaja, cajaSesionActual);
  overlayCaja.hidden = Boolean(cajaSesionActual);
  botonCobrar.disabled = carrito.estaVacio() || !cajaSesionActual;
}

formularioAbrirCaja.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const monto = Number.parseInt(inputMontoApertura.value, 10);
  if (!(monto >= 0)) return;

  const botonAbrir = formularioAbrirCaja.querySelector('button[type="submit"]');
  botonAbrir.disabled = true;
  try {
    await api.abrirCaja(monto);
    await verificarCaja();
    inputMontoApertura.value = '';
    mostrarToast('Caja abierta');
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    botonAbrir.disabled = false;
  }
});

// --- Productos ---

async function cargarProductos() {
  productosActivos = await api.listarProductosActivos();
  mapaProductos = new Map(productosActivos.map((producto) => [producto.id, producto]));
  renderizarBusquedaActual();
}

// --- Alertas (reutiliza el reporte de inventario ya construido: no hay
// razón para llamar dos endpoints separados si uno ya trae todo). ---

async function cargarAlertas() {
  const reporte = await api.obtenerReporteInventario();
  renderizarAlertas({ reporte, mapaProductos, botonAlertas, panelAlertas });
}

botonAlertas.addEventListener('click', () => {
  panelAlertas.hidden = !panelAlertas.hidden;
});

document.addEventListener('click', (evento) => {
  if (panelAlertas.hidden) return;
  if (panelAlertas.contains(evento.target) || botonAlertas.contains(evento.target)) return;
  panelAlertas.hidden = true;
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && !panelAlertas.hidden) {
    panelAlertas.hidden = true;
    botonAlertas.focus();
  }
});

// --- Arranque ---

iniciarTema(botonTema);
reRenderizarCarrito();

async function iniciar() {
  try {
    await cargarProductos(); // primero: renderizarAlertas necesita mapaProductos ya listo
    await Promise.all([verificarCaja(), cargarAlertas()]);
  } catch (error) {
    mostrarToast('No se pudo conectar con el servidor. Verificá que esté corriendo.', 'error');
  }
}

iniciar();
