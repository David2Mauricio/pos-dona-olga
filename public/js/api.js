// Cliente delgado sobre la API ya construida. Ningún endpoint acá es
// inventado — cada ruta corresponde exactamente a un módulo del backend
// ya probado (ver src/modules/*/*.routes.js).

const BASE = '/api';

export class ErrorApi extends Error {
  constructor(mensaje, status, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

async function peticion(ruta, opciones = {}) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: opciones.body ? { 'Content-Type': 'application/json', ...opciones.headers } : opciones.headers,
  });

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorApi(cuerpo?.error || 'Error de comunicación con el servidor', respuesta.status, cuerpo?.detalles);
  }

  return cuerpo;
}

// Para endpoints donde 404 es un resultado válido y esperado (no hay caja
// abierta, código de barras sin coincidencia) — no es un error de red.
async function peticionOpcional(ruta, opciones) {
  try {
    return await peticion(ruta, opciones);
  } catch (error) {
    if (error instanceof ErrorApi && error.status === 404) return null;
    throw error;
  }
}

export const api = {
  obtenerCajaActual: () => peticionOpcional('/caja/actual'),
  abrirCaja: (montoApertura) => peticion('/caja/apertura', { method: 'POST', body: JSON.stringify({ montoApertura }) }),

  listarProductosActivos: () => peticion('/productos?activo=true'),
  buscarProductoPorCodigoBarras: (codigo) => peticionOpcional(`/productos/codigo-barras/${encodeURIComponent(codigo)}`),

  crearVenta: (datos) => peticion('/ventas', { method: 'POST', body: JSON.stringify(datos) }),

  obtenerReporteInventario: () => peticion('/reportes/inventario'),
};
