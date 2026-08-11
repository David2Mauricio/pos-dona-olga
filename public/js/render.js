// Todo el DOM dinámico vive acá — separado de cart.js (estado) y de
// main.js (orquestación/eventos). Los datos que vienen de la API se
// insertan siempre con textContent, nunca con innerHTML interpolado:
// aunque el backend es propio y confiable, es el hábito correcto.

import { iconoQuitar, iconoPaqueteVacio, iconoAlerta, iconoCheck } from './icons.js';
import { formatearMoneda, gramosAKilosTexto, kilosTextoAGramos } from './utils.js';
import { carrito } from './cart.js';

const UMBRAL_FOTOS_EAGER = 8; // primeras tarjetas: no son "lazy", ya están en el viewport inicial

export function renderizarGrillaProductos(productos, contenedor, alAgregar) {
  contenedor.innerHTML = '';

  if (productos.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'carrito-vacio';
    vacio.textContent = 'No se encontraron productos con ese nombre.';
    contenedor.appendChild(vacio);
    return;
  }

  productos.forEach((producto, indice) => {
    contenedor.appendChild(crearTarjetaProducto(producto, indice, alAgregar));
  });
}

function crearTarjetaProducto(producto, indice, alAgregar) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'tarjeta-producto';
  boton.setAttribute('aria-label', `Agregar ${producto.nombre} al carrito, ${formatearPrecioTarjeta(producto)}`);

  let elementoFoto;
  if (producto.fotoNombreArchivo) {
    elementoFoto = document.createElement('img');
    elementoFoto.src = `/uploads/${producto.fotoNombreArchivo}`;
    elementoFoto.alt = '';
    elementoFoto.loading = indice < UMBRAL_FOTOS_EAGER ? 'eager' : 'lazy';
    elementoFoto.className = 'tarjeta-producto__foto';
  } else {
    elementoFoto = document.createElement('div');
    elementoFoto.className = 'tarjeta-producto__foto tarjeta-producto__foto--vacia';
    elementoFoto.innerHTML = iconoPaqueteVacio;
  }
  boton.appendChild(elementoFoto);

  const cuerpo = document.createElement('div');
  cuerpo.className = 'tarjeta-producto__cuerpo';

  const nombre = document.createElement('span');
  nombre.className = 'tarjeta-producto__nombre';
  nombre.textContent = producto.nombre;
  cuerpo.appendChild(nombre);

  if (tieneStockBajo(producto)) {
    const badge = document.createElement('span');
    badge.className = 'badge-alerta';
    const icono = document.createElement('span');
    icono.className = 'icono';
    icono.innerHTML = iconoAlerta;
    const texto = document.createElement('span');
    texto.textContent = 'Stock bajo';
    badge.append(icono, texto);
    cuerpo.appendChild(badge);
  }

  const precio = document.createElement('span');
  precio.className = 'tarjeta-producto__precio precio numero';
  precio.textContent = formatearPrecioTarjeta(producto);
  cuerpo.appendChild(precio);

  boton.appendChild(cuerpo);
  boton.addEventListener('click', () => alAgregar(producto));
  return boton;
}

function formatearPrecioTarjeta(producto) {
  return producto.tipoVenta === 'peso' ? `${formatearMoneda(producto.precioPublico)}/kg` : formatearMoneda(producto.precioPublico);
}

function tieneStockBajo(producto) {
  if (producto.stockMinimo == null) return false;
  const stockActual = producto.tipoVenta === 'peso' ? producto.stockGramos : producto.stockUnidades;
  return stockActual < producto.stockMinimo;
}

