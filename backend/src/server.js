"use strict";
const { createApp } = require("./app");
const { createStore } = require("./store");
const { config, hashPassword } = require("./config");

// Siembra una consultora y un usuario demo (solo para el adaptador en memoria).
async function seedDemo(store) {
  const consultancy = await store.createConsultancy({ name: "Consultora Demo", cif: "B00000000" });
  await store.createUser(consultancy.id, {
    email: "demo@consultora.test",
    password_hash: await hashPassword("demo1234"),
    display_name: "Coordinador Demo",
    role: "owner",
  });
  return consultancy;
}

async function main() {
  const store = createStore();
  if (store.kind === "memory") { await seedDemo(store); console.log("· usuario demo: demo@consultora.test / demo1234"); }
  const app = createApp(store);
  app.listen(config.port, () => console.log(`API escuchando en http://localhost:${config.port} (store=${store.kind})`));
}

if (require.main === module) main();
module.exports = { seedDemo };
