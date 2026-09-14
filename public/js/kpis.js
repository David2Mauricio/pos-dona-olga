// Panel de Indicadores (Fase 4/Bloque 3 original + Fase 4 cierre, ver ADR
// 0013 y 0015). Mismo patrón que usuarios.js/catalogo.js: módulo
// autocontenido, propio DOM, propias llamadas. Solo-administrador en el
// backend (app.js monta /api/reportes con requiereRol('administrador')) —
// main.js oculta el nav para cajero, pero eso es ayuda de UI, no la
// protección real.
//
// Sin librería de gráficos ni CDN: dos gráficos de barras dibujados a mano
// con SVG, generados en JS a partir de los datos reales — mismo criterio
// que los íconos SVG inline hechos a mano en el resto de la interfaz. El
// backend (GET /api/reportes/ventas?desde&hasta) ya acepta cualquier rango
// de fechas — el selector de período (día/semana/mes/trimestre) es
// enteramente de cliente, sin cambios de backend.
//
// ticketPromedio y la exclusión de anuladas ya vienen calculados por el
// backend (reportes.service.js) — este módulo no repite esa aritmética.
// La comparativa contra el período anterior sí es de cliente, porque no
// hay ningún endpoint que compare dos rangos: se pide el mismo reporte dos
// veces (período actual, período anterior) en paralelo.

import { api, ErrorApi } from './api.js';
import { mostrarToast } from './render.js';
import { formatearMoneda } from './utils.js';

const NS_SVG = 'http://www.w3.org/2000/svg';

const contenedorCargando = document.getElementById('indicadores-cargando');
const contenedorContenido = document.getElementById('indicadores-contenido');
const elementoEtiquetaVentas = document.getElementById('indicadores-etiqueta-ventas');
const elementoTotalVentas = document.getElementById('indicadores-total-ventas');
const elementoCantidadVentas = document.getElementById('indicadores-cantidad-ventas');
const elementoTicketPromedio = document.getElementById('indicadores-ticket-promedio');
const elementoUnidadesVendidas = document.getElementById('indicadores-unidades-vendidas');
const elementoProductoTop = document.getElementById('indicadores-producto-top');
const elementoProductoTopMonto = document.getElementById('indicadores-producto-top-monto');
const elementoEtiquetaComparativa = document.getElementById('indicadores-etiqueta-comparativa');
const elementoComparativa = document.getElementById('indicadores-comparativa');
const elementoTotalGastos = document.getElementById('indicadores-total-gastos');
const elementoGananciaReal = document.getElementById('indicadores-ganancia-real');
const graficoComparativa = document.getElementById('grafico-comparativa');
const graficoProductos = document.getElementById('grafico-productos');
const graficoTendencia = document.getElementById('grafico-tendencia');
const graficoMedioPago = document.getElementById('grafico-medio-pago');
const graficoCategorias = document.getElementById('grafico-categorias');
const resumenProductos = document.getElementById('grafico-productos-resumen');
const resumenTendencia = document.getElementById('grafico-tendencia-resumen');
const resumenMedioPago = document.getElementById('grafico-medio-pago-resumen');
const resumenCategorias = document.getElementById('grafico-categorias-resumen');
const selectorPeriodo = document.getElementById('selector-periodo');
const contenedorDesgloseVentas = document.getElementById('indicadores-desglose-ventas');
const botonVerHistorialFiltrado = document.getElementById('boton-ver-historial-filtrado');
const botonExportarCsv = document.getElementById('boton-exportar-csv');

let periodoActual = 'dia';
let rangoActualParaHistorial = null; // {desde,hasta} del período que se está viendo -- lo usa el link a Historial

const LIMITE_DESGLOSE = 8;

function mensajeDeError(error) {
  return error instanceof ErrorApi ? error.message : 'No se pudo cargar el panel de indicadores. Intentá de nuevo.';
}

