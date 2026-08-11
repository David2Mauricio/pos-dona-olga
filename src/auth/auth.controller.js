const authService = require('./auth.service');
const { NOMBRE_COOKIE_SESION } = require('./session-config');

function login(req, res) {
  const usuarioExpuesto = authService.login(req.body.usuario, req.body.password);
  req.session.usuario = usuarioExpuesto;
  res.json(usuarioExpuesto);
}

function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie(NOMBRE_COOKIE_SESION);
    res.status(204).end();
  });
}

function sesion(req, res) {
  res.json(req.session.usuario);
}

function cambiarPassword(req, res) {
  const actualizado = authService.cambiarPassword(
    req.session.usuario.id,
    req.body.passwordActual,
    req.body.passwordNueva
  );
  // La sesión activa ya tenía debeCambiarPassword=true cargado desde el
  // login; hay que refrescarla o quedaría bloqueada hasta el próximo login.
  req.session.usuario = actualizado;
  res.json(actualizado);
}

module.exports = { login, logout, sesion, cambiarPassword };
