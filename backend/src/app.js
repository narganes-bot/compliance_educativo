"use strict";
const express = require("express");
const { buildRouter } = require("./routes");
const { errorHandler } = require("./middleware");
const { createRateLimiter } = require("./rateLimit");
const { config } = require("./config");

function createApp(store, options = {}) {
  const rl = Object.assign({}, config.rateLimits, options.rateLimits);
  const app = express();
  if (config.trustProxy) app.set("trust proxy", true);

  // CORS: autoriza a la web (otro dominio) a llamar a la API. Usamos token en la
  // cabecera Authorization (no cookies), por lo que "*" es válido y sencillo.
  // Para restringir a tu web, pon CORS_ORIGIN con su dirección exacta.
  const corsOrigin = process.env.CORS_ORIGIN || "*";
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  app.use(express.json({ limit: "256kb" }));
  app.get("/health", (req, res) => res.json({ ok: true, store: store.kind }));
  // Límite de peticiones en las superficies sensibles.
  app.use("/auth", createRateLimiter(rl.auth));
  app.use("/p", createRateLimiter(rl.participant));
  app.use("/", buildRouter(store));
  app.use((req, res) => res.status(404).json({ error: { code: "not_found", message: "Recurso no encontrado." } }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