// Fechas locales (no UTC) para no correr el día por el huso horario —
// mismo criterio que historial.js:fechaDeHoy().
function fechaISO(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function sumarDias(fecha, dias) {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

function diferenciaDias(a, b) {
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  const aMedianoche = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bMedianoche = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((aMedianoche.getTime() - bMedianoche.getTime()) / MS_POR_DIA);
}

function inicioSemana(fecha) {
  const offset = (fecha.getDay() + 6) % 7; // lunes = 0
  return sumarDias(fecha, -offset);
}

function inicioMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

function inicioTrimestre(fecha) {
  const mesTrimestre = Math.floor(fecha.getMonth() / 3) * 3;
  return new Date(fecha.getFullYear(), mesTrimestre, 1);
}

// Cada período define cómo calcular su propio inicio, el inicio del
// período anterior equivalente, y las etiquetas de UI. La comparativa es
// "período a la fecha" (period-to-date): si hoy es el 3er día de la
// semana/mes/trimestre actual, se compara contra los primeros 3 días del
// período anterior — no contra el período anterior completo, que
// exageraría cualquier variación mientras el período actual esté en curso
// (mismo espíritu que ya regía "hoy vs. ayer": comparar cosas comparables).
const DEFINICIONES_PERIODO = {
  dia: {
    etiquetaCorta: 'hoy',
    etiquetaComparativa: 'ayer',
    calcularInicio: (hoy) => hoy,
    calcularInicioAnterior: (inicio) => sumarDias(inicio, -1),
  },
  semana: {
    etiquetaCorta: 'esta semana',
    etiquetaComparativa: 'la semana pasada',
    calcularInicio: inicioSemana,
    calcularInicioAnterior: (inicio) => sumarDias(inicio, -7),
  },
  mes: {
    etiquetaCorta: 'este mes',
    etiquetaComparativa: 'el mes pasado',
    calcularInicio: inicioMes,
    calcularInicioAnterior: (inicio) => inicioMes(sumarDias(inicio, -1)),
  },
  trimestre: {
    etiquetaCorta: 'este trimestre',
    etiquetaComparativa: 'el trimestre pasado',
    calcularInicio: inicioTrimestre,
    calcularInicioAnterior: (inicio) => inicioTrimestre(sumarDias(inicio, -1)),
  },
};

function calcularRangos(tipoPeriodo) {
  const hoy = new Date();
  const definicion = DEFINICIONES_PERIODO[tipoPeriodo];
  const inicioActual = definicion.calcularInicio(hoy);
  const diasTranscurridos = diferenciaDias(hoy, inicioActual) + 1;

  const inicioAnterior = definicion.calcularInicioAnterior(inicioActual);
  // Tope: no cruzar hacia el período actual — importa en meses/trimestres
  // más cortos que el actual (ej. comparar el 30 de marzo contra febrero).
  const topeFinAnterior = sumarDias(inicioActual, -1);
  let finAnterior = sumarDias(inicioAnterior, diasTranscurridos - 1);
  if (finAnterior > topeFinAnterior) finAnterior = topeFinAnterior;

  return {
    actual: { desde: fechaISO(inicioActual), hasta: fechaISO(hoy) },
    anterior: { desde: fechaISO(inicioAnterior), hasta: fechaISO(finAnterior) },
    etiquetaCorta: definicion.etiquetaCorta,
    etiquetaComparativa: definicion.etiquetaComparativa,
  };
}

// null si no se puede calcular (sin base contra la que comparar) — nunca
// Infinity/NaN. Pedido explícito: "el período anterior sin ventas" no es
// "0% de variación", es "no hay con qué comparar".
function calcularVariacionPorcentual(totalActual, totalAnterior) {
  if (totalAnterior === 0) return null;
  return Math.round(((totalActual - totalAnterior) / totalAnterior) * 100);
}

function renderizarComparativa(totalActual, totalAnterior, etiquetaComparativa) {
  const variacion = calcularVariacionPorcentual(totalActual, totalAnterior);

  elementoComparativa.innerHTML = '';
  if (variacion === null) {
    const texto = document.createElement('span');
    texto.className = 'indicadores__detalle';
    texto.textContent = `Sin ventas registradas ${etiquetaComparativa}`;
    elementoComparativa.appendChild(texto);
    return;
  }

  const badge = document.createElement('span');
  const tono = variacion > 0 ? 'exito' : variacion < 0 ? 'peligro' : '';
  badge.className = tono ? `badge-alerta badge-alerta--${tono}` : 'badge-alerta';
  const signo = variacion > 0 ? '+' : '';
  badge.textContent = `${signo}${variacion}% vs ${etiquetaComparativa}`;
  elementoComparativa.appendChild(badge);
}

// --- Gráficos SVG (sin librería, sin CDN — ver cabecera del archivo) ---

function crearElementoSvg(etiqueta, atributos) {
  const elemento = document.createElementNS(NS_SVG, etiqueta);
  Object.entries(atributos).forEach(([clave, valor]) => elemento.setAttribute(clave, valor));
  return elemento;
}

function limpiarGrafico(contenedor, textoVacio) {
  contenedor.innerHTML = '';
  const vacio = document.createElement('p');
  vacio.className = 'catalogo__vacio';
  vacio.textContent = textoVacio;
  contenedor.appendChild(vacio);
}

// Dos barras verticales: período anterior vs. período actual. aria-label
// describe los valores reales (no solo "gráfico de barras") para que un
// lector de pantalla obtenga la misma información que alguien viendo las
// barras — mismo criterio de accesibilidad que el resto de la interfaz
// (ver auditorías axe-core previas).
function renderizarGraficoComparativa(totalAnterior, totalActual, etiquetaAnterior) {
  graficoComparativa.innerHTML = '';

  if (totalAnterior === 0 && totalActual === 0) {
    limpiarGrafico(graficoComparativa, 'Sin ventas para graficar todavía.');
    return;
  }

  const ANCHO = 220;
  const ALTO = 130;
  const ALTO_BARRAS = 90;
  // Espacio reservado arriba para la etiqueta de monto, incluso encima de
  // la barra más alta posible -- sin esto, cuando un valor toca el 100%
  // de ALTO_BARRAS su etiqueta caía en y≈2, casi encima del borde del
  // viewBox: quedaba cortada por el propio SVG y quedaba visualmente
  // encimada con el badge "+X% vs..." que está arriba, fuera del SVG.
  // Confirmado con una captura real antes de asumir la causa.
  const MARGEN_ETIQUETA = 18;
  const ALTO_BARRA_MAXIMO = ALTO_BARRAS - MARGEN_ETIQUETA;
  const ANCHO_BARRA = 56;
  const maximo = Math.max(totalAnterior, totalActual, 1);

  const svg = crearElementoSvg('svg', {
    viewBox: `0 0 ${ANCHO} ${ALTO}`,
    role: 'img',
    'aria-label': `Comparativa de ventas: ${formatearMoneda(totalAnterior)} ${etiquetaAnterior}, ${formatearMoneda(totalActual)} en el período actual.`,
    class: 'indicadores__svg',
  });

  const barras = [
    { valor: totalAnterior, etiqueta: etiquetaAnterior, x: 24, color: 'var(--color-texto-muted)' },
    { valor: totalActual, etiqueta: 'actual', x: 24 + ANCHO_BARRA + 40, color: 'var(--color-acento)' },
  ];

  barras.forEach(({ valor, etiqueta, x, color }) => {
    const alturaBarra = Math.max((valor / maximo) * ALTO_BARRA_MAXIMO, valor > 0 ? 3 : 0);
    const y = ALTO_BARRAS - alturaBarra + 8;

    const rect = crearElementoSvg('rect', {
      x,
      y,
      width: ANCHO_BARRA,
      height: alturaBarra,
      rx: 4,
      'aria-hidden': 'true',
    });
    rect.style.fill = color;
    svg.appendChild(rect);

    const etiquetaValor = crearElementoSvg('text', {
      x: x + ANCHO_BARRA / 2,
      y: y - 6,
      'text-anchor': 'middle',
      class: 'indicadores__svg-valor',
      'aria-hidden': 'true',
    });
    etiquetaValor.textContent = formatearMoneda(valor);
    svg.appendChild(etiquetaValor);

    const etiquetaEje = crearElementoSvg('text', {
      x: x + ANCHO_BARRA / 2,
      y: ALTO_BARRAS + 24,
      'text-anchor': 'middle',
      class: 'indicadores__svg-etiqueta',
      'aria-hidden': 'true',
    });
    etiquetaEje.textContent = etiqueta;
    svg.appendChild(etiquetaEje);
  });

  graficoComparativa.appendChild(svg);
}

// Barras horizontales para el top de productos — el largo de los nombres
// varía mucho (de "Pollo" a nombres compuestos largos), así que barras
// horizontales con el nombre a la izquierda leen mejor que barras
// verticales con nombres rotados o truncados.
// --- Chart.js (rediseño visual, Fase 6) ---
// Vendorizado como archivo estático local (public/js/vendor/chart.umd.min.js,
// ver ADR 0022) -- reemplaza los gráficos grandes que antes eran SVG a
// mano (tendencia, top productos, donut de medio de pago) y agrega el
// donut nuevo de categoría. La comparativa chica (arriba) se queda como
// estaba: un solo bloque de 2 barras no justificaba la dependencia, y ya
// usa var(--color-x) directo en SVG (sí soportado ahí, a diferencia de
// canvas) -- ya está en la misma paleta sin tocar nada.
//
// Un <canvas> no es accesible por sí solo (a diferencia del SVG a mano,
// que llevaba su propio role="img"/aria-label) -- cada gráfico tiene un
// <p class="visualmente-oculto"> hermano (aria-describedby en el canvas,
// ver index.html) con el mismo resumen en texto que ya se armaba antes.
// Sin datos, ese mismo párrafo se muestra (deja de estar oculto) con el
// mensaje vacío, en vez de dejar un canvas en blanco sin explicación.
//
// Chart.js lanza error si se crea una instancia nueva sobre un <canvas>
// que ya tiene una activa -- con el selector de período reejecutando el
// render en cada cambio, hay que destruir la instancia anterior antes de
// crear la próxima. Un registro (Map) por id de canvas alcanza.
const graficosChart = new Map();

function crearOReemplazarChart(canvas, config) {
  graficosChart.get(canvas.id)?.destroy();
  const grafico = new Chart(canvas, config);
  graficosChart.set(canvas.id, grafico);
  return grafico;
}

// Resueltos en cada render, no una vez al cargar el módulo: un <canvas>
// dibuja con valores de color reales, no puede usar var(--color-x) como sí
// hacen los SVG a mano -- si el tema cambia entre una carga y otra, el
// próximo render ya toma los valores nuevos sin lógica aparte.
function coloresDelTema() {
  const estilos = getComputedStyle(document.documentElement);
  const leer = (variable) => estilos.getPropertyValue(variable).trim();
  return {
    acento: leer('--color-acento'),
    exito: leer('--color-exito'),
    alerta: leer('--color-alerta'),
    peligro: leer('--color-peligro'),
    textoMuted: leer('--color-texto-muted'),
    texto: leer('--color-texto'),
    borde: leer('--color-borde'),
  };
}

function mostrarResumenVacio(elementoResumen, canvas, textoVacio) {
  graficosChart.get(canvas.id)?.destroy();
  graficosChart.delete(canvas.id);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  elementoResumen.textContent = textoVacio;
  elementoResumen.classList.remove('visualmente-oculto');
  elementoResumen.classList.add('catalogo__vacio');
}

function ocultarResumenAccesible(elementoResumen, texto) {
  elementoResumen.textContent = texto;
  elementoResumen.classList.add('visualmente-oculto');
  elementoResumen.classList.remove('catalogo__vacio');
}

function renderizarGraficoProductos(topProductos) {
  if (topProductos.length === 0) {
    mostrarResumenVacio(resumenProductos, graficoProductos, 'Sin ventas registradas en este período.');
    return;
  }

  const productos = topProductos.slice(0, 5);
  const colores = coloresDelTema();
  ocultarResumenAccesible(
    resumenProductos,
    `Top productos por monto vendido en el período: ${productos.map((p) => `${p.nombre}: ${formatearMoneda(p.totalVendido)}`).join('; ')}.`
  );

  crearOReemplazarChart(graficoProductos, {
    type: 'bar',
    data: {
      labels: productos.map((p) => p.nombre),
      datasets: [{ data: productos.map((p) => p.totalVendido), backgroundColor: colores.acento, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => formatearMoneda(item.parsed.x) } },
      },
      scales: {
        x: { ticks: { color: colores.textoMuted, callback: (valor) => formatearMoneda(valor) }, grid: { color: colores.borde } },
        y: { ticks: { color: colores.texto }, grid: { display: false } },
      },
    },
  });
}

function formatearEtiquetaFechaCorta(fechaIso) {
  const [, mes, dia] = fechaIso.split('-');
  return `${dia}/${mes}`;
}

// Línea de tendencia: un punto por día dentro del rango (ventasPorDia ya
// viene relleno en $0 para los días sin ventas, ver reportes.service.js —
// sin eso, la línea saltaría directo entre los días que sí tuvieron y
// daría una forma falsa). Un solo día no tiene tendencia que mostrar
// (el período "Día" del selector), así que ahí se pasa directo al mensaje
// vacío en vez de dibujar una línea degenerada de un solo punto.
function renderizarGraficoTendencia(ventasPorDia) {
  if (ventasPorDia.length < 2) {
    mostrarResumenVacio(resumenTendencia, graficoTendencia, 'Elegí un período de más de un día para ver la tendencia.');
    return;
  }

  const totalGeneral = ventasPorDia.reduce((suma, dia) => suma + dia.total, 0);
  if (totalGeneral === 0) {
    mostrarResumenVacio(resumenTendencia, graficoTendencia, 'Sin ventas para graficar todavía.');
    return;
  }

  const colores = coloresDelTema();
  const maximo = Math.max(...ventasPorDia.map((dia) => dia.total));
  const minimo = Math.min(...ventasPorDia.map((dia) => dia.total));
  ocultarResumenAccesible(
    resumenTendencia,
    `Tendencia de ventas del ${ventasPorDia[0].fecha} al ${ventasPorDia[ventasPorDia.length - 1].fecha}, entre ${formatearMoneda(minimo)} y ${formatearMoneda(maximo)} por día.`
  );

  crearOReemplazarChart(graficoTendencia, {
    type: 'line',
    data: {
      labels: ventasPorDia.map((dia) => formatearEtiquetaFechaCorta(dia.fecha)),
      datasets: [
        {
          data: ventasPorDia.map((dia) => dia.total),
          borderColor: colores.acento,
          backgroundColor: `${colores.acento}26`, // relleno suave bajo la línea (~15% opacidad)
          pointBackgroundColor: colores.acento,
          tension: 0.2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => formatearMoneda(item.parsed.y) } },
      },
      scales: {
        x: { ticks: { color: colores.textoMuted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { display: false } },
        y: { ticks: { color: colores.textoMuted, callback: (valor) => formatearMoneda(valor) }, grid: { color: colores.borde } },
      },
    },
  });
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Paleta compartida por los dos donuts (medio de pago y categoría) -- los
// mismos tonos semánticos ya establecidos en el resto del rediseño
// visual, nunca los colores por defecto de Chart.js (pedido explícito del
// cliente): azul de marca primero, después éxito/alerta/peligro, gris
// neutro si sobran categorías.
function paletaCategorica(colores) {
  return [colores.acento, colores.exito, colores.alerta, colores.peligro, colores.textoMuted];
}

// Donut genérico: medio de pago y categoría son la misma forma de datos
// (lista de {etiqueta, valor}), solo cambia de dónde sale la lista -- ver
// renderizarGraficoDonutMedioPago/renderizarGraficoDonutCategoria abajo.
function crearGraficoDonut(canvas, elementoResumen, items, tituloResumen) {
  const total = items.reduce((suma, item) => suma + item.valor, 0);
  if (total === 0) {
    mostrarResumenVacio(elementoResumen, canvas, 'Sin ventas para graficar todavía.');
    return;
  }

  const colores = coloresDelTema();
  const paleta = paletaCategorica(colores);
  ocultarResumenAccesible(
    elementoResumen,
    `${tituloResumen}: ${items.map((item) => `${item.etiqueta}: ${Math.round((item.valor / total) * 100)}% (${formatearMoneda(item.valor)})`).join('; ')}.`
  );

  crearOReemplazarChart(canvas, {
    type: 'doughnut',
    data: {
      labels: items.map((item) => item.etiqueta),
      datasets: [{ data: items.map((item) => item.valor), backgroundColor: items.map((_item, indice) => paleta[indice % paleta.length]) }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: colores.texto, boxWidth: 12, padding: 12 } },
        tooltip: {
          callbacks: {
            label: (item) => `${item.label}: ${formatearMoneda(item.parsed)} (${Math.round((item.parsed / total) * 100)}%)`,
          },
        },
      },
    },
  });
}

