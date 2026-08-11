// Representa un error esperado y controlado del negocio (ej: "producto no
// encontrado", "stock insuficiente", "datos inválidos"). Se diferencia de un
// error de programación inesperado en que su mensaje SÍ es seguro de mostrar
// al usuario final, y trae su propio código de estado HTTP.
class AppError extends Error {
  constructor(mensaje, statusCode = 400) {
    super(mensaje);
    this.statusCode = statusCode;
    this.esOperacional = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
