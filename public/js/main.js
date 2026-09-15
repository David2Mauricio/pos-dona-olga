import { api, ErrorApi } from './api.js';
import { carrito } from './cart.js';
import { iniciarTema } from './theme.js';
import { iniciarAccesibilidad } from './accesibilidad.js';
import { iniciarLectorCodigoBarras } from './barcode-scanner.js';
import { renderizarGrillaProductos, renderizarCarrito, actualizarEstadoCaja, renderizarAlertas, mostrarToast } from './render.js';
import { debounce, formatearMoneda } from './utils.js';
import { iniciarAuth, obtenerUsuarioActual } from './auth.js';

// Historial, Productos, Usuarios y Cierre de Caja se cargan bajo demanda
// (import() dinámico), no con import estático arriba: cada sección nueva
// sumaba su JS al camino crítico de TODA carga inicial, incluida la
// pantalla de login sin sesión — Lighthouse lo empezó a reflejar (ver ADR
// 0013, hallazgo de performance surgido en la sección Usuarios).
// establecerCajaSesionId empieza como no-op porque verificarCaja() podría
// llamarla antes de que el import dinámico de cierre-caja.js resuelva si
// algún día se reordena el arranque — no pasa hoy (se espera el import
// antes de iniciarMostrador()), pero el no-op evita un TypeError si eso
// cambiara.
let establecerCajaSesionId = () => {};
let cierreCajaCargado = false;

const elementoEstadoCaja = document.getElementById('estado-caja');
const botonTema = document.getElementById('boton-tema');
const botonAccesibilidadFlotante = document.getElementById('boton-accesibilidad-flotante');
const botonAlertas = document.getElementById('boton-alertas');
const panelAlertas = document.getElementById('panel-alertas');
const inputBusqueda = document.getElementById('input-busqueda');
const chipsCategorias = document.getElementById('chips-categorias');
const anuncioLector = document.getElementById('anuncio-lector');
const grillaProductos = document.getElementById('grilla-productos');
const listaCarrito = document.getElementById('lista-carrito');
const totalCarrito = document.getElementById('total-carrito');
const selectMedioPago = document.getElementById('select-medio-pago');
const campoMontoRecibido = document.getElementById('campo-monto-recibido');
const inputMontoRecibido = document.getElementById('input-monto-recibido');
const filaVuelto = document.getElementById('fila-vuelto');
const vueltoCarrito = document.getElementById('vuelto-carrito');
const inputImprimirRecibo = document.getElementById('input-imprimir-recibo');
const botonCobrar = document.getElementById('boton-cobrar');
const navItems = document.querySelectorAll('.nav-lateral__item[data-vista]');
const navHistorial = document.getElementById('nav-historial');
const navProductos = document.getElementById('nav-productos');
const navUsuarios = document.getElementById('nav-usuarios');
const navIndicadores = document.getElementById('nav-indicadores');
const navProveedores = document.getElementById('nav-proveedores');
const navAuditoria = document.getElementById('nav-auditoria');
const navGastos = document.getElementById('nav-gastos');
const navLateral = document.getElementById('nav-lateral');
const botonMenu = document.getElementById('boton-menu');
const fondoMenu = document.getElementById('fondo-menu');
const overlayCaja = document.getElementById('overlay-caja-cerrada');
const formularioAbrirCaja = document.getElementById('formulario-abrir-caja');
const inputMontoApertura = document.getElementById('input-monto-apertura');

let productosActivos = [];
let mapaProductos = new Map();
let categoriaSeleccionada = null; // null = "Todas"
let cajaSesionActual = null;
let ultimoIdAgregado = null;
let cierreCajaEnProceso = false;

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
  botonCobrar.disabled = carrito.estaVacio() || !cajaSesionActual || !montoRecibidoAlcanza() || cierreCajaEnProceso;
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
  let resultado = consulta ? productosActivos.filter((producto) => normalizar(producto.nombre).includes(consulta)) : productosActivos;
  if (categoriaSeleccionada != null) {
    resultado = resultado.filter((producto) => producto.categoriaId === categoriaSeleccionada);
  }
  renderizarGrillaProductos(resultado, grillaProductos, agregarProductoAlCarrito);
}

inputBusqueda.addEventListener('input', debounce(renderizarBusquedaActual, 200));

