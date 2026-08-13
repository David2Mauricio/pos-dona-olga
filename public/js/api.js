// Cliente delgado sobre la API ya construida. Ningún endpoint acá es
// inventado — cada ruta corresponde exactamente a un módulo del backend
// ya probado (ver src/modules/*/*.routes.js).

const BASE = '/api';

export class ErrorApi extends Error {
  constructor(mensaje, status, codigo, detalles) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

// Registrado por auth.js (ver Fase 4, Bloque 1): se dispara cuando CUALQUIER
// llamada de CUALQUIER módulo recibe un 401 con codigo SIN_SESION — cubre
// tanto la carga inicial sin sesión como una sesión que vence a mitad de
// una venta. api.js no toca el DOM directamente (sigue siendo un cliente
// delgado); solo avisa, quien decide qué mostrar es auth.js.
let onSesionExpirada = null;
export function registrarOnSesionExpirada(callback) {
  onSesionExpirada = callback;
}

async function peticion(ruta, opciones = {}) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: opciones.body ? { 'Content-Type': 'application/json', ...opciones.headers } : opciones.headers,
  });

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401 && cuerpo?.codigo === 'SIN_SESION' && onSesionExpirada) {
      onSesionExpirada();
    }
    throw new ErrorApi(cuerpo?.error || 'Error de comunicación con el servidor', respuesta.status, cuerpo?.codigo, cuerpo?.detalles);
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
  login: (usuario, password) => peticion('/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) }),
  logout: () => peticion('/auth/logout', { method: 'POST' }),
  obtenerSesion: () => peticion('/auth/sesion'),
  cambiarPassword: (passwordActual, passwordNueva) =>
    peticion('/auth/cambiar-password', { method: 'POST', body: JSON.stringify({ passwordActual, passwordNueva }) }),

  obtenerCajaActual: () => peticionOpcional('/caja/actual'),
  abrirCaja: (montoApertura) => peticion('/caja/apertura', { method: 'POST', body: JSON.stringify({ montoApertura }) }),
  obtenerReporteCaja: (id) => peticion(`/caja/${id}`),
  cerrarCaja: (id, montoCierre) => peticion(`/caja/${id}/cierre`, { method: 'PATCH', body: JSON.stringify({ montoCierre }) }),

  listarProductosActivos: () => peticion('/productos?activo=true'),
  buscarProductoPorCodigoBarras: (codigo) => peticionOpcional(`/productos/codigo-barras/${encodeURIComponent(codigo)}`),

  // Gestión de catálogo (Fase 4, ver ADR 0013) — admin-only en el backend
  // para crear/actualizar, ambos roles para listar (ver productos.routes.js).
  listarProductosCatalogo: ({ categoriaId, activo } = {}) => {
    const parametros = new URLSearchParams();
    if (categoriaId) parametros.set('categoriaId', categoriaId);
    if (activo !== undefined) parametros.set('activo', String(activo));
    const query = parametros.toString();
    return peticion(`/productos${query ? `?${query}` : ''}`);
  },
  crearProducto: (datos) => peticion('/productos', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarProducto: (id, cambios) => peticion(`/productos/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),

  listarCategorias: () => peticion('/categorias'),
  crearCategoria: (nombre) => peticion('/categorias', { method: 'POST', body: JSON.stringify({ nombre }) }),
  actualizarCategoria: (id, nombre) => peticion(`/categorias/${id}`, { method: 'PATCH', body: JSON.stringify({ nombre }) }),

  // Gestión de usuarios (Fase 4, ver ADR 0013) — módulo entero solo-administrador.
  listarUsuarios: () => peticion('/usuarios'),
  crearUsuario: (datos) => peticion('/usuarios', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarUsuario: (id, cambios) => peticion(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
  resetearPasswordUsuario: (id) => peticion(`/usuarios/${id}/resetear-password`, { method: 'PATCH' }),

  crearVenta: (datos) => peticion('/ventas', { method: 'POST', body: JSON.stringify(datos) }),
  listarVentas: ({ desde, hasta }) => peticion(`/ventas?desde=${desde}&hasta=${hasta}`),
  anularVenta: (id, motivoAnulacion) =>
    peticion(`/ventas/${id}/anular`, { method: 'PATCH', body: JSON.stringify({ motivoAnulacion }) }),

  // Reemplaza a GET /api/reportes/inventario (quedó solo-administrador
  // desde Fase 1, ver ADR 0010): estos dos endpoints son de ambos roles,
  // que es lo que necesita el indicador de alertas del mostrador.
  obtenerAlertasInventario: () => peticion('/inventario/alertas'),
  obtenerAlertasVencimientos: () => peticion('/vencimientos/alertas'),

  // Lotes de vencimiento (Fase 4, ver ADR 0013) — de ambos roles en el
  // backend (app.js monta /api/vencimientos sin requiereRol, confirmado
  // con el cliente: registrar un lote es documentación aditiva, no un
  // caso con riesgo de ocultar una merma).
  listarLotesVencimiento: () => peticion('/vencimientos/lotes'),
  crearLoteVencimiento: (datos) => peticion('/vencimientos/lotes', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarLoteVencimiento: (id, cambios) =>
    peticion(`/vencimientos/lotes/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),

  // Panel de Indicadores (Fase 4/Bloque 3, ver ADR 0013) — admin-only en
  // el backend (app.js monta /api/reportes con requiereRol('administrador')).
  obtenerReporteVentas: ({ desde, hasta, cajaSesionId } = {}) => {
    const parametros = new URLSearchParams({ desde, hasta });
    if (cajaSesionId) parametros.set('cajaSesionId', cajaSesionId);
    return peticion(`/reportes/ventas?${parametros.toString()}`);
  },

  // Proveedores (Fase 4, ver ADR 0013) — módulo entero solo-administrador
  // (app.js monta /api/proveedores con requiereRol('administrador'), ya
  // documentado desde ADR 0010).
  listarProveedores: () => peticion('/proveedores'),
  crearProveedor: (datos) => peticion('/proveedores', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarProveedor: (id, cambios) => peticion(`/proveedores/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
};
