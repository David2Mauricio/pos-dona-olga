// Gestión de productos y categorías (Fase 4, ver ADR 0013). Mismo patrón
// que historial.js: módulo autocontenido (propio DOM, propias llamadas),
// mostrar/ocultar la SECCIÓN en sí es responsabilidad de main.js
// (mostrarVista). Todo dato que viene de la API se inserta con
// textContent, nunca con innerHTML interpolado (mismo criterio que
// render.js).
//
// Alta/edición son solo-administrador en el backend (ver productos.routes.js
// y categorias.routes.js); esta sección entera queda oculta para cajero en
// la sidebar (main.js), pero eso es ayuda de UI — el 403 real lo pone el
// backend.
//
// Decisión (ver ADR 0017, Bloque D — revierte la decisión original de este
// comentario): el stock normal de un producto activo SIGUE sin ser
// editable acá (corregirlo es tarea de un movimiento de ajuste en
// Inventario, ADR 0005) — "Stock inicial" solo se pide en ALTA. Pero
// tipoVenta SÍ es editable ahora: como gramos y unidades no son
// convertibles entre sí, cambiar el tipo de venta en edición revela un
// campo de stock nuevo, obligatorio, con una advertencia visible — nunca
// queda en blanco o en 0 sin que la persona lo note (ver
// actualizarVisibilidadCambioTipoVenta).

import { api, ErrorApi } from './api.js';
import { formatearMoneda, gramosAKilosTexto, kilosTextoAGramos } from './utils.js';
import { mostrarToast } from './render.js';
import { iconoEditar, iconoAgregar, iconoRestar } from './icons.js';
import { crearInfoTooltip } from './info-tooltip.js';

const tabProductos = document.getElementById('tab-productos');
const tabCategorias = document.getElementById('tab-categorias');
const panelProductosLista = document.getElementById('panel-productos-lista');
const panelCategoriasLista = document.getElementById('panel-categorias-lista');
const inputBuscarProductos = document.getElementById('input-buscar-productos');
const selectFiltroCategoria = document.getElementById('select-filtro-categoria');
const selectFiltroActivo = document.getElementById('select-filtro-activo');
const tablaProductos = document.getElementById('tabla-productos');
const tablaCategorias = document.getElementById('tabla-categorias');
const botonNuevoProducto = document.getElementById('boton-nuevo-producto');
const botonNuevaCategoria = document.getElementById('boton-nueva-categoria');
const kpiProductosTotal = document.getElementById('kpi-productos-total');
const kpiProductosStockCritico = document.getElementById('kpi-productos-stock-critico');
const kpiProductosStockCriticoTarjeta = document.getElementById('kpi-productos-stock-critico-tarjeta');
const kpiProductosValorizacion = document.getElementById('kpi-productos-valorizacion');

const overlayFormProducto = document.getElementById('overlay-form-producto');
const tituloFormProducto = document.getElementById('titulo-form-producto');
const formularioProducto = document.getElementById('formulario-producto');
const inputProductoCategoria = document.getElementById('input-producto-categoria');
const inputProductoNombre = document.getElementById('input-producto-nombre');
const inputProductoTipoVenta = document.getElementById('input-producto-tipo-venta');
const inputProductoCodigoBarras = document.getElementById('input-producto-codigo-barras');
const inputProductoPrecioPublico = document.getElementById('input-producto-precio-publico');
const campoProductoStock = document.getElementById('campo-producto-stock');
const labelProductoStock = document.getElementById('label-producto-stock');
const inputProductoStock = document.getElementById('input-producto-stock');
const advertenciaTipoVenta = document.getElementById('advertencia-tipo-venta');
const campoProductoStockNuevo = document.getElementById('campo-producto-stock-nuevo');
const labelProductoStockNuevo = document.getElementById('label-producto-stock-nuevo');
const inputProductoStockNuevo = document.getElementById('input-producto-stock-nuevo');
const labelProductoStockMinimo = document.getElementById('label-producto-stock-minimo');
const inputProductoStockMinimo = document.getElementById('input-producto-stock-minimo');
const campoProductoActivo = document.getElementById('campo-producto-activo');

