"use strict";
const jwt = require("jsonwebtoken");
const { config } = require("./config");

// Error de API con código estable y estado HTTP.
class ApiError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new ApiError(status, code, message); };

// Firma/verificación de sesión.
function signToken(user) {
  return jwt.sign({ sub: user.id, cid: user.consultancy_id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// Exige usuario autenticado; adjunta req.auth = { userId, consultancyId, role }.
function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return next(new ApiError(401, "unauthenticated", "Falta el token de sesión."));
  try {
    const p = jwt.verify(m[1], config.jwtSecret);
    req.auth = { userId: p.sub, consultancyId: p.cid, role: p.role };
    next();
  } catch { next(new ApiError(401, "invalid_token", "Sesión no válida o caducada.")); }
}

// Envuelve un handler async y enruta los errores al middleware de errores.
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Middleware de errores con modelo uniforme.
function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const code = err.code || "internal_error";
  const message = status === 500 ? "Error interno." : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ error: { code, message } });
}

module.exports = { ApiError, fail, signToken, requireAuth, asyncH, errorHandler };