// --- Chips de categoría (rediseño visual, Fase 2): filtro en cliente
// sobre productosActivos ya cargado, igual que el buscador de texto de
// arriba -- se combinan los dos filtros, no son alternativos. ---
function renderizarChipsCategorias(categorias) {
  chipsCategorias.innerHTML = '';

  const crearChip = (id, nombre) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = categoriaSeleccionada === id ? 'chip chip--activo' : 'chip';
    boton.textContent = nombre;
    boton.setAttribute('aria-pressed', String(categoriaSeleccionada === id));
    boton.addEventListener('click', () => {
      categoriaSeleccionada = categoriaSeleccionada === id ? null : id;
      renderizarChipsCategorias(categorias);
      renderizarBusquedaActual();
    });
    return boton;
  };

  chipsCategorias.appendChild(crearChip(null, 'Todas'));
  categorias.forEach((categoria) => chipsCategorias.appendChild(crearChip(categoria.id, categoria.nombre)));
}

async function cargarCategorias() {
  try {
    const categorias = await api.listarCategorias();
    renderizarChipsCategorias(categorias);
  } catch (error) {
    // No bloquea el mostrador si falla -- el buscador de texto sigue
    // funcionando igual sin los chips.
    mostrarToast(mensajeDeError(error), 'error');
  }
}

// --- Lector de código de barras (HID, ver ADR de la interfaz) ---

// El listener es único y global (ver barcode-scanner.js) -- este callback
// decide qué hacer con el código según qué esté abierto en pantalla. Con
// el formulario de alta/edición de Productos abierto, un escaneo completa
// el campo en vez de buscar en el carrito del mostrador (antes solo hacía
// esto último, sin importar qué pantalla estuviera activa -- el campo
// "Código de barras" del formulario nunca se llenaba solo). No se toca el
// bloqueo de #overlay-login (ver barcode-scanner.js): sigue aplicando acá
// igual, un escaneo durante login nunca llega a este callback.
iniciarLectorCodigoBarras(async (codigo) => {
  const overlayProducto = document.getElementById('overlay-form-producto');
  if (overlayProducto && !overlayProducto.hidden) {
    const inputCodigoBarras = document.getElementById('input-producto-codigo-barras');
    if (inputCodigoBarras) {
      inputCodigoBarras.value = codigo;
      inputCodigoBarras.focus();
    }
    return;
  }

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
      // 'publico' fijo -- ya no hay distinción de precio que elegir (ver
      // ADR de eliminación de precio_mayorista). El backend sigue
      // aceptando el campo tipoPrecio tal cual (ADR: alcance acotado a
      // quitar la columna/selector, no tocar el contrato de ventas).
      tipoPrecio: 'publico',
      medioPago: selectMedioPago.value,
      ...(esEfectivo() ? { montoRecibido: Number.parseInt(inputMontoRecibido.value, 10) } : {}),
      items: carrito.obtenerItemsParaVenta(),
      imprimir: inputImprimirRecibo.checked,
    });

    mostrarToast(
      venta.vuelto !== null ? `Venta registrada — vuelto: ${formatearMoneda(venta.vuelto)}` : 'Venta registrada con éxito'
    );
    carrito.vaciar();
    ultimoIdAgregado = null;
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

// El gate de "abrí la caja" tapa TODA la pantalla (.overlay, z-index 50)
// -- por diseño solo tiene sentido sobre Mostrador, que es donde se
// vende. Desde que Tablero es la pantalla de arranque (Fase 3 del
// rediseño visual), un login sin caja abierta lo dejaba tapado apenas se
// entraba, aunque Tablero ya tiene su propio aviso de "caja cerrada" en
// una tarjeta (no necesita bloquear toda la pantalla para mostrarlo).
function actualizarGateDeCaja() {
  const enMostrador = !document.getElementById('vista-mostrador').hidden;
  overlayCaja.hidden = !enMostrador || Boolean(cajaSesionActual);
}

