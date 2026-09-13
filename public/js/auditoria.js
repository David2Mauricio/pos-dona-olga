// Registro de auditoría inmutable (ver ADR 0018). Mismo patrón que
// usuarios.js/vencimientos.js: módulo autocontenido, propio DOM, propias
// llamadas. Módulo entero solo-administrador en el backend (app.js monta
// /api/auditoria con requiereRol('administrador')) — la sección queda
// oculta para cajero en la sidebar (main.js), pero eso es ayuda de UI, no
// la protección real.
//
// A propósito no hay NINGÚN botón de borrado ni de edición en esta
// pantalla: el backend no expone ningún DELETE/PATCH para esta entidad
// (ver auditoria.repository.js, que solo tiene crear/obtenerPorId/listar),
// así que no habría nada real detrás de un botón acá.

import { api, ErrorApi } from './api.js';
import { mostrarToast } from './render.js';
import {
  iconoCaja,
  iconoAnular,
  iconoEditar,
  iconoAgregar,
  iconoQuitar,
  iconoCambioRol,
  iconoCandado,
  iconoEliminar,
  iconoGasto,
} from './icons.js';

// Lista verificada contra el código real (grep de registrarAuditoria en
// src/, no la lista original del brief -- esa se quedó corta: le
// faltaba baja_usuario, que sí existe desde ADR 0018/usuarios.service.js).
// Si se agrega un accion nuevo en el backend y no se agrega acá, cae al
// fallback (?? accion / sin ícono) en vez de romper -- pero eso debería
// ser la excepción, no el estado esperado: cualquier accion nuevo debería
// sumarse a este mapa a propósito, no quedarse en el fallback sin decidir.
const ETIQUETAS_ACCION = {
  cierre_caja: 'Cierre de caja',
  anulacion_venta: 'Anulación de venta',
  override_precio: 'Override de precio',
  alta_usuario: 'Alta de usuario',
  baja_usuario: 'Baja de usuario',
  cambio_rol_usuario: 'Cambio de rol',
  reseteo_password: 'Reseteo de contraseña',
  ajuste_inventario: 'Ajuste de inventario',
  eliminacion_usuario: 'Eliminación de usuario',
  registro_gasto: 'Registro de gasto',
  baja_gasto: 'Baja de gasto',
};

// Un ícono por tipo de acción (rediseño visual, Fase 7). Reutiliza el
// vocabulario ya establecido en el resto de la app en vez de inventar uno
// nuevo por entidad: iconoEditar ya significa "corrección manual de un
// valor" (inventario.js lo usa para el tipo 'ajuste'), así que
// ajuste_inventario y override_precio comparten ese mismo ícono a
// propósito -- son la misma idea (alguien corrigió un número a mano)
// aplicada a dos entidades distintas. Mismo criterio para baja_usuario/
// baja_gasto con iconoQuitar (ambas son la misma acción -- desactivar,
// reversible -- sobre entidades distintas). Solo se agregaron íconos
// nuevos (iconoCaja, iconoCambioRol, iconoGasto) donde no había ninguno
// reusable sin forzarlo.
const ICONOS_ACCION = {
  cierre_caja: iconoCaja,
  anulacion_venta: iconoAnular,
  override_precio: iconoEditar,
  alta_usuario: iconoAgregar,
  baja_usuario: iconoQuitar,
  cambio_rol_usuario: iconoCambioRol,
  reseteo_password: iconoCandado,
  ajuste_inventario: iconoEditar,
  eliminacion_usuario: iconoEliminar,
  registro_gasto: iconoGasto,
  baja_gasto: iconoQuitar,
};

const tablaAuditoria = document.getElementById('tabla-auditoria');
const selectAccion = document.getElementById('select-auditoria-accion');
const selectUsuario = document.getElementById('select-auditoria-usuario');

let filtrosCargados = false;

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la operación. Intentá de nuevo.';
}

function etiquetaAccion(accion) {
  return ETIQUETAS_ACCION[accion] ?? accion;
}

