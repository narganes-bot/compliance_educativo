"use strict";
/* Límite de peticiones por ventana fija, en memoria y por instancia.
 * Suficiente para un despliegue de un solo proceso; en producción con varias
 * instancias, usar un almacén compartido (p. ej. Redis) con la misma interfaz. */
const { ApiError } = require("./middleware");

function createRateLimiter({ windowMs, max, keyFn }) {
  const hits = new Map(); // key -> { count, resetAt }
  const key = keyFn || ((req) => req.ip || req.socket.remoteAddress || "unknown");

  // Limpieza perezosa de entradas caducadas.
  function sweep(now) { if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k); }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const k = key(req);
    let e = hits.get(k);
    if (!e || e.resetAt <= now) { e = { count: 0, resetAt: now + windowMs }; hits.set(k, e); sweep(now); }
    e.count++;
    const remaining = Math.max(0, max - e.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(e.resetAt / 1000)));
    if (e.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((e.resetAt - now) / 1000)));
      return next(new ApiError(429, "rate_limited", "Demasiadas peticiones; inténtalo más tarde."));
    }
    next();
  };
}

module.exports = { createRateLimiter };