// Ayuda contextual: se crea una sola vez (no en cada render del
// formulario) y vive como hermano del <label>, nunca adentro -- el label
// cambia de texto dinámicamente según tipoVenta (ver
// actualizarCampoStockSegunTipo), y reemplazar textContent se llevaría
// puesto cualquier hijo.
document.getElementById('ayuda-producto-stock').appendChild(
  crearInfoTooltip(
    'El stock se muestra en kilogramos para productos que se venden por peso, o en unidades para productos que se venden por pieza.',
    'Ayuda sobre el formato de stock'
  )
);

// Solo aplica a productos por peso (el precio de un producto por unidad
// es por pieza, no por kilogramo) -- el contenedor se oculta/muestra
// según tipoVenta en actualizarCampoStockSegunTipo(), mismo criterio que
// el resto de los campos que dependen del tipo de venta.
const contenedorAyudaPrecio = document.getElementById('ayuda-producto-precio');
contenedorAyudaPrecio.appendChild(
  crearInfoTooltip(
    'Este precio corresponde a un kilogramo. El total de cada venta se calcula según el peso real registrado en el mostrador.',
    'Ayuda sobre el precio por peso'
  )
);

// campo-producto-stock-nuevo entero (label, input y este tooltip) ya
// arranca hidden y lo maneja actualizarVisibilidadCambioTipoVenta() --
// no hace falta lógica de visibilidad aparte para el tooltip acá,
// aparece/desaparece junto con el resto del campo.
document.getElementById('ayuda-producto-stock-nuevo').appendChild(
  crearInfoTooltip(
    'Aparece solo al editar un producto existente y cambiar su tipo de venta. Ingresá la cantidad real que hay hoy en existencia, en el nuevo formato — este valor reemplaza al stock anterior, que quedó registrado en la unidad vieja.',
    'Ayuda sobre el stock actual en el formato nuevo'
  )
);

// Tarea 5 (aclaración de stock): este campo no tenía tooltip -- el label
// ya es claro por sí solo, pero faltaba decir QUÉ pasa cuando el stock
// cae por debajo de este número (dónde aparece la alerta).
document.getElementById('ayuda-producto-stock-minimo').appendChild(
  crearInfoTooltip(
    'Cuando el stock actual baja de este número, el producto aparece en las alertas de stock bajo (Tablero y el ícono de alertas del Mostrador). Dejalo en blanco si no querés una alerta para este producto.',
    'Ayuda sobre el stock mínimo'
  )
);

const inputProductoActivo = document.getElementById('input-producto-activo');
const botonCancelarProducto = document.getElementById('boton-cancelar-producto');

// Tarea 6 (ajustar stock desde Producto): bloque fuera de <form
// id="formulario-producto"> a propósito -- ver el comentario en
// index.html junto a #bloque-ajuste-stock. Reusa el MISMO mecanismo de
// Inventario (POST /api/inventario/movimientos, tipo:'ajuste'); nunca
// edita productos.stock_* directo (ADR 0005).
const bloqueAjusteStock = document.getElementById('bloque-ajuste-stock');
const textoStockActualAjuste = document.getElementById('texto-stock-actual-ajuste');
const labelAjusteStockNuevo = document.getElementById('label-ajuste-stock-nuevo');
const inputAjusteStockNuevo = document.getElementById('input-ajuste-stock-nuevo');
const inputAjusteStockMotivo = document.getElementById('input-ajuste-stock-motivo');
const botonGuardarAjusteStock = document.getElementById('boton-guardar-ajuste-stock');

const overlayFormCategoria = document.getElementById('overlay-form-categoria');
const tituloFormCategoria = document.getElementById('titulo-form-categoria');
const formularioCategoria = document.getElementById('formulario-categoria');
const inputCategoriaNombre = document.getElementById('input-categoria-nombre');
const botonCancelarCategoria = document.getElementById('boton-cancelar-categoria');

