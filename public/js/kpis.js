// Panel de Indicadores (Fase 4/Bloque 3 original + Fase 4 cierre, ver ADR
// 0013 y 0015). Mismo patrón que usuarios.js/catalogo.js: módulo
// autocontenido, propio DOM, propias llamadas. Solo-administrador en el
// backend (app.js monta /api/reportes con requiereRol('administrador')) —
// main.js oculta el nav para cajero, pero eso es ayuda de UI, no la
// protección real.
//
// Gráficas con Chart.js vendorizado (ver ADR 0022, sin CDN -- el sistema
// es offline). El backend (GET /api/reportes/ventas?desde&hasta) ya
// acepta cualquier rango de fechas — el selector de período (día/semana/
// mes/trimestre) es enteramente de cliente, sin cambios de backend.
//
// ticketPromedio y la exclusión de anuladas ya vienen calculados por el
// backend (reportes.service.js) — este módulo no repite esa aritmética.
// La comparativa contra el período anterior sí es de cliente, porque no
// hay ningún endpoint que compare dos rangos: se pide el mismo reporte dos
// veces (período actual, período anterior) en paralelo.

import { api, ErrorApi } from './api.js';
import { mostrarToast } from './render.js';
import { formatearMoneda } from './utils.js';
import { iconoIndicadores, crearIcono } from './icons.js';

const contenedorCargando = document.getElementById('indicadores-cargando');
const contenedorContenido = document.getElementById('indicadores-contenido');
const elementoEtiquetaVentas = document.getElementById('indicadores-etiqueta-ventas');
const elementoTotalVentas = document.getElementById('indicadores-total-ventas');
const elementoCantidadVentas = document.getElementById('indicadores-cantidad-ventas');
const elementoTicketPromedio = document.getElementById('indicadores-ticket-promedio');
const elementoTicketPromedioVariacion = document.getElementById('indicadores-ticket-promedio-variacion');
const elementoUnidadesVendidas = document.getElementById('indicadores-unidades-vendidas');
const elementoUnidadesVendidasVariacion = document.getElementById('indicadores-unidades-vendidas-variacion');
const elementoComparativa = document.getElementById('indicadores-comparativa');
const elementoTotalGastos = document.getElementById('indicadores-total-gastos');
const elementoTotalGastosVariacion = document.getElementById('indicadores-total-gastos-variacion');
const elementoGananciaReal = document.getElementById('indicadores-ganancia-real');
const elementoGananciaRealVariacion = document.getElementById('indicadores-ganancia-real-variacion');
const graficoProductos = document.getElementById('grafico-productos');
const graficoTendencia = document.getElementById('grafico-tendencia');
const graficoMedioPago = document.getElementById('grafico-medio-pago');
const graficoCategorias = document.getElementById('grafico-categorias');
const resumenProductos = document.getElementById('grafico-productos-resumen');
const resumenTendencia = document.getElementById('grafico-tendencia-resumen');
const resumenMedioPago = document.getElementById('grafico-medio-pago-resumen');
const resumenCategorias = document.getElementById('grafico-categorias-resumen');
const contenedorCategoriasLeyenda = document.getElementById('indicadores-categorias-leyenda');
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

function crearBadgeVariacion(tono, texto) {
  const badge = document.createElement('span');
  badge.className = tono ? `badge-alerta badge-alerta--${tono}` : 'badge-alerta';
  badge.textContent = texto;
  return badge;
}

