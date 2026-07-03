"use strict";
const { config } = require("../config");
const { createMemoryStore } = require("./memoryStore");
const { createPgStore } = require("./pgStore");

function createStore() {
  if (config.store === "pg") {
    if (!config.databaseUrl) throw new Error("DATABASE_URL requerido para STORE=pg");
    return createPgStore(config.databaseUrl);
  }
  return createMemoryStore();
}
module.exports = { createStore };