// Reutiliza desglosePorMedioPago, que el backend ya devuelve (sin cambio
// de backend para esto, a diferencia de unidadesVendidas/ventasPorCategoria).
function renderizarGraficoDonutMedioPago(desglosePorMedioPago) {
  const items = desglosePorMedioPago.map((item) => ({ etiqueta: capitalizar(item.medioPago), valor: item.total }));
  crearGraficoDonut(graficoMedioPago, resumenMedioPago, items, 'Desglose de ventas por medio de pago');
}

// Distribución por categoría (rediseño visual, Fase 6) -- ventasPorCategoria
// es un agregado nuevo de backend (reportes.repository.js), no derivado de
// topProductos en el cliente: ese solo trae el top 10, una categoría con
// muchos productos chicos podría quedar subrepresentada.
function renderizarGraficoDonutCategoria(ventasPorCategoria) {
  const items = ventasPorCategoria.map((item) => ({ etiqueta: item.nombre, valor: item.total }));
  crearGraficoDonut(graficoCategorias, resumenCategorias, items, 'Distribución de ventas por categoría');
}

// creadaEn: 'YYYY-MM-DD HH:MM:SS' (ver ventas.repository.js). Con el
// período en "Día" alcanza con la hora; para semana/mes/trimestre, varias
// ventas caen en días distintos, así que se antepone la fecha (mismo
// criterio que historial.js cuando lo abre este mismo link con un rango
// de más de un día).
function formatearFechaHoraDesglose(creadaEn) {
  const [fecha, hora] = creadaEn.split(' ');
  const horaCorta = hora?.slice(0, 5) ?? creadaEn;
  return periodoActual === 'dia' ? horaCorta : `${fecha} ${horaCorta}`;
}

