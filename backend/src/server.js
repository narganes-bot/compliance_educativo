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
 
// Crea el primer usuario a partir de variables de entorno (Opción B, sin consola).
// La contraseña NUNCA está en el código: se lee de SEED_PASSWORD, que se configura
// de forma privada en el panel del servidor (Render). Solo actúa si el usuario no existe.
async function seedFromEnv(store) {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;
  const name = process.env.SEED_CONSULTANCY || "Consultora";
  if (!email || !password) return;
  const existing = await store.findUserByEmail(email);
  if (existing) { console.log("· usuario inicial ya existe:", email); return; }
  const consultancy = await store.createConsultancy({ name });
  await store.createUser(consultancy.id, { email, password_hash: await hashPassword(password), display_name: name, role: "owner" });
  console.log("· usuario inicial creado:", email);
}
 
async function main() {
  const store = createStore();
  if (store.kind === "memory") { await seedDemo(store); console.log("· usuario demo: demo@consultora.test / demo1234"); }
  else { try { await seedFromEnv(store); } catch (e) { console.error("seedFromEnv:", e.message); } }
  const app = createApp(store);
  app.listen(config.port, () => console.log(`API escuchando en http://localhost:${config.port} (store=${store.kind})`));
}
 
if (require.main === module) main();
module.exports = { seedDemo, seedFromEnv };
