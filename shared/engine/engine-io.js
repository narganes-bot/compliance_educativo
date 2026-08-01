"use strict";
/* engine-io.js — copia de shared/engine/engine-io.js del repo */
const E = require("./engine.js");

const ENGINE_VERSION = "1.2.0";
const VALID_ANSWERS = new Set(["si", "parcial", "no", "ns"]);
const QIDS = new Set(E.QUESTIONS.map((q) => q.id));
const ROLE_IDS = new Set([...E.ROLES.map((r) => r.id), E.CONSULTANT_ROLE]);
const OWNERSHIP = new Set(["publica", "concertada", "privada"]);
const RISK_CODES = new Set(E.RISKS.map((r) => r.code));

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
  const center = {
    name: (c.name || "").toString().slice(0, 200),
    tipo: OWNERSHIP.has(c.tipo) ? c.tipo : (OWNERSHIP.has(c.ownership) ? c.ownership : "concertada"),
    etapas: (c.etapas || c.stages || "").toString().slice(0, 300),
    alumnos: (c.alumnos != null ? c.alumnos : c.num_students != null ? c.num_students : "").toString().slice(0, 20),
    ccaa: (c.ccaa || "").toString().slice(0, 120),
    docentes: (c.docentes != null ? c.docentes : c.num_teaching_staff != null ? c.num_teaching_staff : "").toString().slice(0, 20),
    noDocentes: (c.noDocentes != null ? c.noDocentes : c.num_non_teaching_staff != null ? c.num_non_teaching_staff : "").toString().slice(0, 20),
    otras: (c.otras != null ? c.otras : c.num_other_people != null ? c.num_other_people : "").toString().slice(0, 20),
    alturaGe28m: !!(c.alturaGe28m != null ? c.alturaGe28m : c.altura28 != null ? c.altura28 : c.height_ge_28m),
    evacuacionEspecial: !!(c.evacuacionEspecial != null ? c.evacuacionEspecial : c.evacEspecial != null ? c.evacEspecial : c.special_evacuation),
  };
  center.rd393 = E.rd393Assessment({
    num_students: center.alumnos, num_teaching_staff: center.docentes,
    num_non_teaching_staff: center.noDocentes, num_other_people: center.otras,
    height_ge_28m: center.alturaGe28m, special_evacuation: center.evacuacionEspecial,
  });
  return center;
}

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

function normalizeWeights(raw) {
  if (!raw || typeof raw !== "object") return null;
  const clampW = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null; };
  const out = {};
  if (raw.roles && typeof raw.roles === "object") {
    out.roles = {};
    for (const [role, v] of Object.entries(raw.roles)) {
      if (!ROLE_IDS.has(role)) continue;
      const w = clampW(v); if (w != null) out.roles[role] = w;
    }
  }
  if (raw.questions && typeof raw.questions === "object") {
    out.questions = {};
    for (const [qid, rmap] of Object.entries(raw.questions)) {
      if (!QIDS.has(qid) || !rmap || typeof rmap !== "object") continue;
      const clean = {};
      for (const [role, v] of Object.entries(rmap)) {
        if (!ROLE_IDS.has(role)) continue;
        const w = clampW(v); if (w != null) clean[role] = w;
      }
      if (Object.keys(clean).length) out.questions[qid] = clean;
    }
  }
  return (out.roles || out.questions) ? out : null;
}

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
  const weights = normalizeWeights(payload.weights);
  return { ok: errors.length === 0 || interviews.length > 0, errors, data: { center, interviews, overrides, weights } };
}

function analyze(payload) {
  const { data } = validatePayload(payload);
  return {
    engineVersion: ENGINE_VERSION,
    center: data.center,
    interviews: data.interviews.length,
    overrides: data.overrides,
    risks: E.computeRisks(data.interviews, data.overrides, data.center, data.weights),
    coverage: E.computeCoverage(data.interviews),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { ENGINE_VERSION, VALID_ANSWERS, toAlias, normalizeInterview, normalizeCenter, normalizeOverrides, normalizeWeights, validatePayload, analyze };