export function renderizarCarrito({ contenedorLista, elementoTotal, alCambiarCantidad, alQuitar, idRecienAgregado }) {
  const items = carrito.obtenerItems();
  contenedorLista.innerHTML = '';

  if (items.length === 0) {
    const vacio = document.createElement('li');
    vacio.className = 'carrito-vacio';
    vacio.textContent = 'El carrito está vacío. Buscá o escaneá un producto para empezar.';
    contenedorLista.appendChild(vacio);
  } else {
    items.forEach((item) => {
      contenedorLista.appendChild(
        crearFilaCarrito(item, alCambiarCantidad, alQuitar, item.producto.id === idRecienAgregado)
      );
    });
  }

  const total = carrito.obtenerTotal();
  elementoTotal.textContent = formatearMoneda(total);
  elementoTotal.classList.remove('total--actualizado');
  // Fuerza un reflow para poder re-disparar la misma animación en la
  // próxima actualización (quitar y volver a poner la clase no alcanza
  // si el navegador no repinta entre medio).
  void elementoTotal.offsetWidth;
  elementoTotal.classList.add('total--actualizado');
}

function crearFilaCarrito(item, alCambiarCantidad, alQuitar, esNuevo) {
  const esPeso = item.producto.tipoVenta === 'peso';
  const li = document.createElement('li');
  li.className = esNuevo ? 'item-carrito item-carrito--nuevo' : 'item-carrito';

  const info = document.createElement('div');
  info.className = 'item-carrito__info';

  const nombre = document.createElement('p');
  nombre.className = 'item-carrito__nombre';
  nombre.textContent = item.producto.nombre;
  info.appendChild(nombre);

  const precioUnitario = document.createElement('p');
  precioUnitario.className = 'item-carrito__precio-unitario numero';
  precioUnitario.textContent = esPeso ? `${formatearMoneda(item.precioUnitario)}/kg` : formatearMoneda(item.precioUnitario);
  info.appendChild(precioUnitario);

  const detalle = document.createElement('div');
  detalle.className = 'item-carrito__detalle';

  const idInput = `cantidad-item-${item.producto.id}`;
  const etiqueta = document.createElement('label');
  etiqueta.setAttribute('for', idInput);
  etiqueta.className = 'visualmente-oculto';
  etiqueta.textContent = esPeso ? `Peso de ${item.producto.nombre} en kilos` : `Cantidad de ${item.producto.nombre}`;

  const inputCantidad = document.createElement('input');
  inputCantidad.id = idInput;
  // Los productos por peso usan texto, no type="number": los inputs
  // numéricos nativos del navegador SOLO aceptan punto decimal (estándar
  // HTML, sin importar el idioma) y rechazan la coma que se usa en
  // Colombia — con type="number" el navegador descarta "1,5" en
  // silencio. kilosTextoAGramos ya acepta coma o punto al leer el valor.
  inputCantidad.type = esPeso ? 'text' : 'number';
  inputCantidad.inputMode = esPeso ? 'decimal' : 'numeric';
  if (!esPeso) inputCantidad.min = '1';
  inputCantidad.value = esPeso ? gramosAKilosTexto(item.cantidad) : String(item.cantidad);

  const restaurarValor = () => {
    inputCantidad.value = esPeso ? gramosAKilosTexto(item.cantidad) : String(item.cantidad);
  };

  inputCantidad.addEventListener('change', () => {
    const nuevaCantidad = esPeso ? kilosTextoAGramos(inputCantidad.value) : Number.parseInt(inputCantidad.value, 10);
    if (nuevaCantidad && nuevaCantidad > 0) {
      alCambiarCantidad(item.producto.id, nuevaCantidad);
    } else {
      restaurarValor();
    }
  });

  const unidad = document.createElement('span');
  unidad.className = 'item-carrito__unidad';
  unidad.textContent = esPeso ? 'kg' : 'u.';

  detalle.append(etiqueta, inputCantidad, unidad);
  info.appendChild(detalle);

  const subtotal = document.createElement('span');
  subtotal.className = 'item-carrito__subtotal numero';
  subtotal.textContent = formatearMoneda(item.subtotal);

  const botonQuitar = document.createElement('button');
  botonQuitar.type = 'button';
  botonQuitar.className = 'item-carrito__quitar';
  botonQuitar.setAttribute('aria-label', `Quitar ${item.producto.nombre} del carrito`);
  botonQuitar.innerHTML = iconoQuitar;
  botonQuitar.addEventListener('click', () => alQuitar(item.producto.id));

  li.append(info, subtotal, botonQuitar);
  return li;
}