// Badge de variación, reusado por la cifra hero (Ventas totales) y por
// las 4 tarjetas compactas (mejoras visuales consolidadas -- antes solo
// existía para el total general, en una tarjeta "Comparativa" aparte con
// su propio gráfico de 2 barras; ese gráfico se retiró porque quedó
// redundante con la línea de tendencia de la tarjeta hero, que ya muestra
// la misma comparación de forma más rica). null (sin base para comparar)
// muestra un texto neutro, nunca "0%" ni un signo inventado.
//
// Ganancia real es la única de las 5 cifras que puede ser negativa (un
// período con más gastos que ventas) -- un % sobre una base negativa
// miente: de -100 a -50 (mejoró, hay menos pérdida) el cálculo normal da
// "-50%" y lo pinta de rojo, cuando en realidad mejoró. Con cualquiera de
// los dos valores negativo se muestra la diferencia en pesos en vez de
// un %, con el signo correcto según si la ganancia subió o bajó -- no
// hay forma honesta de expresar eso como porcentaje.
function renderizarVariacion(elemento, actual, anterior, etiquetaComparativa) {
  elemento.innerHTML = '';

  if (actual < 0 || anterior < 0) {
    const diferencia = actual - anterior;
    if (diferencia === 0) {
      elemento.appendChild(crearBadgeVariacion('', `Igual que ${etiquetaComparativa}`));
      return;
    }
    const tono = diferencia > 0 ? 'exito' : 'peligro';
    const signo = diferencia > 0 ? '+' : '-';
    elemento.appendChild(crearBadgeVariacion(tono, `${signo}${formatearMoneda(Math.abs(diferencia))} vs ${etiquetaComparativa}`));
    return;
  }

  const variacion = calcularVariacionPorcentual(actual, anterior);
  if (variacion === null) {
    const texto = document.createElement('span');
    texto.className = 'indicadores__detalle';
    texto.textContent = `Sin datos ${etiquetaComparativa}`;
    elemento.appendChild(texto);
    return;
  }

  const tono = variacion > 0 ? 'exito' : variacion < 0 ? 'peligro' : '';
  const signo = variacion > 0 ? '+' : '';
  elemento.appendChild(crearBadgeVariacion(tono, `${signo}${variacion}% vs ${etiquetaComparativa}`));
}

// Barras horizontales para el top de productos — el largo de los nombres
// varía mucho (de "Pollo" a nombres compuestos largos), así que barras
// horizontales con el nombre a la izquierda leen mejor que barras
// verticales con nombres rotados o truncados.
// --- Chart.js (rediseño visual, Fase 6) ---
// Vendorizado como archivo estático local (public/js/vendor/chart.umd.min.js,
// ver ADR 0022) -- reemplaza los gráficos grandes que antes eran SVG a
// mano (tendencia, top productos, donut de medio de pago) y agrega el
// donut nuevo de categoría. El bloque de 2 barras SVG que comparaba
// contra el período anterior se retiró (mejoras visuales consolidadas):
// la tarjeta hero de "Ventas totales" ahora muestra esa misma comparación
// como badge de variación + la línea de tendencia completa, más rica que
// dos barras sueltas.
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
    categoria1: leer('--color-categoria-1'),
    categoria2: leer('--color-categoria-2'),
    exito: leer('--color-exito'),
    alerta: leer('--color-alerta'),
    peligro: leer('--color-peligro'),
    textoMuted: leer('--color-texto-muted'),
    texto: leer('--color-texto'),
    borde: leer('--color-borde'),
  };
}

