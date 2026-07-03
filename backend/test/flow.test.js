"use strict";
/* Prueba de integración: arranca la API con el adaptador en memoria y ejecuta
 * el flujo completo (login → centro → campaña → enlaces → envíos → panel →
 * modelo), más la comprobación de aislamiento entre inquilinos. */
const http = require("http");
const { createApp } = require("../src/app");
const { createMemoryStore } = require("../src/store/memoryStore");
const { hashPassword } = require("../src/config");

let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) { passed++; console.log("  ✓ " + msg); } else { failed++; console.log("  ✗ " + msg); } }

async function req(base, method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function main() {
  const store = createMemoryStore();
  // Inquilino A (demo) + inquilino B (para probar aislamiento)
  const A = await store.createConsultancy({ name: "Consultora A" });
  await store.createUser(A.id, { email: "a@test", password_hash: await hashPassword("secretA1"), display_name: "A", role: "owner" });
  const B = await store.createConsultancy({ name: "Consultora B" });
  await store.createUser(B.id, { email: "b@test", password_hash: await hashPassword("secretB1"), display_name: "B", role: "owner" });

  const server = createApp(store).listen(0);
  const base = "http://127.0.0.1:" + server.address().port;

  try {
    console.log("Autenticación");
    let r = await req(base, "POST", "/auth/login", { body: { email: "a@test", password: "secretA1" } });
    ok(r.status === 200 && r.json.token, "login correcto devuelve token");
    const tokenA = r.json.token;
    r = await req(base, "POST", "/auth/login", { body: { email: "a@test", password: "mala" } });
    ok(r.status === 401, "login con contraseña incorrecta → 401");
    r = await req(base, "GET", "/me", { token: tokenA });
    ok(r.status === 200 && r.json.consultancy.name === "Consultora A", "/me devuelve la consultora");

    console.log("Centros y campañas");
    r = await req(base, "POST", "/centers", { token: tokenA, body: { name: "Colegio Santa María", ownership: "concertada", stages: "Infantil, Primaria, ESO", num_students: 620, ccaa: "Castilla y León" } });
    ok(r.status === 201, "crear centro → 201");
    const centerId = r.json.center.id;
    r = await req(base, "POST", `/centers/${centerId}/campaigns`, { token: tokenA, body: {} });
    ok(r.status === 201 && r.json.campaign.code, "crear campaña → 201 con código");
    const campaignId = r.json.campaign.id;
    const campaignCode = r.json.campaign.code;

    console.log("Enlaces y envíos de participante");
    async function link(role) { const x = await req(base, "POST", `/campaigns/${campaignId}/links`, { token: tokenA, body: { assigned_role: role } }); return x.json.link.token; }
    const tDir = await link("direccion");
    r = await req(base, "GET", `/p/${tDir}`);
    ok(r.status === 200 && Array.isArray(r.json.questions), "GET /p/:token devuelve preguntas");
    r = await req(base, "POST", `/p/${tDir}/interview`, { body: { role: "direccion", alias: "M. L.", answers: { q4: "parcial", q8: "no", q11: "si", q27: "parcial", q28: "no" } } });
    ok(r.status === 201, "envío de entrevista (dirección) → 201");
    const tCoord = await link("coordinador");
    await req(base, "POST", `/p/${tCoord}/interview`, { body: { role: "coordinador", answers: { q2: "no", q4: "no", q6: "parcial", q7: "no", q29: "no" } } });
    const tProf = await link("profesorado");
    await req(base, "POST", `/p/${tProf}/interview`, { body: { role: "profesorado", answers: { q4: "no", q7: "no", q12: "no", q15: "parcial" } } });

    r = await req(base, "POST", `/p/${tDir}/interview`, { body: { role: "direccion", answers: { q4: "zzz", noexiste: "si" } } });
    ok(r.status === 400, "envío sin respuestas válidas → 400 (normalización)");

    console.log("Panel y modelo");
    r = await req(base, "GET", `/campaigns/${campaignId}`, { token: tokenA });
    ok(r.status === 200 && r.json.participation.total === 3, "participación agrega 3 entrevistas");
    ok(r.json.participation.levelsCovered === 3, "3 niveles cubiertos");
    r = await req(base, "GET", `/campaigns/${campaignId}/model`, { token: tokenA });
    const rated = (r.json.risks || []).filter((x) => x.status === "rated");
    ok(r.status === 200 && r.json.engineVersion === "1.1.0", "modelo devuelve engineVersion 1.1.0");
    ok(rated.length > 0, `modelo calcula riesgos (${rated.length} evaluados)`);
    ok(Array.isArray(r.json.coverage), "modelo incluye cobertura normativa");

    console.log("Documento");
    const docRes = await fetch(`${base}/campaigns/${campaignId}/document`, { method: "POST", headers: { Authorization: "Bearer " + tokenA } });
    const buf = Buffer.from(await docRes.arrayBuffer());
    ok(docRes.status === 200, "generar documento → 200");
    ok((docRes.headers.get("content-type") || "").includes("wordprocessingml"), "content-type de .docx");
    ok(buf.length > 3000 && buf.slice(0, 2).toString() === "PK", `.docx válido (${buf.length} bytes, firma PK)`);
    const emptyCampaign = (await req(base, "POST", `/centers/${centerId}/campaigns`, { token: tokenA, body: {} })).json.campaign.id;
    r = await req(base, "POST", `/campaigns/${emptyCampaign}/document`, { token: tokenA });
    ok(r.status === 409, "documento sin entrevistas → 409");

    console.log("Sala por código (flujo de la app)");
    r = await req(base, "GET", `/rooms/${campaignCode}/public`);
    ok(r.status === 200 && r.json.center.name === "Colegio Santa María", "info pública de la sala por código");
    r = await req(base, "POST", `/rooms/${campaignCode}/interview`, { body: { role: "nodocente", answers: { q9: "no", q17: "parcial", q18: "si" } } });
    ok(r.status === 201, "envío por código de sala → 201");
    r = await req(base, "GET", `/rooms/${campaignCode}`, { token: tokenA });
    ok(r.status === 200 && r.json.interviews.length === 4, "panel por código agrega la nueva entrevista (4)");

    console.log("Aislamiento entre inquilinos");
    const tokenB = (await req(base, "POST", "/auth/login", { body: { email: "b@test", password: "secretB1" } })).json.token;
    r = await req(base, "GET", `/campaigns/${campaignId}`, { token: tokenB });
    ok(r.status === 404, "inquilino B no ve la campaña de A → 404");
    r = await req(base, "GET", `/centers/${centerId}`, { token: tokenB });
    ok(r.status === 404, "inquilino B no ve el centro de A → 404");
    r = await req(base, "GET", "/centers", { token: tokenB });
    ok(r.status === 200 && r.json.centers.length === 0, "inquilino B tiene su propia lista vacía");
    r = await req(base, "GET", `/rooms/${campaignCode}`, { token: tokenB });
    ok(r.status === 404, "inquilino B no accede a la sala por código de A → 404");

    console.log("Seguridad de acceso");
    r = await req(base, "GET", `/campaigns/${campaignId}`);
    ok(r.status === 401, "sin token → 401");

    console.log("Auditoría");
    r = await req(base, "GET", "/audit", { token: tokenA });
    const actions = (r.json.entries || []).map((e) => e.action);
    ok(r.status === 200, "consultar auditoría → 200");
    ok(actions.includes("create_center") && actions.includes("create_campaign"), "audita creación de centro y campaña");
    ok(actions.includes("submit_interview"), "audita envíos de participante");
    ok(actions.includes("generate_document"), "audita la generación de documento");
    const auditB = await req(base, "GET", "/audit", { token: tokenB });
    ok((auditB.json.entries || []).every((e) => e.action !== "create_center"), "la auditoría también está aislada por inquilino");
  } finally {
    server.close();
  }

  // Límite de peticiones: app independiente con límite bajo para /auth
  console.log("Límite de peticiones");
  const store2 = createMemoryStore();
  const c2 = await store2.createConsultancy({ name: "RL" });
  await store2.createUser(c2.id, { email: "rl@test", password_hash: await hashPassword("secretRL1"), display_name: "RL", role: "owner" });
  const server2 = createApp(store2, { rateLimits: { auth: { windowMs: 60000, max: 3 } } }).listen(0);
  const base2 = "http://127.0.0.1:" + server2.address().port;
  try {
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await req(base2, "POST", "/auth/login", { body: { email: "rl@test", password: "secretRL1" } })).status);
    ok(codes.slice(0, 3).every((s) => s === 200), "las 3 primeras peticiones pasan");
    ok(codes[3] === 429, "la 4ª supera el límite → 429");
  } finally {
    server2.close();
  }

  console.log(`\nResultado: ${passed} correctas, ${failed} fallidas`);
  process.exit(failed ? 1 : 0);
}
main();
