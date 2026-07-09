import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Grid3x3, FileText, Plus, Download, AlertTriangle, Check, ChevronRight, Info, Scale,
  Copy, RefreshCw, LogIn, Share2, ArrowLeft, Send, Loader2, Users, Zap, FileDown, Menu, Home as HomeIcon
} from "lucide-react";

/* ================================================================== *
 *  Prevención y Compliance educativo (LOPIVI) — herramienta unificada
 *  · Sala multiusuario con persistencia (varias personas responden)
 *  · Diagnóstico rápido en una sola sesión (consultor en solitario)
 *  · Panel/modelo completo: matriz, plan 90 días, discrepancias,
 *    brechas, cobertura normativa y descarga del informe en Word.
 *  Cálculo orientativo; no constituye asesoramiento jurídico.
 * ================================================================== */

const C = {
  navy: "#1F3864", ink: "#16202E", slate: "#54627A", line: "#D8DEE7",
  bg: "#EDF0F5", surface: "#FFFFFF",
  low: "#3F8F6B", med: "#C98A2B", high: "#D06B3A", crit: "#B23A48",
  action: "#2E5E8C", unrated: "#9AA4B2",
};
const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const sans = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/* ------------------------------- motor -------------------------------- */
const LAW_CATALOG = [
  { id: "cdn", label: "Convención sobre los Derechos del Niño", level: "Internacional", transversal: true },
  { id: "lanzarote", label: "Convenio de Lanzarote", level: "Consejo de Europa" },
  { id: "budapest", label: "Convenio de Budapest", level: "Consejo de Europa" },
  { id: "dir2011", label: "Directiva 2011/93/UE", level: "Unión Europea" },
  { id: "lopivi", label: "LOPIVI (LO 8/2021)", level: "Estatal" },
  { id: "lopjm", label: "LOPJM (LO 1/1996)", level: "Estatal" },
  { id: "loe124", label: "LOE art. 124 (convivencia)", level: "Estatal" },
  { id: "lo1_2004", label: "LO 1/2004 (violencia de género)", level: "Estatal" },
  { id: "ley4_2015", label: "Ley 4/2015 (Estatuto de la víctima)", level: "Estatal" },
  { id: "rgpd", label: "RGPD / LOPDGDD", level: "Estatal" },
  { id: "cc", label: "Código Civil (arts. 1902-1904)", level: "Estatal" },
  { id: "ley40", label: "Ley 40/2015 (resp. patrimonial)", level: "Estatal" },
  { id: "auton", label: "Protocolos autonómicos", level: "Autonómico" },
];
const LAW_SHORT = { cdn: "CDN", lanzarote: "Lanzarote", budapest: "Budapest", dir2011: "Dir. 2011/93/UE",
  lopivi: "LOPIVI", lopjm: "LOPJM", loe124: "LOE 124", lo1_2004: "LO 1/2004", ley4_2015: "Ley 4/2015",
  rgpd: "RGPD", cc: "CC 1902-04", ley40: "Ley 40/2015", auton: "Autonómica" };
const lawShort = (id) => LAW_SHORT[id] || id;
const lawLabel = (id) => (LAW_CATALOG.find((l) => l.id === id) || {}).label || id;
const LAW_LEVELS = ["Internacional", "Consejo de Europa", "Unión Europea", "Estatal", "Autonómico"];

const ROLES = [
  { id: "titularidad", label: "Titularidad / órgano de gobierno" },
  { id: "direccion", label: "Dirección" },
  { id: "coordinador", label: "Coordinador/a de Bienestar y Protección" },
  { id: "jefatura", label: "Jefatura de estudios" },
  { id: "profesorado", label: "Profesorado / tutorías" },
  { id: "nodocente", label: "Personal no docente / secretaría" },
  { id: "dpd", label: "DPD / responsable de datos" },
];
const roleLabel = (id) => (ROLES.find((r) => r.id === id) || {}).label || id;
const roleShort = (id) => roleLabel(id).split(/[ /]/)[0];

const RISKS = [
  { code: "R01", title: "Ausencia de protocolos internos de protección", impact: 4, resp: "Dirección / Titularidad", laws: ["lopivi", "lopjm"] },
  { code: "R02", title: "Protocolos no implantados o desactualizados", impact: 4, resp: "Coordinador/a de Bienestar", laws: ["lopivi", "auton"] },
  { code: "R03", title: "Coordinador/a de Bienestar no designado o sin capacitación", impact: 5, resp: "Titularidad / Dirección", laws: ["lopivi"] },
  { code: "R04", title: "Omisión de comunicación ante indicios de violencia", impact: 5, resp: "Coordinador/a / Dirección", laws: ["lopivi", "lopjm"] },
  { code: "R05", title: "Gestión inadecuada de casos de acoso escolar", impact: 4, resp: "Coordinador/a / Tutoría", laws: ["loe124", "auton"] },
  { code: "R06", title: "Ciberacoso y violencia digital", impact: 4, resp: "Coordinador/a / TIC", laws: ["budapest", "auton"] },
  { code: "R07", title: "Violencia sexual o sospecha de abuso", impact: 5, resp: "Dirección / Coordinador/a", laws: ["lopivi", "dir2011", "lanzarote"] },
  { code: "R08", title: "Violencia entre iguales (física y psicológica)", impact: 3, resp: "Jefatura de estudios", laws: ["loe124", "cc"] },
  { code: "R09", title: "Violencia ejercida por personal del centro", impact: 5, resp: "Titularidad / RR. HH.", laws: ["lopivi"] },
  { code: "R10", title: "Incidentes en actividades extraescolares", impact: 4, resp: "Coordinador/a de actividades", laws: ["cc"] },
  { code: "R11", title: "Riesgos en transporte escolar", impact: 4, resp: "Secretaría / proveedor", laws: ["auton"] },
  { code: "R12", title: "Riesgos en comedor escolar", impact: 3, resp: "Coordinador/a de comedor", laws: ["auton"] },
  { code: "R13", title: "Riesgos en excursiones, salidas y campamentos", impact: 4, resp: "Responsable de la salida", laws: ["cc"] },
  { code: "R14", title: "Contratación inadecuada de proveedores o personal externo", impact: 4, resp: "Administración / RR. HH.", laws: ["lopivi"] },
  { code: "R15", title: "Falta de verificación del certificado de delitos sexuales (art. 57)", impact: 5, resp: "RR. HH. / Secretaría", laws: ["lopivi", "dir2011"] },
  { code: "R16", title: "Deficiencias en custodia y vigilancia", impact: 4, resp: "Jefatura de estudios", laws: ["cc"] },
  { code: "R17", title: "Revictimización del menor", impact: 4, resp: "Coordinador/a / Orientación", laws: ["ley4_2015", "lopivi"] },
  { code: "R18", title: "Vulneración de la confidencialidad", impact: 4, resp: "DPD / Dirección", laws: ["rgpd"] },
  { code: "R19", title: "Tratamiento inadecuado de datos personales", impact: 4, resp: "DPD", laws: ["rgpd"] },
  { code: "R20", title: "Falta de formación", impact: 3, resp: "Coordinador/a de Bienestar", laws: ["lopivi"] },
  { code: "R21", title: "Falta de documentación y trazabilidad", impact: 4, resp: "Secretaría / Dirección", laws: ["ley40", "rgpd"] },
  { code: "R22", title: "Deficiente coordinación con servicios sociales y autoridades", impact: 4, resp: "Coordinador/a / Dirección", laws: ["lopjm", "lopivi", "lo1_2004"] },
  { code: "R23", title: "Riesgos reputacionales e institucionales", impact: 4, resp: "Titularidad / Dirección", laws: [] },
];
const QUESTIONS = [
  { id: "q1", q: "¿Está designado por escrito el Coordinador/a de Bienestar y Protección?", roles: ["titularidad", "direccion"], risks: ["R03"], laws: ["lopivi"] },
  { id: "q2", q: "¿El Coordinador/a ha recibido formación específica acreditada?", roles: ["titularidad", "coordinador"], risks: ["R03", "R20"], laws: ["lopivi"] },
  { id: "q3", q: "¿Existe una Política de protección de la infancia aprobada y publicada?", roles: ["titularidad", "direccion"], risks: ["R01"], laws: ["lopivi"] },
  { id: "q4", q: "¿Los protocolos están implantados y difundidos (no solo aprobados)?", roles: ["direccion", "coordinador", "profesorado"], risks: ["R02"], laws: ["lopivi"] },
  { id: "q5", q: "¿Hay un código de conducta firmado por todo el personal y terceros?", roles: ["titularidad", "direccion", "nodocente"], risks: ["R09"], laws: ["lopivi"] },
  { id: "q6", q: "¿El protocolo frente a violencia y acoso está operativo y se aplica?", roles: ["coordinador", "jefatura"], risks: ["R05"], laws: ["loe124"] },
  { id: "q7", q: "¿Existe protocolo de ciberacoso y una norma de uso de TIC?", roles: ["coordinador", "profesorado"], risks: ["R06"], laws: ["budapest"] },
  { id: "q8", q: "¿Hay protocolo ante sospecha de abuso con escucha única y no revictimización?", roles: ["direccion", "coordinador"], risks: ["R07", "R17"], laws: ["lopivi", "ley4_2015", "lanzarote"] },
  { id: "q9", q: "¿Todo el personal con contacto con menores tiene certificado negativo vigente (art. 57)?", roles: ["titularidad", "nodocente"], risks: ["R15"], laws: ["lopivi"] },
  { id: "q10", q: "¿Se verifica el certificado también de proveedores, monitores y voluntariado?", roles: ["nodocente", "direccion"], risks: ["R14", "R15"], laws: ["lopivi", "dir2011"] },
  { id: "q11", q: "¿Existe un canal de comunicación/denuncia accesible y difundido?", roles: ["direccion", "coordinador", "profesorado"], risks: ["R04"], laws: ["lopivi"] },
  { id: "q12", q: "¿El personal conoce el deber de comunicación y a quién comunicar?", roles: ["profesorado", "nodocente"], risks: ["R04"], laws: ["lopivi", "lopjm"] },
  { id: "q13", q: "¿Se registran y custodian las comunicaciones, decisiones y derivaciones?", roles: ["direccion", "coordinador", "nodocente"], risks: ["R21"], laws: ["ley40", "rgpd"] },
  { id: "q14", q: "¿Hay un plan de formación anual con registro de asistencia?", roles: ["coordinador", "direccion"], risks: ["R20"], laws: ["lopivi"] },
  { id: "q15", q: "¿Están definidos ratios y vigilancia en patios, comedor, transporte y salidas?", roles: ["jefatura", "profesorado"], risks: ["R08", "R16"], laws: ["cc"] },
  { id: "q16", q: "¿Existe protocolo de extraescolares y excursiones con ratios y seguros?", roles: ["direccion", "jefatura"], risks: ["R10", "R13"], laws: ["cc"] },
  { id: "q17", q: "¿El transporte escolar cuenta con acompañante y control de listas?", roles: ["nodocente"], risks: ["R11"], laws: ["auton"] },
  { id: "q18", q: "¿El comedor gestiona fichas de alergias y control de seguridad alimentaria?", roles: ["nodocente"], risks: ["R12"], laws: ["auton"] },
  { id: "q19", q: "¿Los datos personales se tratan con base jurídica y medidas de seguridad?", roles: ["dpd", "nodocente"], risks: ["R19"], laws: ["rgpd"] },
  { id: "q20", q: "¿Se controla el acceso a información sensible por necesidad de conocer?", roles: ["dpd", "direccion"], risks: ["R18"], laws: ["rgpd"] },
  { id: "q21", q: "¿Está designado un DPD o evaluada su necesidad?", roles: ["titularidad", "dpd"], risks: ["R19"], laws: ["rgpd"] },
  { id: "q22", q: "¿Existen cauces definidos con servicios sociales, FCSE y Fiscalía de Menores?", roles: ["direccion", "coordinador"], risks: ["R22"], laws: ["lopjm", "lopivi"] },
  { id: "q23", q: "¿Se realiza al menos una auditoría o revisión interna anual?", roles: ["titularidad", "direccion"], risks: ["R21", "R02"], laws: [] },
  { id: "q24", q: "¿Existe un plan de gestión de crisis y comunicación?", roles: ["titularidad", "direccion"], risks: ["R23"], laws: [] },
  { id: "q25", q: "¿La titularidad asigna recursos y presupuesto al sistema de protección?", roles: ["titularidad"], risks: ["R01", "R03"], laws: ["lopivi"] },
  { id: "q26", q: "¿La dirección realiza supervisión documentada del sistema?", roles: ["direccion"], risks: ["R04", "R21"], laws: ["lopivi"] },
  { id: "q27", q: "¿El centro tiene un plan de convivencia actualizado y aplicado (art. 124 LOE)?", roles: ["direccion", "jefatura"], risks: ["R05", "R08"], laws: ["loe124"] },
  { id: "q28", q: "¿Hay pauta de actuación cuando un menor es víctima de violencia de género en su entorno?", roles: ["coordinador", "direccion"], risks: ["R22", "R04"], laws: ["lo1_2004"] },
  { id: "q29", q: "¿Se aplican los protocolos autonómicos vigentes (acoso, ciberacoso, maltrato)?", roles: ["coordinador", "jefatura"], risks: ["R02", "R05", "R06"], laws: ["auton"] },
];
const questionsForRole = (role) => QUESTIONS.filter((q) => q.roles.includes(role));
const CONSULTANT_ROLE = "consultor"; // rol de relleno del consultor (no es nivel real)
const ANSWER_VALUE = { si: 1, parcial: 0.5, no: 0, ns: 0.15 };
const ANSWER_LABEL = { si: "Sí", parcial: "Parcial", no: "No", ns: "No sé" };
const ANSWERS = [{ v: "si", label: "Sí" }, { v: "parcial", label: "Parcial" }, { v: "no", label: "No" }, { v: "ns", label: "No sé" }];
const bandOf = (level) => (level <= 4 ? "low" : level <= 10 ? "med" : level <= 15 ? "high" : "crit");
const BAND_META = { low: { label: "Bajo", color: C.low }, med: { label: "Medio", color: C.med }, high: { label: "Alto", color: C.high }, crit: { label: "Crítico", color: C.crit } };
const validPI = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);

