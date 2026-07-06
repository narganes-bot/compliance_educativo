"use strict";
const express = require("express");
const { fail, signToken, requireAuth, asyncH } = require("./middleware");
const { checkPassword } = require("./config");
const E = require("./engine/engine.js");
const IO = require("./engine/engine-io.js");
const { buildDocxBuffer, safeName } = require("./docgen.js");
const { createRateLimiter } = require("./rateLimit");
const { config } = require("./config");

// Mapea el centro almacenado al formato que consume el motor.
const toEngineCenter = (c) => ({ name: c.name, tipo: c.ownership, etapas: c.stages || "", alumnos: c.num_students != null ? String(c.num_students) : "", ccaa: c.ccaa || "" });

// Sanea el estado del modelo antes de guardarlo: solo admite sobrescrituras de
// P e I (enteros 1..5) por riesgo (Rxx) y un campo de notas opcional. Evita
// almacenar datos arbitrarios en la columna JSONB.
function sanitizeModelState(body) {
  const src = (body && typeof body === "object") ? body : {};
  const out = { overrides: {}, updated_at: new Date().toISOString() };
  const ov = (src.overrides && typeof src.overrides === "object") ? src.overrides : {};
  for (const code of Object.keys(ov)) {
    if (!/^R\d{2}$/.test(code)) continue;
    const e = ov[code] || {};
    const clean = {};
    const p = Number(e.prob), im = Number(e.impact);
    if (Number.isInteger(p) && p >= 1 && p <= 5) clean.prob = p;
    if (Number.isInteger(im) && im >= 1 && im <= 5) clean.impact = im;
    if (Object.keys(clean).length) out.overrides[code] = clean;
  }
  if (typeof src.notes === "string") out.notes = src.notes.slice(0, 5000);
  return out;
}