let categorias = [];
let mapaCategorias = new Map();
let productoEnEdicion = null; // null = alta; objeto completo en edición (necesita tipoVenta para convertir stockMinimo)
let categoriaEnEdicionId = null; // null = alta

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

function crearOpcion(valor, texto) {
  const opcion = document.createElement('option');
  opcion.value = valor;
  opcion.textContent = texto;
  return opcion;
}

// --- Tabs ---

function mostrarTab(nombre) {
  const esProductos = nombre === 'productos';
  panelProductosLista.hidden = !esProductos;
  panelCategoriasLista.hidden = esProductos;
  tabProductos.setAttribute('aria-selected', String(esProductos));
  tabCategorias.setAttribute('aria-selected', String(!esProductos));
  tabProductos.classList.toggle('catalogo__tab--activo', esProductos);
  tabCategorias.classList.toggle('catalogo__tab--activo', !esProductos);
}

tabProductos.addEventListener('click', () => mostrarTab('productos'));
tabCategorias.addEventListener('click', () => mostrarTab('categorias'));

// --- Categorías ---

async function cargarCategorias() {
  categorias = await api.listarCategorias();
  mapaCategorias = new Map(categorias.map((c) => [c.id, c.nombre]));

  selectFiltroCategoria.innerHTML = '';
  selectFiltroCategoria.appendChild(crearOpcion('', 'Todas las categorías'));
  inputProductoCategoria.innerHTML = '';
  for (const categoria of categorias) {
    selectFiltroCategoria.appendChild(crearOpcion(String(categoria.id), categoria.nombre));
    inputProductoCategoria.appendChild(crearOpcion(String(categoria.id), categoria.nombre));
  }

  renderizarCategorias();
}

function renderizarCategorias() {
  tablaCategorias.innerHTML = '';

  if (categorias.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'catalogo__vacio';
    vacio.textContent = 'Todavía no hay categorías creadas.';
    tablaCategorias.appendChild(vacio);
    return;
  }

  categorias.forEach((categoria) => {
    const fila = document.createElement('div');
    fila.className = 'catalogo__fila catalogo__fila--categoria';

    const nombre = document.createElement('span');
    nombre.className = 'catalogo__fila-nombre';
    nombre.textContent = categoria.nombre;

    const botonEditar = document.createElement('button');
    botonEditar.type = 'button';
    botonEditar.className = 'boton-icono';
    botonEditar.setAttribute('aria-label', `Editar categoría ${categoria.nombre}`);
    botonEditar.innerHTML = iconoEditar;
    botonEditar.addEventListener('click', () => abrirFormularioCategoria(categoria));

    fila.append(nombre, botonEditar);
    tablaCategorias.appendChild(fila);
  });
}

function abrirFormularioCategoria(categoria) {
  categoriaEnEdicionId = categoria ? categoria.id : null;
  tituloFormCategoria.textContent = categoria ? 'Editar categoría' : 'Nueva categoría';
  inputCategoriaNombre.value = categoria ? categoria.nombre : '';
  overlayFormCategoria.hidden = false;
  inputCategoriaNombre.focus();
}

function cerrarFormularioCategoria() {
  overlayFormCategoria.hidden = true;
  formularioCategoria.reset();
}

botonNuevaCategoria.addEventListener('click', () => abrirFormularioCategoria(null));
botonCancelarCategoria.addEventListener('click', cerrarFormularioCategoria);

formularioCategoria.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const nombre = inputCategoriaNombre.value.trim();
  if (!nombre) return;

  const boton = formularioCategoria.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    if (categoriaEnEdicionId) {
      await api.actualizarCategoria(categoriaEnEdicionId, nombre);
      mostrarToast('Categoría actualizada');
    } else {
      await api.crearCategoria(nombre);
      mostrarToast('Categoría creada');
    }
    cerrarFormularioCategoria();
    await cargarCategorias();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

// --- Productos ---

let productosCargados = [];
let soloStockCritico = false; // toggle del CTA en la tarjeta KPI "Stock crítico"