function computeRisks(interviews, overrides = {}) {
  overrides = overrides && typeof overrides === "object" ? overrides : {};
  return RISKS.map((risk) => {
    const qs = QUESTIONS.filter((q) => q.risks.includes(risk.code));
    const answers = []; const discrepancies = [];
    qs.forEach((q) => {
      const perQ = [];
      interviews.forEach((iv) => { const a = iv.answers[q.id]; if (a) { answers.push(a); if (iv.role !== CONSULTANT_ROLE) perQ.push({ role: iv.role, val: ANSWER_VALUE[a], raw: a }); } });
      if (perQ.length >= 2) { const vals = perQ.map((x) => x.val); if (Math.max(...vals) - Math.min(...vals) >= 0.5) discrepancies.push({ q: q.q, detail: perQ }); }
    });
    const nsCount = answers.filter((a) => a === "ns").length;
    const missing = qs.filter((q) => interviews.some((iv) => ["no", "parcial", "ns"].includes(iv.answers[q.id]))).map((q) => q.q);
    let probSuggested = null;
    if (answers.length) { const control = answers.reduce((s, a) => s + ANSWER_VALUE[a], 0) / answers.length; probSuggested = Math.min(5, Math.max(1, Math.round(5 - control * 4))); }
    const impactSuggested = risk.impact;
    const ov = overrides[risk.code] || null;
    const ovProb = ov ? validPI(ov.prob) : null;
    const ovImpact = ov ? validPI(ov.impact) : null;
    const overriddenFields = [];
    if (ovProb != null) overriddenFields.push("prob");
    if (ovImpact != null) overriddenFields.push("impact");
    const overridden = overriddenFields.length > 0;
    const prob = ovProb != null ? ovProb : probSuggested;
    const impact = ovImpact != null ? ovImpact : impactSuggested;
    const common = { ...risk, impact, prob, probSuggested, impactSuggested, overridden, overriddenFields, nsCount, missing, discrepancies };
    if (prob != null && impact != null) { const level = prob * impact; return { ...common, status: "rated", level, band: bandOf(level) }; }
    return { ...common, status: "unrated", level: null, band: null };
  });
}
function computeCoverage(interviews) {
  return LAW_CATALOG.map((law) => {
    if (law.transversal) return { ...law, covered: interviews.length > 0 };
    const covered = QUESTIONS.some((q) => q.laws.includes(law.id) && interviews.some((iv) => iv.answers[q.id]));
    return { ...law, covered };
  });
}

/* --------------------------- almacenamiento --------------------------- */
// Configuración de conexión. API_BASE vacío = modo LOCAL (datos en el navegador,
// para desarrollo y vista previa). Al poner aquí la URL del backend se activa el
// modo SERVIDOR y la app habla con la API en vez de con el navegador.
const API_BASE = import.meta.env.VITE_API_BASE || ""; // se configura al publicar (VITE_API_BASE)