// Desglose simple (hora, monto, medio de pago) de las ventas que entran en
// el total mostrado arriba -- no reemplaza Historial (por eso el límite y
// el link "Ver detalle"), solo da un vistazo rápido sin cambiar de
// sección. Ventas anuladas quedan afuera a propósito: el total de arriba
// tampoco las cuenta (ver reportes.repository.js, estado='activa'),
// mostrarlas acá sin contar en el total de arriba sería confuso.
async function cargarYRenderizarDesglose(rango) {
  contenedorDesgloseVentas.innerHTML = '';
  try {
    const ventas = await api.listarVentas(rango);
    const activas = ventas.filter((venta) => venta.estado === 'activa');

    if (activas.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'indicadores__desglose-vacio';
      vacio.textContent = 'Sin ventas en este período.';
      contenedorDesgloseVentas.appendChild(vacio);
      return;
    }

    activas.slice(0, LIMITE_DESGLOSE).forEach((venta) => {
      const fila = document.createElement('div');
      fila.className = 'indicadores__desglose-fila';

      const hora = document.createElement('span');
      hora.textContent = formatearFechaHoraDesglose(venta.creadaEn);

      const medioPago = document.createElement('span');
      medioPago.textContent = venta.medioPago;

      const monto = document.createElement('span');
      monto.className = 'numero';
      monto.textContent = formatearMoneda(venta.total);

      fila.append(hora, medioPago, monto);
      contenedorDesgloseVentas.appendChild(fila);
    });

    if (activas.length > LIMITE_DESGLOSE) {
      const resto = document.createElement('p');
      resto.className = 'indicadores__desglose-vacio';
      resto.textContent = `+ ${activas.length - LIMITE_DESGLOSE} venta(s) más — ver detalle completo en Historial.`;
      contenedorDesgloseVentas.appendChild(resto);
    }
  } catch (error) {
    // No es crítico para el resto del panel -- el desglose es un plus, no
    // la fuente de verdad del total (que ya se ve arriba). Si falla, se
    // deja vacío en vez de tumbar el resto de Indicadores con un toast.
    contenedorDesgloseVentas.innerHTML = '';
  }
}

