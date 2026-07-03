"use strict";
/* Crea la primera consultora y su usuario (owner) en la base de datos real.
 * Uso:
 *   DATABASE_URL=postgres://... node src/seed_pg.js "Mi Consultora" correo@dominio.com "contraseña"
 * Requisitos: haber aplicado antes schema.sql a la base de datos.
 */
const { Pool } = require("pg");
const { hashPassword } = require("./config");

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Uso: node src/seed_pg.js "Nombre consultora" correo@dominio.com "contraseña"');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("Falta DATABASE_URL."); process.exit(1); }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    const exists = await client.query("SELECT 1 FROM app_user WHERE email=$1", [email.toLowerCase()]);
    if (exists.rowCount) { console.error("Ya existe un usuario con ese correo."); process.exit(1); }

    await client.query("BEGIN");
    const c = await client.query("INSERT INTO consultancy(name) VALUES($1) RETURNING id", [name]);
    const cid = c.rows[0].id;
    // Fija el inquilino por si la tabla tuviera RLS activa para este rol.
    await client.query("SELECT set_config('app.consultancy_id', $1, true)", [cid]);
    const hash = await hashPassword(password);
    await client.query(
      "INSERT INTO app_user(consultancy_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,'owner')",
      [cid, email.toLowerCase(), hash, name]
    );
    await client.query("COMMIT");
    console.log("✓ Consultora y usuario creados.");
    console.log("  Consultora:", name, "(id " + cid + ")");
    console.log("  Acceso:", email.toLowerCase());
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Error:", e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
