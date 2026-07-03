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
