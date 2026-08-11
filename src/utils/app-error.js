// Representa un error esperado y controlado del negocio (ej: "producto no
// encontrado", "stock insuficiente", "datos inválidos"). Se diferencia de un
// error de programación inesperado en que su mensaje SÍ es seguro de mostrar
// al usuario final, y trae su propio código de estado HTTP.
class AppError extends Error {
  // `codigo` es opcional: un identificador estable para que el frontend
  // distinga programáticamente entre errores que se ven igual por fuera
  // (mismo statusCode) pero requieren una UI distinta — ej. 403 por rol
  // insuficiente vs. 403 porque falta cambiar la contraseña obligatoria
  // (ver ADR 0010). Parsear el mensaje en el frontend para eso sería
  // frágil; el mensaje es para mostrar, el código es para decidir.
  constructor(mensaje, statusCode = 400, codigo) {
    super(mensaje);
    this.statusCode = statusCode;
    this.esOperacional = true;
    this.codigo = codigo;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