const hasStore = typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";
const _mem = new Map();
// Almacén clave-valor de bajo nivel (navegador o memoria), base del modo local.
const KV = {
  async get(k) { if (!hasStore) return _mem.has(k) ? JSON.parse(_mem.get(k)) : null; try { const r = await window.storage.get(k, true); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  async set(k, v) { const s = JSON.stringify(v); if (!hasStore) { _mem.set(k, s); return true; } try { const r = await window.storage.set(k, s, true); return !!r; } catch { return false; } },
  async list(p) { if (!hasStore) return [..._mem.keys()].filter((k) => k.startsWith(p)); try { const r = await window.storage.list(p, true); const keys = (r && r.keys) || []; return keys.map((x) => (typeof x === "string" ? x : x.key)); } catch { return []; } },
  async del(k) { if (!hasStore) { _mem.delete(k); return; } try { await window.storage.delete(k, true); } catch { } },
};
const metaKey = (code) => `c:${code}:meta`;
const respPrefix = (code) => `c:${code}:r:`;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const genCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ------- almacén de dominio: mismas operaciones, dos implementaciones ------- */
// Modo LOCAL: usa el navegador (KV). Funciona sin servidor (vista previa).
const localStore = {
  mode: "local",
  persistent: hasStore,
  async createRoom(center) {
    let code = genCode();
    for (let i = 0; i < 3; i++) { if (!(await KV.get(metaKey(code)))) break; code = genCode(); }
    const room = { ...center, code, createdAt: new Date().toISOString() };
    await KV.set(metaKey(code), room);
    return { code, center: room };
  },
  async getRoom(code) { return await KV.get(metaKey(code)); },
  async submitInterview(code, iv) { await KV.set(respPrefix(code) + iv.id, { ...iv, submittedAt: new Date().toISOString() }); },
  async updateInterview(code, id, iv) { const prev = await KV.get(respPrefix(code) + id); await KV.set(respPrefix(code) + id, { ...iv, id, submittedAt: (prev && prev.submittedAt) || new Date().toISOString() }); },
  async listInterviews(code) { const keys = await KV.list(respPrefix(code)); const rows = await Promise.all(keys.map((k) => KV.get(k))); return rows.filter(Boolean); },
  async resetInterviews(code) { const keys = await KV.list(respPrefix(code)); await Promise.all(keys.map((k) => KV.del(k))); },
  async listModels() {
    const keys = await KV.list("c:");
    const metaKeys = keys.filter((k) => k.endsWith(":meta"));
    const rows = await Promise.all(metaKeys.map(async (k) => {
      const room = await KV.get(k); if (!room) return null;
      const ivs = await this.listInterviews(room.code);
      return { code: room.code, status: "open", createdAt: room.createdAt, interviews: ivs.length,
        center: { name: room.name, tipo: room.tipo, etapas: room.etapas || "", alumnos: room.alumnos || "" } };
    }));
    return rows.filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async deleteModel(code) { await this.resetInterviews(code); await KV.del(metaKey(code)); },
  async getModelState(code) { return (await KV.get(`c:${code}:state`)) || { overrides: {} }; },
  async saveModelState(code, state) { await KV.set(`c:${code}:state`, state); },
};

// Modo SERVIDOR: habla con la API del backend.
function makeApiStore(base) {
  let token = null;
  const authFetch = async (path, opts = {}) => {
    if (!token) throw new Error("Sesión no iniciada.");
    return fetch(base + path, { ...opts, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...(opts.headers || {}) } });
  };
  return {
    mode: "api", persistent: true,
    setToken(t) { token = t; },
    hasToken() { return !!token; },
    async changePassword(current, next) {
      const r = await authFetch("/me/password", { method: "POST", body: JSON.stringify({ current, next }) });
      if (!r.ok) {
        let msg = "No se pudo cambiar la contraseña.";
        try { const j = await r.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { }
        throw new Error(msg);
      }
    },
    async login(email, password) {
      const r = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!r.ok) throw new Error("Credenciales no válidas.");
      token = (await r.json()).token; return true;
    },
    async createRoom(center) {
      const cr = await authFetch("/centers", { method: "POST", body: JSON.stringify({ name: center.name, ownership: center.tipo, stages: center.etapas || null, num_students: center.alumnos ? parseInt(center.alumnos, 10) : null, ccaa: center.ccaa || null }) });
      if (!cr.ok) throw new Error("No se pudo crear el centro.");
      const created = (await cr.json()).center;
      const cp = await authFetch(`/centers/${created.id}/campaigns`, { method: "POST", body: JSON.stringify({}) });
      if (!cp.ok) throw new Error("No se pudo crear la sala.");
      const campaign = (await cp.json()).campaign;
      return { code: campaign.code, center: { ...center, code: campaign.code } };
    },
    async getRoom(code) {
      const r = await fetch(base + `/rooms/${code}/public`);
      if (!r.ok) return null;
      const j = await r.json();
      return { name: j.center.name, status: j.status };
    },
    async submitInterview(code, iv) {
      const r = await fetch(base + `/rooms/${code}/interview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: iv.role, alias: iv.name || iv.alias || "", answers: iv.answers, comments: iv.comments || {} }) });
      if (!r.ok) throw new Error("No se pudo enviar la entrevista.");
    },
    async updateInterview(code, id, iv) {
      const r = await authFetch(`/rooms/${code}/interview/${id}`, { method: "PUT", body: JSON.stringify({ role: iv.role, alias: iv.name || iv.alias || "", answers: iv.answers, comments: iv.comments || {} }) });
      if (!r.ok) throw new Error("No se pudo actualizar la entrevista.");
    },
    async listInterviews(code) {
      const r = await authFetch(`/rooms/${code}`);
      if (!r.ok) return [];
      const j = await r.json();
      return (j.interviews || []).map((i) => ({ id: i.id, role: i.role, alias: i.alias, answers: i.answers, comments: i.comments || {} }));
    },
    async resetInterviews(code) { await authFetch(`/rooms/${code}/responses`, { method: "DELETE" }); },
    async listModels() {
      const r = await authFetch("/campaigns");
      if (!r.ok) return [];
      const j = await r.json();
      return (j.campaigns || []).map((c) => ({
        code: c.code, status: c.status, createdAt: c.created_at, interviews: Number(c.interview_count) || 0,
        center: { name: c.center_name, tipo: c.ownership, etapas: c.stages || "", alumnos: c.num_students != null ? String(c.num_students) : "" },
      }));
    },
    async deleteModel(code) {
      const r = await authFetch(`/rooms/${code}`, { method: "DELETE" });
      if (!r.ok) throw new Error("No se pudo eliminar el modelo.");
    },
    async getModelState(code) {
      const r = await authFetch(`/rooms/${code}/state`);
      if (!r.ok) return { overrides: {} };
      const j = await r.json();
      return j.state || { overrides: {} };
    },
    async saveModelState(code, state) {
      const r = await authFetch(`/rooms/${code}/state`, { method: "PUT", body: JSON.stringify(state) });
      if (!r.ok) throw new Error("No se pudieron guardar los ajustes.");
    },
    // Descarga el informe .docx completo generado en el servidor (docgen.js).
    async downloadDocument(code, centerName) {
      const r = await authFetch(`/rooms/${code}/document`, { method: "POST" });
      if (!r.ok) {
        let msg = "No se pudo generar el informe.";
        try { const j = await r.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { }
        throw new Error(msg);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Informe_${(centerName || "centro").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "")}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
  };
}

// Selector: si hay API_BASE, modo servidor; si no, modo local.
const store = API_BASE ? makeApiStore(API_BASE) : localStore;

/* ------------------------------- demo -------------------------------- */
const SEED = () => {
  const mk = (role, map) => { const a = {}; questionsForRole(role).forEach((q) => { a[q.id] = map[q.id] || "parcial"; }); return { id: genId(), role, name: "(ejemplo)", answers: a }; };
  return [
    mk("titularidad", { q1: "si", q3: "parcial", q9: "no", q23: "no", q25: "parcial", q21: "no" }),
    mk("direccion", { q4: "parcial", q8: "no", q11: "si", q16: "parcial", q24: "no", q26: "parcial", q3: "si", q23: "no", q27: "parcial", q28: "no" }),
    mk("coordinador", { q2: "no", q4: "no", q6: "parcial", q7: "no", q11: "si", q14: "no", q22: "parcial", q28: "no", q29: "no" }),
    mk("profesorado", { q4: "no", q7: "no", q11: "parcial", q12: "no", q15: "parcial" }),
  ];
};

/* --------------------------- exportaciones --------------------------- */
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tipoTxt = (t) => ({ publica: "pública", concertada: "concertada", privada: "privada" }[t] || "—");
const WORD_BAND = { low: "#EAF3EE", med: "#F7EED9", high: "#F7E7DB", crit: "#F4DEE2" };
const WORD_BANDTX = { low: "#2E6B4F", med: "#8A6414", high: "#9A4A22", crit: "#8C2C3A" };

function buildWordHTML(center, interviews, overrides = {}) {
  const risks = computeRisks(interviews, overrides);
  const coverage = computeCoverage(interviews);
  const rated = risks.filter((r) => r.status === "rated").sort((a, b) => b.level - a.level);
  const anyOverride = rated.some((r) => r.overridden);
  const mk = (r, f) => (r.overriddenFields && r.overriddenFields.includes(f) ? " *" : "");
  const nBy = (b) => rated.filter((r) => r.band === b).length;
  const critHigh = rated.filter((r) => ["crit", "high"].includes(r.band));
  const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const byRole = {}; interviews.forEach((iv) => { byRole[iv.role] = (byRole[iv.role] || 0) + 1; });
  const discrep = risks.flatMap((r) => r.discrepancies.map((d) => ({ code: r.code, ...d })));
  const brechas = risks.filter((r) => r.nsCount > 0);

  const matrizRows = rated.map((r) => `<tr>
    <td style="border:1px solid #B8C2CC;padding:5px;font-family:Consolas;font-weight:bold;color:#1F3864">${r.code}</td>
    <td style="border:1px solid #B8C2CC;padding:5px">${esc(r.title)}</td>
    <td style="border:1px solid #B8C2CC;padding:5px;text-align:center">${r.prob}${mk(r, "prob")}</td>
    <td style="border:1px solid #B8C2CC;padding:5px;text-align:center">${r.impact}${mk(r, "impact")}</td>
    <td style="border:1px solid #B8C2CC;padding:5px;text-align:center;font-weight:bold">${r.level}</td>
    <td style="border:1px solid #B8C2CC;padding:5px;background:${WORD_BAND[r.band]};color:${WORD_BANDTX[r.band]};font-weight:bold">${BAND_META[r.band].label}</td>
    <td style="border:1px solid #B8C2CC;padding:5px;font-family:Consolas;font-size:10px">${r.laws.map(lawShort).join(", ") || "—"}</td>
    <td style="border:1px solid #B8C2CC;padding:5px">${esc(r.resp)}</td></tr>`).join("");

  const planRows = critHigh.slice(0, 8).map((r, i) => `<p style="margin:6px 0 2px"><b>${String(i + 1).padStart(2, "0")} · ${r.code} — ${esc(r.title)}</b> [${BAND_META[r.band].label}]</p>
    <ul style="margin:2px 0 6px">${(r.missing.length ? r.missing.slice(0, 4) : ["Mantener y documentar los controles existentes."]).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
    <p style="margin:0 0 8px;color:#595959;font-style:italic">Responsable: ${esc(r.resp)}. Fundamento: ${r.laws.map(lawShort).join(", ") || "—"}.</p>`).join("") || "<p>No se han detectado riesgos altos o críticos con los datos actuales.</p>";

  const discRows = discrep.length ? "<ul>" + discrep.slice(0, 10).map((d) => `<li><b>${d.code}</b> — "${esc(d.q)}": ${d.detail.map((x) => `${esc(roleShort(x.role))} (${ANSWER_LABEL[x.raw]})`).join(" vs ")}</li>`).join("") + "</ul>" : "<p>No se detectan divergencias significativas entre roles.</p>";
  const brechaRows = brechas.length ? "<ul>" + brechas.map((r) => `<li><b>${r.code}</b> — ${esc(r.title)}: ${r.nsCount} respuesta(s) «No sé».</li>`).join("") + "</ul>" : "<p>Sin respuestas «No sé» relevantes.</p>";
  const cobRows = LAW_LEVELS.map((lvl) => { const items = coverage.filter((l) => l.level === lvl); if (!items.length) return ""; return `<p style="margin:6px 0 2px"><b>${lvl}</b></p><p style="margin:0 0 6px">${items.map((l) => `${l.covered ? "✓" : "○"} ${esc(l.label)}`).join(" &nbsp;·&nbsp; ")}</p>`; }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe ${esc(center.name || "centro")}</title></head>
  <body style="font-family:Arial,sans-serif;color:#16202E;font-size:12px;line-height:1.5">
  <h1 style="color:#1F3864;font-size:22px;margin:0 0 2px">Informe de diagnóstico y modelo personalizado</h1>
  <p style="color:#1F3864;font-size:14px;margin:0 0 10px">Prevención de riesgos y compliance (LOPIVI / ISO 37301:2021)</p>
  <p style="margin:0"><b>${esc(center.name || "Centro educativo")}</b> — titularidad ${tipoTxt(center.tipo)}${center.etapas ? " · " + esc(center.etapas) : ""}${center.alumnos ? " · " + esc(center.alumnos) + " alumnos/as" : ""}</p>
  <p style="color:#595959;margin:2px 0 14px">Generado el ${fecha} a partir de ${interviews.length} entrevista(s). Borrador orientativo · requiere validación jurídica.</p>

  <h2 style="color:#1F3864;font-size:16px;border-bottom:2px solid #1F3864;padding-bottom:3px">1. Resumen del diagnóstico</h2>
  <p>${esc(center.name || "El centro")} presenta ${nBy("crit")} riesgo(s) crítico(s), ${nBy("high")} alto(s), ${nBy("med")} medio(s) y ${nBy("low")} bajo(s), sobre ${rated.length} evaluados de ${RISKS.length}. Niveles entrevistados: ${Object.keys(byRole).length ? Object.keys(byRole).map((r) => `${roleShort(r)} (${byRole[r]})`).join(", ") : "—"}.</p>

  <h2 style="color:#1F3864;font-size:16px;border-bottom:2px solid #1F3864;padding-bottom:3px">2. Matriz de riesgos priorizada</h2>
  <table style="border-collapse:collapse;width:100%;font-size:11px">
    <tr style="background:#1F3864;color:#fff">
      <th style="border:1px solid #1F3864;padding:5px;text-align:left">Cód.</th><th style="border:1px solid #1F3864;padding:5px;text-align:left">Riesgo</th>
      <th style="border:1px solid #1F3864;padding:5px">P</th><th style="border:1px solid #1F3864;padding:5px">I</th><th style="border:1px solid #1F3864;padding:5px">Nivel</th>
      <th style="border:1px solid #1F3864;padding:5px;text-align:left">Banda</th><th style="border:1px solid #1F3864;padding:5px;text-align:left">Fundamento</th><th style="border:1px solid #1F3864;padding:5px;text-align:left">Responsable</th></tr>
    ${matrizRows || '<tr><td colspan="8" style="border:1px solid #B8C2CC;padding:5px">Sin riesgos evaluados.</td></tr>'}
  </table>
  ${anyOverride ? '<p style="margin:6px 0 0;color:#595959;font-style:italic;font-size:11px">* Valor de Probabilidad (P) o Impacto (I) ajustado por el consultor a criterio experto. El valor sugerido por la herramienta se conserva.</p>' : ''}

  <h2 style="color:#1F3864;font-size:16px;border-bottom:2px solid #1F3864;padding-bottom:3px;margin-top:16px">3. Plan de actuación a 90 días</h2>
  ${planRows}
  <h2 style="color:#1F3864;font-size:16px;border-bottom:2px solid #1F3864;padding-bottom:3px">4. Discrepancias entre niveles jerárquicos</h2>
  ${discRows}
  <h2 style="color:#1F3864;font-size:16px;border-bottom:2px solid #1F3864;padding-bottom:3px">5. Brechas de conocimiento</h2>
  ${brechaRows}
  <h2 style="color:#1F3864;font-size:16px;border-bottom:2px solid #1F3864;padding-bottom:3px">6. Cobertura normativa</h2>
  ${cobRows}
  <p style="margin-top:16px;padding:8px;border-left:4px solid #C00000;color:#6B5324;font-style:italic">Documento de trabajo. Los resultados son orientativos y no constituyen asesoramiento jurídico ni sustituyen la validación profesional ni la supervisión de la Administración educativa. El marco autonómico debe verificarse en cada comunidad.</p>
  </body></html>`;
}
function downloadWord(center, interviews, overrides) {
  const html = buildWordHTML(center, interviews, overrides);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `Informe_${(center.name || "centro").replace(/\W+/g, "_")}.doc`; a.click(); URL.revokeObjectURL(url);
}
function exportJSON(center, interviews) {
  const blob = new Blob([JSON.stringify({ center, interviews, generatedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `entrevistas_${(center.name || "centro").replace(/\W+/g, "_")}.json`; a.click(); URL.revokeObjectURL(url);
}

/* ============================== APP ============================== */
export default function App() {
  const [view, setView] = useState("home");
  const [code, setCode] = useState("");
  const [center, setCenter] = useState(null);
  const [authed, setAuthed] = useState(store.mode !== "api");
  const logout = () => { try { store.setToken && store.setToken(null); } catch { } setAuthed(false); setView("home"); };
  const canModels = (store.mode === "api" && authed) || (store.mode === "local" && store.persistent);
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <div style={{ fontFamily: sans, background: C.bg, color: C.ink, minHeight: "100vh" }}>
      <style>{`
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${C.action}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce){ *{transition:none!important} .spin{animation:none!important} }
        @keyframes spin{ to{transform:rotate(360deg)} } .spin{ animation:spin 1s linear infinite; }
      `}</style>

      <header style={{ borderBottom: `1px solid ${C.line}`, background: C.surface }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setView("home")} title="Inicio" style={{ width: 36, height: 36, borderRadius: 8, background: C.navy, display: "grid", placeItems: "center", border: "none", cursor: "pointer", flexShrink: 0 }}>
            <Scale size={19} color="#fff" />
          </button>
          <div style={{ lineHeight: 1.15, flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.navy, fontFamily: mono, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 1 }}>Forentia 360</div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>Prevención y Compliance educativo</div>
            <div style={{ fontSize: 12, color: C.slate, fontFamily: mono }}>LOPIVI (LO 8/2021) · LOPJM (LO 1/1996) · LOE (LO 2/2006) · ISO 37301:2021</div>
          </div>
          {store.mode === "local" && !store.persistent && <span title="Sin almacenamiento persistente en este entorno" style={{ fontSize: 11, color: C.med, fontFamily: mono, display: "inline-flex", alignItems: "center", gap: 5 }}><AlertTriangle size={13} /> modo local</span>}
          {(canModels || (store.mode === "api" && authed)) && (
            <HeaderMenu items={[
              ...(canModels ? [{ key: "models", label: "Mis modelos", icon: Grid3x3, onClick: () => setView("models") }] : []),
              { key: "home", label: "Inicio", icon: HomeIcon, onClick: () => setView("home") },
              ...(store.mode === "api" && authed ? [{ key: "pw", label: "Cambiar contraseña", icon: Scale, onClick: () => setPwOpen(true) }] : []),
              ...(store.mode === "api" && authed ? [{ key: "logout", label: "Cerrar sesión", icon: LogIn, danger: true, onClick: logout }] : []),
            ]} />
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 24px" }}>
        {view === "home" && <Home go={setView} />}
        {view === "create" && (store.mode === "api" && !authed
          ? <Login onOk={() => setAuthed(true)} onBack={() => setView("home")} />
          : <Create onDone={(cd, ce) => { setCode(cd); setCenter(ce); setView("dashboard"); }} onBack={() => setView("home")} />)}
        {view === "join" && <Join onJoined={(cd, ce) => { setCode(cd); setCenter(ce); setView("participant"); }} onBack={() => setView("home")} />}
        {view === "participant" && <Participant code={code} center={center} onBack={() => setView("home")} />}
        {view === "dashboard" && <Dashboard code={code} center={center} onBack={() => setView("home")} />}
        {view === "quick" && <Quick onBack={() => setView("home")} />}
        {view === "demo" && <Demo onBack={() => setView("home")} />}
        {view === "models" && <Models onOpen={(cd, ce) => { setCode(cd); setCenter(ce); setView("dashboard"); }} onBack={() => setView("home")} />}
      </div>

      <footer style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 30px" }}><Disclaimer /></footer>
      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
    </div>
  );
}

/* --------------------------- Menú de cabecera --------------------------- */
function HeaderMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen((v) => !v)} title="Menú" aria-haspopup="true" aria-expanded={open}
        style={{ border: `1px solid ${C.line}`, background: C.surface, borderRadius: 8, padding: "7px 11px", cursor: "pointer", color: C.navy, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600 }}>
        <Menu size={16} /> Menú
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 12px 34px rgba(0,0,0,0.14)", minWidth: 210, padding: 6, zIndex: 40 }}>
          {items.map((it) => (
            <React.Fragment key={it.key}>
              {it.danger && <div style={{ height: 1, background: C.line, margin: "5px 4px" }} />}
              <button role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 7, padding: "9px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 600, color: it.danger ? C.crit : C.ink }}
                onMouseEnter={(e) => (e.currentTarget.style.background = it.danger ? hexA(C.crit, 0.08) : C.bg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <it.icon size={16} style={it.key === "logout" ? { transform: "scaleX(-1)" } : undefined} /> {it.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Cambiar contraseña --------------------------- */
function PasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const submit = async () => {
    setErr("");
    if (!current || !next) { setErr("Rellena la contraseña actual y la nueva."); return; }
    if (next.length < 8) { setErr("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (next !== repeat) { setErr("La nueva contraseña y su repetición no coinciden."); return; }
    setBusy(true);
    try { await store.changePassword(current, next); setOk(true); } catch (e) { setErr(e.message || "No se pudo cambiar la contraseña."); } finally { setBusy(false); }
  };
  const field = (label, value, set, ph) => (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.slate, marginBottom: 5 }}>{label}</span>
      <input type="password" value={value} onChange={(e) => set(e.target.value)} placeholder={ph} autoComplete="off"
        style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 14 }} />
    </label>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 400, boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Cambiar contraseña</div>
        {ok ? (
          <div>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: hexA(C.low, 0.12), border: `1px solid ${hexA(C.low, 0.5)}`, borderRadius: 9, padding: "12px 14px", margin: "10px 0 16px" }}>
              <Check size={18} color={C.low} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13.5, color: C.ink }}>Contraseña actualizada. Se usará la próxima vez que inicies sesión.</span>
            </div>
            <div style={{ textAlign: "right" }}><PrimaryBtn onClick={onClose}>Entendido</PrimaryBtn></div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12.5, color: C.slate, margin: "2px 0 16px" }}>Introduce tu contraseña actual y la nueva (mínimo 8 caracteres).</div>
            {field("Contraseña actual", current, setCurrent, "••••••••")}
            {field("Nueva contraseña", next, setNext, "Mínimo 8 caracteres")}
            {field("Repite la nueva contraseña", repeat, setRepeat, "••••••••")}
            {err && <div style={{ fontSize: 13, color: C.crit, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <PrimaryBtn onClick={onClose} ghost>Cancelar</PrimaryBtn>
              <PrimaryBtn onClick={submit} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : null} {busy ? "Guardando…" : "Guardar"}</PrimaryBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Home ------------------------------ */
function Home({ go }) {
  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Del diagnóstico al modelo, en una sola herramienta</h1>
        <p style={{ fontSize: 14, color: C.slate, margin: "8px 0 0", maxWidth: 660 }}>
          Recoge las entrevistas del equipo por nivel jerárquico, agrégalas en una matriz de riesgos y genera el modelo con plan a 90 días y descarga del informe en Word.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <ChoiceCard icon={Share2} title="Crear sala del centro" primary
          desc="Para el coordinador. Genera un código para el equipo y abre el panel con el modelo completo."
          cta="Crear sala" onClick={() => go("create")} />
        <ChoiceCard icon={LogIn} title="Unirse con un código"
          desc="Para cualquier miembro. Introduce el código, elige tu rol y responde tu entrevista."
          cta="Unirse" onClick={() => go("join")} />
        <ChoiceCard icon={Zap} title="Diagnóstico rápido"
          desc="Para trabajar en solitario. Añade tú mismo las entrevistas en una sesión y obtén el modelo al momento."
          cta="Empezar" onClick={() => go("quick")} />
        <ChoiceCard icon={FileText} title="Ver demostración"
          desc="Un centro ficticio ya rellenado para ver el modelo completo al instante. Ideal para presentar la herramienta."
          cta="Ver ejemplo" onClick={() => go("demo")} />
      </div>
    </div>
  );
}
function ChoiceCard({ icon: Icon, title, desc, cta, onClick, primary }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${primary ? C.navy : C.line}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ width: 40, height: 40, borderRadius: 9, background: primary ? C.navy : C.bg, display: "grid", placeItems: "center" }}><Icon size={20} color={primary ? "#fff" : C.navy} /></div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
      <p style={{ fontSize: 13, color: C.slate, margin: 0, flex: 1 }}>{desc}</p>
      <div><PrimaryBtn onClick={onClick} ghost={!primary}>{cta} <ChevronRight size={16} /></PrimaryBtn></div>
    </div>
  );
}

/* ------------------------------ Login ------------------------------ */
function Login({ onOk, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    try { await store.login(email.trim(), password); onOk(); }
    catch (e) { setErr(e.message || "No se pudo iniciar sesión."); }
    finally { setBusy(false); }
  };
  return (
    <div><BackLink onClick={onBack} />
      <Card style={{ maxWidth: 420 }}>
        <H sub="Acceso del consultor. Los participantes que responden con un código no necesitan iniciar sesión.">Iniciar sesión</H>
        <label><Lbl>Correo</Lbl><input style={field} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <div style={{ height: 12 }} />
        <label><Lbl>Contraseña</Lbl><input type="password" style={field} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} autoComplete="current-password" /></label>
        {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.crit, display: "flex", gap: 6, alignItems: "center" }}><AlertTriangle size={14} /> {err}</div>}
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}><PrimaryBtn onClick={go} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />} Entrar</PrimaryBtn></div>
      </Card>
    </div>
  );
}

/* ------------------------------ Create ------------------------------ */
function Create({ onDone, onBack }) {
  const [form, setForm] = useState({ name: "", tipo: "concertada", etapas: "", alumnos: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const create = async () => {
    setBusy(true);
    try {
      const { code, center } = await store.createRoom(form);
      setBusy(false); onDone(code, center);
    } catch (e) { setBusy(false); alert(e.message || "No se pudo crear la sala."); }
  };
  return (
    <div><BackLink onClick={onBack} />
      <Card>
        <H sub="Estos datos encabezan el diagnóstico. Al crear la sala obtendrás un código para compartir con el equipo.">Crear sala del centro</H>
        <CenterFields form={form} set={set} />
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <PrimaryBtn onClick={create} disabled={busy || !form.name.trim()}>{busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Crear sala y abrir panel</PrimaryBtn>
        </div>
      </Card>
    </div>
  );
}
function CenterFields({ form, set }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <label style={{ gridColumn: "1 / -1" }}><Lbl>Nombre del centro</Lbl><input style={field} value={form.name} onChange={set("name")} placeholder="p. ej. Colegio San…" /></label>
      <label><Lbl>Titularidad</Lbl><select style={field} value={form.tipo} onChange={set("tipo")}><option value="publica">Pública</option><option value="concertada">Concertada</option><option value="privada">Privada</option></select></label>
      <label><Lbl>Nº de alumnado</Lbl><input style={field} value={form.alumnos} onChange={set("alumnos")} placeholder="p. ej. 620" inputMode="numeric" /></label>
      <label style={{ gridColumn: "1 / -1" }}><Lbl>Etapas educativas</Lbl><input style={field} value={form.etapas} onChange={set("etapas")} placeholder="Infantil, Primaria, ESO…" /></label>
    </div>
  );
}

/* ------------------------------ Join ------------------------------ */
function Join({ onJoined, onBack }) {
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const join = async () => {
    const cd = code.trim().toUpperCase();
    if (cd.length < 4) { setErr("Introduce el código que te han compartido."); return; }
    setBusy(true); setErr("");
    const center = await store.getRoom(cd); setBusy(false);
    if (!center) { setErr("No encontramos esa sala. Revisa el código con quien te lo compartió."); return; }
    onJoined(cd, center);
  };
  return (
    <div><BackLink onClick={onBack} />
      <Card style={{ maxWidth: 460 }}>
        <H sub="Introduce el código de la sala de tu centro para responder tu entrevista.">Unirse a una sala</H>
        <Lbl>Código de la sala</Lbl>
        <input style={{ ...field, fontFamily: mono, fontSize: 20, letterSpacing: "0.15em", textTransform: "uppercase" }} value={code} maxLength={6}
          onChange={(e) => setCode(e.target.value)} placeholder="ABC123" onKeyDown={(e) => e.key === "Enter" && join()} />
        {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.crit, display: "flex", gap: 6, alignItems: "center" }}><AlertTriangle size={14} /> {err}</div>}
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}><PrimaryBtn onClick={join} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />} Entrar</PrimaryBtn></div>
      </Card>
    </div>
  );
}

/* ------------------------- InterviewForm (compartido) ------------------------- */
function InterviewForm({ onSubmit, submitLabel = "Enviar entrevista", submitIcon = Send, initial = null }) {
  const isConsultantEdit = !!(initial && initial.role === CONSULTANT_ROLE);
  const [role, setRole] = useState((initial && initial.role) || "profesorado");
  const [name, setName] = useState((initial && (initial.name || initial.alias)) || "");
  const [answers, setAnswers] = useState((initial && initial.answers) || {});
  const [comments, setComments] = useState((initial && initial.comments) || {});
  const [busy, setBusy] = useState(false);
  const qs = isConsultantEdit ? QUESTIONS.filter((q) => (initial.answers || {})[q.id] !== undefined) : questionsForRole(role);
  const answered = Object.keys(answers).length;
  const Icon = submitIcon;
  const go = async () => { setBusy(true); await onSubmit({ id: (initial && initial.id) || genId(), role, name: name.trim(), answers, comments }); setBusy(false); if (!initial) { setAnswers({}); setName(""); setComments({}); } };
  const setAns = (qid, v) => setAnswers((prev) => { const n = { ...prev }; if (n[qid] === v) delete n[qid]; else n[qid] = v; return n; });
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 10 }}>
        {isConsultantEdit
          ? <label><Lbl>Origen</Lbl><div style={{ ...field, display: "flex", alignItems: "center", color: C.action, fontWeight: 600 }}>Respuesta del consultor (relleno)</div></label>
          : <label><Lbl>Nivel jerárquico</Lbl><select style={field} value={role} onChange={(e) => { setRole(e.target.value); setAnswers({}); setComments({}); }}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}
        <label><Lbl>Nombre o iniciales (opcional)</Lbl><input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. M. L." /></label>
      </div>
      <div style={{ margin: "6px 0", fontSize: 12, color: C.slate, fontFamily: mono }}>{answered}/{qs.length} respondidas</div>
      <div style={{ fontSize: 11.5, color: C.slate, marginBottom: 8 }}>Puedes cambiar cualquier respuesta; pulsa de nuevo la opción marcada para dejarla en blanco. En «Parcial» y «No sé» puedes añadir un comentario.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {qs.map((q) => { const showComment = answers[q.id] === "parcial" || answers[q.id] === "ns"; return (
          <div key={q.id} style={{ padding: "12px 14px", borderRadius: 9, border: `1px solid ${C.line}`, background: C.bg }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 10.5, color: C.slate, marginTop: 2, whiteSpace: "nowrap" }}>{q.risks.join("·")}</span>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{q.q}</span>
            </div>
            {q.laws.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 9 }}>{q.laws.map((id) => <LawChip small key={id} id={id} />)}</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ANSWERS.map((a) => { const on = answers[q.id] === a.v; return <button key={a.v} onClick={() => setAns(q.id, a.v)}
                  style={{ padding: "6px 13px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? C.navy : C.line}`, background: on ? C.navy : "#fff", color: on ? "#fff" : C.slate }}>{a.label}</button>; })}
              </div>
              {showComment && <input value={comments[q.id] || ""} maxLength={500} onChange={(e) => setComments({ ...comments, [q.id]: e.target.value })}
                placeholder="Comentario (opcional) · sin nombres ni datos personales"
                style={{ flex: "1 1 220px", minWidth: 180, boxSizing: "border-box", padding: "7px 10px", borderRadius: 7, border: `1px solid ${C.action}`, fontSize: 12.5, background: "#fff" }} />}
            </div>
          </div>); })}
      </div>
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <PrimaryBtn onClick={go} disabled={busy || answered === 0}>{busy ? <Loader2 size={16} className="spin" /> : <Icon size={16} />} {submitLabel}</PrimaryBtn>
      </div>
    </div>
  );
}

/* ----------------------- Completar huecos (consultor) ----------------------- */
function ConsultantFill({ interviews, onSubmit }) {
  const answeredIds = new Set();
  interviews.forEach((iv) => Object.keys(iv.answers || {}).forEach((k) => answeredIds.add(k)));
  const gaps = QUESTIONS.filter((q) => !answeredIds.has(q.id));
  const [answers, setAnswers] = useState({});
  const [comments, setComments] = useState({});
  const [busy, setBusy] = useState(false);
  const answered = Object.keys(answers).length;
  const rolesTxt = (q) => q.roles.map((r) => (ROLES.find((x) => x.id === r) || {}).label || r).join(", ");
  const go = async () => { setBusy(true); await onSubmit({ id: genId(), role: CONSULTANT_ROLE, name: "Consultor", answers, comments }); setBusy(false); setAnswers({}); setComments({}); };
  if (!gaps.length) return <Empty text="No hay huecos: todas las preguntas tienen ya al menos una respuesta." />;
  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.slate, marginBottom: 10 }}>Hay {gaps.length} pregunta(s) que nadie ha respondido. Responde las que puedas con tu criterio; quedarán registradas como respuesta del consultor.</div>
      <div style={{ margin: "6px 0", fontSize: 12, color: C.slate, fontFamily: mono }}>{answered}/{gaps.length} respondidas</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {gaps.map((q) => { const showComment = answers[q.id] === "parcial" || answers[q.id] === "ns"; return (
          <div key={q.id} style={{ padding: "12px 14px", borderRadius: 9, border: `1px solid ${C.line}`, background: C.bg }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{ fontFamily: mono, fontSize: 10.5, color: C.slate, marginTop: 2, whiteSpace: "nowrap" }}>{q.risks.join("·")}</span>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{q.q}</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.slate, marginBottom: 8 }}>Correspondía a: {rolesTxt(q)}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ANSWERS.map((a) => { const on = answers[q.id] === a.v; return <button key={a.v} onClick={() => setAnswers((prev) => { const n = { ...prev }; if (n[q.id] === a.v) delete n[q.id]; else n[q.id] = a.v; return n; })}
                  style={{ padding: "6px 13px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? C.action : C.line}`, background: on ? C.action : "#fff", color: on ? "#fff" : C.slate }}>{a.label}</button>; })}
              </div>
              {showComment && <input value={comments[q.id] || ""} maxLength={500} onChange={(e) => setComments({ ...comments, [q.id]: e.target.value })}
                placeholder="Comentario (opcional) · sin nombres ni datos personales"
                style={{ flex: "1 1 220px", minWidth: 180, boxSizing: "border-box", padding: "7px 10px", borderRadius: 7, border: `1px solid ${C.action}`, fontSize: 12.5, background: "#fff" }} />}
            </div>
          </div>); })}
      </div>
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <PrimaryBtn onClick={go} disabled={busy || answered === 0}>{busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Guardar respuestas del consultor</PrimaryBtn>
      </div>
    </div>
  );
}

/* --------------------------- Participant --------------------------- */
function Participant({ code, center, onBack }) {
  const [done, setDone] = useState(false);
  const submit = async (iv) => { await store.submitInterview(code, iv); setDone(true); };
  if (done) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: C.low, display: "grid", placeItems: "center" }}><Check size={22} color="#fff" /></div>
          <div><div style={{ fontSize: 17, fontWeight: 700 }}>Entrevista enviada</div><div style={{ fontSize: 13, color: C.slate }}>Gracias. El coordinador verá tus respuestas agregadas en el panel del centro.</div></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <PrimaryBtn onClick={() => setDone(false)} ghost><Plus size={16} /> Enviar otra entrevista</PrimaryBtn>
          <PrimaryBtn onClick={onBack}>Terminar</PrimaryBtn>
        </div>
      </Card>
    );
  }
  return (
    <div><BackLink onClick={onBack} label="Salir" />
      <Card>
        <H sub={`Centro: ${center?.name || "—"} · sala ${code}`}>Tu entrevista</H>
        <InterviewForm onSubmit={submit} submitLabel="Enviar entrevista" submitIcon={Send} />
      </Card>
    </div>
  );
}

