// Captura del lector de código de barras HID (funciona como teclado, sin
// driver — confirmado con hardware real, ver ADR 0007 de impresión donde
// se documentó el lector). No hay un campo de texto dedicado: el lector
// tipea donde sea que esté el foco, así que este listener es global.
//
// La diferencia entre "alguien escribiendo" y "el lector disparando una
// ráfaga" es de velocidad: un lector HID entrega cada carácter en unos
// pocos milisegundos; incluso una persona escribiendo muy rápido no baja
// de ~60-80ms entre teclas. Un umbral de 30ms es conservador de sobra —
// prácticamente nunca lo dispara tecleo humano por accidente.

const UMBRAL_MS_ENTRE_TECLAS = 30;
const LARGO_MINIMO_CODIGO = 4;
const TIMEOUT_CIERRE_MS = 100;

export function iniciarLectorCodigoBarras(alDetectarCodigo) {
  let buffer = '';
  let ultimoTiempo = 0;
  let temporizadorCierre = null;

  function reiniciar() {
    buffer = '';
    if (temporizadorCierre) {
      clearTimeout(temporizadorCierre);
      temporizadorCierre = null;
    }
  }

  function finalizar() {
    const codigo = buffer;
    reiniciar();

    if (codigo.length < LARGO_MINIMO_CODIGO) return;

    // El lector tipeó donde estuviera el foco en ese momento (ej. el
    // buscador manual). Limpiamos ese residuo: el código ya se procesa
    // por su cuenta, no tiene sentido dejarlo como texto de búsqueda.
    if (document.activeElement instanceof HTMLInputElement) {
      document.activeElement.value = '';
    }

    alDetectarCodigo(codigo);
  }

  document.addEventListener('keydown', (evento) => {
    if (evento.ctrlKey || evento.altKey || evento.metaKey) {
      reiniciar();
      return;
    }

    const ahora = performance.now();
    const tiempoDesdeUltimaTecla = ahora - ultimoTiempo;
    ultimoTiempo = ahora;

    if (evento.key === 'Enter') {
      if (buffer.length >= LARGO_MINIMO_CODIGO) {
        // Solo interceptamos Enter cuando el buffer ya es lo bastante
        // largo para ser, con confianza, el terminador de un escaneo —
        // así un Enter normal en cualquier otro campo nunca se ve afectado.
        evento.preventDefault();
        finalizar();
      } else {
        reiniciar();
      }
      return;
    }

    // Los lectores HID entregan caracteres imprimibles normales, nunca
    // teclas especiales (Shift, Tab, flechas...) como eventos propios.
    if (evento.key.length !== 1) return;

    if (buffer.length > 0 && tiempoDesdeUltimaTecla <= UMBRAL_MS_ENTRE_TECLAS) {
      buffer += evento.key;
    } else {
      // Muy lento para ser la misma ráfaga (o es la primera tecla):
      // arrancamos un buffer nuevo, por si resulta ser el inicio de un
      // escaneo real.
      buffer = evento.key;
    }

    if (temporizadorCierre) clearTimeout(temporizadorCierre);
    temporizadorCierre = setTimeout(finalizar, TIMEOUT_CIERRE_MS);
  });
}