async function verificarCaja() {
  cajaSesionActual = await api.obtenerCajaActual();
  actualizarEstadoCaja(elementoEstadoCaja, cajaSesionActual);
  establecerCajaSesionId(cajaSesionActual?.id ?? null);
  actualizarGateDeCaja();
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

// Sin esto, entrar a Mostrador sin caja abierta dejaba sin salida por el
// nav (el gate tapa la sidebar) -- antes no hacía falta, Mostrador era la
// única pantalla; ahora Tablero es la de arranque (Fase 3). Dispara
// abrirTablero() igual que el click real del nav -- mostrarVista() sola
// solo cambia qué sección se ve, no vuelve a pedir los datos, así que sin
// esto el tablero se veía con lo que tenía cargado desde el login.
document.getElementById('boton-volver-tablero').addEventListener('click', () => {
  mostrarVista('tablero');
  import('./tablero.js').then(({ abrirTablero }) => abrirTablero());
});

// --- Productos ---

async function cargarProductos() {
  productosActivos = await api.listarProductosActivos();
  mapaProductos = new Map(productosActivos.map((producto) => [producto.id, producto]));
  renderizarBusquedaActual();
}

// --- Alertas ---
// Fase 4/Bloque 1: GET /api/reportes/inventario quedó solo-administrador
// desde Fase 1 (ADR 0010), así que un cajero recibiría 403 ahí. Se usa
// el endpoint de alertas de inventario (de ambos roles) en su lugar, sin
// tocar render.js más de lo necesario.
//
// Tarea 1 (retiro de Vencimientos de la interfaz): este panel combinaba
// stock bajo + lotes por vencer/vencidos -- ahora solo pide stock bajo.
async function cargarAlertas() {
  const productosStockBajo = await api.obtenerAlertasInventario();
  renderizarAlertas({ productosStockBajo, botonAlertas, panelAlertas });
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
iniciarAccesibilidad(botonAccesibilidadFlotante);
actualizarVisibilidadMontoRecibido();
reRenderizarCarrito();

// --- Navegación (sidebar persistente, ver ADR 0013) ---
// Un solo mecanismo para las 4 secciones, no un botón suelto por bloque:
// mostrarVista() es el único lugar que decide qué <section
// data-vista-contenido> queda visible. Los ítems deshabilitados (ver
// index.html: Indicadores/Inventario "Próximamente") ignoran el click.
// Exportado para que otras vistas puedan navegar programáticamente (ver
// kpis.js: el link "Ver detalle en Historial" abre Historial ya
// filtrado por el rango de fecha actual de Indicadores, sin pasar por un
// click real de la sidebar).
export function mostrarVista(nombre) {
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
  actualizarGateDeCaja();
}

// --- Menú lateral en anchos chicos (ver ADR 0017, Bloque C) ---
// Por debajo de 768px .nav-lateral pasa de barra fija a cajón (ver CSS) —
// esto solo maneja el estado abierto/cerrado; el CSS decide si el botón
// de hamburguesa y el fondo son visibles según el ancho real.
function abrirMenu() {
  navLateral.classList.add('nav-lateral--abierta');
  fondoMenu.hidden = false;
  botonMenu.setAttribute('aria-expanded', 'true');
}

function cerrarMenu() {
  navLateral.classList.remove('nav-lateral--abierta');
  fondoMenu.hidden = true;
  botonMenu.setAttribute('aria-expanded', 'false');
}

botonMenu.addEventListener('click', () => {
  if (navLateral.classList.contains('nav-lateral--abierta')) {
    cerrarMenu();
  } else {
    abrirMenu();
  }
});
fondoMenu.addEventListener('click', cerrarMenu);
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && navLateral.classList.contains('nav-lateral--abierta')) {
    cerrarMenu();
  }
});

navItems.forEach((boton) => {
  boton.addEventListener('click', () => {
    if (boton.disabled) return;
    cerrarMenu(); // navegar cierra el cajón -- sin esto, taparía la sección recién elegida
    const nombre = boton.dataset.vista;
    if (nombre === 'tablero') {
      import('./tablero.js').then(({ abrirTablero }) => abrirTablero());
    }
    if (nombre === 'historial') {
      import('./historial.js').then(({ iniciarHistorial, abrirHistorial }) => {
        iniciarHistorial({ obtenerUsuarioActual });
        abrirHistorial();
      });
    }
    if (nombre === 'productos') {
      import('./catalogo.js').then(({ abrirCatalogo }) => abrirCatalogo());
    }
    if (nombre === 'usuarios') {
      import('./usuarios.js').then(({ abrirUsuarios }) => abrirUsuarios());
    }
    if (nombre === 'indicadores') {
      import('./kpis.js').then(({ abrirIndicadores }) => abrirIndicadores());
    }
    if (nombre === 'proveedores') {
      import('./proveedores.js').then(({ abrirProveedores }) => abrirProveedores());
    }
    if (nombre === 'inventario') {
      import('./inventario.js').then(({ abrirInventario }) => abrirInventario());
    }
    if (nombre === 'auditoria') {
      import('./auditoria.js').then(({ abrirAuditoria }) => abrirAuditoria());
    }
    if (nombre === 'gastos') {
      import('./gastos.js').then(({ abrirGastos }) => abrirGastos());
    }
    mostrarVista(nombre);
  });
});

