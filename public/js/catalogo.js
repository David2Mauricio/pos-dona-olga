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
// Decisión (confirmada con el cliente): el formulario de EDICIÓN no expone
// stock ni tipo de venta. tipoVenta es inmutable en el backend (ni el
// schema de PATCH lo acepta); stock si se dejara editable acá evitaría el
// ledger de movimientos_inventario (ADR 0005) — corregir stock de un
// producto activo es tarea de un movimiento de ajuste (Inventario), no de
// este formulario. En ALTA sí se pide stock inicial: un producto nuevo no
// tiene historial que romper.

import { api, ErrorApi } from './api.js';
import { formatearMoneda, gramosAKilosTexto, kilosTextoAGramos } from './utils.js';
import { mostrarToast } from './render.js';
import { iconoEditar } from './icons.js';

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

const overlayFormProducto = document.getElementById('overlay-form-producto');
const tituloFormProducto = document.getElementById('titulo-form-producto');
const formularioProducto = document.getElementById('formulario-producto');
const inputProductoCategoria = document.getElementById('input-producto-categoria');
const inputProductoNombre = document.getElementById('input-producto-nombre');
const campoProductoTipoVenta = document.getElementById('campo-producto-tipo-venta');
const inputProductoTipoVenta = document.getElementById('input-producto-tipo-venta');
const inputProductoCodigoBarras = document.getElementById('input-producto-codigo-barras');
const inputProductoPrecioPublico = document.getElementById('input-producto-precio-publico');
const inputProductoPrecioMayorista = document.getElementById('input-producto-precio-mayorista');
const campoProductoStock = document.getElementById('campo-producto-stock');
const labelProductoStock = document.getElementById('label-producto-stock');
const inputProductoStock = document.getElementById('input-producto-stock');
const labelProductoStockMinimo = document.getElementById('label-producto-stock-minimo');
const inputProductoStockMinimo = document.getElementById('input-producto-stock-minimo');
const campoProductoActivo = document.getElementById('campo-producto-activo');
const inputProductoActivo = document.getElementById('input-producto-activo');
const botonCancelarProducto = document.getElementById('boton-cancelar-producto');

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
    renderizarProductosFiltrados();
  } catch (error) {
    tablaProductos.innerHTML = '';
    mostrarToast(mensajeDeError(error), 'error');
  }
}

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
  const lista = consulta
    ? productosCargados.filter((producto) => normalizar(producto.nombre).includes(consulta))
    : productosCargados;
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
    vacio.textContent = 'No se encontraron productos con esos filtros.';
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
    precios.textContent = producto.precioMayorista
      ? `${formatearMoneda(producto.precioPublico)} / ${formatearMoneda(producto.precioMayorista)}`
      : formatearMoneda(producto.precioPublico);

    const stock = document.createElement('span');
    stock.className = 'numero';
    stock.textContent = formatearStock(producto);

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
  inputProductoPrecioMayorista.value = producto?.precioMayorista ?? '';
  const tipoVentaActual = producto ? producto.tipoVenta : 'unidad';
  const esPesoActual = tipoVentaActual === 'peso';
  labelProductoStockMinimo.textContent = esPesoActual ? 'Stock mínimo para alerta, en kg (opcional)' : 'Stock mínimo para alerta (opcional)';
  inputProductoStockMinimo.value = producto
    ? (esPesoActual ? (producto.stockMinimo != null ? gramosAKilosTexto(producto.stockMinimo) : '') : producto.stockMinimo ?? '')
    : '';

  // tipoVenta y stock: solo en alta (ver comentario de cabecera del archivo).
  const esAlta = !producto;
  campoProductoTipoVenta.hidden = !esAlta;
  campoProductoStock.hidden = !esAlta;
  inputProductoTipoVenta.required = esAlta;
  inputProductoStock.required = esAlta;
  if (esAlta) {
    inputProductoTipoVenta.value = 'unidad';
    inputProductoStock.value = '';
    actualizarCampoStockSegunTipo();
  }

  // activo: solo en edición.
  campoProductoActivo.hidden = esAlta;
  if (!esAlta) inputProductoActivo.checked = producto.activo;

  overlayFormProducto.hidden = false;
  inputProductoCategoria.focus();
}

function cerrarFormularioProducto() {
  overlayFormProducto.hidden = true;
  formularioProducto.reset();
}

function actualizarCampoStockSegunTipo() {
  const esPeso = inputProductoTipoVenta.value === 'peso';
  labelProductoStock.textContent = esPeso ? 'Stock inicial (kg)' : 'Stock inicial (unidades)';
  inputProductoStock.type = esPeso ? 'text' : 'number';
  inputProductoStock.inputMode = esPeso ? 'decimal' : 'numeric';
  labelProductoStockMinimo.textContent = esPeso ? 'Stock mínimo para alerta, en kg (opcional)' : 'Stock mínimo para alerta (opcional)';
}

inputProductoTipoVenta.addEventListener('change', actualizarCampoStockSegunTipo);
botonNuevoProducto.addEventListener('click', () => abrirFormularioProducto(null));
botonCancelarProducto.addEventListener('click', cerrarFormularioProducto);

formularioProducto.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const boton = formularioProducto.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    if (productoEnEdicion) {
      // stockMinimo se manda en la unidad nativa del producto (gramos si es
      // peso, unidades si no) — tipoVenta no está en el DOM en edición (el
      // campo queda oculto, ver comentario de cabecera), pero sí lo
      // conservamos en productoEnEdicion desde que se abrió el formulario.
      const esPeso = productoEnEdicion.tipoVenta === 'peso';
      const cambios = {
        categoriaId: Number.parseInt(inputProductoCategoria.value, 10),
        nombre: inputProductoNombre.value.trim(),
        codigoBarras: inputProductoCodigoBarras.value.trim() || null,
        precioPublico: Number.parseInt(inputProductoPrecioPublico.value, 10),
        precioMayorista: inputProductoPrecioMayorista.value ? Number.parseInt(inputProductoPrecioMayorista.value, 10) : null,
        activo: inputProductoActivo.checked,
        stockMinimo: inputProductoStockMinimo.value
          ? (esPeso ? kilosTextoAGramos(inputProductoStockMinimo.value) : Number.parseInt(inputProductoStockMinimo.value, 10))
          : null,
      };
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
        precioMayorista: inputProductoPrecioMayorista.value ? Number.parseInt(inputProductoPrecioMayorista.value, 10) : null,
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
