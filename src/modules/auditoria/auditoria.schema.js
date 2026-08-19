const { z } = require('zod');
const { fechaSchema } = require('../../utils/schemas-comunes');

// Sin schema de creación a propósito: registrarAuditoria() nunca se llama
// desde un body HTTP directo (ver ADR 0018) -- solo como efecto colateral
// de otras acciones ya validadas por sus propios schemas. Esta tabla no
// tiene, ni va a tener, un POST público.
const listarAuditoriaQuerySchema = z
  .object({
    accion: z.string().trim().min(1).optional(),
    usuarioId: z.coerce.number().int().positive().optional(),
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
  })
  .strict();

module.exports = { listarAuditoriaQuerySchema };
