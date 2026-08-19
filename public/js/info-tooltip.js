// Ayuda contextual reutilizable: un ícono "i" que al activarse (click o
// Enter/Espacio, ya que es un <button> nativo) muestra un popover corto
// con una explicación. Componente único usado en toda la interfaz — no
// una implementación distinta por pantalla.
//
// role="tooltip" (no "dialog"): el contenido de cada popover es texto
// plano de solo lectura, sin nada interactivo adentro -- si algún día se
// necesita un popover con un link o botón dentro, ESE caso necesitaría
// role="dialog" en su lugar (foco atrapado, cierre distinto), no este
// componente tal cual.
//
// Un solo popover abierto a la vez en toda la interfaz: abrir uno cierra
// cualquier otro que hubiera quedado abierto, mismo criterio que un menú
// contextual normal.

import { iconoInfo } from './icons.js';

let contador = 0;
let abierto = null; // { boton, popover, contenedor } o null

function cerrarAbierto() {
  if (!abierto) return;
  abierto.popover.hidden = true;
  abierto.boton.setAttribute('aria-expanded', 'false');
  abierto = null;
}

// Un solo listener global para click-afuera y Escape, no uno por
// instancia -- una pantalla con varios InfoTooltip no debería acumular
// un listener de document por cada uno.
document.addEventListener('click', (evento) => {
  if (abierto && !abierto.contenedor.contains(evento.target)) cerrarAbierto();
});
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && abierto) cerrarAbierto();
});

// Si el popover se saldría del viewport por la derecha (campos cerca del
// borde de la pantalla), lo alinea a la derecha del ícono en vez de a la
// izquierda (default) -- se mide DESPUÉS de mostrarlo, con el layout ya
// resuelto por el navegador.
function ajustarPosicion(popover) {
  popover.classList.remove('info-tooltip__popover--derecha');
  const rect = popover.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    popover.classList.add('info-tooltip__popover--derecha');
  }
}

// texto: una o dos frases cortas (ver reglas de calidad de texto del
// proyecto: mayúscula inicial, tildes correctas, punto final, nunca
// justificado). etiqueta: aria-label del botón -- describe QUÉ campo
// explica ("Ayuda sobre stock actual"), no repite el texto del popover
// (eso ya lo lee aria-describedby cuando está abierto).
export function crearInfoTooltip(texto, etiqueta) {
  contador += 1;
  const idPopover = `info-tooltip-popover-${contador}`;

  const contenedor = document.createElement('span');
  contenedor.className = 'info-tooltip';

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'info-tooltip__boton';
  boton.setAttribute('aria-expanded', 'false');
  boton.setAttribute('aria-describedby', idPopover);
  boton.setAttribute('aria-label', etiqueta);
  boton.innerHTML = iconoInfo;

  const popover = document.createElement('div');
  popover.id = idPopover;
  popover.className = 'info-tooltip__popover';
  popover.setAttribute('role', 'tooltip');
  popover.textContent = texto;
  popover.hidden = true;

  boton.addEventListener('click', (evento) => {
    evento.stopPropagation();
    const yaEstabaAbierto = abierto?.popover === popover;
    cerrarAbierto();
    if (yaEstabaAbierto) return;

    popover.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    abierto = { boton, popover, contenedor };
    ajustarPosicion(popover);
  });

  contenedor.append(boton, popover);
  return contenedor;
}
