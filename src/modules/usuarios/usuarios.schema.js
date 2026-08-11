const { z } = require('zod');

const crearUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    // Se normaliza a minúsculas para que "Juan" y "juan" no puedan
    // coexistir como usuarios distintos por un descuido de mayúsculas.
    usuario: z
      .string()
      .trim()
      .min(3, 'El usuario debe tener al menos 3 caracteres')
      .transform((valor) => valor.toLowerCase()),
    rol: z.enum(['administrador', 'cajero']),
  })
  .strict();

const actualizarUsuarioSchema = z
  .object({
    rol: z.enum(['administrador', 'cajero']),
    activo: z.boolean(),
  })
  .partial()
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe incluir al menos un campo para actualizar',
  });

module.exports = { crearUsuarioSchema, actualizarUsuarioSchema };