function renderizar(reporteActual, reporteAnterior, rangos) {
  elementoEtiquetaVentas.textContent = `Ventas totales (${rangos.etiquetaCorta})`;
  elementoTotalVentas.textContent = formatearMoneda(reporteActual.totalVentas);
  elementoCantidadVentas.textContent =
    reporteActual.cantidadVentas === 1 ? '1 venta' : `${reporteActual.cantidadVentas} ventas`;

  elementoTicketPromedio.textContent =
    reporteActual.ticketPromedio === null ? '—' : formatearMoneda(reporteActual.ticketPromedio);
  // ?? 0, no reporteActual.unidadesVendidas directo: un bug real (ver
  // incidente post-Fase 6) mostró qué pasa si este campo llega ausente --
  // un servidor Node que no se reinició después de actualizar el código
  // sigue sirviendo la forma vieja del reporte aunque el HTML/JS del
  // navegador ya sean los nuevos. Sin el default, esto solo mostraba el
  // texto "undefined"; con ventasPorCategoria (abajo) el mismo problema
  // tumbaba el panel entero, no solo una tarjeta.
  elementoUnidadesVendidas.textContent = String(reporteActual.unidadesVendidas ?? 0);

  const masVendido = reporteActual.topProductos[0];
  if (masVendido) {
    elementoProductoTop.textContent = masVendido.nombre;
    elementoProductoTopMonto.textContent = `${formatearMoneda(masVendido.totalVendido)} vendidos`;
  } else {
    elementoProductoTop.textContent = 'Sin ventas registradas en este período';
    elementoProductoTopMonto.textContent = '';
  }

  elementoTotalGastos.textContent = formatearMoneda(reporteActual.totalGastos);
  elementoGananciaReal.textContent = formatearMoneda(reporteActual.gananciaReal);

  elementoEtiquetaComparativa.textContent = `Comparativa contra ${rangos.etiquetaComparativa}`;
  renderizarComparativa(reporteActual.totalVentas, reporteAnterior.totalVentas, rangos.etiquetaComparativa);
  renderizarGraficoComparativa(reporteAnterior.totalVentas, reporteActual.totalVentas, rangos.etiquetaComparativa);
  renderizarGraficoProductos(reporteActual.topProductos);
  renderizarGraficoTendencia(reporteActual.ventasPorDia);
  renderizarGraficoDonutMedioPago(reporteActual.desglosePorMedioPago);
  // ?? [], no reporteActual.ventasPorCategoria directo -- ver el comentario
  // de unidadesVendidas arriba. Sin este default, un reporte sin este
  // campo (por ejemplo un backend que todavía no se reinició tras
  // actualizar) hace que .map() explote acá adentro; como el error queda
  // atrapado por el catch de cargarIndicadores() sin loguearse (ver ese
  // catch, también corregido en este mismo incidente), tumbaba TODO el
  // panel -- ni siquiera las tarjetas que ya se habían pintado antes de
  // esta línea llegaban a mostrarse, porque contenedorContenido recién se
  // revela al final de esta función. Con el default, si falta el campo,
  // el donut de categoría simplemente muestra su propio estado vacío.
  renderizarGraficoDonutCategoria(reporteActual.ventasPorCategoria ?? []);

  rangoActualParaHistorial = rangos.actual;
  cargarYRenderizarDesglose(rangos.actual);

  contenedorCargando.hidden = true;
  contenedorContenido.hidden = false;
}

