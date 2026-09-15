// Panel de accesibilidad (Fase 9, tarea 1 -- ver ADR 0030): tamaño de
// texto (3 niveles) y alto contraste, persistidos en localStorage e
// INDEPENDIENTES del tema claro/oscuro -- ese sigue siendo función
// exclusiva de #boton-tema en la sidebar (theme.js). El botón flotante
// que antes togleaba tema ahora abre este panel.
//
// El tamaño de texto escala el font-size de <html>: toda la interfaz usa
// rem para tipografía/paddings/gaps, así que un solo valor reescala todo
// proporcionalmente, el mismo mecanismo que ya usa el zoom del
// navegador (ver estilos.css, reglas [data-tamano-texto]).

const CLAVE_TAMANO = 'pos-dona-olga:tamano-texto';
const CLAVE_CONTRASTE = 'pos-dona-olga:alto-contraste';

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // localStorage puede fallar (modo privado, cuota llena). El ajuste
    // simplemente no persiste entre sesiones; no es un error que deba
    // interrumpir el uso del panel.
  }
}

function leerGuardado(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function aplicarTamano(tamano) {
  document.documentElement.setAttribute('data-tamano-texto', tamano);
}

function aplicarContraste(activo) {
  if (activo) {
    document.documentElement.setAttribute('data-alto-contraste', 'true');
  } else {
    document.documentElement.removeAttribute('data-alto-contraste');
  }
}

// Aplicado al importar el módulo, no dentro de iniciarAccesibilidad(): si
// se esperara al primer render de main.js, alguien con "Grande" guardado
// vería un instante en tamaño normal antes de reescalar -- mismo criterio
// que el tema (ver theme.js), aunque acá no hace falta un script inline
// en <head> porque el salto de tamaño de texto es mucho menos brusco que
// un flash claro/oscuro completo.
aplicarTamano(leerGuardado(CLAVE_TAMANO) ?? 'normal');
aplicarContraste(leerGuardado(CLAVE_CONTRASTE) === 'true');

export function iniciarAccesibilidad(botonFlotante) {
  const overlay = document.getElementById('overlay-accesibilidad');
  const botonCerrar = document.getElementById('boton-cerrar-accesibilidad');
  const botonesTamano = Array.from(overlay.querySelectorAll('[data-tamano]'));
  const inputContraste = document.getElementById('input-alto-contraste');

  const tamanoActual = document.documentElement.getAttribute('data-tamano-texto') ?? 'normal';
  botonesTamano.forEach((boton) => {
    const activo = boton.dataset.tamano === tamanoActual;
    boton.classList.toggle('selector-periodo__boton--activo', activo);
    boton.setAttribute('aria-pressed', String(activo));
  });
  inputContraste.checked = document.documentElement.hasAttribute('data-alto-contraste');

  botonesTamano.forEach((boton) => {
    boton.addEventListener('click', () => {
      const tamano = boton.dataset.tamano;
      aplicarTamano(tamano);
      guardar(CLAVE_TAMANO, tamano);
      botonesTamano.forEach((otro) => {
        const activo = otro === boton;
        otro.classList.toggle('selector-periodo__boton--activo', activo);
        otro.setAttribute('aria-pressed', String(activo));
      });
    });
  });

  inputContraste.addEventListener('change', () => {
    aplicarContraste(inputContraste.checked);
    guardar(CLAVE_CONTRASTE, String(inputContraste.checked));
  });

  botonFlotante.addEventListener('click', () => {
    overlay.hidden = false;
    botonesTamano[0].focus();
  });

  botonCerrar.addEventListener('click', () => {
    overlay.hidden = true;
    botonFlotante.focus();
  });
}