async function cargarProductos() {
  tablaProductos.innerHTML = '';
  const cargando = document.createElement('p');
  cargando.className = 'catalogo__vacio';
  cargando.textContent = 'Cargando…';
  tablaProductos.appendChild(cargando);

  try {
    const filtros = {};
    if (selectFiltroCategoria.value) filtros.categoriaId = selectFiltroCategoria.value;
    if (selectFiltroActivo.value) filtros.activo = selectFiltroActivo.value;
    productosCargados = await api.listarProductosCatalogo(filtros);
    renderizarKPIsProductos(productosCargados);
    renderizarProductosFiltrados();
  } catch (error) {
    tablaProductos.innerHTML = '';
    mostrarToast(mensajeDeError(error), 'error');
  }
}

// Cálculo en cliente sobre la lista ya cargada (confirmado explícito con
// el cliente antes de esta fase: sin endpoint de agregados nuevo -- para
// el tamaño real del catálogo de Doña Olga esto no tiene costo real de
// rendimiento; si el catálogo creciera mucho, esto se movería al backend
// recién ahí, no antes). "Stock crítico" usa el mismo criterio que ya usa
// el backend en inventario.repository.js:obtenerAlertas (stock_minimo no
// nulo y por debajo de él) -- no se reinventa el umbral acá.
function estaEnStockCritico(producto) {
  if (producto.stockMinimo == null) return false;
  const stockActual = producto.tipoVenta === 'peso' ? producto.stockGramos : producto.stockUnidades;
  return stockActual < producto.stockMinimo;
}

function renderizarKPIsProductos(productos) {
  kpiProductosTotal.textContent = String(productos.length);

  const critico = productos.filter(estaEnStockCritico).length;
  kpiProductosStockCritico.textContent = String(critico);
  kpiProductosStockCriticoTarjeta.classList.toggle('tarjeta-kpi--alerta', critico > 0);
  kpiProductosStockCriticoTarjeta.classList.toggle('tarjeta-kpi--clickeable', critico > 0);
  kpiProductosStockCriticoTarjeta.setAttribute('role', critico > 0 ? 'button' : 'presentation');
  kpiProductosStockCriticoTarjeta.tabIndex = critico > 0 ? 0 : -1;

  const valorizacion = productos.reduce((suma, producto) => {
    const stockActual = producto.tipoVenta === 'peso' ? producto.stockGramos / 1000 : producto.stockUnidades;
    return suma + producto.precioPublico * stockActual;
  }, 0);
  kpiProductosValorizacion.textContent = formatearMoneda(Math.round(valorizacion));
}

function alternarFiltroStockCritico() {
  if (kpiProductosStockCriticoTarjeta.getAttribute('role') !== 'button') return;
  soloStockCritico = !soloStockCritico;
  kpiProductosStockCriticoTarjeta.setAttribute('aria-pressed', String(soloStockCritico));
  renderizarProductosFiltrados();
}

// Exportado para el CTA de la tarjeta "Stock crítico" en Inventario (ver
// inventario.js) -- navega acá y activa el mismo filtro, en vez de
// duplicar el cálculo de qué está en stock crítico en dos módulos.
export function activarFiltroStockCritico() {
  soloStockCritico = true;
  kpiProductosStockCriticoTarjeta.setAttribute('aria-pressed', 'true');
  renderizarProductosFiltrados();
}

kpiProductosStockCriticoTarjeta.addEventListener('click', alternarFiltroStockCritico);
kpiProductosStockCriticoTarjeta.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter' || evento.key === ' ') {
    evento.preventDefault();
    alternarFiltroStockCritico();
  }
});

// Mismo criterio que main.js: quita tildes/diéresis para que la búsqueda
// no dependa de que el admin tipee los acentos.
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function renderizarProductosFiltrados() {
  const consulta = normalizar(inputBuscarProductos.value);
  let lista = consulta ? productosCargados.filter((producto) => normalizar(producto.nombre).includes(consulta)) : productosCargados;
  if (soloStockCritico) lista = lista.filter(estaEnStockCritico);
  renderizarProductos(lista);
}