/* ------------------------------ Quick ------------------------------ */
function Quick({ onBack }) {
  const [step, setStep] = useState("center");
  const [center, setCenter] = useState({ name: "", tipo: "concertada", etapas: "", alumnos: "" });
  const [interviews, setInterviews] = useState([]);
  const [adding, setAdding] = useState(false);
  const set = (k) => (e) => setCenter({ ...center, [k]: e.target.value });

  if (step === "center") {
    return (
      <div><BackLink onClick={onBack} />
        <Card>
          <H sub="Diagnóstico en una sola sesión. Los datos se mantienen en memoria mientras trabajas.">Centro educativo</H>
          <CenterFields form={center} set={set} />
          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}><PrimaryBtn onClick={() => setStep("collect")} disabled={!center.name.trim()}>Continuar <ChevronRight size={16} /></PrimaryBtn></div>
        </Card>
      </div>
    );
  }
  if (step === "collect") {
    return (
      <div><BackLink onClick={() => setStep("center")} />
        <Card style={{ marginBottom: 16 }}>
          <H sub="Añade una entrevista por cada persona o carga un ejemplo. Cuando tengas suficientes, genera el modelo.">Entrevistas — {center.name}</H>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <PrimaryBtn onClick={() => setAdding(true)} ghost><Plus size={16} /> Nueva entrevista</PrimaryBtn>
            <PrimaryBtn onClick={() => setInterviews(SEED())} ghost><Users size={16} /> Cargar ejemplo</PrimaryBtn>
            {interviews.length > 0 && <div style={{ marginLeft: "auto" }}><PrimaryBtn onClick={() => setStep("results")}>Ver modelo <ChevronRight size={16} /></PrimaryBtn></div>}
          </div>
          {interviews.length > 0 && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {interviews.map((iv) => (
                <div key={iv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff" }}>
                  <span style={{ fontFamily: mono, fontSize: 11, color: "#fff", background: C.navy, padding: "3px 7px", borderRadius: 5 }}>{Object.keys(iv.answers).length} resp.</span>
                  <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{roleLabel(iv.role)}{iv.name ? ` · ${iv.name}` : ""}</div>
                  <button onClick={() => setInterviews(interviews.filter((x) => x.id !== iv.id))} title="Eliminar" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.slate }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </Card>
        {adding && (
          <Card style={{ borderColor: C.navy }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Nueva entrevista</div>
            <InterviewForm submitLabel="Guardar entrevista" submitIcon={Check} onSubmit={async (iv) => { setInterviews((p) => [...p, iv]); setAdding(false); }} />
            <div style={{ marginTop: 10 }}><button onClick={() => setAdding(false)} style={{ border: "none", background: "transparent", color: C.slate, fontSize: 12.5, cursor: "pointer" }}>Cancelar</button></div>
          </Card>
        )}
      </div>
    );
  }
  return (
    <div><BackLink onClick={() => setStep("collect")} label="Volver a entrevistas" />
      <Results center={center} interviews={interviews} />
    </div>
  );
}

/* ------------------------------ Mis modelos ------------------------------ */
function Models({ onOpen, onBack }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setRows(null); try { setRows(await store.listModels()); } catch { setRows([]); } }, []);
  useEffect(() => { load(); }, [load]);
  const del = async (m) => {
    if (!window.confirm(`¿Eliminar el modelo de "${m.center.name || m.code}"? Se borrarán también sus entrevistas. Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    try { await store.deleteModel(m.code); await load(); } catch (e) { alert(e.message || "No se pudo eliminar el modelo."); } finally { setBusy(false); }
  };
  return (
    <div><BackLink onClick={onBack} />
      <Card>
        <H sub="Tus centros y modelos guardados. Ábrelos para seguir trabajando o elimínalos.">Mis modelos</H>
        {rows === null ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", color: C.slate, fontSize: 13.5 }}><Loader2 size={16} className="spin" /> Cargando…</div>
        ) : !rows.length ? (
          <Empty text="Aún no tienes modelos guardados. Crea una sala del centro para empezar." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((m) => (
              <div key={m.code} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{m.center.name || "(centro sin nombre)"}</div>
                  <div style={{ fontSize: 12.5, color: C.slate }}>Titularidad {tipoTxt(m.center.tipo)}{m.center.etapas ? ` · ${m.center.etapas}` : ""} · {m.interviews} entrevista(s)</div>
                </div>
                <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: C.navy, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 7, padding: "4px 9px" }}>{m.code}</span>
                <PrimaryBtn onClick={() => onOpen(m.code, m.center)}><ChevronRight size={16} /> Abrir</PrimaryBtn>
                <button onClick={() => del(m)} disabled={busy} title="Eliminar modelo" style={{ border: `1px solid ${hexA(C.crit, 0.4)}`, background: "#fff", color: C.crit, borderRadius: 9, padding: "9px 12px", cursor: busy ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>✕ Eliminar</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ Demo (ejemplo ficticio) ------------------------------ */
function Demo({ onBack }) {
  const [interviews] = useState(SEED);
  const center = { name: "Colegio Ejemplo San Martín (ficticio)", tipo: "concertada", etapas: "Infantil, Primaria, ESO", alumnos: "620" };
  return (
    <div><BackLink onClick={onBack} />
      <Card style={{ marginBottom: 16, borderColor: C.navy }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Info size={18} color={C.navy} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, color: C.slate }}>Datos de <b>demostración</b> de un centro ficticio, para presentar la herramienta. No corresponden a ningún centro real.</span>
        </div>
      </Card>
      <Results center={center} interviews={interviews} />
    </div>
  );
}

/* ---------------------------- Dashboard ---------------------------- */
function Dashboard({ code, center, onBack }) {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const [copied, setCopied] = useState(false);
  const [interviewing, setInterviewing] = useState(false);
  const [filling, setFilling] = useState(false);
  const [editing, setEditing] = useState(null);
  const [overrides, setOverrides] = useState({});
  const timer = useRef(null);
  const load = useCallback(async () => {
    try { setInterviews(await store.listInterviews(code)); } catch { /* mantener lo anterior */ }
    setLoading(false);
  }, [code]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!auto) { if (timer.current) clearInterval(timer.current); return; } timer.current = setInterval(load, 9000); return () => timer.current && clearInterval(timer.current); }, [auto, load]);
  // Carga los ajustes manuales guardados (P/I) al abrir el modelo.
  useEffect(() => { let ok = true; (async () => { try { const st = await store.getModelState(code); if (ok) setOverrides((st && st.overrides) || {}); } catch { } })(); return () => { ok = false; }; }, [code]);

  const persistOverrides = (next) => { setOverrides(next); store.saveModelState(code, { overrides: next }).catch(() => { }); };
  const applyOverride = (rcode, field, value) => {
    const cur = overrides[rcode] || {};
    const nextRisk = { ...cur };
    if (value == null) delete nextRisk[field]; else nextRisk[field] = value;
    const next = { ...overrides };
    if (Object.keys(nextRisk).length) next[rcode] = nextRisk; else delete next[rcode];
    persistOverrides(next);
  };
  const resetRisk = (rcode) => { const next = { ...overrides }; delete next[rcode]; persistOverrides(next); };

  const byRole = {}; interviews.forEach((iv) => { byRole[iv.role] = (byRole[iv.role] || 0) + 1; });
  const realInterviews = interviews.filter((iv) => iv.role !== CONSULTANT_ROLE);
  const consultorFills = interviews.length - realInterviews.length;
  const levelsCovered = ROLES.filter((r) => byRole[r.id]).length;
  const answeredIds = new Set(); interviews.forEach((iv) => Object.keys(iv.answers || {}).forEach((k) => answeredIds.add(k)));
  const gapCount = QUESTIONS.filter((q) => !answeredIds.has(q.id)).length;
  const risks = computeRisks(interviews, overrides);
  const critHigh = risks.filter((r) => ["crit", "high"].includes(r.band)).sort((a, b) => b.level - a.level);
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { } };
  const reset = async () => { if (!window.confirm("¿Vaciar todas las entrevistas de esta sala? No se puede deshacer.")) return; await store.resetInterviews(code); load(); };
  const saveInterview = async (iv) => { await store.submitInterview(code, iv); await load(); };
  const updateInterviewHandler = async (iv) => { await store.updateInterview(code, editing.id, iv); setEditing(null); await load(); };
  const roleLbl = (id) => id === CONSULTANT_ROLE ? "Consultor (relleno)" : (ROLES.find((r) => r.id === id) || {}).label || id;

  return (
    <div><BackLink onClick={onBack} />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{center?.name || "Centro"}</div>
            <div style={{ fontSize: 12.5, color: C.slate }}>Titularidad {tipoTxt(center?.tipo)}{center?.etapas ? ` · ${center.etapas}` : ""}{center?.alumnos ? ` · ${center.alumnos} alumnos/as` : ""}</div>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 9, background: C.bg, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: C.slate, fontFamily: mono }}>CÓDIGO</span>
            <span style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, letterSpacing: "0.12em", color: C.navy }}>{code}</span>
            <button onClick={copy} title="Copiar" style={{ border: "none", background: "transparent", cursor: "pointer", color: copied ? C.low : C.slate }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: C.slate }}><Share2 size={13} /> Comparte el código para que cada persona responda, o registra tú mismo la entrevista.</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <PrimaryBtn onClick={() => { setFilling(false); setInterviewing((v) => !v); }} ghost={interviewing}><Plus size={16} /> {interviewing ? "Cerrar" : "Registrar una entrevista"}</PrimaryBtn>
            {interviews.length > 0 && <PrimaryBtn onClick={() => { setInterviewing(false); setFilling((v) => !v); }} ghost={!filling}><Zap size={16} /> {filling ? "Cerrar" : `Completar huecos${gapCount ? ` (${gapCount})` : ""}`}</PrimaryBtn>}
          </div>
        </div>
      </Card>

      {filling && (
        <Card style={{ marginBottom: 16, borderColor: C.action }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Completar huecos (respuesta del consultor)</div>
            <span style={{ fontSize: 12, color: C.slate }}>Solo preguntas que nadie ha respondido · se marcan como aportación del consultor</span>
          </div>
          <ConsultantFill interviews={interviews} onSubmit={async (iv) => { await saveInterview(iv); setFilling(false); }} />
        </Card>
      )}

      {interviewing && (
        <Card style={{ marginBottom: 16, borderColor: C.navy }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Registrar una entrevista</div>
            <span style={{ fontSize: 12, color: C.slate }}>Entrevistas tú y anotas las respuestas · una persona por entrevista</span>
          </div>
          <InterviewForm submitLabel="Guardar y siguiente persona" submitIcon={Check} onSubmit={saveInterview} />
        </Card>
      )}

      {editing && (
        <Card style={{ marginBottom: 16, borderColor: C.action }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Editar entrevista · {editing.alias || editing.name || "(sin alias)"} — {roleLbl(editing.role)}</div>
            <button onClick={() => setEditing(null)} style={{ border: "none", background: "transparent", color: C.slate, cursor: "pointer", fontSize: 12.5 }}>Cancelar</button>
          </div>
          <InterviewForm submitLabel="Guardar cambios" submitIcon={Check} initial={editing} onSubmit={updateInterviewHandler} />
        </Card>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Participación</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: C.slate, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> auto</label>
            <button onClick={load} style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: C.navy, display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12.5, fontWeight: 600 }}><RefreshCw size={14} className={loading ? "spin" : ""} /> Actualizar</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, marginBottom: 14, flexWrap: "wrap" }}>
          <Metric k="Entrevistas" v={realInterviews.length} />
          <Metric k="Niveles" v={`${levelsCovered}/${ROLES.length}`} />
          <Metric k="Alto+crítico" v={critHigh.length} color={critHigh.length ? C.crit : C.low} />
        </div>
        {consultorFills > 0 && <div style={{ fontSize: 12, color: C.action, marginBottom: 12, display: "flex", gap: 6, alignItems: "center" }}><Zap size={13} /> Incluye respuestas de relleno del consultor (no cuentan como nivel ni como discrepancia).</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ROLES.map((r) => { const n = byRole[r.id] || 0; return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
              <span style={{ width: 20, textAlign: "center", fontFamily: mono, fontWeight: 700, color: n ? C.low : C.unrated }}>{n || "·"}</span>
              <span style={{ flex: 1, color: n ? C.ink : C.slate }}>{r.label}</span>{n > 0 && <Check size={14} color={C.low} />}
            </div>); })}
        </div>
        <div style={{ marginTop: 12, textAlign: "right" }}><button onClick={reset} style={{ border: "none", background: "transparent", color: C.crit, fontSize: 12.5, cursor: "pointer" }}>Vaciar entrevistas de la sala</button></div>
      </Card>

      {interviews.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Entrevistas recogidas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {interviews.map((iv) => { const isC = iv.role === CONSULTANT_ROLE; const ansN = Object.keys(iv.answers || {}).length; const comN = Object.keys(iv.comments || {}).length; return (
              <div key={iv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{iv.alias || iv.name || "(sin alias)"} <span style={{ color: isC ? C.action : C.slate, fontWeight: 500 }}>· {roleLbl(iv.role)}</span></div>
                  <div style={{ fontSize: 12, color: C.slate }}>{ansN} respuesta(s){comN ? ` · ${comN} comentario(s)` : ""}</div>
                </div>
                <button onClick={() => { setInterviewing(false); setFilling(false); setEditing(iv); }} style={{ border: `1px solid ${C.line}`, background: C.surface, borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: C.navy, fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><RefreshCw size={13} /> Editar</button>
              </div>); })}
          </div>
        </Card>
      )}

      {loading && !interviews.length ? (
        <Card><div style={{ display: "flex", gap: 10, alignItems: "center", color: C.slate, fontSize: 13.5 }}><Loader2 size={16} className="spin" /> Cargando entrevistas…</div></Card>
      ) : !interviews.length ? (
        <Card><Empty text="Aún no hay entrevistas. Comparte el código para que el equipo responda, o pulsa «Registrar una entrevista» para anotarlas tú. El panel se actualizará solo." /></Card>
      ) : <Results center={center} interviews={interviews} overrides={overrides} editable onOverride={applyOverride} onResetRisk={resetRisk} serverDoc={store.mode === "api" ? () => store.downloadDocument(code, center && center.name) : null} />}
    </div>
  );
}

/* ------------------------- Results (modelo) ------------------------- */
function Results({ center, interviews, overrides = {}, editable = false, onOverride = () => { }, onResetRisk = () => { }, serverDoc = null }) {
  const [dl, setDl] = useState(false);
  const doDownload = async () => {
    if (!serverDoc) { downloadWord(center, interviews, overrides); return; }
    setDl(true);
    try { await serverDoc(); } catch (e) { alert(e.message || "No se pudo generar el informe."); } finally { setDl(false); }
  };
  const risks = computeRisks(interviews, overrides);
  const rated = risks.filter((r) => r.status === "rated");
  const ratedSorted = [...rated].sort((a, b) => b.level - a.level);
  const tableRisks = editable ? [...rated].sort((a, b) => a.code.localeCompare(b.code)) : ratedSorted;
  const critHigh = ratedSorted.filter((r) => ["crit", "high"].includes(r.band));
  const coverage = computeCoverage(interviews);
  const discrep = risks.flatMap((r) => r.discrepancies.map((d) => ({ code: r.code, ...d })));
  const brechas = risks.filter((r) => r.nsCount > 0);
  const nBy = (b) => rated.filter((r) => r.band === b).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <H sub={`Modelo generado a partir de ${interviews.length} entrevista(s). Revisable y validable antes de su aprobación.`}>Modelo de prevención — borrador</H>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <PrimaryBtn onClick={doDownload} disabled={dl}>{dl ? <Loader2 size={16} className="spin" /> : <FileDown size={16} />} {dl ? "Generando…" : "Descargar Word"}</PrimaryBtn>
            <PrimaryBtn onClick={() => window.print()} ghost><FileText size={16} /> Imprimir</PrimaryBtn>
          </div>
        </div>
        <Section title="1 · Diagnóstico">
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
            {center?.name ? <b>{center.name}</b> : "El centro"} (titularidad {tipoTxt(center?.tipo)}{center?.alumnos ? `, ${center.alumnos} alumnos/as` : ""}) presenta{" "}
            <b style={{ color: C.crit }}>{nBy("crit")} crítico(s)</b>, <b style={{ color: C.high }}>{nBy("high")} alto(s)</b>, {nBy("med")} medio(s) y {nBy("low")} bajo(s), sobre {rated.length} riesgos evaluados de {RISKS.length}.
          </p>
        </Section>

        <Section title="2 · Matriz de riesgos">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <HeatMatrix rated={rated} />
            <div style={{ flex: "1 1 260px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr style={{ textAlign: "left", color: C.slate, fontSize: 11, textTransform: "uppercase" }}>
                  {["Cód.", "Riesgo", "P", "I", "Niv.", "Banda", "Responsable"].map((h) => <th key={h} style={{ padding: "6px 8px", borderBottom: `2px solid ${C.line}`, fontFamily: mono, textAlign: (h === "P" || h === "I") ? "center" : "left" }}>{h}</th>)}
                  {editable && <th style={{ borderBottom: `2px solid ${C.line}` }} />}
                </tr></thead>
                <tbody>{tableRisks.map((r) => { const m = BAND_META[r.band]; return (
                  <tr key={r.code} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <td style={{ padding: "7px 8px", fontFamily: mono, fontWeight: 700, color: C.navy }}>{r.code}</td>
                    <td style={{ padding: "7px 8px" }}>{r.title}</td>
                    <td style={{ padding: "5px 6px", textAlign: "center" }}>{editable
                      ? <PIedit value={r.prob} on={r.overriddenFields.includes("prob")} onChange={(v) => onOverride(r.code, "prob", v)} />
                      : <span style={{ fontFamily: mono }}>{r.prob}</span>}</td>
                    <td style={{ padding: "5px 6px", textAlign: "center" }}>{editable
                      ? <PIedit value={r.impact} on={r.overriddenFields.includes("impact")} onChange={(v) => onOverride(r.code, "impact", v)} />
                      : <span style={{ fontFamily: mono }}>{r.impact}</span>}</td>
                    <td style={{ padding: "7px 8px", fontFamily: mono, fontWeight: 700 }}>{r.level}</td>
                    <td style={{ padding: "7px 8px" }}><span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: m.color, padding: "2px 7px", borderRadius: 20 }}>{m.label}</span></td>
                    <td style={{ padding: "7px 8px", color: C.slate }}>{r.resp}</td>
                    {editable && <td style={{ padding: "5px 6px", textAlign: "center" }}>{r.overridden
                      ? <button onClick={() => onResetRisk(r.code)} title="Restablecer valores sugeridos" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.slate, fontSize: 15, lineHeight: 1 }}>↺</button>
                      : null}</td>}
                  </tr>); })}</tbody>
              </table>
              {editable && <div style={{ fontSize: 11.5, color: C.slate, marginTop: 8, lineHeight: 1.5 }}>Ajusta <b>P</b> e <b>I</b> con tu criterio experto: el nivel y la matriz se recalculan al instante. Los valores <b style={{ color: C.navy }}>resaltados</b> son ajustes tuyos; <b>↺</b> restablece el sugerido. Los cambios se guardan automáticamente.</div>}
            </div>
          </div>
        </Section>

        <Section title="3 · Plan a 90 días">
          {critHigh.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {critHigh.slice(0, 8).map((r, i) => (
                <div key={r.code} style={{ display: "flex", gap: 12, padding: "11px 13px", borderRadius: 9, border: `1px solid ${C.line}`, background: C.bg }}>
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: "#fff", background: BAND_META[r.band].color, borderRadius: 6, padding: "2px 8px", height: "fit-content" }}>{String(i + 1).padStart(2, "0")}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}><span style={{ fontFamily: mono, color: C.navy }}>{r.code}</span> · {r.title}</div>
                    {r.missing.length > 0 && <div style={{ fontSize: 12.5, color: C.slate, marginTop: 4 }}>Acción: reforzar {r.missing.length} control(es). Responsable: {r.resp}.</div>}
                    {r.laws.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>{r.laws.map((id) => <LawChip small key={id} id={id} />)}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : <Muted>No se han detectado riesgos altos o críticos con los datos actuales.</Muted>}
        </Section>

        <Section title="4 · Discrepancias entre niveles">
          {discrep.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "flex", flexDirection: "column", gap: 7 }}>
              {discrep.slice(0, 8).map((d, i) => (
                <li key={i}><span style={{ fontFamily: mono, color: C.navy, fontWeight: 700 }}>{d.code}</span> — “{d.q}”: <span style={{ color: C.slate }}>{d.detail.map((x) => `${roleShort(x.role)} (${ANSWER_LABEL[x.raw]})`).join(" vs ")}</span></li>
              ))}
            </ul>
          ) : <Muted>No se detectan divergencias significativas entre roles.</Muted>}
        </Section>

        <Section title="5 · Brechas de conocimiento">
          {brechas.length ? (
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {brechas.map((r) => <span key={r.code} style={{ fontSize: 12.5, padding: "5px 10px", borderRadius: 7, background: hexA(C.med, 0.14), border: `1px solid ${hexA(C.med, 0.4)}`, color: "#7A5A16" }}><span style={{ fontFamily: mono, fontWeight: 700 }}>{r.code}</span> · {r.nsCount} “No sé”</span>)}
            </div>
          ) : <Muted>Sin respuestas “No sé” relevantes.</Muted>}
        </Section>

        <Section title="6 · Cobertura normativa">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {LAW_LEVELS.map((lvl) => { const items = coverage.filter((l) => l.level === lvl); if (!items.length) return null; return (
              <div key={lvl}>
                <div style={{ fontSize: 11.5, fontFamily: mono, color: C.slate, marginBottom: 6 }}>{lvl.toUpperCase()}</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {items.map((l) => (
                    <span key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "5px 10px", borderRadius: 7, background: l.covered ? hexA(C.low, 0.12) : C.bg, border: `1px solid ${l.covered ? hexA(C.low, 0.4) : C.line}`, color: l.covered ? "#1F5E43" : C.slate }}>
                      {l.covered ? <Check size={13} /> : <span style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${C.unrated}`, display: "inline-block" }} />}{l.label}
                    </span>
                  ))}
                </div>
              </div>); })}
          </div>
        </Section>
      </Card>
    </div>
  );
}

