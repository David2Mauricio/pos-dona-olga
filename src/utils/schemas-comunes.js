const { z } = require('zod');

// Validación de :id de ruta, repetida igual en todos los módulos que
// exponen "obtener/actualizar por id" (productos, categorías, y los que
// siguen). Se centraliza acá para no duplicar la misma regla en cada
// *.schema.js.
const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = { idParamsSchema };