function formatearStock(producto) {
  return producto.tipoVenta === 'peso' ? `${gramosAKilosTexto(producto.stockGramos)} kg` : `${producto.stockUnidades} u.`;
}

function renderizarProductos(lista) {
  tablaProductos.innerHTML = '';

  if (lista.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'catalogo__vacio';
    vacio.textContent = soloStockCritico ? 'Ningún producto está en stock crítico ahora mismo.' : 'No se encontraron productos con esos filtros.';
    tablaProductos.appendChild(vacio);
    return;
  }

  lista.forEach((producto) => {
    const fila = document.createElement('div');
    fila.className = producto.activo ? 'catalogo__fila' : 'catalogo__fila catalogo__fila--inactivo';

    const nombre = document.createElement('span');
    nombre.className = 'catalogo__fila-nombre';
    nombre.textContent = producto.nombre;

    const categoria = document.createElement('span');
    categoria.className = 'catalogo__fila-muted';
    categoria.textContent = mapaCategorias.get(producto.categoriaId) ?? `Categoría #${producto.categoriaId}`;

    const tipoVenta = document.createElement('span');
    tipoVenta.className = 'catalogo__fila-muted';
    tipoVenta.textContent = producto.tipoVenta === 'peso' ? 'Peso' : 'Unidad';

    const precios = document.createElement('span');
    precios.className = 'numero';
    precios.textContent = formatearMoneda(producto.precioPublico);

    const stock = document.createElement('span');
    stock.className = 'catalogo__fila-stock';

    const stockValor = document.createElement('span');
    stockValor.className = 'numero';
    stockValor.textContent = formatearStock(producto);
    stock.appendChild(stockValor);

    // Ajuste rápido +/-1 SOLO para 'unidad' (rediseño visual, Fase 4) --
    // mismo criterio que el stepper del carrito en Fase 2: un peso viene
    // de la báscula, +/-1 no tiene sentido ahí. Dispara un movimiento de
    // 'ajuste' real (mismo endpoint que ya usa Inventario) -- no es un
    // atajo que edite productos.stock_unidades por su cuenta, así que el
    // historial de movimientos sigue siendo la única fuente de verdad de
    // cómo cambió el stock (ver ADR 0006 sobre lotes de vencimiento: ya
    // establece que productos.stock_* es la fuente de verdad del stock
    // actual, esto no crea una segunda). Convive con el ajuste manual
    // completo de Inventario, que sigue siendo la vía para corregir a un
    // número exacto.
    if (producto.activo && producto.tipoVenta === 'unidad') {
      const botonRestar = document.createElement('button');
      botonRestar.type = 'button';
      botonRestar.className = 'catalogo__fila-paso';
      botonRestar.setAttribute('aria-label', `Restar una unidad de ${producto.nombre}`);
      botonRestar.innerHTML = iconoRestar;
      botonRestar.addEventListener('click', () => ajustarStockRapido(producto, -1));

      const botonSumar = document.createElement('button');
      botonSumar.type = 'button';
      botonSumar.className = 'catalogo__fila-paso';
      botonSumar.setAttribute('aria-label', `Sumar una unidad de ${producto.nombre}`);
      botonSumar.innerHTML = iconoAgregar;
      botonSumar.addEventListener('click', () => ajustarStockRapido(producto, 1));

      stock.append(botonRestar, botonSumar);
    }

    const estado = document.createElement('span');
    estado.className = producto.activo ? 'badge-alerta badge-alerta--exito' : 'badge-alerta badge-alerta--peligro';
    estado.textContent = producto.activo ? 'Activo' : 'Inactivo';

    const botonEditar = document.createElement('button');
    botonEditar.type = 'button';
    botonEditar.className = 'boton-icono';
    botonEditar.setAttribute('aria-label', `Editar ${producto.nombre}`);
    botonEditar.innerHTML = iconoEditar;
    botonEditar.addEventListener('click', () => abrirFormularioProducto(producto));

    fila.append(nombre, categoria, tipoVenta, precios, stock, estado, botonEditar);
    tablaProductos.appendChild(fila);
  });
}

