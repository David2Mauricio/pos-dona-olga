// Estado del carrito y sus cálculos. Sin DOM acá a propósito — el
// renderizado vive en render.js, esto solo es estado + aritmética.
//
// Los cálculos replican EXACTO lo que hace ventas.service.js en el
// backend (ADR 0002 y 0003): fallback a precio público cuando no hay
// mayorista diferenciado, y redondeo una sola vez por línea. El backend
// sigue siendo la autoridad final (vuelve a calcular todo al confirmar
// la venta) — esto es solo para que el total en pantalla coincida con lo
// que se va a cobrar de verdad, no una fuente de verdad paralela.

let items = []; // [{ producto, cantidad, override: null | { precioUnitarioOverride, motivoAjuste } }]
let tipoPrecio = 'publico';

// Fase 2 (ver ADR 0011/0013): un override es un precio absoluto que el
// cajero fija para esa línea — no depende de tipoPrecio ni lo reemplaza
// para el resto del carrito, sigue vigente aunque después se cambie
// Público/Mayorista (igual criterio que el backend: el override, si
// existe, siempre gana sobre resolverPrecioAplicado).
function calcularPrecioUnitarioItem(item) {
  if (item.override) {
    return item.override.precioUnitarioOverride;
  }
  if (tipoPrecio === 'mayorista') {
    return item.producto.precioMayorista ?? item.producto.precioPublico;
  }
  return item.producto.precioPublico;
}

function calcularSubtotal(producto, cantidad, precioUnitario) {
  const divisor = producto.tipoVenta === 'peso' ? 1000 : 1;
  return Math.round((precioUnitario * cantidad) / divisor);
}

export const carrito = {
  obtenerItems() {
    return items.map((item) => {
      const precioUnitario = calcularPrecioUnitarioItem(item);
      return {
        producto: item.producto,
        cantidad: item.cantidad,
        precioUnitario,
        subtotal: calcularSubtotal(item.producto, item.cantidad, precioUnitario),
        precioModificado: item.override !== null,
        motivoAjuste: item.override?.motivoAjuste ?? null,
      };
    });
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
    items.push({ producto, cantidad: producto.tipoVenta === 'peso' ? 1000 : 1, override: null });
  },

  actualizarCantidad(productoId, nuevaCantidad) {
    if (!(nuevaCantidad > 0)) return;
    const item = items.find((i) => i.producto.id === productoId);
    if (item) item.cantidad = nuevaCantidad;
  },

  quitarProducto(productoId) {
    items = items.filter((item) => item.producto.id !== productoId);
  },

  establecerOverride(productoId, precioUnitarioOverride, motivoAjuste) {
    const item = items.find((i) => i.producto.id === productoId);
    if (item) item.override = { precioUnitarioOverride, motivoAjuste };
  },

  quitarOverride(productoId) {
    const item = items.find((i) => i.producto.id === productoId);
    if (item) item.override = null;
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

  // Shape exacto que espera POST /api/ventas (ventas.schema.js): solo
  // incluye precioUnitarioOverride/motivoAjuste cuando el item tiene un
  // override — el schema del backend rechaza uno sin el otro, y también
  // rechaza mandarlos como null/undefined explícitos junto a los demás
  // campos si .strict() los ve de más, así que se omiten por completo
  // cuando no aplican en vez de mandarlos en null.
  obtenerItemsParaVenta() {
    return items.map((item) => {
      const base = { productoId: item.producto.id, cantidad: item.cantidad };
      if (item.override) {
        base.precioUnitarioOverride = item.override.precioUnitarioOverride;
        base.motivoAjuste = item.override.motivoAjuste;
      }
      return base;
    });
  },
};