export function actualizarEstadoCaja(elemento, sesion) {
  if (sesion) {
    elemento.dataset.estado = 'abierta';
    elemento.textContent = `Caja abierta · ${formatearMoneda(sesion.montoApertura)}`;
  } else {
    elemento.dataset.estado = 'cerrada';
    elemento.textContent = 'Caja cerrada';
  }
}

export function renderizarAlertas({ reporte, mapaProductos, botonAlertas, panelAlertas }) {
  const stockBajo = reporte.productosStockBajo ?? [];
  const vencidos = reporte.lotesPorVencer?.vencidos ?? [];
  const porVencer = reporte.lotesPorVencer?.porVencer ?? [];
  const total = stockBajo.length + vencidos.length + porVencer.length;

  let contador = botonAlertas.querySelector('.boton-icono__contador');
  if (total > 0) {
    if (!contador) {
      contador = document.createElement('span');
      contador.className = 'boton-icono__contador';
      botonAlertas.appendChild(contador);
    }
    contador.textContent = String(total);
  } else if (contador) {
    contador.remove();
  }
  botonAlertas.setAttribute('aria-label', total > 0 ? `Alertas: ${total} pendientes` : 'Sin alertas pendientes');

  panelAlertas.innerHTML = '';
  panelAlertas.appendChild(crearSeccionAlertas('Stock bajo', stockBajo, (producto) => {
    const disponible = producto.tipoVenta === 'peso' ? producto.stockGramos : producto.stockUnidades;
    return `${disponible}/${producto.stockMinimo}`;
  }, 'Ningún producto por debajo de su mínimo.'));

  const lotes = [
    ...vencidos.map((lote) => ({ ...lote, etiqueta: 'Vencido' })),
    ...porVencer.map((lote) => ({ ...lote, etiqueta: 'Por vencer' })),
  ];
  panelAlertas.appendChild(
    crearSeccionAlertas(
      'Vencimientos',
      lotes,
      (lote) => lote.fechaVencimiento,
      'Sin lotes próximos a vencer.',
      (lote) => {
        const nombre = mapaProductos.get(lote.productoId)?.nombre ?? `Producto #${lote.productoId}`;
        return `${nombre} — ${lote.etiqueta}`;
      }
    )
  );
}

function crearSeccionAlertas(titulo, items, obtenerValor, mensajeVacio, obtenerEtiqueta) {
  const seccion = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.textContent = titulo;
  seccion.appendChild(h3);

  const lista = document.createElement('ul');
  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'panel-alertas__vacio';
    li.textContent = mensajeVacio;
    lista.appendChild(li);
  } else {
    items.forEach((item) => {
      const li = document.createElement('li');
      const etiqueta = document.createElement('span');
      etiqueta.textContent = obtenerEtiqueta ? obtenerEtiqueta(item) : item.nombre;
      const valor = document.createElement('span');
      valor.className = 'numero';
      valor.textContent = obtenerValor(item);
      li.append(etiqueta, valor);
      lista.appendChild(li);
    });
  }
  seccion.appendChild(lista);
  return seccion;
}

let temporizadorToast = null;

export function mostrarToast(mensaje, tipo = 'exito') {
  document.querySelectorAll('.toast').forEach((el) => el.remove());
  if (temporizadorToast) clearTimeout(temporizadorToast);

  const toast = document.createElement('div');
  toast.className = tipo === 'error' ? 'toast toast--error' : 'toast';
  toast.setAttribute('role', 'status');

  const icono = document.createElement('span');
  icono.innerHTML = tipo === 'error' ? iconoAlerta : iconoCheck;
  const texto = document.createElement('span');
  texto.textContent = mensaje;

  toast.append(icono, texto);
  document.body.appendChild(toast);

  temporizadorToast = setTimeout(() => toast.remove(), 3500);
}