function buildRouter(store) {
  const r = express.Router();
  const ipOf = (req) => req.ip || (req.socket && req.socket.remoteAddress) || null;
  // Registro de auditoría tolerante a fallos: nunca rompe la petición.
  const audit = async (cid, entry) => { try { if (cid) await store.addAudit(cid, entry); } catch (e) { console.error("audit:", e.message); } };
  const publicLimiter = createRateLimiter(config.rateLimits.participant);

  /* ------------------------------ auth ------------------------------ */
  r.post("/auth/login", asyncH(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) fail(400, "missing_fields", "Email y contraseña son obligatorios.");
    const user = await store.findUserByEmail(email);
    if (!user || !(await checkPassword(password, user.password_hash))) {
      if (user) await audit(user.consultancy_id, { actor_user_id: user.id, action: "login_failed", ip: ipOf(req) });
      fail(401, "invalid_credentials", "Credenciales no válidas.");
    }
    await audit(user.consultancy_id, { actor_user_id: user.id, action: "login", ip: ipOf(req) });
    res.json({ token: signToken(user), user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role } });
  }));

  r.get("/me", requireAuth, asyncH(async (req, res) => {
    const user = await store.getUserById(req.auth.userId);
    const consultancy = await store.getConsultancy(req.auth.consultancyId);
    res.json({ user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role }, consultancy: { id: consultancy.id, name: consultancy.name } });
  }));

  /* ----------------------------- centros ----------------------------- */
  r.get("/centers", requireAuth, asyncH(async (req, res) => {
    res.json({ centers: await store.listCenters(req.auth.consultancyId) });
  }));

  r.post("/centers", requireAuth, asyncH(async (req, res) => {
    const { name, ownership, stages, num_students, ccaa } = req.body || {};
    if (!name) fail(400, "missing_fields", "El nombre del centro es obligatorio.");
    if (!["publica", "concertada", "privada"].includes(ownership)) fail(400, "invalid_ownership", "Titularidad no válida.");
    const center = await store.createCenter(req.auth.consultancyId, { name, ownership, stages, num_students, ccaa });
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "create_center", entity: "center", entity_id: center.id, ip: ipOf(req) });
    res.status(201).json({ center });
  }));

  r.get("/centers/:id", requireAuth, asyncH(async (req, res) => {
    const center = await store.getCenter(req.auth.consultancyId, req.params.id);
    if (!center) fail(404, "not_found", "Centro no encontrado.");
    res.json({ center });
  }));

  /* ----------------------- modelos guardados ------------------------- */
  // Lista de modelos (campañas) de la consultoría, para la pantalla "Mis modelos".
  r.get("/campaigns", requireAuth, asyncH(async (req, res) => {
    res.json({ campaigns: await store.listCampaigns(req.auth.consultancyId) });
  }));

  /* ---------------------------- campañas ----------------------------- */
  r.post("/centers/:id/campaigns", requireAuth, asyncH(async (req, res) => {
    const center = await store.getCenter(req.auth.consultancyId, req.params.id);
    if (!center) fail(404, "not_found", "Centro no encontrado.");
    const campaign = await store.createCampaign(req.auth.consultancyId, center.id, { retention_until: req.body && req.body.retention_until, created_by: req.auth.userId });
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "create_campaign", entity: "campaign", entity_id: campaign.id, ip: ipOf(req) });
    res.status(201).json({ campaign: { id: campaign.id, code: campaign.code, status: campaign.status } });
  }));

  // Estado + participación
  r.get("/campaigns/:id", requireAuth, asyncH(async (req, res) => {
    const campaign = await store.getCampaign(req.auth.consultancyId, req.params.id);
    if (!campaign) fail(404, "not_found", "Campaña no encontrada.");
    const center = await store.getCenter(req.auth.consultancyId, campaign.center_id);
    const interviews = await store.listInterviews(req.auth.consultancyId, campaign.id);
    const byRole = {}; interviews.forEach((i) => { byRole[i.role] = (byRole[i.role] || 0) + 1; });
    res.json({
      campaign: { id: campaign.id, code: campaign.code, status: campaign.status, retention_until: campaign.retention_until },
      center: center ? { id: center.id, name: center.name, ownership: center.ownership } : null,
      participation: { total: interviews.length, levelsCovered: Object.keys(byRole).length, totalLevels: E.ROLES.length, byRole },
    });
  }));

  // Modelo calculado (motor en servidor)
  r.get("/campaigns/:id/model", requireAuth, asyncH(async (req, res) => {
    const campaign = await store.getCampaign(req.auth.consultancyId, req.params.id);
    if (!campaign) fail(404, "not_found", "Campaña no encontrada.");
    const center = await store.getCenter(req.auth.consultancyId, campaign.center_id);
    const interviews = await store.listInterviews(req.auth.consultancyId, campaign.id);
    const state = await store.getModelState(req.auth.consultancyId, campaign.id);
    const overrides = (state && state.overrides) || {};
    const analysis = IO.analyze({ center: toEngineCenter(center), interviews: interviews.map((i) => ({ role: i.role, answers: i.answers })), overrides });
    res.json(analysis);
  }));

  // Exporta el JSON agregado (alimenta el generador de .docx)
  r.get("/campaigns/:id/export", requireAuth, asyncH(async (req, res) => {
    const campaign = await store.getCampaign(req.auth.consultancyId, req.params.id);
    if (!campaign) fail(404, "not_found", "Campaña no encontrada.");
    const center = await store.getCenter(req.auth.consultancyId, campaign.center_id);
    const interviews = await store.listInterviews(req.auth.consultancyId, campaign.id);
    res.json({ center: toEngineCenter(center), interviews: interviews.map((i) => ({ role: i.role, alias: i.alias, answers: i.answers })), generatedAt: new Date().toISOString() });
  }));

  // Genera el informe .docx personalizado (motor + generador en servidor)
  r.post("/campaigns/:id/document", requireAuth, asyncH(async (req, res) => {
    const campaign = await store.getCampaign(req.auth.consultancyId, req.params.id);
    if (!campaign) fail(404, "not_found", "Campaña no encontrada.");
    const center = await store.getCenter(req.auth.consultancyId, campaign.center_id);
    const interviews = await store.listInterviews(req.auth.consultancyId, campaign.id);
    if (!interviews.length) fail(409, "no_data", "La campaña no tiene entrevistas.");
    const state = await store.getModelState(req.auth.consultancyId, campaign.id);
    const overrides = (state && state.overrides) || {};
    const buffer = await buildDocxBuffer(toEngineCenter(center), interviews.map((i) => ({ role: i.role, answers: i.answers })), overrides);
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "generate_document", entity: "campaign", entity_id: campaign.id, ip: ipOf(req) });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="Informe_${safeName(center.name)}.docx"`);
    res.send(buffer);
  }));

  // Enlaces de participante
  r.post("/campaigns/:id/links", requireAuth, asyncH(async (req, res) => {
    const campaign = await store.getCampaign(req.auth.consultancyId, req.params.id);
    if (!campaign) fail(404, "not_found", "Campaña no encontrada.");
    const { assigned_role, expires_at } = req.body || {};
    if (assigned_role && !E.ROLES.some((x) => x.id === assigned_role)) fail(400, "invalid_role", "Rol no válido.");
    const link = await store.createLink(req.auth.consultancyId, campaign.id, { assigned_role, expires_at });
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "create_link", entity: "campaign", entity_id: campaign.id, ip: ipOf(req) });
    res.status(201).json({ link: { token: link.token, assigned_role: link.assigned_role, expires_at: link.expires_at }, url: `/p/${link.token}` });
  }));

  r.patch("/campaigns/:id", requireAuth, asyncH(async (req, res) => {
    const patch = {};
    if (req.body && req.body.status) { if (!["open", "closed", "archived"].includes(req.body.status)) fail(400, "invalid_status", "Estado no válido."); patch.status = req.body.status; }
    if (req.body && req.body.retention_until !== undefined) patch.retention_until = req.body.retention_until;
    const campaign = await store.updateCampaign(req.auth.consultancyId, req.params.id, patch);
    if (!campaign) fail(404, "not_found", "Campaña no encontrada.");
    res.json({ campaign: { id: campaign.id, code: campaign.code, status: campaign.status, retention_until: campaign.retention_until } });
  }));

  r.delete("/campaigns/:id/responses", requireAuth, asyncH(async (req, res) => {
    const campaign = await store.getCampaign(req.auth.consultancyId, req.params.id);
    if (!campaign) fail(404, "not_found", "Campaña no encontrada.");
    await store.resetResponses(req.auth.consultancyId, campaign.id);
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "reset_responses", entity: "campaign", entity_id: campaign.id, ip: ipOf(req) });
    res.json({ ok: true });
  }));

  /* ------------------------ participante (público) ------------------------ */
  r.get("/p/:token", asyncH(async (req, res) => {
    const ctx = await store.getPublicByToken(req.params.token);
    if (!ctx) fail(404, "not_found", "Enlace no válido.");
    if (ctx.link.expires_at && new Date(ctx.link.expires_at) < new Date()) fail(410, "link_expired", "El enlace ha caducado.");
    res.json({
      campaign: { code: ctx.campaign.code, status: ctx.campaign.status },
      center: { name: ctx.center.name },
      assignedRole: ctx.link.assigned_role || null,
      roles: E.ROLES,
      questions: E.QUESTIONS,
    });
  }));

  r.post("/p/:token/interview", asyncH(async (req, res) => {
    const iv = IO.normalizeInterview(req.body || {});
    if (!iv.role) fail(400, "invalid_role", "Rol no válido.");
    if (!Object.keys(iv.answers).length) fail(400, "no_answers", "No hay respuestas válidas.");
    const ctx = await store.getPublicByToken(req.params.token);
    if (!ctx) fail(404, "not_found", "Enlace no válido.");
    try {
      const id = await store.submitInterview(req.params.token, { role: iv.role, alias: iv.alias, answers: iv.answers });
      await audit(ctx.consultancy_id, { action: "submit_interview", entity: "interview", entity_id: id, ip: ipOf(req) });
      res.status(201).json({ ok: true, interviewId: id });
    } catch (e) {
      if (e.code === "link_expired") fail(410, "link_expired", "El enlace ha caducado.");
      if (e.code === "campaign_closed") fail(409, "campaign_closed", "La campaña no admite envíos.");
      if (e.code === "invalid_token") fail(404, "not_found", "Enlace no válido.");
      throw e;
    }
  }));

  /* ------------------------ sala por código (app) ------------------------ */
  // Público: información mínima de la sala (para "unirse con el código")
  r.get("/rooms/:code/public", publicLimiter, asyncH(async (req, res) => {
    const room = await store.getRoomPublic(req.params.code);
    if (!room) fail(404, "not_found", "Sala no encontrada.");
    res.json(room);
  }));

  // Público: envío de entrevista por código de sala
  r.post("/rooms/:code/interview", publicLimiter, asyncH(async (req, res) => {
    const iv = IO.normalizeInterview(req.body || {});
    if (!iv.role) fail(400, "invalid_role", "Rol no válido.");
    if (!Object.keys(iv.answers).length) fail(400, "no_answers", "No hay respuestas válidas.");
    try {
      const { id, consultancy_id } = await store.submitInterviewByCode(req.params.code, { role: iv.role, alias: iv.alias, answers: iv.answers });
      await audit(consultancy_id, { action: "submit_interview", entity: "interview", entity_id: id, ip: ipOf(req) });
      res.status(201).json({ ok: true, interviewId: id });
    } catch (e) {
      if (e.code === "campaign_closed") fail(409, "campaign_closed", "La campaña no admite envíos.");
      if (e.code === "invalid_code") fail(404, "not_found", "Sala no encontrada.");
      throw e;
    }
  }));

  // Autenticado: panel de la sala (centro + entrevistas) para el coordinador
  r.get("/rooms/:code", requireAuth, asyncH(async (req, res) => {
    const room = await store.getRoomForTenant(req.auth.consultancyId, req.params.code);
    if (!room) fail(404, "not_found", "Sala no encontrada.");
    res.json({
      code: room.campaign.code, status: room.campaign.status,
      center: room.center ? { id: room.center.id, name: room.center.name, ownership: room.center.ownership, stages: room.center.stages, num_students: room.center.num_students } : null,
      interviews: room.interviews,
    });
  }));

  // Autenticado: leer los ajustes del modelo (P/I manuales) por código
  r.get("/rooms/:code/state", requireAuth, asyncH(async (req, res) => {
    const state = await store.getModelStateByCode(req.auth.consultancyId, req.params.code);
    if (state === undefined) fail(404, "not_found", "Modelo no encontrado.");
    res.json({ state: state || { overrides: {} } });
  }));

  // Autenticado: guardar los ajustes del modelo (P/I manuales) por código
  r.put("/rooms/:code/state", requireAuth, asyncH(async (req, res) => {
    const clean = sanitizeModelState(req.body);
    const saved = await store.saveModelStateByCode(req.auth.consultancyId, req.params.code, clean);
    if (saved === undefined) fail(404, "not_found", "Modelo no encontrado.");
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "save_model_state", entity: "campaign", ip: ipOf(req) });
    res.json({ state: saved });
  }));

  // Autenticado: informe .docx completo (docgen.js) por código de sala
  r.post("/rooms/:code/document", requireAuth, asyncH(async (req, res) => {
    const room = await store.getRoomForTenant(req.auth.consultancyId, req.params.code);
    if (!room || !room.campaign) fail(404, "not_found", "Modelo no encontrado.");
    if (!room.interviews.length) fail(409, "no_data", "El modelo no tiene entrevistas.");
    const st = await store.getModelStateByCode(req.auth.consultancyId, req.params.code);
    const overrides = (st && st.overrides) || {};
    const buffer = await buildDocxBuffer(toEngineCenter(room.center), room.interviews.map((i) => ({ role: i.role, answers: i.answers })), overrides);
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "generate_document", entity: "campaign", entity_id: room.campaign.id, ip: ipOf(req) });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="Informe_${safeName(room.center.name)}.docx"`);
    res.send(buffer);
  }));

  // Autenticado: eliminar el modelo completo (campaña + entrevistas en cascada)
  r.delete("/rooms/:code", requireAuth, asyncH(async (req, res) => {
    const done = await store.deleteCampaignByCode(req.auth.consultancyId, req.params.code);
    if (!done) fail(404, "not_found", "Modelo no encontrado.");
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "delete_campaign", entity: "campaign", entity_id: done.campaign_id, ip: ipOf(req) });
    res.json({ ok: true });
  }));

  // Autenticado: vaciar entrevistas de la sala por código
  r.delete("/rooms/:code/responses", requireAuth, asyncH(async (req, res) => {
    const done = await store.resetByCodeForTenant(req.auth.consultancyId, req.params.code);
    if (!done) fail(404, "not_found", "Sala no encontrada.");
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "reset_responses", entity: "campaign", entity_id: done.campaign_id, ip: ipOf(req) });
    res.json({ ok: true });
  }));

  /* ------------------------------ auditoría ------------------------------ */
  r.get("/audit", requireAuth, asyncH(async (req, res) => {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    res.json({ entries: await store.listAudit(req.auth.consultancyId, { limit }) });
  }));

  return r;
}

module.exports = { buildRouter };
