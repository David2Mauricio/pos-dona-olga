const { z } = require('zod');
const { idParamsSchema, fechaSchema } = require('../../utils/schemas-comunes');

// Fase 2 (ver ADR 0011): un item puede cobrarse a un precio distinto del
// catálogo, pero solo si trae su justificación — nunca uno sin el otro.
// z.strictObject + .refine en vez de dos schemas separados porque el resto
// del item (productoId, cantidad) es idéntico en ambos casos.
const itemSchema = z
  .object({
    productoId: z.number().int().positive(),
    cantidad: z.number().int().positive('La cantidad debe ser mayor a cero'),
    precioUnitarioOverride: z.number().int().nonnegative().optional(),
    motivoAjuste: z.string().trim().min(1, 'El motivo del ajuste no puede estar vacío').optional(),
  })
  .strict()
  .refine((item) => (item.precioUnitarioOverride === undefined) === (item.motivoAjuste === undefined), {
    message: 'motivoAjuste es obligatorio cuando se envía precioUnitarioOverride, y no debe enviarse si no hay override',
  });

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
