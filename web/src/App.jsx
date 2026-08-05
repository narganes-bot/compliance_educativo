import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Grid3x3, FileText, Plus, Download, AlertTriangle, Check, ChevronRight, Info, Scale,
  Copy, RefreshCw, LogIn, Share2, ArrowLeft, Send, Loader2, Users, Zap, FileDown, Menu, Home as HomeIcon,
  UserPlus, Trash2, Pencil, X
} from "lucide-react";
// Motor de reglas (preguntas, riesgos, cálculo de P/I): fuente única compartida
// con el backend y el generador de Word. NO dupliques aquí ninguna de estas
// definiciones — cualquier cambio se hace en shared/engine/engine.js.
import ENGINE from "../../shared/engine/engine.js";
const {
  LAW_LEVELS, lawShort, lawLabel,
  ROLES, roleLabel, roleShort,
  RISKS, QUESTIONS,
  ANSWER_VALUE, ANSWER_LABEL,
  bandOf, BAND_LABEL,
  computeRisks, computeCoverage,
  CONSULTANT_ROLE,
  rd393Assessment,
  DEFAULT_WEIGHTS, questionInfluence,
  questionMeta,
} = ENGINE;

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

// Comunidades y ciudades autónomas, para poder tener en cuenta la normativa
// autonómica de protección de la infancia y de autoprotección de cada centro.
const CCAA_LIST = [
  "Andalucía", "Aragón", "Principado de Asturias", "Illes Balears", "Canarias",
  "Cantabria", "Castilla-La Mancha", "Castilla y León", "Catalunya", "Extremadura",
  "Galicia", "La Rioja", "Comunidad de Madrid", "Región de Murcia",
  "Comunidad Foral de Navarra", "País Vasco", "Comunitat Valenciana",
  "Ceuta", "Melilla",
];

