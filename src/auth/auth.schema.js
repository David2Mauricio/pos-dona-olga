const { z } = require('zod');

const loginSchema = z
  .object({
    usuario: z.string().trim().min(1, 'El usuario es obligatorio'),
    password: z.string().min(1, 'La contraseña es obligatoria'),
  })
  .strict();

const cambiarPasswordSchema = z
  .object({
    passwordActual: z.string().min(1, 'La contraseña actual es obligatoria'),
    passwordNueva: z.string().min(8, 'La contraseña nueva debe tener al menos 8 caracteres'),
  })
  .strict();

module.exports = { loginSchema, cambiarPasswordSchema };
