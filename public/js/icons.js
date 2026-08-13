// Set de íconos propio: líneas, trazo 1.75, currentColor. Nada de
// librerías externas ni emojis — cada uno se dibujó a mano para esta
// interfaz (ver ADR de la interfaz de mostrador).

const ATRIBUTOS_BASE =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

export const iconoSol = `
<svg ${ATRIBUTOS_BASE}>
  <circle cx="12" cy="12" r="4.2" />
  <path d="M12 2.5v2.5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12H5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
</svg>`;

export const iconoLuna = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M20 13.2A8.5 8.5 0 1 1 10.8 4a7 7 0 0 0 9.2 9.2z" />
</svg>`;

export const iconoBuscar = `
<svg ${ATRIBUTOS_BASE}>
  <circle cx="11" cy="11" r="7" />
  <path d="M20.5 20.5l-4.3-4.3" />
</svg>`;

export const iconoAgregar = `
<svg ${ATRIBUTOS_BASE}>
  <circle cx="12" cy="12" r="9.5" />
  <path d="M12 8v8M8 12h8" />
</svg>`;

export const iconoQuitar = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M6 6l12 12M18 6L6 18" />
</svg>`;

export const iconoCheck = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="icono-check">
  <path d="M5 13l4 4L19 7" />
</svg>`;

export const iconoAlerta = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M12 3.5 21.5 20h-19L12 3.5z" />
  <path d="M12 9.5v4.2" />
  <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
</svg>`;

export const iconoCandado = `
<svg ${ATRIBUTOS_BASE}>
  <rect x="5" y="11" width="14" height="9" rx="1.8" />
  <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
</svg>`;

export const iconoCerrar = iconoQuitar;

export const iconoSalir = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M15 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
  <path d="M10 12h11M17 8l4 4-4 4" />
</svg>`;

export const iconoEditar = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M16.5 4.5l3 3L8 19H5v-3L16.5 4.5z" />
</svg>`;

export const iconoAnular = `
<svg ${ATRIBUTOS_BASE}>
  <circle cx="12" cy="12" r="8.5" />
  <path d="M6.5 6.5l11 11" />
</svg>`;

export const iconoHistorial = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
  <path d="M3.5 5v4h4" />
  <path d="M12 8v4l3 2" />
</svg>`;

export const iconoMostrador = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M4 8.5l1.2-4h13.6l1.2 4" />
  <path d="M4 8.5h16v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8.5z" />
  <path d="M9.5 12.5a2.5 2.5 0 0 0 5 0" />
</svg>`;

export const iconoIndicadores = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M4 20V10M11 20V4M18 20v-7" />
  <path d="M2.5 20h19" />
</svg>`;

export const iconoOjo = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
  <circle cx="12" cy="12" r="2.75" />
</svg>`;

export const iconoOjoTachado = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M2.5 12s3.5-6.5 9.5-6.5c1.7 0 3.15.4 4.37 1M21.5 12s-1.15 2.15-3.32 3.98M9.9 9.9a2.75 2.75 0 0 0 3.9 3.9" />
  <path d="M6.6 6.6C4.2 8.1 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.55 0 2.9-.34 4.05-.85" />
  <path d="M3.5 3.5l17 17" />
</svg>`;

export const iconoUsuarios = `
<svg ${ATRIBUTOS_BASE}>
  <circle cx="9" cy="8" r="3.25" />
  <path d="M2.75 19c0-3.45 2.8-6 6.25-6s6.25 2.55 6.25 6" />
  <path d="M16 6.5a3 3 0 0 1 0 5.9" />
  <path d="M18.5 13.3c2.35.55 4 2.65 4 5.2" />
</svg>`;

export const iconoProductos = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M20.5 12.5L12 21 3.5 12.5V6a2 2 0 0 1 2-2H12l8.5 8.5z" />
  <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
</svg>`;

export const iconoInventario = `
<svg ${ATRIBUTOS_BASE}>
  <path d="M3.5 8L12 3.5 20.5 8 12 12.5 3.5 8z" />
  <path d="M3.5 8v9L12 21.5 20.5 17V8" />
  <path d="M12 12.5V21.5" />
</svg>`;

// Placeholder para producto sin foto: un paquete envuelto en papel de
// carnicería, no un ícono de "imagen rota" ni un cuadro gris genérico.
export const iconoPaqueteVacio = `
<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="8" y="10" width="48" height="30" rx="3" />
  <path d="M8 22h48M32 10v30" stroke-dasharray="3 3" />
  <path d="M22 10c1-4 3-6 10-6s9 2 10 6" />
</svg>`;

export function crearIcono(marcadoSvg, claseAdicional = '') {
  const contenedor = document.createElement('span');
  contenedor.className = `icono ${claseAdicional}`.trim();
  contenedor.innerHTML = marcadoSvg;
  return contenedor;
}
