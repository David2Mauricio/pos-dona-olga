import { api, ErrorApi } from './api.js';
import { carrito } from './cart.js';
import { iniciarTema } from './theme.js';
import { iniciarLectorCodigoBarras } from './barcode-scanner.js';
import { renderizarGrillaProductos, renderizarCarrito, actualizarEstadoCaja, renderizarAlertas, mostrarToast } from './render.js';
import { debounce, formatearMoneda } from './utils.js';
import { iniciarAuth, obtenerUsuarioActual } from './auth.js';
import { iniciarHistorial, abrirHistorial } from './historial.js';
import { abrirCatalogo } from './catalogo.js';

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
const campoMontoRecibido = document.getElementById('campo-monto-recibido');
const inputMontoRecibido = document.getElementById('input-monto-recibido');
const filaVuelto = document.getElementById('fila-vuelto');
const vueltoCarrito = document.getElementById('vuelto-carrito');
const botonCobrar = document.getElementById('boton-cobrar');
const navItems = document.querySelectorAll('.nav-lateral__item[data-vista]');
const navHistorial = document.getElementById('nav-historial');
const navProductos = document.getElementById('nav-productos');
const navIndicadores = document.getElementById('nav-indicadores');
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
    alAjustarPrecio: (productoId, precio, motivo) => {
      carrito.establecerOverride(productoId, precio, motivo);
      reRenderizarCarrito();
    },
    alQuitarAjuste: (productoId) => {
      carrito.quitarOverride(productoId);
      reRenderizarCarrito();
    },
    idRecienAgregado: ultimoIdAgregado,
  });
  actualizarVuelto();
  actualizarEstadoBotonCobrar();
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

// --- Vuelto (Fase 3, ver ADR 0012/0013) ---
// Mismo criterio tolerante a mayúsculas/espacios que usa el backend para
// reconocer 'efectivo' (no hay catálogo cerrado de medios de pago, ADR 0004).
function esEfectivo() {
  return selectMedioPago.value.trim().toLowerCase() === 'efectivo';
}

function actualizarVisibilidadMontoRecibido() {
  const mostrar = esEfectivo();
  campoMontoRecibido.hidden = !mostrar;
  filaVuelto.hidden = !mostrar;
  if (!mostrar) inputMontoRecibido.value = '';
}

function actualizarVuelto() {
  if (!esEfectivo()) {
    vueltoCarrito.textContent = formatearMoneda(0);
    return;
  }
  const montoRecibido = Number.parseInt(inputMontoRecibido.value, 10);
  const total = carrito.obtenerTotal();
  const vuelto = Number.isFinite(montoRecibido) ? montoRecibido - total : 0;
  vueltoCarrito.textContent = formatearMoneda(Math.max(vuelto, 0));
}

// Validación en cliente ADEMÁS de la que ya existe en el backend (nunca en
// vez de) — acá solo evita un viaje al servidor que se sabe de antemano
// que va a rechazar; ventas.service.js sigue siendo quien decide de verdad.
function montoRecibidoAlcanza() {
  if (!esEfectivo()) return true;
  const montoRecibido = Number.parseInt(inputMontoRecibido.value, 10);
  return Number.isFinite(montoRecibido) && montoRecibido >= carrito.obtenerTotal();
}

function actualizarEstadoBotonCobrar() {
  botonCobrar.disabled = carrito.estaVacio() || !cajaSesionActual || !montoRecibidoAlcanza();
}

selectMedioPago.addEventListener('change', () => {
  actualizarVisibilidadMontoRecibido();
  actualizarVuelto();
  actualizarEstadoBotonCobrar();
});

inputMontoRecibido.addEventListener('input', () => {
  actualizarVuelto();
  actualizarEstadoBotonCobrar();
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
    const venta = await api.crearVenta({
      cajaSesionId: cajaSesionActual.id,
      tipoPrecio: carrito.obtenerTipoPrecio(),
      medioPago: selectMedioPago.value,
      ...(esEfectivo() ? { montoRecibido: Number.parseInt(inputMontoRecibido.value, 10) } : {}),
      items: carrito.obtenerItemsParaVenta(),
    });

    mostrarToast(
      venta.vuelto !== null ? `Venta registrada — vuelto: ${formatearMoneda(venta.vuelto)}` : 'Venta registrada con éxito'
    );
    carrito.vaciar();
    ultimoIdAgregado = null;
    selectTipoPrecio.value = 'publico';
    inputMontoRecibido.value = '';
    reRenderizarCarrito();
    cargarProductos();
    cargarAlertas();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    botonCobrar.textContent = textoOriginal;
    actualizarEstadoBotonCobrar();
  }
});