/* ------------------------------- motor -------------------------------- */
// Todo lo anterior (leyes, roles, preguntas, riesgos, cálculo de P/I) viene
// ahora de shared/engine/engine.js (ver import arriba). Aquí solo quedan
// pequeños derivados de presentación, propios de esta interfaz.
const questionsForRole = (role) => QUESTIONS.filter((q) => q.roles.includes(role));
const ANSWERS = Object.entries(ANSWER_LABEL).map(([v, label]) => ({ v, label }));
const BAND_META = {
  low: { label: BAND_LABEL.low, color: C.low },
  med: { label: BAND_LABEL.med, color: C.med },
  high: { label: BAND_LABEL.high, color: C.high },
  crit: { label: BAND_LABEL.crit, color: C.crit },
};

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
  async updateCenter(code, patch) {
    const room = (await KV.get(metaKey(code))) || {};
    const next = { ...room };
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.ownership !== undefined) next.tipo = patch.ownership;
    if (patch.stages !== undefined) next.etapas = patch.stages || "";
    if (patch.num_students !== undefined) next.alumnos = patch.num_students != null ? String(patch.num_students) : "";
    if (patch.ccaa !== undefined) next.ccaa = patch.ccaa || "";
    if (patch.num_teaching_staff !== undefined) next.docentes = patch.num_teaching_staff != null ? String(patch.num_teaching_staff) : "";
    if (patch.num_non_teaching_staff !== undefined) next.noDocentes = patch.num_non_teaching_staff != null ? String(patch.num_non_teaching_staff) : "";
    if (patch.num_other_people !== undefined) next.otras = patch.num_other_people != null ? String(patch.num_other_people) : "";
    if (patch.height_ge_28m !== undefined) next.altura28 = !!patch.height_ge_28m;
    if (patch.special_evacuation !== undefined) next.evacEspecial = !!patch.special_evacuation;
    await KV.set(metaKey(code), next);
    return { name: next.name, tipo: next.tipo, etapas: next.etapas || "", alumnos: next.alumnos || "",
      ccaa: next.ccaa || "", docentes: next.docentes || "", noDocentes: next.noDocentes || "",
      otras: next.otras || "", altura28: !!next.altura28, evacEspecial: !!next.evacEspecial };
  },
  async listInterviews(code) { const keys = await KV.list(respPrefix(code)); const rows = await Promise.all(keys.map((k) => KV.get(k))); return rows.filter(Boolean); },
  async resetInterviews(code) { const keys = await KV.list(respPrefix(code)); await Promise.all(keys.map((k) => KV.del(k))); },
  async listModels() {
    const keys = await KV.list("c:");
    const metaKeys = keys.filter((k) => k.endsWith(":meta"));
    const rows = await Promise.all(metaKeys.map(async (k) => {
      const room = await KV.get(k); if (!room) return null;
      const ivs = await this.listInterviews(room.code);
      return { code: room.code, status: "open", createdAt: room.createdAt, interviews: ivs.length,
        center: { name: room.name, tipo: room.tipo, etapas: room.etapas || "", alumnos: room.alumnos || "",
          ccaa: room.ccaa || "", docentes: room.docentes || "", noDocentes: room.noDocentes || "",
          otras: room.otras || "", altura28: !!room.altura28, evacEspecial: !!room.evacEspecial } };
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
    async me() {
      const r = await authFetch("/me");
      if (!r.ok) throw new Error("No se pudo obtener el perfil.");
      return r.json();
    },
    async updateUserName(id, display_name) {
      const r = await authFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ display_name }) });
      if (!r.ok) {
        let msg = "No se pudo guardar el nombre.";
        try { const j = await r.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { }
        throw new Error(msg);
      }
      return (await r.json()).user;
    },
    async listUsers() {
      const r = await authFetch("/users");
      if (!r.ok) {
        let msg = "No se pudo cargar la lista de usuarios.";
        try { const j = await r.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { }
        throw new Error(msg);
      }
      return (await r.json()).users;
    },
    async inviteUser(email, display_name) {
      const r = await authFetch("/users", { method: "POST", body: JSON.stringify({ email, display_name }) });
      if (!r.ok) {
        let msg = "No se pudo enviar la invitación.";
        try { const j = await r.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { }
        throw new Error(msg);
      }
      return (await r.json()).user;
    },
    async deleteUser(id) {
      const r = await authFetch(`/users/${id}`, { method: "DELETE" });
      if (!r.ok) {
        let msg = "No se pudo eliminar el usuario.";
        try { const j = await r.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { }
        throw new Error(msg);
      }
    },
    async login(email, password) {
      const r = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!r.ok) throw new Error("Credenciales no válidas.");
      token = (await r.json()).token; return true;
    },
    async requestPasswordReset(email) {
      const r = await fetch(base + "/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!r.ok) {
        let msg = "No se pudo procesar la solicitud.";
        try { const j = await r.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { }
        throw new Error(msg);
      }
    },
    async resetPassword(token, next) {
      const r = await fetch(base + "/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, next }) });
      if (!r.ok) {
        let msg = "No se pudo restablecer la contraseña.";
        try { const j = await r.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { }
        throw new Error(msg);
      }
    },
    async createRoom(center) {
      const cr = await authFetch("/centers", {
        method: "POST", body: JSON.stringify({
          name: center.name, ownership: center.tipo, stages: center.etapas || null,
          num_students: center.alumnos ? parseInt(center.alumnos, 10) : null,
          ccaa: center.ccaa || null,
          num_teaching_staff: center.docentes ? parseInt(center.docentes, 10) : null,
          num_non_teaching_staff: center.noDocentes ? parseInt(center.noDocentes, 10) : null,
          num_other_people: center.otras ? parseInt(center.otras, 10) : null,
          height_ge_28m: !!center.altura28,
          special_evacuation: !!center.evacEspecial,
        })
      });
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
    async updateCenter(code, patch) {
      const r = await authFetch(`/rooms/${code}/center`, { method: "PATCH", body: JSON.stringify(patch) });
      if (!r.ok) throw new Error("No se pudieron guardar los datos del centro.");
      const j = await r.json(); const c = j.center || {};
      return {
        name: c.name, tipo: c.ownership, etapas: c.stages || "",
        alumnos: c.num_students != null ? String(c.num_students) : "",
        ccaa: c.ccaa || "",
        docentes: c.num_teaching_staff != null ? String(c.num_teaching_staff) : "",
        noDocentes: c.num_non_teaching_staff != null ? String(c.num_non_teaching_staff) : "",
        otras: c.num_other_people != null ? String(c.num_other_people) : "",
        altura28: !!c.height_ge_28m,
        evacEspecial: !!c.special_evacuation,
      };
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
        center: {
          name: c.center_name, tipo: c.ownership, etapas: c.stages || "",
          alumnos: c.num_students != null ? String(c.num_students) : "",
          ccaa: c.ccaa || "",
          docentes: c.num_teaching_staff != null ? String(c.num_teaching_staff) : "",
          noDocentes: c.num_non_teaching_staff != null ? String(c.num_non_teaching_staff) : "",
          otras: c.num_other_people != null ? String(c.num_other_people) : "",
          altura28: !!c.height_ge_28m,
          evacEspecial: !!c.special_evacuation,
        },
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
    // Igual que downloadDocument, pero para el modo rápido/demo: no hay sala
    // guardada, así que el centro y las entrevistas viajan enteros en la
    // petición (no requiere sesión). No se guarda nada en el servidor.
    async downloadQuickDocument(center, interviews, overrides) {
      const r = await fetch(base + "/document", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ center, interviews, overrides: overrides || {} }) });
      if (!r.ok) {
        let msg = "No se pudo generar el informe.";
        try { const j = await r.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { }
        throw new Error(msg);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Informe_${((center && center.name) || "centro").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "")}.docx`;
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

function buildWordHTML(center, interviews, overrides = {}, weights = null) {
  const risks = computeRisks(interviews, overrides, center, weights);
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
    <ul style="margin:2px 0 6px">${((r.actions && r.actions.length) ? r.actions.slice(0, 4) : ["Mantener y documentar los controles existentes."]).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
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
function downloadWord(center, interviews, overrides, weights) {
  const html = buildWordHTML(center, interviews, overrides, weights);
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
  // Abre el panel de una sala (tras crearla desde el diagnóstico rápido).
  const openRoom = (cd, ce) => { setCode(cd); setCenter(ce); setView("dashboard"); };
  const [pwOpen, setPwOpen] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const [participantAll, setParticipantAll] = useState(false); // entrar a la entrevista con "responder todas" activado (enlace compartido)
  const [me, setMe] = useState(null);

  // Perfil del usuario autenticado (para saber su rol y su nombre).
  const refreshMe = () => { if (store.mode === "api" && authed) { store.me().then(setMe).catch(() => setMe(null)); } else { setMe(null); } };
  useEffect(refreshMe, [authed]);

  // Si se llega desde el enlace del correo de recuperación (?reset_token=...),
  // abre directamente la pantalla de "nueva contraseña" y limpia la URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("reset_token");
    if (t) {
      setResetToken(t);
      setView("reset");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    // Enlace de entrevista (?entrevista=CÓDIGO): abre directamente la entrevista
    // con el código puesto. Si no se resuelve la sala, cae en "unirse con código".
    const cd = params.get("entrevista");
    if (cd) {
      const codeUp = cd.trim().toUpperCase();
      window.history.replaceState({}, "", window.location.pathname);
      (async () => {
        try {
          const room = await store.getRoom(codeUp);
          if (room) { setCode(codeUp); setCenter(room); setParticipantAll(true); setView("participant"); return; }
        } catch { }
        setView("join");
      })();
    }
  }, []);

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
              ...(canModels ? [{ key: "models", label: "Modelos de prevención", icon: Grid3x3, onClick: () => setView("models") }] : []),
              { key: "home", label: "Inicio", icon: HomeIcon, onClick: () => setView("home") },
              ...(store.mode === "api" && authed && me && me.user && me.user.role === "owner" ? [{ key: "users", label: "Usuarios", icon: Users, onClick: () => setView("users") }] : []),
              ...(store.mode === "api" && authed ? [{ key: "pw", label: "Cambiar contraseña", icon: Scale, onClick: () => setPwOpen(true) }] : []),
              ...(store.mode === "api" && authed ? [{ key: "logout", label: "Cerrar sesión", icon: LogIn, danger: true, onClick: logout }] : []),
            ]} />
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 24px" }}>
        {view === "home" && <Home go={setView} />}
        {view === "create" && (store.mode === "api" && !authed
          ? <Login onOk={() => setAuthed(true)} onBack={() => setView("home")} onForgot={() => setView("forgot")} />
          : <Create onDone={(cd, ce) => { setCode(cd); setCenter(ce); setView("dashboard"); }} onBack={() => setView("home")} />)}
        {view === "join" && <Join onJoined={(cd, ce) => { setCode(cd); setCenter(ce); setParticipantAll(false); setView("participant"); }} onBack={() => setView("home")} />}
        {view === "participant" && <Participant code={code} center={center} defaultAll={participantAll} onBack={() => setView("home")} />}
        {view === "dashboard" && <Dashboard code={code} center={center} onBack={() => setView("home")} />}
        {view === "quick" && <Quick onBack={() => setView("home")} canSaveRoom={canModels} onOpenRoom={openRoom} authed={authed} onAuthed={() => setAuthed(true)} onForgot={() => setView("forgot")} />}
        {view === "demo" && <Demo onBack={() => setView("home")} />}
        {view === "models" && (store.mode === "api" && !authed
          ? <Login onOk={() => setAuthed(true)} onBack={() => setView("home")} onForgot={() => setView("forgot")} />
          : <Models onOpen={(cd, ce) => { setCode(cd); setCenter(ce); setView("dashboard"); }} onBack={() => setView("home")} />)}
        {view === "forgot" && <ForgotPassword onBack={() => setView("home")} />}
        {view === "reset" && <ResetPassword token={resetToken} onDone={() => setView("home")} onBack={() => setView("home")} />}
        {view === "users" && (store.mode === "api" && !authed
          ? <Login onOk={() => setAuthed(true)} onBack={() => setView("home")} onForgot={() => setView("forgot")} />
          : <UsersScreen onBack={() => setView("home")} meId={me && me.user && me.user.id} />)}
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
  const SectionLabel = ({ children }) => <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.slate, marginBottom: 10 }}>{children}</div>;
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Del diagnóstico al modelo de prevención, en una sola herramienta</h1>
        <p style={{ fontSize: 14, color: C.slate, margin: "8px 0 0", maxWidth: 660 }}>
          Recoge las entrevistas del equipo por nivel jerárquico, agrégalas en una matriz de riesgos y genera el modelo con plan a 90 días y descarga del informe en Word.
        </p>
      </div>

      <SectionLabel>Trabajar en un modelo de prevención</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 28 }}>
        <ChoiceCard icon={Grid3x3} title="Continuar un modelo de prevención" primary
          desc="Abre uno de tus modelos guardados para seguir recogiendo entrevistas, ajustar la matriz o descargar el informe."
          cta="Ver modelos de prevención" onClick={() => go("models")} />
        <ChoiceCard icon={Plus} title="Nuevo modelo de prevención"
          desc="Crea la sala de un centro nuevo. Obtendrás un código para compartir con el equipo y el panel del modelo."
          cta="Crear modelo de prevención" onClick={() => go("create")} />
      </div>

      <SectionLabel>Otras opciones</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <MiniCard icon={LogIn} title="Responder con un código" desc="Para el personal del centro: introduce el código y responde tu entrevista." onClick={() => go("join")} />
        <MiniCard icon={Zap} title="Diagnóstico rápido" desc="Comparte el código o el enlace para que una persona del centro educativo responda a distancia." onClick={() => go("quick")} />
        <MiniCard icon={FileText} title="Ver demostración" desc="Un centro ficticio ya relleno, para presentar la herramienta." onClick={() => go("demo")} />
      </div>
    </div>
  );
}
function MiniCard({ icon: Icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} style={{ textAlign: "left", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start", width: "100%" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: C.bg, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={16} color={C.navy} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, display: "flex", alignItems: "center", gap: 5 }}>{title} <ChevronRight size={14} color={C.slate} /></div>
        <div style={{ fontSize: 12, color: C.slate, marginTop: 2 }}>{desc}</div>
      </div>
    </button>
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
function Login({ onOk, onBack, onForgot }) {
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
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <button onClick={onForgot} style={{ border: "none", background: "transparent", color: C.action, fontSize: 12.5, cursor: "pointer", padding: 0 }}>¿Olvidaste tu contraseña?</button>
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}><PrimaryBtn onClick={go} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />} Entrar</PrimaryBtn></div>
      </Card>
    </div>
  );
}

/* ------------------------- Recuperar contraseña ------------------------- */
function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const go = async () => {
    if (!email.trim()) { setErr("Escribe tu correo."); return; }
    setBusy(true); setErr("");
    try { await store.requestPasswordReset(email.trim()); setSent(true); }
    catch (e) { setErr(e.message || "No se pudo procesar la solicitud."); }
    finally { setBusy(false); }
  };
  return (
    <div><BackLink onClick={onBack} />
      <Card style={{ maxWidth: 420 }}>
        <H sub="Te enviaremos un enlace para restablecerla si el correo está registrado.">¿Olvidaste tu contraseña?</H>
        {sent ? (
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: hexA(C.low, 0.12), border: `1px solid ${hexA(C.low, 0.5)}`, borderRadius: 9, padding: "12px 14px" }}>
            <Check size={18} color={C.low} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13.5, color: C.ink }}>Si el correo está registrado, recibirás un enlace en unos minutos. Revisa también la carpeta de spam.</span>
          </div>
        ) : (
          <>
            <label><Lbl>Correo</Lbl><input style={field} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} autoComplete="username" /></label>
            {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.crit, display: "flex", gap: 6, alignItems: "center" }}><AlertTriangle size={14} /> {err}</div>}
            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
              <PrimaryBtn onClick={go} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : null} {busy ? "Enviando…" : "Enviar enlace"}</PrimaryBtn>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* -------------------------- Restablecer contraseña -------------------------- */
function ResetPassword({ token, onDone, onBack }) {
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const go = async () => {
    setErr("");
    if (!token) { setErr("El enlace no es válido. Solicita uno nuevo desde \"¿Olvidaste tu contraseña?\"."); return; }
    if (next.length < 8) { setErr("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (next !== repeat) { setErr("Las dos contraseñas no coinciden."); return; }
    setBusy(true);
    try { await store.resetPassword(token, next); setOk(true); }
    catch (e) { setErr(e.message || "No se pudo restablecer la contraseña."); }
    finally { setBusy(false); }
  };
  return (
    <div><BackLink onClick={onBack} />
      <Card style={{ maxWidth: 420 }}>
        <H sub="Escribe tu nueva contraseña (mínimo 8 caracteres).">Nueva contraseña</H>
        {ok ? (
          <div>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: hexA(C.low, 0.12), border: `1px solid ${hexA(C.low, 0.5)}`, borderRadius: 9, padding: "12px 14px", marginBottom: 16 }}>
              <Check size={18} color={C.low} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13.5, color: C.ink }}>Contraseña actualizada. Ya puedes iniciar sesión con ella.</span>
            </div>
            <div style={{ textAlign: "right" }}><PrimaryBtn onClick={onDone}>Ir a inicio</PrimaryBtn></div>
          </div>
        ) : (
          <>
            <label><Lbl>Nueva contraseña</Lbl><input type="password" style={field} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></label>
            <div style={{ height: 12 }} />
            <label><Lbl>Repite la nueva contraseña</Lbl><input type="password" style={field} value={repeat} onChange={(e) => setRepeat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} autoComplete="new-password" /></label>
            {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.crit, display: "flex", gap: 6, alignItems: "center" }}><AlertTriangle size={14} /> {err}</div>}
            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
              <PrimaryBtn onClick={go} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : null} {busy ? "Guardando…" : "Guardar"}</PrimaryBtn>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* --------------------------- Usuarios de la consultora --------------------------- */
function UsersScreen({ onBack, meId }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [delBusy, setDelBusy] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const startEdit = (u) => { setEditingId(u.id); setEditValue(u.display_name || ""); setErr(""); };
  const cancelEdit = () => { setEditingId(null); setEditValue(""); };
  const saveEdit = async (id) => {
    if (!editValue.trim()) { setErr("El nombre no puede estar vacío."); return; }
    setEditBusy(true); setErr("");
    try { await store.updateUserName(id, editValue.trim()); setEditingId(null); await load(); }
    catch (e) { setErr(e.message || "No se pudo guardar el nombre."); }
    finally { setEditBusy(false); }
  };

  const load = async () => { setErr(""); try { setList(await store.listUsers()); } catch (e) { setErr(e.message || "No se pudo cargar la lista de usuarios."); } };
  useEffect(() => { load(); }, []);

  const invite = async () => {
    setErr(""); setInviteMsg("");
    if (!email.trim()) { setErr("Escribe el correo de la persona a invitar."); return; }
    setBusy(true);
    try {
      await store.inviteUser(email.trim(), name.trim());
      setInviteMsg("Invitación enviada. Recibirá un correo para crear su contraseña.");
      setEmail(""); setName(""); await load();
    } catch (e) { setErr(e.message || "No se pudo enviar la invitación."); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar el acceso de este usuario? No podrá volver a iniciar sesión.")) return;
    setDelBusy(id); setErr("");
    try { await store.deleteUser(id); await load(); }
    catch (e) { setErr(e.message || "No se pudo eliminar el usuario."); }
    finally { setDelBusy(null); }
  };

  return (
    <div><BackLink onClick={onBack} />
      <Card style={{ marginBottom: 18 }}>
        <H sub="Invita a otra persona de tu consultora. Recibirá un correo para crear su propia contraseña; no la eliges tú.">Invitar a un usuario</H>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 220px" }}><Lbl>Correo</Lbl><input style={field} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></label>
          <label style={{ flex: "1 1 220px" }}><Lbl>Nombre (opcional)</Lbl><input style={field} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && invite()} autoComplete="off" /></label>
        </div>
        {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.crit, display: "flex", gap: 6, alignItems: "center" }}><AlertTriangle size={14} /> {err}</div>}
        {inviteMsg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.low, display: "flex", gap: 6, alignItems: "center" }}><Check size={14} /> {inviteMsg}</div>}
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <PrimaryBtn onClick={invite} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />} {busy ? "Enviando…" : "Invitar"}</PrimaryBtn>
        </div>
      </Card>

      <Card>
        <H>Usuarios de la consultora</H>
        {!list ? (
          <div style={{ fontSize: 13, color: C.slate }}>Cargando…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((u) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === u.id ? (
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus autoComplete="off"
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(u.id); if (e.key === "Escape") cancelEdit(); }}
                      style={{ width: "100%", boxSizing: "border-box", padding: "6px 9px", borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 13.5, fontWeight: 700 }} />
                  ) : (
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{u.display_name || u.email}</div>
                  )}
                  <div style={{ fontSize: 12, color: C.slate, marginTop: 2 }}>{u.email} · {u.role === "owner" ? "Propietario/a" : "Consultor/a"}</div>
                </div>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  {editingId === u.id ? (
                    <>
                      <button onClick={() => saveEdit(u.id)} disabled={editBusy} title="Guardar nombre"
                        style={{ border: "none", background: "transparent", color: C.low, cursor: "pointer", padding: 6, display: "grid", placeItems: "center" }}>
                        {editBusy ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                      </button>
                      <button onClick={cancelEdit} disabled={editBusy} title="Cancelar"
                        style={{ border: "none", background: "transparent", color: C.slate, cursor: "pointer", padding: 6, display: "grid", placeItems: "center" }}>
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(u)} title="Editar nombre"
                      style={{ border: "none", background: "transparent", color: C.action, cursor: "pointer", padding: 6, display: "grid", placeItems: "center" }}>
                      <Pencil size={16} />
                    </button>
                  )}
                  {u.id !== meId && (
                    <button onClick={() => remove(u.id)} disabled={delBusy === u.id} title="Eliminar acceso"
                      style={{ border: "none", background: "transparent", color: C.crit, cursor: "pointer", padding: 6, display: "grid", placeItems: "center" }}>
                      {delBusy === u.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!list.length && <div style={{ fontSize: 13, color: C.slate }}>No hay usuarios.</div>}
          </div>
        )}
      </Card>
    </div>
  );
}
function Create({ onDone, onBack }) {
  const [form, setForm] = useState({ name: "", tipo: "concertada", etapas: "", alumnos: "", ccaa: "", docentes: "", noDocentes: "", otras: "", altura28: false, evacEspecial: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
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
// Traduce el estado local del formulario (nombres "de pantalla": alumnos,
// docentes, noDocentes, otras, altura28) al formato que espera rd393Assessment.
function rd393FromForm(form) {
  return rd393Assessment({
    num_students: form.alumnos, num_teaching_staff: form.docentes,
    num_non_teaching_staff: form.noDocentes, num_other_people: form.otras,
    height_ge_28m: form.altura28,
    special_evacuation: form.evacEspecial,
  });
}

function RD393Banner({ form }) {
  const a = rd393FromForm(form);
  if (!a.applies) return (
    <div style={{ marginTop: 4, fontSize: 12, color: C.slate }}>
      Ocupación total estimada: <b style={{ fontFamily: mono }}>{a.occupancy}</b> persona(s). No se alcanzan los umbrales del RD 393/2007 con los datos actuales.
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, background: hexA(C.med, 0.14), border: `1px solid ${hexA(C.med, 0.4)}`, color: "#7A5A16", fontSize: 12.5 }}>
      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>Con estos datos, el centro entra dentro del <b>RD 393/2007 (Norma Básica de Autoprotección)</b>: {a.reasons.join(" y ")}.</span>
    </div>
  );
}

function CenterFields({ form, set }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <label style={{ gridColumn: "1 / -1" }}><Lbl>Nombre del centro</Lbl><input style={field} value={form.name} onChange={set("name")} placeholder="p. ej. Colegio San…" /></label>
      <label><Lbl>Titularidad</Lbl><select style={field} value={form.tipo} onChange={set("tipo")}><option value="publica">Pública</option><option value="concertada">Concertada</option><option value="privada">Privada</option></select></label>
      <label><Lbl>Comunidad autónoma</Lbl>
        <select style={field} value={form.ccaa || ""} onChange={set("ccaa")}>
          <option value="">— Sin especificar —</option>
          {CCAA_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label style={{ gridColumn: "1 / -1" }}><Lbl>Etapas educativas</Lbl><input style={field} value={form.etapas} onChange={set("etapas")} placeholder="Infantil, Primaria, ESO…" /></label>

      <div style={{ gridColumn: "1 / -1", marginTop: 4, fontSize: 12.5, fontWeight: 700, color: C.navy, fontFamily: mono, letterSpacing: "0.02em" }}>OCUPACIÓN Y ALTURA (RD 393/2007)</div>
      <label><Lbl>Nº de alumnado</Lbl><input style={field} value={form.alumnos} onChange={set("alumnos")} placeholder="p. ej. 620" inputMode="numeric" /></label>
      <label><Lbl>Nº de personal docente</Lbl><input style={field} value={form.docentes || ""} onChange={set("docentes")} placeholder="p. ej. 55" inputMode="numeric" /></label>
      <label><Lbl>Nº de personal no docente</Lbl><input style={field} value={form.noDocentes || ""} onChange={set("noDocentes")} placeholder="p. ej. 20" inputMode="numeric" /></label>
      <label><Lbl>Otras personas habituales</Lbl><input style={field} value={form.otras || ""} onChange={set("otras")} placeholder="p. ej. 10" inputMode="numeric" /></label>
      <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input type="checkbox" checked={!!form.altura28} onChange={set("altura28")} style={{ width: 16, height: 16 }} />
        <span style={{ fontSize: 13 }}>La altura de evacuación del centro es igual o superior a 28 m (aprox. 10 plantas)</span>
      </label>
      <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input type="checkbox" checked={!!form.evacEspecial} onChange={set("evacEspecial")} style={{ width: 16, height: 16 }} />
        <span style={{ fontSize: 13 }}>Centro especialmente destinado a personas con discapacidad física o psíquica o que no pueden realizar una evacuación por sus propios medios (Anexo I.e — aplica sin umbral)</span>
      </label>
      <div style={{ gridColumn: "1 / -1" }}><RD393Banner form={form} /></div>
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

/* --------- Encabezado de pregunta: número (q1…), texto y ayuda --------- */
// La ayuda explica qué comprueba la pregunta, el riesgo asociado y la norma.
function QuestionHead({ q }) {
  const [open, setOpen] = useState(false);
  const m = questionMeta ? questionMeta(q.id) : null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: C.action, marginTop: 2, whiteSpace: "nowrap" }}>{q.id}</span>
        <span style={{ fontSize: 13.5, fontWeight: 500, flex: 1 }}>{q.q}</span>
        <button onClick={() => setOpen((o) => !o)} title="Ayuda: qué comprueba, riesgo asociado y norma"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: open ? C.action : C.slate, display: "inline-flex", flexShrink: 0, marginTop: 1, padding: 0 }}>
          <Info size={15} />
        </button>
      </div>
      {open && m && (
        <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: hexA(C.action, 0.06), border: `1px solid ${hexA(C.action, 0.25)}`, fontSize: 12, color: C.ink, lineHeight: 1.5 }}>
          <div style={{ marginBottom: 4 }}><b>Propósito.</b> {m.purpose}</div>
          <div style={{ marginBottom: 4 }}><b>Responsable del cumplimiento:</b> {m.responsible || "—"}</div>
          <div style={{ marginBottom: 4 }}><b>Riesgo asociado:</b> {m.risks.map((r) => `${r.code} — ${r.title}`).join(" · ")}</div>
          <div><b>Se regula en:</b> {m.norms || (m.laws.length ? m.laws.map((l) => l.label).join(", ") : "Buena práctica de gestión (sin norma específica)")}</div>
        </div>
      )}
    </div>
  );
}

/* Botón de ayuda con popover (para filas compactas, p. ej. editor de pesos). */
function QHelpInline({ qid }) {
  const [open, setOpen] = useState(false);
  const m = questionMeta ? questionMeta(qid) : null;
  if (!m) return null;
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button onClick={() => setOpen((o) => !o)} title="Ayuda: qué comprueba, riesgo asociado y norma"
        style={{ border: "none", background: "transparent", cursor: "pointer", color: open ? C.action : C.slate, display: "inline-flex", padding: 0, marginLeft: 4 }}>
        <Info size={14} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "130%", right: 0, zIndex: 20, width: 340, maxWidth: "80vw", padding: "10px 12px", borderRadius: 8, background: "#fff", border: `1px solid ${hexA(C.action, 0.4)}`, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", fontSize: 12, color: C.ink, lineHeight: 1.5, textAlign: "left", fontWeight: 400, whiteSpace: "normal" }}>
          <div style={{ marginBottom: 4 }}><b>Propósito.</b> {m.purpose}</div>
          <div style={{ marginBottom: 4 }}><b>Responsable del cumplimiento:</b> {m.responsible || "—"}</div>
          <div style={{ marginBottom: 4 }}><b>Riesgo asociado:</b> {m.risks.map((r) => `${r.code} — ${r.title}`).join(" · ")}</div>
          <div><b>Se regula en:</b> {m.norms || (m.laws.length ? m.laws.map((l) => l.label).join(", ") : "Buena práctica de gestión (sin norma específica)")}</div>
        </div>
      )}
    </span>
  );
}

/* ------------------------- InterviewForm (compartido) ------------------------- */
function InterviewForm({ onSubmit, submitLabel = "Enviar entrevista", submitIcon = Send, initial = null, allowAll = false, draftKey = null, defaultAll = false }) {
  const isConsultantEdit = !!(initial && initial.role === CONSULTANT_ROLE);
  // Borrador guardado en este navegador (si draftKey está definido y no es edición).
  const draft0 = (draftKey && !initial && typeof window !== "undefined")
    ? (() => { try { return JSON.parse(window.localStorage.getItem(draftKey) || "null"); } catch { return null; } })()
    : null;
  const [role, setRole] = useState((initial && initial.role) || (draft0 && draft0.role) || "profesorado");
  const [name, setName] = useState((initial && (initial.name || initial.alias)) || (draft0 && draft0.name) || "");
  const [answers, setAnswers] = useState((initial && initial.answers) || (draft0 && draft0.answers) || {});
  const [comments, setComments] = useState((initial && initial.comments) || (draft0 && draft0.comments) || {});
  const [allQuestions, setAllQuestions] = useState(draft0 ? !!draft0.allQuestions : !!defaultAll); // responder todas (no solo las del rol)
  const [draftMsg, setDraftMsg] = useState(draft0 ? "Hemos recuperado tu borrador guardado en este navegador." : "");
  const [busy, setBusy] = useState(false);
  // Autoguardado del borrador en cada cambio (solo si hay draftKey).
  useEffect(() => {
    if (!draftKey || initial || typeof window === "undefined") return;
    try { window.localStorage.setItem(draftKey, JSON.stringify({ role, name, answers, comments, allQuestions })); } catch { }
  }, [draftKey, initial, role, name, answers, comments, allQuestions]);
  const saveDraft = () => {
    if (!draftKey || typeof window === "undefined") return;
    try { window.localStorage.setItem(draftKey, JSON.stringify({ role, name, answers, comments, allQuestions })); setDraftMsg("Borrador guardado. Puedes cerrar y continuar más tarde en este mismo dispositivo."); } catch { }
  };
  const qs = isConsultantEdit
    ? QUESTIONS.filter((q) => (initial.answers || {})[q.id] !== undefined)
    : (allowAll && allQuestions ? QUESTIONS : questionsForRole(role));
  const answered = Object.keys(answers).length;
  const Icon = submitIcon;
  // Pase lo que pase (error del servidor, red caída, servidor "dormido"), el
  // botón deja de girar y se muestra el motivo: el finally garantiza setBusy(false).
  const go = async () => {
    setBusy(true);
    try {
      await onSubmit({ id: (initial && initial.id) || genId(), role, name: name.trim(), answers, comments });
      if (draftKey && typeof window !== "undefined") { try { window.localStorage.removeItem(draftKey); } catch { } }
      if (!initial) { setAnswers({}); setName(""); setComments({}); }
    } catch (e) {
      alert((e && e.message) || "No se pudo guardar. Comprueba la conexión e inténtalo de nuevo en unos segundos.");
    } finally { setBusy(false); }
  };
  const setAns = (qid, v) => setAnswers((prev) => { const n = { ...prev }; if (n[qid] === v) delete n[qid]; else n[qid] = v; return n; });
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 10 }}>
        {isConsultantEdit
          ? <label><Lbl>Origen</Lbl><div style={{ ...field, display: "flex", alignItems: "center", color: C.action, fontWeight: 600 }}>Respuesta del consultor (relleno)</div></label>
          : <label><Lbl>Nivel jerárquico</Lbl><select style={field} value={role} onChange={(e) => { setRole(e.target.value); setAnswers({}); setComments({}); }}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}
        <label><Lbl>Nombre o iniciales (opcional)</Lbl><input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. M. L." /></label>
      </div>
      {allowAll && !isConsultantEdit && (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer", padding: "9px 11px", borderRadius: 8, border: `1px solid ${allQuestions ? hexA(C.action, 0.5) : C.line}`, background: allQuestions ? hexA(C.action, 0.06) : "#fff", marginBottom: 10 }}>
          <input type="checkbox" checked={allQuestions} onChange={(e) => setAllQuestions(e.target.checked)} style={{ width: 16, height: 16, marginTop: 1 }} />
          <span style={{ fontSize: 12.5, color: C.ink }}>Responder <b>todas las preguntas</b> (no solo las de este rol). Útil para una primera aproximación contestada por una sola persona; cuantas más responda, mejor.</span>
        </label>
      )}
      <div style={{ margin: "6px 0", fontSize: 12, color: C.slate, fontFamily: mono }}>{answered}/{qs.length} respondidas</div>
      <div style={{ fontSize: 11.5, color: C.slate, marginBottom: 8 }}>Puedes cambiar cualquier respuesta; pulsa de nuevo la opción marcada para dejarla en blanco. En «Parcial» y «No sé» puedes añadir un comentario.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {qs.map((q) => { const showComment = answers[q.id] === "parcial" || answers[q.id] === "ns"; return (
          <div key={q.id} style={{ padding: "12px 14px", borderRadius: 9, border: `1px solid ${C.line}`, background: C.bg }}>
            <QuestionHead q={q} />
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
      {draftMsg && <div style={{ marginTop: 12, fontSize: 12, color: C.low, display: "flex", gap: 6, alignItems: "center" }}><Check size={14} /> {draftMsg}</div>}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        {draftKey && !initial && <PrimaryBtn onClick={saveDraft} ghost disabled={busy || answered === 0}><FileDown size={16} /> Guardar borrador</PrimaryBtn>}
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
  // Mismo tratamiento de errores que en InterviewForm: el spinner nunca se queda colgado.
  const go = async () => {
    setBusy(true);
    try {
      await onSubmit({ id: genId(), role: CONSULTANT_ROLE, name: "Consultor", answers, comments });
      setAnswers({}); setComments({});
    } catch (e) {
      alert((e && e.message) || "No se pudo guardar. Comprueba la conexión e inténtalo de nuevo en unos segundos.");
    } finally { setBusy(false); }
  };
  if (!gaps.length) return <Empty text="No hay huecos: todas las preguntas tienen ya al menos una respuesta." />;
  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.slate, marginBottom: 10 }}>Hay {gaps.length} pregunta(s) que nadie ha respondido. Responde las que puedas con tu criterio; quedarán registradas como respuesta del consultor.</div>
      <div style={{ margin: "6px 0", fontSize: 12, color: C.slate, fontFamily: mono }}>{answered}/{gaps.length} respondidas</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {gaps.map((q) => { const showComment = answers[q.id] === "parcial" || answers[q.id] === "ns"; return (
          <div key={q.id} style={{ padding: "12px 14px", borderRadius: 9, border: `1px solid ${C.line}`, background: C.bg }}>
            <QuestionHead q={q} />
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
function Participant({ code, center, onBack, defaultAll = false }) {
  const [done, setDone] = useState(false);
  const submit = async (iv) => { await store.submitInterview(code, iv); setDone(true); };
  if (done) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: C.low, display: "grid", placeItems: "center" }}><Check size={22} color="#fff" /></div>
          <div><div style={{ fontSize: 17, fontWeight: 700 }}>Entrevista enviada</div><div style={{ fontSize: 13, color: C.slate }}>Gracias. Tus respuestas han llegado al consultor, que elaborará el informe del centro. El borrador guardado en este navegador se ha eliminado.</div></div>
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
        <H sub={`Centro: ${center?.name || "—"} · código ${code}`}>Tu entrevista</H>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, background: hexA(C.action, 0.06), border: `1px solid ${hexA(C.action, 0.25)}`, color: C.ink, fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: C.action }} />
          <span>Responde con tranquilidad. Puedes <b>guardar el borrador</b> y continuar más tarde en este mismo dispositivo, y cuando termines pulsar <b>«Enviar al consultor»</b>. En cada pregunta tienes un icono de ayuda (ℹ) con su propósito, el riesgo asociado y la norma. El informe lo elaborará el consultor; tú no necesitas verlo.</span>
        </div>
        <InterviewForm allowAll defaultAll={defaultAll} draftKey={`forentia_draft_${code}`} onSubmit={submit} submitLabel="Enviar al consultor" submitIcon={Send} />
      </Card>
    </div>
  );
}

/* ------------------------------ Quick ------------------------------ */
function Quick({ onBack, canSaveRoom = false, onOpenRoom, authed = false, onAuthed, onForgot }) {
  const [step, setStep] = useState("center");
  const [center, setCenter] = useState({ name: "", tipo: "concertada", etapas: "", alumnos: "", ccaa: "", docentes: "", noDocentes: "", otras: "", altura28: false, evacEspecial: false });
  const [interviews, setInterviews] = useState([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);         // { code } tras crear la sala para compartir
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const needsLogin = store.mode === "api" && !authed; // hay que iniciar sesión para crear la sala
  const set = (k) => (e) => setCenter({ ...center, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  // Crea la sala (para poder compartir código/enlace) y vuelca las entrevistas
  // que ya se hayan añadido. El enlace exige una sala guardada en el servidor.
  const doShare = async () => {
    setSaving(true);
    try {
      const { code: cd } = await store.createRoom(center);
      for (const iv of interviews) { try { await store.submitInterview(cd, iv); } catch { } }
      setSaved({ code: cd });
    } catch (e) { alert((e && e.message) || "No se pudo crear la sala para compartir."); }
    finally { setSaving(false); }
  };
  const shareLink = saved ? `${window.location.origin}${window.location.pathname}?entrevista=${saved.code}` : "";
  const copyText = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "link") { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800); }
      else { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1800); }
    } catch { }
  };
  const clickShare = () => { if (needsLogin) setShowLogin(true); else doShare(); };
  const ShareBtn = () => (!saved)
    ? <PrimaryBtn onClick={clickShare} ghost disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : <Share2 size={16} />} Crear enlace para compartir</PrimaryBtn>
    : null;
  // Panel con código y enlace para compartir, una vez creada la sala.
  const SharedPanel = () => saved ? (
    <Card style={{ marginBottom: 16, border: `1px solid ${hexA(C.action, 0.5)}` }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Check size={17} color={C.low} /> Listo para compartir</div>
      <div style={{ fontSize: 12.5, color: C.slate, marginBottom: 12 }}>Envía el enlace (o el código) a la persona del centro para que responda a distancia. Cuando lo envíe, sus respuestas aparecerán en el panel de la sala, donde podrás generar el informe.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: C.slate, fontFamily: mono }}>CÓDIGO</span>
        <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, letterSpacing: "0.12em", color: C.navy }}>{saved.code}</span>
        <button onClick={() => copyText(saved.code, "code")} style={{ border: `1px solid ${C.line}`, background: C.surface, borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: codeCopied ? C.low : C.navy, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>{codeCopied ? <Check size={13} /> : <Copy size={13} />} {codeCopied ? "Copiado" : "Copiar código"}</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input readOnly value={shareLink} onFocus={(e) => e.target.select()} style={{ flex: "1 1 320px", minWidth: 220, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, fontFamily: mono, background: C.bg }} />
        <PrimaryBtn onClick={() => copyText(shareLink, "link")}>{linkCopied ? <Check size={16} /> : <Share2 size={16} />} {linkCopied ? "Enlace copiado" : "Copiar enlace"}</PrimaryBtn>
        <PrimaryBtn ghost onClick={() => onOpenRoom && onOpenRoom(saved.code, center)}><ChevronRight size={16} /> Abrir panel de la sala</PrimaryBtn>
      </div>
    </Card>
  ) : null;

  // Si hace falta iniciar sesión para crear el enlace, mostramos el login;
  // al entrar, se crea la sala y el enlace automáticamente.
  if (showLogin) {
    return <Login
      onOk={() => { setShowLogin(false); if (onAuthed) onAuthed(); doShare(); }}
      onBack={() => setShowLogin(false)}
      onForgot={() => { setShowLogin(false); onForgot && onForgot(); }} />;
  }

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
        <SharedPanel />
        <Card style={{ marginBottom: 16 }}>
          <H sub="Añade una entrevista por cada persona o carga un ejemplo. Cuando tengas suficientes, genera el modelo.">Entrevistas — {center.name}</H>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, background: hexA(C.med, 0.14), border: `1px solid ${hexA(C.med, 0.4)}`, color: "#7A5A16", fontSize: 12.5, marginBottom: 12, lineHeight: 1.5 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Puedes pedir a una sola persona (p. ej. la dirección) que responda, activando «Responder todas las preguntas» al añadir la entrevista. Es una <b>primera aproximación</b> al nivel de cumplimiento: al no participar todos los niveles, es menos fiable y no detecta discrepancias entre roles. Para un diagnóstico sólido, recoge una entrevista por cada rol.</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <PrimaryBtn onClick={() => setAdding(true)} ghost><Plus size={16} /> Nueva entrevista</PrimaryBtn>
            <PrimaryBtn onClick={() => setInterviews(SEED())} ghost><Users size={16} /> Cargar ejemplo</PrimaryBtn>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ShareBtn />
              {interviews.length > 0 && <PrimaryBtn onClick={() => setStep("results")}>Ver modelo <ChevronRight size={16} /></PrimaryBtn>}
            </div>
          </div>
          {!saved && <div style={{ marginTop: 10, fontSize: 11.5, color: C.slate, lineHeight: 1.5 }}>Para que una persona del centro lo complete a distancia, pulsa «Crear enlace para compartir»: obtendrás un código y un enlace para enviarle (si no has iniciado sesión, te lo pedirá primero). Puedes hacerlo con el diagnóstico vacío —que lo rellene él entero— o con lo que ya hayas añadido. Se guarda como sala.</div>}
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
            <InterviewForm allowAll submitLabel="Guardar entrevista" submitIcon={Check} onSubmit={async (iv) => { setInterviews((p) => [...p, iv]); setAdding(false); }} />
            <div style={{ marginTop: 10 }}><button onClick={() => setAdding(false)} style={{ border: "none", background: "transparent", color: C.slate, fontSize: 12.5, cursor: "pointer" }}>Cancelar</button></div>
          </Card>
        )}
      </div>
    );
  }
  return (
    <div><BackLink onClick={() => setStep("collect")} label="Volver a entrevistas" />
      <SharedPanel />
      {!saved && interviews.length > 0 && (
        <Card style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: C.slate, display: "flex", gap: 8, alignItems: "center" }}><Share2 size={14} /> ¿Quieres que una persona del centro lo complete a distancia, o conservar este diagnóstico? Crea el enlace para compartir (se guarda como sala).</span>
          <ShareBtn />
        </Card>
      )}
      <Results center={center} interviews={interviews} serverDoc={store.mode === "api" ? () => store.downloadQuickDocument(center, interviews, {}) : null} />
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
        <H sub="Tus centros y modelos guardados. Ábrelos para seguir trabajando o elimínalos.">Modelos de prevención</H>
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
      <Results center={center} interviews={interviews} serverDoc={store.mode === "api" ? () => store.downloadQuickDocument(center, interviews, {}) : null} />
    </div>
  );
}

/* ---------------------------- Dashboard ---------------------------- */
/* ------------------------ Editar datos del centro ------------------------ */
function CenterEditForm({ center, onSave, onCancel }) {
  const [name, setName] = useState((center && center.name) || "");
  const [tipo, setTipo] = useState((center && center.tipo) || "concertada");
  const [alumnos, setAlumnos] = useState((center && center.alumnos) || "");
  const [etapas, setEtapas] = useState((center && center.etapas) || "");
  const [ccaa, setCcaa] = useState((center && center.ccaa) || "");
  const [docentes, setDocentes] = useState((center && center.docentes) || "");
  const [noDocentes, setNoDocentes] = useState((center && center.noDocentes) || "");
  const [otras, setOtras] = useState((center && center.otras) || "");
  const [altura28, setAltura28] = useState(!!(center && center.altura28));
  const [evacEspecial, setEvacEspecial] = useState(!!(center && center.evacEspecial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    if (!name.trim()) { setErr("El nombre del centro es obligatorio."); return; }
    setBusy(true); setErr("");
    try {
      await onSave({
        name: name.trim(), ownership: tipo, stages: etapas.trim() || null,
        num_students: alumnos ? parseInt(alumnos, 10) : null,
        ccaa: ccaa || null,
        num_teaching_staff: docentes ? parseInt(docentes, 10) : null,
        num_non_teaching_staff: noDocentes ? parseInt(noDocentes, 10) : null,
        num_other_people: otras ? parseInt(otras, 10) : null,
        height_ge_28m: altura28,
        special_evacuation: evacEspecial,
      });
    }
    catch (e) { setErr(e.message || "No se pudieron guardar los datos."); setBusy(false); }
  };
  return (
    <div style={{ marginTop: 14, padding: 16, borderRadius: 10, border: `1px solid ${C.action}`, background: C.bg }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Editar datos del centro</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ gridColumn: "1 / -1" }}><Lbl>Nombre del centro</Lbl><input style={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label><Lbl>Titularidad</Lbl><select style={field} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="publica">Pública</option><option value="concertada">Concertada</option><option value="privada">Privada</option></select></label>
        <label><Lbl>Comunidad autónoma</Lbl>
          <select style={field} value={ccaa} onChange={(e) => setCcaa(e.target.value)}>
            <option value="">— Sin especificar —</option>
            {CCAA_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={{ gridColumn: "1 / -1" }}><Lbl>Etapas educativas</Lbl><input style={field} value={etapas} onChange={(e) => setEtapas(e.target.value)} placeholder="Infantil, Primaria, ESO…" /></label>

        <div style={{ gridColumn: "1 / -1", marginTop: 2, fontSize: 12, fontWeight: 700, color: C.navy, fontFamily: mono, letterSpacing: "0.02em" }}>OCUPACIÓN Y ALTURA (RD 393/2007)</div>
        <label><Lbl>Nº de alumnado</Lbl><input style={field} value={alumnos} onChange={(e) => setAlumnos(e.target.value.replace(/[^0-9]/g, ""))} placeholder="p. ej. 620" /></label>
        <label><Lbl>Nº de personal docente</Lbl><input style={field} value={docentes} onChange={(e) => setDocentes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="p. ej. 55" /></label>
        <label><Lbl>Nº de personal no docente</Lbl><input style={field} value={noDocentes} onChange={(e) => setNoDocentes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="p. ej. 20" /></label>
        <label><Lbl>Otras personas habituales</Lbl><input style={field} value={otras} onChange={(e) => setOtras(e.target.value.replace(/[^0-9]/g, ""))} placeholder="p. ej. 10" /></label>
        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
          <input type="checkbox" checked={altura28} onChange={(e) => setAltura28(e.target.checked)} style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 13 }}>La altura de evacuación del centro es igual o superior a 28 m (aprox. 10 plantas)</span>
        </label>
        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
          <input type="checkbox" checked={evacEspecial} onChange={(e) => setEvacEspecial(e.target.checked)} style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 13 }}>Centro especialmente destinado a personas con discapacidad física o psíquica o que no pueden realizar una evacuación por sus propios medios (Anexo I.e — aplica sin umbral)</span>
        </label>
        <div style={{ gridColumn: "1 / -1" }}><RD393Banner form={{ alumnos, docentes, noDocentes, otras, altura28, evacEspecial }} /></div>
      </div>
      {err && <div style={{ fontSize: 12.5, color: C.crit, marginTop: 8 }}>{err}</div>}
      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <PrimaryBtn onClick={onCancel} ghost>Cancelar</PrimaryBtn>
        <PrimaryBtn onClick={go} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Guardar datos</PrimaryBtn>
      </div>
    </div>
  );
}

function Dashboard({ code, center: centerProp, onBack }) {
  const [center, setCenter] = useState(centerProp);
  const [editingCenter, setEditingCenter] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const [copied, setCopied] = useState(false);
  const [interviewing, setInterviewing] = useState(false);
  const [filling, setFilling] = useState(false);
  const [editing, setEditing] = useState(null);
  const editRef = useRef(null);
  useEffect(() => { if (editing && editRef.current) editRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }, [editing]);
  const [overrides, setOverrides] = useState({});
  const [weights, setWeights] = useState(null);          // null = predeterminado del motor
  const [editingWeights, setEditingWeights] = useState(false);
  const timer = useRef(null);
  const load = useCallback(async () => {
    try { setInterviews(await store.listInterviews(code)); } catch { /* mantener lo anterior */ }
    setLoading(false);
  }, [code]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!auto) { if (timer.current) clearInterval(timer.current); return; } timer.current = setInterval(load, 9000); return () => timer.current && clearInterval(timer.current); }, [auto, load]);
  // Carga los ajustes manuales guardados (P/I y pesos) al abrir el modelo.
  useEffect(() => { let ok = true; (async () => { try { const st = await store.getModelState(code); if (ok) { setOverrides((st && st.overrides) || {}); setWeights((st && st.weights) || null); } } catch { } })(); return () => { ok = false; }; }, [code]);

  // Guarda estado completo (P/I + pesos) de forma conjunta.
  const persistState = (nextOverrides, nextWeights) => {
    const payload = { overrides: nextOverrides };
    if (nextWeights) payload.weights = nextWeights;
    store.saveModelState(code, payload).catch(() => { });
  };
  const persistOverrides = (next) => { setOverrides(next); persistState(next, weights); };
  const persistWeights = (next) => { setWeights(next); persistState(overrides, next); };
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
  const risks = computeRisks(interviews, overrides, center, weights);
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
            <button onClick={() => setEditingCenter((v) => !v)} style={{ marginTop: 6, border: "none", background: "transparent", color: C.action, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><RefreshCw size={12} /> {editingCenter ? "Cerrar edición" : "Editar datos del centro"}</button>
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
        {editingCenter && <CenterEditForm center={center} onCancel={() => setEditingCenter(false)}
          onSave={async (patch) => { const updated = await store.updateCenter(code, patch); setCenter(updated); setEditingCenter(false); }} />}
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
        <div ref={editRef}>
          <Card style={{ marginBottom: 16, borderColor: C.action }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Editar entrevista · {editing.alias || editing.name || "(sin alias)"} — {roleLbl(editing.role)}</div>
              <button onClick={() => setEditing(null)} style={{ border: "none", background: "transparent", color: C.slate, cursor: "pointer", fontSize: 12.5 }}>Cancelar</button>
            </div>
            <InterviewForm key={editing.id} submitLabel="Guardar cambios" submitIcon={Check} initial={editing} onSubmit={updateInterviewHandler} />
          </Card>
        </div>
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

      {interviews.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Scale size={17} color={C.action} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Ponderación de respuestas</div>
                <div style={{ fontSize: 12, color: C.slate }}>{weights ? "Pesos personalizados para este modelo." : "Usando el predeterminado (más peso a quien aplica el control en el día a día)."}</div>
              </div>
            </div>
            <button onClick={() => setEditingWeights((v) => !v)} style={{ border: `1px solid ${C.line}`, background: C.surface, borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: C.navy, fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Scale size={13} /> {editingWeights ? "Cerrar" : "Ajustar pesos"}
            </button>
          </div>
          {editingWeights && <WeightsEditor weights={weights} onChange={persistWeights} />}
        </Card>
      )}

      {loading && !interviews.length ? (
        <Card><div style={{ display: "flex", gap: 10, alignItems: "center", color: C.slate, fontSize: 13.5 }}><Loader2 size={16} className="spin" /> Cargando entrevistas…</div></Card>
      ) : !interviews.length ? (
        <Card><Empty text="Aún no hay entrevistas. Comparte el código para que el equipo responda, o pulsa «Registrar una entrevista» para anotarlas tú. El panel se actualizará solo." /></Card>
      ) : <Results center={center} interviews={interviews} overrides={overrides} weights={weights} editable onOverride={applyOverride} onResetRisk={resetRisk} serverDoc={store.mode === "api" ? () => store.downloadDocument(code, center && center.name) : null} />}
    </div>
  );
}

/* ---------------------- Editor de ponderación ---------------------- */
// Permite ajustar, por modelo, el peso base de cada rol y añadir excepciones
// por pregunta. Parte del predeterminado del motor; se guarda con el modelo.
function WeightsEditor({ weights, onChange }) {
  // Solo se guardan los repartos PERSONALIZADOS; el resto de preguntas usa el
  // reparto por defecto del motor (fusión en resolveWeights).
  const customQ = (weights && weights.questions && typeof weights.questions === "object") ? weights.questions : {};
  const [showAll, setShowAll] = useState(false);       // ver todas las preguntas o solo las personalizadas
  const [expanded, setExpanded] = useState(() => new Set()); // preguntas abiertas para editar
  const materialize = () => ({ questions: JSON.parse(JSON.stringify(customQ)) });
  const qRoles = (qid) => ((QUESTIONS.find((q) => q.id === qid) || {}).roles) || [];
  // Abre una pregunta para editar; si aún no está personalizada, la inicializa
  // con su reparto por defecto (en % que suman 100).
  const personalize = (qid) => {
    if (!customQ[qid]) {
      const w = materialize();
      w.questions[qid] = {};
      questionInfluence(qid, weights).forEach((r) => { w.questions[qid][r.role] = Math.round(r.share * 100); });
      onChange(w);
    }
    setExpanded((prev) => { const n = new Set(prev); n.add(qid); return n; });
  };
  const hide = (qid) => setExpanded((prev) => { const n = new Set(prev); n.delete(qid); return n; });
  // Cambia el % de un rol dentro del reparto de una pregunta (se normaliza al calcular).
  const setQuestionShare = (qid, role, v) => {
    const w = materialize();
    if (!w.questions[qid]) w.questions[qid] = {};
    const n = parseFloat(String(v).replace(",", "."));
    w.questions[qid][role] = Number.isFinite(n) && n >= 0 && n <= 100 ? n : 0;
    onChange(w);
  };
  const resetQuestion = (qid) => { const w = materialize(); delete w.questions[qid]; onChange(w); hide(qid); };
  const resetDefault = () => { onChange(null); setExpanded(new Set()); };
  const qLabel = (qid) => (QUESTIONS.find((q) => q.id === qid) || {}).q || qid;
  const roleLbl2 = (id) => (ROLES.find((r) => r.id === id) || {}).label || id;
  const nCustom = Object.keys(customQ).length;
  // Lista a mostrar: todas, o solo las personalizadas (+ las abiertas para editar).
  const listQ = QUESTIONS.filter((q) => showAll || customQ[q.id] || expanded.has(q.id)).map((q) => q.id);
  const inp = { width: 52, padding: "5px 7px", borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 13, textAlign: "center", fontFamily: mono };
  const btn = (bg, color, border) => ({ border: border || "none", background: bg, color, borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" });
  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
      <div style={{ fontSize: 12.5, color: C.slate, marginBottom: 12, lineHeight: 1.5 }}>
        La probabilidad de cada riesgo es una media ponderada de las respuestas. Para cada pregunta, el <b>reparto de influencia</b> indica qué porcentaje aporta cada rol que la contesta (siempre suma 100%). El criterio no es jerárquico: se prima a quien vive el control de primera mano. No afecta al impacto.
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, fontFamily: mono }}>REPARTO DE INFLUENCIA POR PREGUNTA (%)</div>
        <button onClick={() => setShowAll((v) => !v)} style={btn(C.surface, C.navy, `1px solid ${C.line}`)}>
          {showAll ? <ChevronRight size={14} style={{ transform: "rotate(90deg)" }} /> : <ChevronRight size={14} />}
          {showAll ? "Ver solo personalizadas" : "Ver todas las preguntas"}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: C.slate, marginBottom: 8 }}>Las preguntas que no personalices usan el reparto por defecto. Al personalizar una, reparte el 100% entre los roles que la contestan; si no suman exactamente 100, se ajustan solos de forma proporcional.</div>
      {listQ.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {listQ.map((qid) => {
            const roles = qRoles(qid);
            const isCustom = !!customQ[qid];
            const isExp = expanded.has(qid);
            const rmap = customQ[qid] || {};
            const sum = roles.reduce((s, role) => s + (Number(rmap[role]) || 0), 0);
            return (
            <div key={qid} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${isCustom ? hexA(C.action, 0.5) : C.line}`, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: C.ink }}>
                  <b style={{ fontFamily: mono }}>{qid}</b> · {qLabel(qid)}
                  {isCustom && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: C.action, background: hexA(C.action, 0.1), borderRadius: 20, padding: "1px 7px" }}>PERSONALIZADA</span>}
                  <QHelpInline qid={qid} />
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {isExp
                    ? <button onClick={() => hide(qid)} title="Cerrar la edición (mantiene los valores)" style={btn(C.surface, C.slate, `1px solid ${C.line}`)}><X size={13} /> Ocultar</button>
                    : <button onClick={() => personalize(qid)} style={btn(C.action, "#fff")}><Pencil size={13} /> {isCustom ? "Editar" : "Personalizar"}</button>}
                  {isCustom && <button onClick={() => resetQuestion(qid)} title="Volver al reparto por defecto de esta pregunta" style={btn(C.surface, C.slate, `1px solid ${C.line}`)}><RefreshCw size={12} /> Restablecer</button>}
                </div>
              </div>
              {isExp && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  {roles.map((role) => (
                    <label key={role} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.ink }}>
                      {roleLbl2(role).split(" / ")[0]}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <input style={inp} value={rmap[role] != null ? String(rmap[role]).replace(".", ",") : ""} onChange={(e) => setQuestionShare(qid, role, e.target.value)} inputMode="decimal" />
                        <span style={{ color: C.slate }}>%</span>
                      </span>
                    </label>
                  ))}
                  <span style={{ fontSize: 11.5, color: Math.round(sum) === 100 ? C.low : C.med, fontWeight: 600 }}>suma {Math.round(sum)}%</span>
                </div>
              )}
              <InfluenceBar qid={qid} weights={weights} />
            </div>
          ); })}
        </div>
      ) : <div style={{ fontSize: 12, color: C.slate, marginBottom: 10 }}>No has personalizado ninguna pregunta; se aplican los repartos por defecto. Pulsa «Ver todas las preguntas» para revisarlas y personalizar las que quieras.</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: C.slate }}>{nCustom ? `${nCustom} pregunta(s) personalizada(s)` : "Sin personalizaciones"}</span>
        {nCustom > 0 && <button onClick={resetDefault} style={{ ...btn(C.surface, C.navy, `1px solid ${C.line}`), marginLeft: "auto" }}><RefreshCw size={13} /> Restaurar todo el predeterminado</button>}
      </div>
    </div>
  );
}