// Cierre de caja (ver ADR 0013): mientras el overlay de cierre está
// abierto, "Cobrar" queda bloqueado (mismo criterio que sin caja abierta)
// para que el monto teórico no pueda cambiar entre que se cuenta el
// efectivo y se confirma. Al cerrar el overlay (cancelar o confirmar con
// éxito) se vuelve a chequear el estado real de la caja — si el cierre
// se confirmó, verificarCaja() ya no encuentra sesión abierta y el
// overlay de "caja cerrada" existente se muestra solo.
//
// A diferencia de Historial/Productos/Usuarios, este módulo no se puede
// diferir a un click de nav: su disparador (#estado-caja) vive en la
// cabecera persistente, siempre clickeable apenas hay sesión — así que se
// carga una sola vez, apenas iniciarAuth confirma sesión (alListo), en vez
// de en la carga inicial de la página (que incluye la pantalla de login
// sin sesión, donde no hace falta todavía).
async function cargarModuloCierreCaja() {
  if (cierreCajaCargado) return;
  cierreCajaCargado = true;
  const { iniciarCierreCaja, establecerCajaSesionId: establecer } = await import('./cierre-caja.js');
  establecerCajaSesionId = establecer;
  iniciarCierreCaja({
    alAbrir: () => {
      cierreCajaEnProceso = true;
      actualizarEstadoBotonCobrar();
    },
    alCerrar: () => {
      cierreCajaEnProceso = false;
      verificarCaja();
    },
  });
}

// Historial, Productos, Usuarios, Indicadores y Proveedores son
// solo-administrador en la UI — la protección real de Historial es el 403
// ROL_INSUFICIENTE que el backend ya devuelve en PATCH /api/ventas/:id/anular
// (verificado en Bloque 2); Productos la misma en POST/PATCH /api/productos
// y /api/categorias; Usuarios el módulo entero (app.js monta /api/usuarios
// con requiereRol('administrador')); Indicadores (Bloque 3) el módulo
// entero también (app.js monta /api/reportes con requiereRol('administrador'));
// Proveedores el módulo entero también (app.js monta /api/proveedores con
// requiereRol('administrador'), documentado desde ADR 0010). Auditoría el
// módulo entero también (app.js monta /api/auditoria con
// requiereRol('administrador'), ver ADR 0018). Gastos el módulo entero
// también (app.js monta /api/gastos con requiereRol('administrador') —
// mismo criterio de riesgo que ajuste manual de inventario, ver el ADR de
// exportación CSV/gastos/redondeo/gráficos).
// Inventario queda visible para ambos roles (ver inventario.routes.js:
// listar/alertas es de ambos, solo crear un movimiento manual quedó
// restringido a administrador).
function actualizarNavegacionPorRol(usuario) {
  const esAdmin = usuario.rol === 'administrador';
  navHistorial.hidden = !esAdmin;
  navProductos.hidden = !esAdmin;
  navUsuarios.hidden = !esAdmin;
  navIndicadores.hidden = !esAdmin;
  navProveedores.hidden = !esAdmin;
  navAuditoria.hidden = !esAdmin;
  navGastos.hidden = !esAdmin;
}

async function iniciarMostrador() {
  try {
    await cargarProductos(); // primero: la grilla de productos depende de mapaProductos ya listo
    await Promise.all([verificarCaja(), cargarAlertas(), cargarCategorias()]);
  } catch (error) {
    // Acá sí puede ser un error de red real (el servidor no respondió) —
    // ya no absorbe 401 de sesión, eso lo maneja auth.js antes de llegar acá.
    mostrarToast('No se pudo conectar con el servidor. Verificá que esté corriendo.', 'error');
  }
}

iniciarAuth({
  alListo: async (usuario) => {
    actualizarNavegacionPorRol(usuario);
    await cargarModuloCierreCaja();
    iniciarMostrador(); // precarga productos/caja/alertas en segundo plano, aunque Tablero sea lo primero que se ve
    mostrarVista('tablero');
    import('./tablero.js').then(({ abrirTablero }) => abrirTablero());
  },
  alCerrarSesion: () => {
    navHistorial.hidden = true;
    navProductos.hidden = true;
    navUsuarios.hidden = true;
    navIndicadores.hidden = true;
    navProveedores.hidden = true;
    navAuditoria.hidden = true;
    navGastos.hidden = true;
    mostrarVista('tablero');
    productosActivos = [];
    mapaProductos = new Map();
    cajaSesionActual = null;
    cierreCajaEnProceso = false;
    establecerCajaSesionId(null);
    carrito.vaciar();
    ultimoIdAgregado = null;
    reRenderizarCarrito();
  },
});