async function ajustarStockRapido(producto, delta) {
  const stockActual = producto.stockUnidades;
  const stockNuevo = Math.max(0, stockActual + delta);
  if (stockNuevo === stockActual) return; // ya está en 0, restar no hace nada

  try {
    await api.crearMovimientoInventario({
      tipo: 'ajuste',
      productoId: producto.id,
      stockNuevo,
      motivo: 'Ajuste rápido desde Productos',
    });
    await cargarProductos();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  }
}

inputBuscarProductos.addEventListener('input', renderizarProductosFiltrados);
selectFiltroCategoria.addEventListener('change', cargarProductos);
selectFiltroActivo.addEventListener('change', cargarProductos);

// --- Formulario de producto (alta/edición) ---

function abrirFormularioProducto(producto) {
  productoEnEdicion = producto ?? null;
  tituloFormProducto.textContent = producto ? `Editar ${producto.nombre}` : 'Nuevo producto';

  inputProductoCategoria.value = producto ? String(producto.categoriaId) : inputProductoCategoria.options[0]?.value ?? '';
  inputProductoNombre.value = producto ? producto.nombre : '';
  inputProductoCodigoBarras.value = producto?.codigoBarras ?? '';
  inputProductoPrecioPublico.value = producto ? String(producto.precioPublico) : '';
  const tipoVentaActual = producto ? producto.tipoVenta : 'unidad';
  const esPesoActual = tipoVentaActual === 'peso';
  labelProductoStockMinimo.textContent = esPesoActual ? 'Stock mínimo para alerta, en kg (opcional)' : 'Stock mínimo para alerta (opcional)';
  inputProductoStockMinimo.value = producto
    ? (esPesoActual ? (producto.stockMinimo != null ? gramosAKilosTexto(producto.stockMinimo) : '') : producto.stockMinimo ?? '')
    : '';

  // tipoVenta: visible siempre ahora (alta y edición, ver ADR 0017).
  // "Stock inicial" sigue siendo solo de alta.
  const esAlta = !producto;
  campoProductoStock.hidden = !esAlta;
  inputProductoTipoVenta.required = true;
  inputProductoStock.required = esAlta;
  inputProductoTipoVenta.value = producto ? producto.tipoVenta : 'unidad';
  if (esAlta) {
    inputProductoStock.value = '';
  }
  actualizarCampoStockSegunTipo();
  actualizarVisibilidadCambioTipoVenta();

  // activo: solo en edición.
  campoProductoActivo.hidden = esAlta;
  if (!esAlta) inputProductoActivo.checked = producto.activo;

  // Ajustar stock (Tarea 6): solo en edición -- en alta el stock inicial
  // ya lo pide el campo de arriba. Usa producto.tipoVenta (el valor YA
  // guardado), no el select del formulario de arriba: esta acción dispara
  // un movimiento aparte, de inmediato, independiente de si hay cambios
  // sin guardar en el resto del formulario.
  bloqueAjusteStock.hidden = esAlta;
  if (!esAlta) {
    textoStockActualAjuste.textContent = `Stock actual: ${formatearStock(producto)}`;
    const esPesoAjuste = producto.tipoVenta === 'peso';
    labelAjusteStockNuevo.textContent = esPesoAjuste ? 'Conteo físico real, en kg' : 'Conteo físico real, en unidades';
    inputAjusteStockNuevo.type = esPesoAjuste ? 'text' : 'number';
    inputAjusteStockNuevo.inputMode = esPesoAjuste ? 'decimal' : 'numeric';
    inputAjusteStockNuevo.value = esPesoAjuste ? gramosAKilosTexto(producto.stockGramos) : String(producto.stockUnidades);
    inputAjusteStockMotivo.value = '';
  }

  overlayFormProducto.hidden = false;
  inputProductoCategoria.focus();
}

function cerrarFormularioProducto() {
  overlayFormProducto.hidden = true;
  formularioProducto.reset();
  advertenciaTipoVenta.hidden = true;
  campoProductoStockNuevo.hidden = true;
  inputProductoStockNuevo.required = false;
  bloqueAjusteStock.hidden = true;
  inputAjusteStockNuevo.value = '';
  inputAjusteStockMotivo.value = '';
}