function formatearFechaHora(creadoEn) {
  const [fecha, hora] = creadoEn.split(' ');
  return `${fecha} ${hora?.slice(0, 8) ?? ''}`.trim();
}

function formatearEntidad(fila) {
  const tipo = fila.entidadTipo.replace(/_/g, ' ');
  return fila.entidadId != null ? `${tipo} #${fila.entidadId}` : tipo;
}

async function cargarFiltros() {
  if (filtrosCargados) return;
  filtrosCargados = true;

  Object.entries(ETIQUETAS_ACCION).forEach(([valor, etiqueta]) => {
    const opcion = document.createElement('option');
    opcion.value = valor;
    opcion.textContent = etiqueta;
    selectAccion.appendChild(opcion);
  });

  try {
    const usuarios = await api.listarUsuarios();
    usuarios.forEach((usuario) => {
      const opcion = document.createElement('option');
      opcion.value = String(usuario.id);
      opcion.textContent = usuario.nombre;
      selectUsuario.appendChild(opcion);
    });
  } catch (error) {
    // El listado de usuarios es solo para poblar el filtro -- si falla, la
    // pantalla igual sirve sin ese filtro, no hace falta bloquear nada.
    mostrarToast(mensajeDeError(error), 'error');
  }
}

async function cargarAuditoria() {
  tablaAuditoria.innerHTML = '';
  const cargando = document.createElement('p');
  cargando.className = 'catalogo__vacio';
  cargando.textContent = 'Cargando…';
  tablaAuditoria.appendChild(cargando);

  const filtros = {};
  if (selectAccion.value) filtros.accion = selectAccion.value;
  if (selectUsuario.value) filtros.usuarioId = selectUsuario.value;

  try {
    const entradas = await api.listarAuditoria(filtros);
    renderizarAuditoria(entradas);
  } catch (error) {
    tablaAuditoria.innerHTML = '';
    mostrarToast(mensajeDeError(error), 'error');
  }
}

function renderizarAuditoria(entradas) {
  tablaAuditoria.innerHTML = '';

  if (entradas.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'catalogo__vacio';
    vacio.textContent = 'No hay entradas de auditoría para este filtro.';
    tablaAuditoria.appendChild(vacio);
    return;
  }

  entradas.forEach((entrada) => {
    tablaAuditoria.appendChild(crearFilaAuditoria(entrada));
  });
}

function crearFilaAuditoria(entrada) {
  const fila = document.createElement('div');
  fila.className = 'catalogo__fila catalogo__fila--auditoria';

  const fecha = document.createElement('span');
  fecha.className = 'catalogo__fila-muted';
  fecha.textContent = formatearFechaHora(entrada.creadoEn);

  const accion = document.createElement('span');
  accion.className = 'badge-alerta';
  const iconoAccion = ICONOS_ACCION[entrada.accion];
  if (iconoAccion) {
    const icono = document.createElement('span');
    icono.className = 'icono';
    icono.setAttribute('aria-hidden', 'true');
    icono.innerHTML = iconoAccion;
    accion.appendChild(icono);
  }
  accion.append(etiquetaAccion(entrada.accion));

  const usuario = document.createElement('span');
  usuario.textContent = entrada.usuarioNombre ?? 'Sistema';

  const entidad = document.createElement('span');
  entidad.className = 'catalogo__fila-muted';
  entidad.textContent = formatearEntidad(entrada);

  const detalle = document.createElement('details');
  detalle.className = 'auditoria__detalle';
  const resumen = document.createElement('summary');
  resumen.textContent = 'Ver detalle';
  const contenido = document.createElement('pre');
  contenido.textContent = JSON.stringify(entrada.detalle, null, 2);
  detalle.append(resumen, contenido);

  fila.append(fecha, accion, usuario, entidad, detalle);
  return fila;
}

selectAccion.addEventListener('change', cargarAuditoria);
selectUsuario.addEventListener('change', cargarAuditoria);

export async function abrirAuditoria() {
  await cargarFiltros();
  await cargarAuditoria();
}
