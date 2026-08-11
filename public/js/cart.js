// Estado del carrito y sus cálculos. Sin DOM acá a propósito — el
// renderizado vive en render.js, esto solo es estado + aritmética.
//
// Los cálculos replican EXACTO lo que hace ventas.service.js en el
// backend (ADR 0002 y 0003): fallback a precio público cuando no hay
// mayorista diferenciado, y redondeo una sola vez por línea. El backend
// sigue siendo la autoridad final (vuelve a calcular todo al confirmar
// la venta) — esto es solo para que el total en pantalla coincida con lo
// que se va a cobrar de verdad, no una fuente de verdad paralela.

let items = []; // [{ producto, cantidad }]
let tipoPrecio = 'publico';

function calcularPrecioUnitario(producto) {
  if (tipoPrecio === 'mayorista') {
    return producto.precioMayorista ?? producto.precioPublico;
  }
  return producto.precioPublico;
}

function calcularSubtotal(producto, cantidad) {
  const precioUnitario = calcularPrecioUnitario(producto);
  const divisor = producto.tipoVenta === 'peso' ? 1000 : 1;
  return Math.round((precioUnitario * cantidad) / divisor);
}

export const carrito = {
  obtenerItems() {
    return items.map((item) => ({
      producto: item.producto,
      cantidad: item.cantidad,
      precioUnitario: calcularPrecioUnitario(item.producto),
      subtotal: calcularSubtotal(item.producto, item.cantidad),
    }));
  },

  // Cantidad inicial razonable al agregar desde la búsqueda/lector: 1kg
  // para productos por peso (el cajero la corrige de inmediato con el
  // peso real de la báscula), 1 unidad para productos por unidad.
  agregarProducto(producto) {
    const existente = items.find((item) => item.producto.id === producto.id);
    if (existente) {
      existente.cantidad += producto.tipoVenta === 'peso' ? 1000 : 1;
      return;
    }
    items.push({ producto, cantidad: producto.tipoVenta === 'peso' ? 1000 : 1 });
  },

  actualizarCantidad(productoId, nuevaCantidad) {
    if (!(nuevaCantidad > 0)) return;
    const item = items.find((i) => i.producto.id === productoId);
    if (item) item.cantidad = nuevaCantidad;
  },

  quitarProducto(productoId) {
    items = items.filter((item) => item.producto.id !== productoId);
  },

  establecerTipoPrecio(nuevo) {
    tipoPrecio = nuevo;
  },

  obtenerTipoPrecio() {
    return tipoPrecio;
  },

  obtenerTotal() {
    return this.obtenerItems().reduce((acumulado, item) => acumulado + item.subtotal, 0);
  },

  estaVacio() {
    return items.length === 0;
  },

  vaciar() {
    items = [];
    tipoPrecio = 'publico';
  },

  // Shape exacto que espera POST /api/ventas.
  obtenerItemsParaVenta() {
    return items.map((item) => ({ productoId: item.producto.id, cantidad: item.cantidad }));
  },
};