function actualizarCampoStockSegunTipo() {
  const esPeso = inputProductoTipoVenta.value === 'peso';
  labelProductoStock.textContent = esPeso ? 'Stock inicial (kg)' : 'Stock inicial (unidades)';
  inputProductoStock.type = esPeso ? 'text' : 'number';
  inputProductoStock.inputMode = esPeso ? 'decimal' : 'numeric';
  labelProductoStockMinimo.textContent = esPeso ? 'Stock mínimo para alerta, en kg (opcional)' : 'Stock mínimo para alerta (opcional)';
  contenedorAyudaPrecio.hidden = !esPeso;
}

// Solo aplica en edición: si la persona cambia el tipo de venta a algo
// distinto del que ya tenía el producto, gramos y unidades no son
// convertibles entre sí (ver ADR 0017), así que se exige declarar de
// nuevo el stock actual, en el formato nuevo -- nunca queda en blanco o
// en 0 sin que lo note. Sin cambio real (o en alta, donde no aplica),
// el campo extra queda oculto y no se manda nada de más.
function actualizarVisibilidadCambioTipoVenta() {
  const cambioReal = productoEnEdicion && inputProductoTipoVenta.value !== productoEnEdicion.tipoVenta;
  advertenciaTipoVenta.hidden = !cambioReal;
  campoProductoStockNuevo.hidden = !cambioReal;
  inputProductoStockNuevo.required = cambioReal;

  if (cambioReal) {
    const esPeso = inputProductoTipoVenta.value === 'peso';
    // Sin "(formato nuevo)" -- era jerga interna (Tarea 5, aclaración de
    // stock): no le dice nada a quien usa el sistema. La unidad (kg vs.
    // unidades) sí importa acá mismo, al cargar el número -- eso se
    // queda en el label. El POR QUÉ aparece este campo y reemplaza al
    // valor anterior ya lo explica la advertencia visible arriba
    // (#advertencia-tipo-venta) y el tooltip ⓘ de al lado, no hace falta
    // repetirlo en el label.
    labelProductoStockNuevo.textContent = esPeso ? 'Stock actual, en kg' : 'Stock actual, en unidades';
    inputProductoStockNuevo.type = esPeso ? 'text' : 'number';
    inputProductoStockNuevo.inputMode = esPeso ? 'decimal' : 'numeric';
    inputProductoStockNuevo.value = '';
    // El stock mínimo ya cargado también está en la unidad vieja -- lo
    // limpiamos para no dejar un número que ahora se leería mal (ver
    // mismo criterio en productos.service.js: el backend lo limpia igual
    // si no se manda de nuevo).
    inputProductoStockMinimo.value = '';
  }
}

inputProductoTipoVenta.addEventListener('change', () => {
  actualizarCampoStockSegunTipo();
  actualizarVisibilidadCambioTipoVenta();
});
botonNuevoProducto.addEventListener('click', () => abrirFormularioProducto(null));
botonCancelarProducto.addEventListener('click', cerrarFormularioProducto);

