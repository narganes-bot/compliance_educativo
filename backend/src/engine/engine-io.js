/* ================================================================== *
 *  engine-io.js — Validación y normalización de entrada del motor
 *  Complementa engine.js. Garantiza que el payload {center, interviews}
 *  que llega del cliente o de la BD es válido y mínimo antes de calcular.
 * ================================================================== */
const E = require("./engine.js");

const ENGINE_VERSION = "1.1.0";
const VALID_ANSWERS = new Set(["si", "parcial", "no", "ns"]);
const QIDS = new Set(E.QUESTIONS.map((q) => q.id));
const ROLE_IDS = new Set(E.ROLES.map((r) => r.id));
const OWNERSHIP = new Set(["publica", "concertada", "privada"]);

// Recorta a alias (iniciales): evita almacenar nombres completos.
function toAlias(name) {
  if (!name) return "";
  const parts = String(name).trim().split(/\s+/).slice(0, 3);
  const initials = parts.map((p) => p.charAt(0).toUpperCase()).join(". ");
  return initials ? initials + "." : "";
}

function normalizeInterview(iv) {
  const role = ROLE_IDS.has(iv && iv.role) ? iv.role : null;
  const answers = {};
  if (iv && iv.answers && typeof iv.answers === "object") {
    for (const [k, v] of Object.entries(iv.answers)) {
      if (QIDS.has(k) && VALID_ANSWERS.has(v)) answers[k] = v;
    }
  }
  return { id: (iv && iv.id) || null, role, alias: toAlias(iv && (iv.alias || iv.name)), answers };
}

function normalizeCenter(c) {
  c = c || {};
  return {
    name: (c.name || "").toString().slice(0, 200),
    tipo: OWNERSHIP.has(c.tipo) ? c.tipo : (OWNERSHIP.has(c.ownership) ? c.ownership : "concertada"),
    etapas: (c.etapas || c.stages || "").toString().slice(0, 300),
    alumnos: (c.alumnos != null ? c.alumnos : c.num_students != null ? c.num_students : "").toString().slice(0, 20),
    ccaa: (c.ccaa || "").toString().slice(0, 120),
  };
}

// Valida y normaliza el payload completo. Devuelve { ok, errors, data }.
function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") return { ok: false, errors: ["payload no válido"], data: null };
  const center = normalizeCenter(payload.center);
  if (!center.name) errors.push("center.name es obligatorio");
  const rawList = Array.isArray(payload.interviews) ? payload.interviews : [];
  const interviews = rawList.map(normalizeInterview).filter((iv) => {
    if (!iv.role) { errors.push("entrevista con rol no válido descartada"); return false; }
    if (!Object.keys(iv.answers).length) { errors.push("entrevista sin respuestas válidas descartada"); return false; }
    return true;
  });
  return { ok: errors.length === 0 || interviews.length > 0, errors, data: { center, interviews } };
}

// Cálculo listo para servir por la API (motor + versión).
function analyze(payload) {
  const { data } = validatePayload(payload);
  return {
    engineVersion: ENGINE_VERSION,
    center: data.center,
    interviews: data.interviews.length,
    risks: E.computeRisks(data.interviews),
    coverage: E.computeCoverage(data.interviews),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { ENGINE_VERSION, VALID_ANSWERS, toAlias, normalizeInterview, normalizeCenter, validatePayload, analyze };