/* --------------------------- edición P/I --------------------------- */
function PIedit({ value, on, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))}
      style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, padding: "3px 4px", borderRadius: 6, cursor: "pointer", border: `1px solid ${on ? C.navy : C.line}`, background: on ? hexA(C.navy, 0.08) : "#fff", color: C.navy }}>
      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

/* ------------------------------ matriz ------------------------------ */
function HeatMatrix({ rated }) {
  const cell = (p, im) => rated.filter((r) => r.prob === p && r.impact === im);
  return (
    <div style={{ flex: "1 1 380px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "24px repeat(5, 1fr)", gap: 5 }}>
        {[5, 4, 3, 2, 1].map((im) => (
          <React.Fragment key={im}>
            <div style={{ display: "grid", placeItems: "center", fontFamily: mono, fontSize: 12, color: C.slate, fontWeight: 700 }}>{im}</div>
            {[1, 2, 3, 4, 5].map((p) => { const meta = BAND_META[bandOf(p * im)]; const here = cell(p, im); return (
              <div key={p} style={{ minHeight: 54, borderRadius: 8, padding: 5, background: hexA(meta.color, 0.13), border: `1px solid ${hexA(meta.color, 0.3)}`, display: "flex", flexWrap: "wrap", gap: 4, alignContent: "flex-start" }}>
                {here.map((r) => <span key={r.code} title={r.title} style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, padding: "2px 5px", borderRadius: 5, border: `1px solid ${meta.color}`, background: "#fff", color: meta.color }}>{r.code}</span>)}
              </div>); })}
          </React.Fragment>
        ))}
        <div />{[1, 2, 3, 4, 5].map((p) => <div key={p} style={{ display: "grid", placeItems: "center", fontFamily: mono, fontSize: 12, color: C.slate, fontWeight: 700, paddingTop: 3 }}>{p}</div>)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 11, color: C.slate, fontFamily: mono }}>↑ Impacto</span>
        <span style={{ fontSize: 11, color: C.slate, fontFamily: mono }}>Probabilidad →</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        {Object.entries(BAND_META).map(([k, m]) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: C.slate }}><span style={{ width: 10, height: 10, borderRadius: 3, background: m.color }} /> {m.label}</span>)}
      </div>
    </div>
  );
}