// Botón suelto (type="button"), no submit de #formulario-producto -- ver
// el comentario junto a #bloque-ajuste-stock en index.html.
botonGuardarAjusteStock.addEventListener('click', async () => {
  if (!productoEnEdicion) return; // el bloque está oculto en alta; solo defensivo

  const motivo = inputAjusteStockMotivo.value.trim();
  if (!motivo) {
    mostrarToast('Escribí un motivo para el ajuste', 'error');
    inputAjusteStockMotivo.focus();
    return;
  }

  const esPeso = productoEnEdicion.tipoVenta === 'peso';
  const stockNuevo = esPeso ? kilosTextoAGramos(inputAjusteStockNuevo.value) : Number.parseInt(inputAjusteStockNuevo.value, 10);
  if (!Number.isFinite(stockNuevo) || stockNuevo < 0) {
    mostrarToast('Ingresá un conteo físico válido', 'error');
    inputAjusteStockNuevo.focus();
    return;
  }

  botonGuardarAjusteStock.disabled = true;
  try {
    await api.crearMovimientoInventario({
      tipo: 'ajuste',
      productoId: productoEnEdicion.id,
      stockNuevo,
      motivo,
    });
    mostrarToast('Stock ajustado');
    await cargarProductos();
    // Refresca productoEnEdicion con el dato recién guardado para que el
    // bloque siga mostrando el stock real sin cerrar el overlay -- se
    // puede seguir editando el producto o hacer otro ajuste.
    productoEnEdicion = productosCargados.find((p) => p.id === productoEnEdicion.id) ?? productoEnEdicion;
    textoStockActualAjuste.textContent = `Stock actual: ${formatearStock(productoEnEdicion)}`;
    inputAjusteStockNuevo.value = esPeso ? gramosAKilosTexto(productoEnEdicion.stockGramos) : String(productoEnEdicion.stockUnidades);
    inputAjusteStockMotivo.value = '';
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    botonGuardarAjusteStock.disabled = false;
  }
});

formularioProducto.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const boton = formularioProducto.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    if (productoEnEdicion) {
      const tipoVentaNuevo = inputProductoTipoVenta.value;
      const cambioTipoVenta = tipoVentaNuevo !== productoEnEdicion.tipoVenta;
      // stockMinimo se manda en la unidad del tipoVenta VIGENTE al momento
      // de guardar (el nuevo si cambió, el de siempre si no) — mismo
      // criterio que el resto del formulario.
      const esPeso = tipoVentaNuevo === 'peso';
      const cambios = {
        categoriaId: Number.parseInt(inputProductoCategoria.value, 10),
        nombre: inputProductoNombre.value.trim(),
        tipoVenta: tipoVentaNuevo,
        codigoBarras: inputProductoCodigoBarras.value.trim() || null,
        precioPublico: Number.parseInt(inputProductoPrecioPublico.value, 10),
        activo: inputProductoActivo.checked,
        stockMinimo: inputProductoStockMinimo.value
          ? (esPeso ? kilosTextoAGramos(inputProductoStockMinimo.value) : Number.parseInt(inputProductoStockMinimo.value, 10))
          : null,
      };
      // Cambiar tipoVenta exige declarar el stock actual en el formato
      // nuevo (ver actualizarVisibilidadCambioTipoVenta y ADR 0017) — el
      // backend igual lo exige y rechaza si falta, esto es solo para no
      // depender únicamente de esa validación del lado del servidor.
      if (cambioTipoVenta) {
        if (esPeso) {
          cambios.stockGramos = kilosTextoAGramos(inputProductoStockNuevo.value);
        } else {
          cambios.stockUnidades = Number.parseInt(inputProductoStockNuevo.value, 10);
        }
      }
      await api.actualizarProducto(productoEnEdicion.id, cambios);
      mostrarToast('Producto actualizado');
    } else {
      const tipoVenta = inputProductoTipoVenta.value;
      const esPeso = tipoVenta === 'peso';
      const datos = {
        categoriaId: Number.parseInt(inputProductoCategoria.value, 10),
        nombre: inputProductoNombre.value.trim(),
        tipoVenta,
        codigoBarras: inputProductoCodigoBarras.value.trim() || null,
        precioPublico: Number.parseInt(inputProductoPrecioPublico.value, 10),
        stockMinimo: inputProductoStockMinimo.value
          ? (esPeso ? kilosTextoAGramos(inputProductoStockMinimo.value) : Number.parseInt(inputProductoStockMinimo.value, 10))
          : null,
      };
      if (esPeso) {
        datos.stockGramos = kilosTextoAGramos(inputProductoStock.value);
      } else {
        datos.stockUnidades = Number.parseInt(inputProductoStock.value, 10);
      }
      await api.crearProducto(datos);
      mostrarToast('Producto creado');
    }
    cerrarFormularioProducto();
    await cargarProductos();
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    boton.disabled = false;
  }
});

export async function abrirCatalogo() {
  await cargarCategorias();
  await cargarProductos();
}
