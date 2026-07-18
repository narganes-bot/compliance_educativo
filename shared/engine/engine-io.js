/* ================================================================== *
 *  engine-io.js — Validación y normalización de entrada del motor
 *  Complementa engine.js. Garantiza que el payload {center, interviews}
 *  que llega del cliente o de la BD es válido y mínimo antes de calcular.
 * ================================================================== */
const E = require("./engine.js");

const ENGINE_VERSION = "1.2.0";
const VALID_ANSWERS = new Set(["si", "parcial", "no", "ns"]);
const QIDS = new Set(E.QUESTIONS.map((q) => q.id));
const ROLE_IDS = new Set([...E.ROLES.map((r) => r.id), E.CONSULTANT_ROLE]);
const OWNERSHIP = new Set(["publica", "concertada", "privada"]);
const RISK_CODES = new Set(E.RISKS.map((r) => r.code));

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
  // Comentarios: solo se conservan en respuestas 'parcial' o 'ns', recortados a 500.
  const comments = {};
  if (iv && iv.comments && typeof iv.comments === "object") {
    for (const [k, v] of Object.entries(iv.comments)) {
      if (QIDS.has(k) && (answers[k] === "parcial" || answers[k] === "ns") && typeof v === "string") {
        const t = v.trim().slice(0, 500);
        if (t) comments[k] = t;
      }
    }
  }
  return { id: (iv && iv.id) || null, role, alias: toAlias(iv && (iv.alias || iv.name)), answers, comments };
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

// Normaliza las sobrescrituras manuales: solo códigos de riesgo válidos y
// valores enteros 1..5 para prob/impact.
function normalizeOverrides(raw) {
  const out = {};
  const src = (raw && typeof raw === "object") ? raw : {};
  for (const [code, v] of Object.entries(src)) {
    if (!RISK_CODES.has(code) || !v || typeof v !== "object") continue;
    const clean = {};
    if (Number.isInteger(v.prob) && v.prob >= 1 && v.prob <= 5) clean.prob = v.prob;
    if (Number.isInteger(v.impact) && v.impact >= 1 && v.impact <= 5) clean.impact = v.impact;
    if (Object.keys(clean).length) out[code] = clean;
  }
  return out;
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
  const overrides = normalizeOverrides(payload.overrides);
  return { ok: errors.length === 0 || interviews.length > 0, errors, data: { center, interviews, overrides } };
}

// Cálculo listo para servir por la API (motor + versión).
function analyze(payload) {
  const { data } = validatePayload(payload);
  return {
    engineVersion: ENGINE_VERSION,
    center: data.center,
    interviews: data.interviews.length,
    overrides: data.overrides,
    risks: E.computeRisks(data.interviews, data.overrides),
    coverage: E.computeCoverage(data.interviews),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { ENGINE_VERSION, VALID_ANSWERS, toAlias, normalizeInterview, normalizeCenter, normalizeOverrides, validatePayload, analyze };