/* --------------------------- componentes UI --------------------------- */
function Card({ children, style }) { return <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 22, ...style }}>{children}</div>; }
function H({ children, sub }) { return <div style={{ marginBottom: 16 }}><h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.015em", margin: 0 }}>{children}</h2>{sub && <p style={{ fontSize: 13, color: C.slate, margin: "5px 0 0" }}>{sub}</p>}</div>; }
function Section({ title, children }) { return <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}><div style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, fontFamily: mono, marginBottom: 10, letterSpacing: "0.02em" }}>{title}</div>{children}</div>; }
function PrimaryBtn({ children, onClick, disabled, ghost }) {
  return <button onClick={onClick} disabled={disabled} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", borderRadius: 9, background: ghost ? C.surface : disabled ? C.unrated : C.navy, color: ghost ? C.navy : "#fff", border: ghost ? `1px solid ${C.line}` : "none", fontSize: 13.5, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>;
}
function LawChip({ id, small }) { return <span title={lawLabel(id)} style={{ fontFamily: mono, fontSize: small ? 10 : 11, color: C.navy, background: hexA(C.navy, 0.07), border: `1px solid ${hexA(C.navy, 0.18)}`, borderRadius: 5, padding: small ? "1px 6px" : "2px 7px", whiteSpace: "nowrap" }}>{lawShort(id)}</span>; }
function Metric({ k, v, color }) { return <div><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: color || C.navy, lineHeight: 1 }}>{v}</div><div style={{ fontSize: 11, color: C.slate, marginTop: 3 }}>{k}</div></div>; }
function Muted({ children }) { return <p style={{ margin: 0, fontSize: 13, color: C.slate }}>{children}</p>; }
function Empty({ text }) { return <div style={{ padding: 22, borderRadius: 10, background: C.bg, border: `1px dashed ${C.line}`, color: C.slate, fontSize: 13.5, textAlign: "center" }}>{text}</div>; }
function BackLink({ onClick, label = "Volver" }) { return <button onClick={onClick} style={{ border: "none", background: "transparent", color: C.slate, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14, padding: 0 }}><ArrowLeft size={15} /> {label}</button>; }
function Lbl({ children }) { return <div style={{ fontSize: 12.5, fontWeight: 600, color: C.slate, marginBottom: 6 }}>{children}</div>; }
function Disclaimer() { return <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "11px 14px", borderRadius: 9, background: "#FBF5EC", border: `1px solid #E7D6B8`, color: "#6B5324", fontSize: 12.5 }}><Info size={16} style={{ flexShrink: 0, marginTop: 1 }} /><span>Herramienta de apoyo con resultados <b>orientativos</b>; no es asesoramiento jurídico. En la sala, las entrevistas se guardan en el almacenamiento compartido del espacio y son visibles para quienes usan el código; en producción se añadiría control de acceso por centro. El marco autonómico debe verificarse en cada comunidad.</span></div>; }
const field = { width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 14, fontFamily: sans, color: C.ink, background: "#fff", boxSizing: "border-box" };
function hexA(hex, a) { const h = hex.replace("#", ""); const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; }
