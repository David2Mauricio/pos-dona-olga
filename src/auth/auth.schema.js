const { z } = require('zod');

const loginSchema = z
  .object({
    usuario: z.string().trim().min(1, 'El usuario es obligatorio'),
    password: z.string().min(1, 'La contraseña es obligatoria'),
  })
  .strict();

// pregunta/respuesta son opcionales acá a propósito: si son obligatorias
// depende del rol y de si el usuario ya tiene una configurada, algo que
// el schema no puede saber (no tiene acceso a la base) — esa parte de la
// regla vive en auth.service.js.
const cambiarPasswordSchema = z
  .object({
    passwordActual: z.string().min(1, 'La contraseña actual es obligatoria'),
    passwordNueva: z.string().min(8, 'La contraseña nueva debe tener al menos 8 caracteres'),
    pregunta: z.string().trim().min(1).optional(),
    respuesta: z.string().trim().min(1).optional(),
  })
  .strict();

const usuarioParamsSchema = z.object({
  usuario: z.string().trim().min(1, 'El usuario es obligatorio'),
});

const recuperarPasswordSchema = z
  .object({
    usuario: z.string().trim().min(1, 'El usuario es obligatorio'),
    respuesta: z.string().trim().min(1, 'La respuesta es obligatoria'),
    passwordNueva: z.string().min(8, 'La contraseña nueva debe tener al menos 8 caracteres'),
  })
  .strict();

module.exports = { loginSchema, cambiarPasswordSchema, usuarioParamsSchema, recuperarPasswordSchema };