/* Barra/etiquetas del reparto de influencia (%) de una pregunta. Suma 100%. */
function InfluenceBar({ qid, weights }) {
  const inf = questionInfluence(qid, weights);
  if (!inf.length) return null;
  const colors = ["#2E5E8C", "#3F8F6B", "#C98A2B", "#D06B3A", "#8C6BB2", "#B23A48", "#5A6B7A"];
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", border: `1px solid ${C.line}` }}>
        {inf.map((r, i) => <div key={r.role} title={`${r.label}: ${(r.share * 100).toFixed(1)}%`} style={{ width: `${r.share * 100}%`, background: colors[i % colors.length] }} />)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {inf.map((r, i) => (
          <span key={r.role} style={{ fontSize: 11, color: C.ink, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length], display: "inline-block" }} />
            {r.label.split(" / ")[0]}: <b>{(r.share * 100).toFixed(0)}%</b>
          </span>
        ))}
        <span style={{ fontSize: 11, color: C.slate }}>· suma 100%</span>
      </div>
    </div>
  );
}

/* ------------------------- Results (modelo) ------------------------- */
function Results({ center, interviews, overrides = {}, weights = null, editable = false, onOverride = () => { }, onResetRisk = () => { }, serverDoc = null }) {
  const [dl, setDl] = useState(false);
  const doDownload = async () => {
    if (!serverDoc) { downloadWord(center, interviews, overrides, weights); return; }
    setDl(true);
    try { await serverDoc(); } catch (e) { alert(e.message || "No se pudo generar el informe."); } finally { setDl(false); }
  };
  const risks = computeRisks(interviews, overrides, center, weights);
  const rated = risks.filter((r) => r.status === "rated");
  const ratedSorted = [...rated].sort((a, b) => b.level - a.level);
  // En modo editable se listan los 23 riesgos (también los que aún no tienen
  // ninguna respuesta), para que el consultor pueda puntuarlos a su criterio
  // experto sin depender de que haya datos de entrevistas.
  const tableRisks = editable ? [...risks].sort((a, b) => a.code.localeCompare(b.code)) : ratedSorted;
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
                <tbody>{tableRisks.map((r) => { const m = r.band ? BAND_META[r.band] : null; return (
                  <tr key={r.code} style={{ borderBottom: `1px solid ${C.line}`, opacity: r.status === "unrated" ? 0.75 : 1 }}>
                    <td style={{ padding: "7px 8px", fontFamily: mono, fontWeight: 700, color: C.navy }}>{r.code}</td>
                    <td style={{ padding: "7px 8px" }}>{r.title}</td>
                    <td style={{ padding: "5px 6px", textAlign: "center" }}>{editable
                      ? <PIedit value={r.prob} on={r.overriddenFields.includes("prob")} onChange={(v) => onOverride(r.code, "prob", v)} />
                      : <span style={{ fontFamily: mono }}>{r.prob}</span>}</td>
                    <td style={{ padding: "5px 6px", textAlign: "center" }}>{editable
                      ? <PIedit value={r.impact} on={r.overriddenFields.includes("impact")} onChange={(v) => onOverride(r.code, "impact", v)} />
                      : <span style={{ fontFamily: mono }}>{r.impact}</span>}</td>
                    <td style={{ padding: "7px 8px", fontFamily: mono, fontWeight: 700 }}>{r.level ?? "—"}</td>
                    <td style={{ padding: "7px 8px" }}>{m
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: m.color, padding: "2px 7px", borderRadius: 20 }}>{m.label}</span>
                      : <span style={{ fontSize: 11, fontWeight: 600, color: C.slate, padding: "2px 7px", borderRadius: 20, border: `1px dashed ${C.line}` }}>Sin puntuar</span>}</td>
                    <td style={{ padding: "7px 8px", color: C.slate }}>{r.resp}</td>
                    {editable && <td style={{ padding: "5px 6px", textAlign: "center" }}>{r.overridden
                      ? <button onClick={() => onResetRisk(r.code)} title="Restablecer valores sugeridos" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.slate, fontSize: 15, lineHeight: 1 }}>↺</button>
                      : null}</td>}
                  </tr>); })}</tbody>
              </table>
              {editable && <div style={{ fontSize: 11.5, color: C.slate, marginTop: 8, lineHeight: 1.5 }}>Ajusta <b>P</b> e <b>I</b> con tu criterio experto: el nivel y la matriz se recalculan al instante. Puedes puntuar cualquier riesgo aunque aún no tenga respuestas de entrevistas ("Sin puntuar"): en cuanto fijes una P, pasa a formar parte del modelo. Los valores <b style={{ color: C.navy }}>resaltados</b> son ajustes tuyos; <b>↺</b> restablece el sugerido (y, si el riesgo no tenía datos, lo deja otra vez sin puntuar). Los cambios se guardan automáticamente.</div>}
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
    <select value={value == null ? "" : value} onChange={(e) => onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
      style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, padding: "3px 4px", borderRadius: 6, cursor: "pointer",
        border: `1px solid ${value == null ? C.med : on ? C.navy : C.line}`,
        background: value == null ? hexA(C.med, 0.12) : on ? hexA(C.navy, 0.08) : "#fff",
        color: value == null ? "#7A5A16" : C.navy }}>
      {value == null && <option value="">–</option>}
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
