const { z } = require('zod');
const { fechaSchema } = require('../../utils/schemas-comunes');

const reporteVentasQuerySchema = z
  .object({
    desde: fechaSchema,
    hasta: fechaSchema,
    cajaSesionId: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .refine((datos) => datos.desde <= datos.hasta, {
    message: 'La fecha "desde" no puede ser posterior a "hasta"',
    path: ['desde'],
  });

module.exports = { reporteVentasQuerySchema };
