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
  cambiarPassword: (passwordActual, passwordNueva, pregunta, respuesta) =>
    peticion('/auth/cambiar-password', {
      method: 'POST',
      body: JSON.stringify({ passwordActual, passwordNueva, ...(pregunta && respuesta ? { pregunta, respuesta } : {}) }),
    }),
  // peticionOpcional: 404 (usuario sin pregunta configurada, o
  // inexistente) se resuelve como null, no como error — así el llamador
  // solo decide mostrar u ocultar el enlace. Un 429 por rate-limit sigue
  // lanzando normalmente, eso sí hay que mostrarlo.
  obtenerPreguntaSeguridad: (usuario) => peticionOpcional(`/auth/pregunta-seguridad/${encodeURIComponent(usuario)}`),
  recuperarPassword: (usuario, respuesta, passwordNueva) =>
    peticion('/auth/recuperar-password', { method: 'POST', body: JSON.stringify({ usuario, respuesta, passwordNueva }) }),

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
  // desde Fase 1, ver ADR 0010): este endpoint es de ambos roles, que es
  // lo que necesita el indicador de alertas del mostrador.
  obtenerAlertasInventario: () => peticion('/inventario/alertas'),

  // Nota (Tarea 1, retiro de Vencimientos de la interfaz): los wrappers de
  // /api/vencimientos/* que vivían acá se quitaron por quedar sin ningún
  // llamador en el frontend -- el endpoint en sí sigue existiendo en el
  // backend (app.js, sin tocar), solo la interfaz que lo consumía se
  // ocultó. Si se reactiva la pantalla, estas 4 líneas se recuperan del
  // historial de git.

  // Panel de Indicadores (Fase 4/Bloque 3, ver ADR 0013) — admin-only en
  // el backend (app.js monta /api/reportes con requiereRol('administrador')).
  obtenerReporteVentas: ({ desde, hasta, cajaSesionId } = {}) => {
    const parametros = new URLSearchParams({ desde, hasta });
    if (cajaSesionId) parametros.set('cajaSesionId', cajaSesionId);
    return peticion(`/reportes/ventas?${parametros.toString()}`);
  },
  // No usa peticion(): la respuesta es texto CSV, no JSON. Mismo manejo de
  // 401/SIN_SESION que peticion() (ver ADR de sesión, Fase 4 Bloque 1) para
  // no romper el hook centralizado de sesión vencida.
  exportarVentasCsv: async ({ desde, hasta }) => {
    const parametros = new URLSearchParams({ desde, hasta });
    const respuesta = await fetch(`${BASE}/reportes/ventas/exportar?${parametros.toString()}`);

    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => null);
      if (respuesta.status === 401 && cuerpo?.codigo === 'SIN_SESION' && onSesionExpirada) {
        onSesionExpirada();
      }
      throw new ErrorApi(cuerpo?.error || 'No se pudo generar el archivo CSV', respuesta.status, cuerpo?.codigo, cuerpo?.detalles);
    }

    const disposicion = respuesta.headers.get('Content-Disposition') || '';
    const coincidencia = disposicion.match(/filename="([^"]+)"/);
    const nombreArchivo = coincidencia ? coincidencia[1] : 'ventas.csv';
    const blob = await respuesta.blob();
    return { blob, nombreArchivo };
  },

  // Movimientos de inventario (Fase 4, ver ADR 0015) — listar es de ambos
  // roles, crear es solo-administrador (inventario.routes.js ya lo exigía
  // desde antes de esta fase).
  listarMovimientosInventario: ({ productoId, desde, hasta } = {}) => {
    const parametros = new URLSearchParams();
    if (productoId) parametros.set('productoId', productoId);
    if (desde) parametros.set('desde', desde);
    if (hasta) parametros.set('hasta', hasta);
    const query = parametros.toString();
    return peticion(`/inventario/movimientos${query ? `?${query}` : ''}`);
  },
  crearMovimientoInventario: (datos) => peticion('/inventario/movimientos', { method: 'POST', body: JSON.stringify(datos) }),

  // Proveedores (Fase 4, ver ADR 0013) — módulo entero solo-administrador
  // (app.js monta /api/proveedores con requiereRol('administrador'), ya
  // documentado desde ADR 0010).
  listarProveedores: ({ activo } = {}) => {
    const parametros = new URLSearchParams();
    if (activo !== undefined) parametros.set('activo', String(activo));
    const query = parametros.toString();
    return peticion(`/proveedores${query ? `?${query}` : ''}`);
  },
  crearProveedor: (datos) => peticion('/proveedores', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarProveedor: (id, cambios) => peticion(`/proveedores/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
  borrarProveedor: (id) => peticion(`/proveedores/${id}`, { method: 'DELETE' }),

  // Auditoría inmutable (ver ADR 0018) — módulo entero solo-administrador
  // (app.js monta /api/auditoria con requiereRol('administrador')). Sin
  // método de borrado acá a propósito: no existe ningún endpoint DELETE en
  // el backend para esta entidad, ni por diseño debería existir uno nunca.
  listarAuditoria: ({ accion, usuarioId } = {}) => {
    const parametros = new URLSearchParams();
    if (accion) parametros.set('accion', accion);
    if (usuarioId) parametros.set('usuarioId', usuarioId);
    const query = parametros.toString();
    return peticion(`/auditoria${query ? `?${query}` : ''}`);
  },

  // Gastos (ver ADR de exportación CSV/gastos/redondeo/gráficos) — módulo
  // entero solo-administrador (app.js monta /api/gastos con
  // requiereRol('administrador')). Sin borrarGasto a propósito: no existe
  // ningún DELETE en el backend, mismo patrón "no borrar" que proveedores/
  // usuarios/productos.
  listarGastos: ({ desde, hasta, categoria } = {}) => {
    const parametros = new URLSearchParams();
    if (desde) parametros.set('desde', desde);
    if (hasta) parametros.set('hasta', hasta);
    if (categoria) parametros.set('categoria', categoria);
    const query = parametros.toString();
    return peticion(`/gastos${query ? `?${query}` : ''}`);
  },
  crearGasto: (datos) => peticion('/gastos', { method: 'POST', body: JSON.stringify(datos) }),
  desactivarGasto: (id) => peticion(`/gastos/${id}`, { method: 'PATCH', body: JSON.stringify({ activo: false }) }),
};
