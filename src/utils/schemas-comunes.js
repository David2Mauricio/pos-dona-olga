const { z } = require('zod');

// Validación de :id de ruta, repetida igual en todos los módulos que
// exponen "obtener/actualizar por id" (productos, categorías, y los que
// siguen). Se centraliza acá para no duplicar la misma regla en cada
// *.schema.js.
const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Filtro de rango de fechas por query string ("desde"/"hasta"), repetido
// igual en ventas e inventario. YYYY-MM-DD simple: los repositories que lo
// usan comparan como texto contra columnas *_en tipo 'YYYY-MM-DD HH:MM:SS'.
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fechaSchema = z.string().regex(FORMATO_FECHA, 'Formato esperado: YYYY-MM-DD');

module.exports = { idParamsSchema, fechaSchema };