async function cargarIndicadores() {
  contenedorCargando.hidden = false;
  contenedorCargando.textContent = 'Cargando…';
  contenedorContenido.hidden = true;

  try {
    const rangos = calcularRangos(periodoActual);
    const [reporteActual, reporteAnterior] = await Promise.all([
      api.obtenerReporteVentas(rangos.actual),
      api.obtenerReporteVentas(rangos.anterior),
    ]);
    renderizar(reporteActual, reporteAnterior, rangos);
  } catch (error) {
    // console.error acá es nuevo (ver incidente post-Fase 6, ADR 0022):
    // antes este catch atrapaba CUALQUIER excepción -- de la petición o de
    // renderizar() completo -- sin dejar rastro real en la consola, solo
    // este mensaje genérico. Un bug real (reporteActual llegando sin
    // ventasPorCategoria) quedó invisible para el diagnóstico normal por
    // esto mismo: no había nada que ver en DevTools más allá del toast.
    console.error('Error al cargar Indicadores:', error);
    contenedorCargando.textContent = 'No se pudo cargar el panel de indicadores.';
    mostrarToast(mensajeDeError(error), 'error');
  }
}

selectorPeriodo.querySelectorAll('.selector-periodo__boton').forEach((boton) => {
  boton.addEventListener('click', () => {
    if (boton.dataset.periodo === periodoActual) return;
    periodoActual = boton.dataset.periodo;
    selectorPeriodo.querySelectorAll('.selector-periodo__boton').forEach((otro) => {
      const activo = otro === boton;
      otro.classList.toggle('selector-periodo__boton--activo', activo);
      otro.setAttribute('aria-pressed', String(activo));
    });
    cargarIndicadores();
  });
});

