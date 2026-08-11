const { z } = require('zod');
const { idParamsSchema, fechaSchema } = require('../../utils/schemas-comunes');

const itemSchema = z
  .object({
    productoId: z.number().int().positive(),
    cantidad: z.number().int().positive('La cantidad debe ser mayor a cero'),
  })
  .strict();

const crearVentaSchema = z
  .object({
    cajaSesionId: z.number().int().positive(),
    tipoPrecio: z.enum(['publico', 'mayorista']),
    medioPago: z.string().trim().min(1, 'El medio de pago es obligatorio'),
    items: z.array(itemSchema).min(1, 'La venta debe tener al menos un item'),
  })
  .strict();

const listarVentasQuerySchema = z
  .object({
    cajaSesionId: z.coerce.number().int().positive().optional(),
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
  })
  .strict();

module.exports = {
  crearVentaSchema,
  listarVentasQuerySchema,
  idParamsSchema,
};