// --- Caja ---

async function verificarCaja() {
  cajaSesionActual = await api.obtenerCajaActual();
  actualizarEstadoCaja(elementoEstadoCaja, cajaSesionActual);
  overlayCaja.hidden = Boolean(cajaSesionActual);
  actualizarEstadoBotonCobrar();
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

// --- Alertas ---
// Fase 4/Bloque 1: GET /api/reportes/inventario quedó solo-administrador
// desde Fase 1 (ADR 0010), así que un cajero recibiría 403 ahí. Se arma el
// mismo shape que renderizarAlertas ya espera a partir de los dos
// endpoints de alertas (de ambos roles), sin tocar render.js.

async function cargarAlertas() {
  const [productosStockBajo, lotesPorVencer] = await Promise.all([
    api.obtenerAlertasInventario(),
    api.obtenerAlertasVencimientos(),
  ]);
  renderizarAlertas({ reporte: { productosStockBajo, lotesPorVencer }, mapaProductos, botonAlertas, panelAlertas });
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
// Fase 4/Bloque 1: antes de esto, iniciar() pedía productos/caja/alertas
// sin saber si había sesión — todas esas llamadas volvían 401 y el catch
// genérico las disfrazaba de "no se pudo conectar" (ver ADR 0013). Ahora
// nada del mostrador se pide hasta que iniciarAuth confirme una sesión
// lista (ver auth.js); una sesión que vence a mitad de uso la resuelve el
// hook central de api.js (registrarOnSesionExpirada), no este bloque.

iniciarTema(botonTema);
actualizarVisibilidadMontoRecibido();
reRenderizarCarrito();

// --- Navegación (sidebar persistente, ver ADR 0013) ---
// Un solo mecanismo para las 4 secciones, no un botón suelto por bloque:
// mostrarVista() es el único lugar que decide qué <section
// data-vista-contenido> queda visible. Los ítems deshabilitados (ver
// index.html: Indicadores/Inventario "Próximamente") ignoran el click.
function mostrarVista(nombre) {
  document.querySelectorAll('[data-vista-contenido]').forEach((seccion) => {
    seccion.hidden = seccion.id !== `vista-${nombre}`;
  });
  navItems.forEach((boton) => {
    if (boton.dataset.vista === nombre) {
      boton.setAttribute('aria-current', 'page');
    } else {
      boton.removeAttribute('aria-current');
    }
  });
}

navItems.forEach((boton) => {
  boton.addEventListener('click', () => {
    if (boton.disabled) return;
    const nombre = boton.dataset.vista;
    if (nombre === 'historial') abrirHistorial();
    if (nombre === 'productos') abrirCatalogo();
    mostrarVista(nombre);
  });
});

iniciarHistorial({ obtenerUsuarioActual });

// Historial, Productos e Indicadores son solo-administrador en la UI — la
// protección real de Historial es el 403 ROL_INSUFICIENTE que el backend
// ya devuelve en PATCH /api/ventas/:id/anular (verificado en Bloque 2);
// Productos la misma en POST/PATCH /api/productos y /api/categorias;
// Indicadores (Bloque 3) todavía no existe, así que un cajero ni siquiera
// ve la opción "Próximamente". Inventario queda visible para ambos roles
// (ver inventario.routes.js: listar/alertas es de ambos, solo crear un
// movimiento manual quedó restringido a administrador).
function actualizarNavegacionPorRol(usuario) {
  const esAdmin = usuario.rol === 'administrador';
  navHistorial.hidden = !esAdmin;
  navProductos.hidden = !esAdmin;
  navIndicadores.hidden = !esAdmin;
}

async function iniciarMostrador() {
  try {
    await cargarProductos(); // primero: renderizarAlertas necesita mapaProductos ya listo
    await Promise.all([verificarCaja(), cargarAlertas()]);
  } catch (error) {
    // Acá sí puede ser un error de red real (el servidor no respondió) —
    // ya no absorbe 401 de sesión, eso lo maneja auth.js antes de llegar acá.
    mostrarToast('No se pudo conectar con el servidor. Verificá que esté corriendo.', 'error');
  }
}

iniciarAuth({
  alListo: (usuario) => {
    actualizarNavegacionPorRol(usuario);
    iniciarMostrador();
  },
  alCerrarSesion: () => {
    navHistorial.hidden = true;
    navProductos.hidden = true;
    navIndicadores.hidden = true;
    mostrarVista('mostrador');
    productosActivos = [];
    mapaProductos = new Map();
    cajaSesionActual = null;
    carrito.vaciar();
    ultimoIdAgregado = null;
    reRenderizarCarrito();
  },
});
