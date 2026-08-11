// Helpers puros. Mismo criterio de formato que ya usa el backend en el
// recibo impreso (ADR 0007): pesos COP con punto de miles, peso en kilos
// con coma decimal — para que lo que ve el cajero en pantalla coincida
// con lo que sale impreso.

export function formatearMoneda(pesos) {
  const signo = pesos < 0 ? '-' : '';
  const conSeparadores = Math.round(Math.abs(pesos))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}$${conSeparadores}`;
}

export function gramosAKilosTexto(gramos) {
  return (gramos / 1000).toFixed(3).replace('.', ',');
}

// Acepta coma o punto como separador decimal (el cajero puede escribir
// cualquiera de los dos sin pensarlo). Devuelve null si no es un peso
// válido, para que quien llame decida cómo reaccionar.
export function kilosTextoAGramos(texto) {
  const normalizado = String(texto).replace(',', '.').trim();
  const kilos = Number.parseFloat(normalizado);
  if (Number.isNaN(kilos) || kilos <= 0) return null;
  return Math.round(kilos * 1000);
}

export function debounce(fn, esperaMs) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), esperaMs);
  };
}
