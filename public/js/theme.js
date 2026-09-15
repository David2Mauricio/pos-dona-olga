// El tema INICIAL se aplica con un script inline en <head> (ver
// index.html), antes de que pintе cualquier CSS — evita el parpadeo de
// "carga en claro y luego salta a oscuro" que pasaría si esto se hiciera
// acá, en un módulo que corre después del parseo del HTML. Este archivo
// solo sincroniza el ícono del botón con lo que ya quedó aplicado, y
// maneja el toggle.

import { iconoSol, iconoLuna } from './icons.js';

const CLAVE_STORAGE = 'pos-dona-olga:tema';

function guardarTema(tema) {
  try {
    localStorage.setItem(CLAVE_STORAGE, tema);
  } catch {
    // localStorage puede fallar (modo privado, cuota llena). El tema
    // simplemente no persiste entre sesiones; no es un error que deba
    // interrumpir el toggle.
  }
}

function actualizarBoton(boton, tema) {
  boton.innerHTML = tema === 'oscuro' ? iconoSol : iconoLuna;
  boton.setAttribute('aria-label', tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  boton.setAttribute('aria-pressed', String(tema === 'oscuro'));
}

// Acepta un botón o una lista -- Tarea 3 agregó un segundo botón (el
// flotante de accesibilidad, ver index.html) que también togglea el
// tema y necesita quedar sincronizado con el de la sidebar sin
// duplicar la lógica de toggle en otro archivo.
export function iniciarTema(botonOLista) {
  const botones = Array.isArray(botonOLista) ? botonOLista : [botonOLista];
  const temaActual = document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
  botones.forEach((boton) => actualizarBoton(boton, temaActual));

  botones.forEach((boton) => {
    boton.addEventListener('click', () => {
      const actual = document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
      const siguiente = actual === 'oscuro' ? 'claro' : 'oscuro';
      document.documentElement.setAttribute('data-tema', siguiente);
      botones.forEach((b) => actualizarBoton(b, siguiente));
      guardarTema(siguiente);
    });
  });
}