// Ícono + texto en vez de solo texto plano (mejoras visuales consolidadas,
// pedido explícito para el estado sin datos) -- reusa iconoIndicadores
// (el mismo glifo de barras del nav) en vez de dibujar uno nuevo solo para
// esto: ya es el símbolo que el propio sistema asocia a "esta es la
// sección de indicadores", sirve igual de bien como ilustración de "acá
// van los datos, todavía no hay".
function mostrarResumenVacio(elementoResumen, canvas, textoVacio) {
  graficosChart.get(canvas.id)?.destroy();
  graficosChart.delete(canvas.id);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  elementoResumen.innerHTML = '';
  const icono = crearIcono(iconoIndicadores, 'indicadores__icono-vacio');
  icono.setAttribute('aria-hidden', 'true');
  elementoResumen.appendChild(icono);
  elementoResumen.appendChild(document.createTextNode(textoVacio));
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
      // false, no el default true (mejoras visuales consolidadas --
      // causa raíz real de un hallazgo visual, confirmada midiendo el
      // DOM, no adivinada): con maintainAspectRatio en su default,
      // Chart.js recalcula el ancho como alto×aspectRatio (2 para
      // barra/línea, 1 para donut) en un resize interno que dispara
      // poco después del primer dibujo -- el primer render se veía
      // correcto (ancho = el del contenedor real) y unos ~150ms después
      // se achicaba solo (barra de $30.000 dibujada como si fuera de
      // $6.000, con el dato real intacto adentro). Con el alto ya fijo
      // por CSS (.indicadores__grafico--chartjs/--donut-chartjs), no
      // hace falta que Chart.js calcule nada por aspecto -- que llene el
      // ancho real y ya.
      maintainAspectRatio: false,
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
      maintainAspectRatio: false,
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

// Paleta compartida por los dos donuts (medio de pago y categoría) --
// terracota/mostaza/oliva primero (mejoras visuales consolidadas: mismos
// 3 colores que las tarjetas KPI del Tablero y los chips de Mostrador,
// "que el sistema completo hable el mismo lenguaje de color"), después
// éxito/alerta/peligro/gris neutro si sobran categorías. Nunca los
// colores por defecto de Chart.js (pedido explícito del cliente).
function paletaCategorica(colores) {
  return [colores.acento, colores.categoria1, colores.categoria2, colores.exito, colores.alerta, colores.peligro, colores.textoMuted];
}

// Leyenda propia con % y valor visibles (mejoras visuales consolidadas --
// antes esa info solo aparecía al pasar el mouse por el tooltip). Solo la
// usa el donut de categoría (elementoLeyenda); medio de pago se queda con
// la leyenda nativa de Chart.js (solo nombre + swatch), que ya alcanzaba
// para ese caso y no tiene pedido explícito de cambiar.
function renderizarLeyendaDonut(elementoLeyenda, items, paleta, total) {
  elementoLeyenda.innerHTML = '';
  items.forEach((item, indice) => {
    const fila = document.createElement('li');
    fila.className = 'indicadores__leyenda-fila';

    const swatch = document.createElement('span');
    swatch.className = 'indicadores__leyenda-swatch';
    swatch.style.background = paleta[indice % paleta.length];
    swatch.setAttribute('aria-hidden', 'true');

    const etiqueta = document.createElement('span');
    etiqueta.className = 'indicadores__leyenda-etiqueta';
    etiqueta.textContent = item.etiqueta;

    const valor = document.createElement('span');
    valor.className = 'indicadores__leyenda-valor numero';
    const porcentaje = Math.round((item.valor / total) * 100);
    valor.textContent = `${porcentaje}% · ${formatearMoneda(item.valor)}`;

    fila.append(swatch, etiqueta, valor);
    elementoLeyenda.appendChild(fila);
  });
}

// Donut genérico: medio de pago y categoría son la misma forma de datos
// (lista de {etiqueta, valor}), solo cambia de dónde sale la lista -- ver
// renderizarGraficoDonutMedioPago/renderizarGraficoDonutCategoria abajo.
// elementoLeyenda es opcional -- ver renderizarLeyendaDonut arriba.
function crearGraficoDonut(canvas, elementoResumen, items, tituloResumen, elementoLeyenda) {
  const total = items.reduce((suma, item) => suma + item.valor, 0);
  if (total === 0) {
    mostrarResumenVacio(elementoResumen, canvas, 'Sin ventas para graficar todavía.');
    if (elementoLeyenda) elementoLeyenda.innerHTML = '';
    return;
  }

  const colores = coloresDelTema();
  const paleta = paletaCategorica(colores);
  ocultarResumenAccesible(
    elementoResumen,
    `${tituloResumen}: ${items.map((item) => `${item.etiqueta}: ${Math.round((item.valor / total) * 100)}% (${formatearMoneda(item.valor)})`).join('; ')}.`
  );

  if (elementoLeyenda) renderizarLeyendaDonut(elementoLeyenda, items, paleta, total);

  crearOReemplazarChart(canvas, {
    type: 'doughnut',
    data: {
      labels: items.map((item) => item.etiqueta),
      datasets: [{ data: items.map((item) => item.valor), backgroundColor: items.map((_item, indice) => paleta[indice % paleta.length]) }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: elementoLeyenda ? { display: false } : { position: 'bottom', labels: { color: colores.texto, boxWidth: 12, padding: 12 } },
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
  crearGraficoDonut(graficoCategorias, resumenCategorias, items, 'Distribución de ventas por categoría', contenedorCategoriasLeyenda);
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
  // Mostrar el contenido ANTES de crear los gráficos Chart.js, no
  // después: por las dudas de que algún <canvas> se mida mientras su
  // contenedor todavía está oculto (hidden=true mide ancho 0). No era la
  // causa del hallazgo real de esta misma tanda de cambios (ver
  // maintainAspectRatio más abajo), pero es la práctica correcta de
  // todas formas y no cuesta nada dejarla así.
  contenedorCargando.hidden = true;
  contenedorContenido.hidden = false;

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
  elementoTotalGastos.textContent = formatearMoneda(reporteActual.totalGastos);
  elementoGananciaReal.textContent = formatearMoneda(reporteActual.gananciaReal);

  // Variación vs. período anterior en las 5 cifras que la tienen (mejoras
  // visuales consolidadas -- antes solo "Ventas totales" la mostraba, en
  // una tarjeta "Comparativa" aparte). reporteAnterior ya se pedía en
  // paralelo para ese único uso; ahora se aprovecha para las 4 tarjetas
  // compactas también, sin pedir nada nuevo al backend. "Producto más
  // vendido" no entra acá: no es una cifra continua (comparar "Pechuga"
  // contra "Pechuga" no es una variación %) -- ese dato ahora vive
  // directamente en la barra de ranking de abajo, no repetido en una
  // tarjeta de texto aparte.
  renderizarVariacion(elementoComparativa, reporteActual.totalVentas, reporteAnterior.totalVentas, rangos.etiquetaComparativa);
  renderizarVariacion(
    elementoTicketPromedioVariacion,
    reporteActual.ticketPromedio ?? 0,
    reporteAnterior.ticketPromedio ?? 0,
    rangos.etiquetaComparativa
  );
  renderizarVariacion(
    elementoUnidadesVendidasVariacion,
    reporteActual.unidadesVendidas ?? 0,
    reporteAnterior.unidadesVendidas ?? 0,
    rangos.etiquetaComparativa
  );
  renderizarVariacion(elementoTotalGastosVariacion, reporteActual.totalGastos, reporteAnterior.totalGastos, rangos.etiquetaComparativa);
  renderizarVariacion(elementoGananciaRealVariacion, reporteActual.gananciaReal, reporteAnterior.gananciaReal, rangos.etiquetaComparativa);

  renderizarGraficoProductos(reporteActual.topProductos);
  renderizarGraficoTendencia(reporteActual.ventasPorDia);
  renderizarGraficoDonutMedioPago(reporteActual.desglosePorMedioPago);
  // ?? [], no reporteActual.ventasPorCategoria directo -- ver el comentario
  // de unidadesVendidas arriba. Sin este default, un reporte sin este
  // campo (por ejemplo un backend que todavía no se reinició tras
  // actualizar) hace que .map() explote acá adentro; como el error queda
  // atrapado por el catch de cargarIndicadores() sin loguearse (ver ese
  // catch, también corregido en este mismo incidente), tumbaba TODO el
  // panel entero. Con el default, si falta el campo, el donut de
  // categoría simplemente muestra su propio estado vacío.
  renderizarGraficoDonutCategoria(reporteActual.ventasPorCategoria ?? []);

  rangoActualParaHistorial = rangos.actual;
  cargarYRenderizarDesglose(rangos.actual);
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