// Abre Historial en el mismo rango de fecha que se está viendo acá, sin
// pasar por un click real de la sidebar -- import dinámico porque
// historial.js no se carga hasta que hace falta (mismo criterio de carga
// diferida que ya usa main.js para el resto de las secciones admin-only).
botonVerHistorialFiltrado.addEventListener('click', async () => {
  if (!rangoActualParaHistorial) return;
  const [{ iniciarHistorial, abrirHistorial }, { obtenerUsuarioActual }, { mostrarVista }] = await Promise.all([
    import('./historial.js'),
    import('./auth.js'),
    import('./main.js'),
  ]);
  iniciarHistorial({ obtenerUsuarioActual });
  abrirHistorial(rangoActualParaHistorial);
  mostrarVista('historial');
});

// Descarga el CSV del rango que se está viendo ahora mismo (mismo criterio
// que "Ver detalle en Historial": usa rangoActualParaHistorial, no un
// rango propio). Blob + <a> sintético en vez de navegar a la URL directo:
// si la sesión venció a mitad de camino, el error viaja como JSON y se
// muestra con el mismo toast de siempre, en vez de que el navegador
// abandone la SPA mostrando el JSON crudo del error.
botonExportarCsv.addEventListener('click', async () => {
  if (!rangoActualParaHistorial) return;
  botonExportarCsv.disabled = true;
  try {
    const { blob, nombreArchivo } = await api.exportarVentasCsv(rangoActualParaHistorial);
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    mostrarToast(mensajeDeError(error), 'error');
  } finally {
    botonExportarCsv.disabled = false;
  }
});

export async function abrirIndicadores() {
  await cargarIndicadores();
}
