"use strict";
const express = require("express");
const { fail, signToken, requireAuth, asyncH } = require("./middleware");
const { checkPassword, hashPassword, genToken, hashToken } = require("./config");
const E = require("./engine/engine.js");
const IO = require("./engine/engine-io.js");
const { buildDocxBuffer, safeName } = require("./docgen.js");
const { createRateLimiter } = require("./rateLimit");
const { config } = require("./config");
const { sendMail, passwordResetEmailHtml } = require("./mailer.js");

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
  const authLimiter = createRateLimiter(config.rateLimits.auth);

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

  // Cambiar la propia contraseña (verifica la actual, guarda la nueva cifrada).
  r.post("/me/password", requireAuth, asyncH(async (req, res) => {
    const current = req.body && req.body.current;
    const next = req.body && req.body.next;
    if (!current || !next) fail(400, "missing_fields", "Debes indicar la contraseña actual y la nueva.");
    if (String(next).length < 8) fail(400, "weak_password", "La nueva contraseña debe tener al menos 8 caracteres.");
    const user = await store.getUserById(req.auth.userId);
    if (!user) fail(404, "not_found", "Usuario no encontrado.");
    const ok = await checkPassword(current, user.password_hash);
    if (!ok) {
      await audit(req.auth.consultancyId, { actor_user_id: user.id, action: "password_change_failed", ip: ipOf(req) });
      fail(401, "invalid_credentials", "La contraseña actual no es correcta.");
    }
    await store.updateUserPassword(user.id, await hashPassword(next));
    await audit(req.auth.consultancyId, { actor_user_id: user.id, action: "password_changed", ip: ipOf(req) });
    res.json({ ok: true });
  }));

  // Solicitar un enlace de restablecimiento por correo. La respuesta es SIEMPRE
  // la misma exista o no el correo, para no revelar qué cuentas están registradas.
  r.post("/auth/forgot-password", authLimiter, asyncH(async (req, res) => {
    const email = ((req.body && req.body.email) || "").trim();
    if (!email) fail(400, "missing_fields", "Indica tu correo.");
    const user = await store.findUserByEmail(email);
    if (user) {
      const rawToken = genToken();
      const expiresAt = new Date(Date.now() + config.passwordResetExpiresMinutes * 60000).toISOString();
      await store.invalidateUserResetTokens(user.id); // cualquier enlace anterior deja de servir
      await store.createPasswordResetToken(user.id, hashToken(rawToken), expiresAt);
      const link = `${config.frontendUrl.replace(/\/$/, "")}/?reset_token=${rawToken}`;
      try {
        await sendMail({ to: user.email, subject: "Restablecer tu contraseña · Forentia 360", html: passwordResetEmailHtml(link) });
      } catch (e) { console.error("mailer forgot-password:", e.message); }
      await audit(user.consultancy_id, { actor_user_id: user.id, action: "password_reset_requested", ip: ipOf(req) });
    }
    res.json({ ok: true, message: "Si el correo está registrado, te hemos enviado un enlace." });
  }));

  // Confirmar el restablecimiento con el token recibido por correo.
  r.post("/auth/reset-password", authLimiter, asyncH(async (req, res) => {
    const token = req.body && req.body.token;
    const next = req.body && req.body.next;
    if (!token || !next) fail(400, "missing_fields", "Faltan datos.");
    if (String(next).length < 8) fail(400, "weak_password", "La nueva contraseña debe tener al menos 8 caracteres.");
    const row = await store.getPasswordResetToken(hashToken(token));
    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      fail(400, "invalid_token", "El enlace no es válido o ha caducado. Solicita uno nuevo.");
    }
    const user = await store.getUserById(row.user_id);
    if (!user) fail(400, "invalid_token", "El enlace no es válido.");
    await store.updateUserPassword(user.id, await hashPassword(next));
    await store.markPasswordResetTokenUsed(row.id);
    await store.invalidateUserResetTokens(user.id);
    await audit(user.consultancy_id, { actor_user_id: user.id, action: "password_reset_completed", ip: ipOf(req) });
    res.json({ ok: true });
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

  // Genera el informe .docx personalizado (motor + generador en servidor).
  // Se pasan también los comentarios de las respuestas para que aparezcan en el informe.
  r.post("/campaigns/:id/document", requireAuth, asyncH(async (req, res) => {
    const campaign = await store.getCampaign(req.auth.consultancyId, req.params.id);
    if (!campaign) fail(404, "not_found", "Campaña no encontrada.");
    const center = await store.getCenter(req.auth.consultancyId, campaign.center_id);
    const interviews = await store.listInterviews(req.auth.consultancyId, campaign.id);
    if (!interviews.length) fail(409, "no_data", "La campaña no tiene entrevistas.");
    const state = await store.getModelState(req.auth.consultancyId, campaign.id);
    const overrides = (state && state.overrides) || {};
    const buffer = await buildDocxBuffer(toEngineCenter(center), interviews.map((i) => ({ role: i.role, answers: i.answers, comments: i.comments || {} })), overrides);
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
      const id = await store.submitInterview(req.params.token, { role: iv.role, alias: iv.alias, answers: iv.answers, comments: iv.comments });
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
      const { id, consultancy_id } = await store.submitInterviewByCode(req.params.code, { role: iv.role, alias: iv.alias, answers: iv.answers, comments: iv.comments });
      await audit(consultancy_id, { action: "submit_interview", entity: "interview", entity_id: id, ip: ipOf(req) });
      res.status(201).json({ ok: true, interviewId: id });
    } catch (e) {
      if (e.code === "campaign_closed") fail(409, "campaign_closed", "La campaña no admite envíos.");
      if (e.code === "invalid_code") fail(404, "not_found", "Sala no encontrada.");
      throw e;
    }
  }));

  // Autenticado: editar una entrevista ya enviada (respuestas, comentarios, rol, alias)
  r.put("/rooms/:code/interview/:id", requireAuth, asyncH(async (req, res) => {
    const room = await store.getRoomForTenant(req.auth.consultancyId, req.params.code);
    if (!room || !room.campaign) fail(404, "not_found", "Sala no encontrada.");
    const belongs = room.interviews.some((i) => i.id === req.params.id);
    if (!belongs) fail(404, "not_found", "Entrevista no encontrada.");
    const iv = IO.normalizeInterview(req.body || {});
    if (!iv.role) fail(400, "invalid_role", "Rol no válido.");
    if (!Object.keys(iv.answers).length) fail(400, "no_answers", "No hay respuestas válidas.");
    const done = await store.updateInterview(req.auth.consultancyId, req.params.id, { role: iv.role, alias: iv.alias, answers: iv.answers, comments: iv.comments });
    if (!done) fail(404, "not_found", "Entrevista no encontrada.");
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "update_interview", entity: "interview", entity_id: req.params.id, ip: ipOf(req) });
    res.json({ ok: true });
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

  // Autenticado: editar los datos del centro (nombre, titularidad, etapas, alumnado)
  r.patch("/rooms/:code/center", requireAuth, asyncH(async (req, res) => {
    const room = await store.getRoomForTenant(req.auth.consultancyId, req.params.code);
    if (!room || !room.center) fail(404, "not_found", "Sala no encontrada.");
    const b = req.body || {};
    const patch = {};
    if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 200);
    if (b.ownership !== undefined) { if (!["publica", "concertada", "privada"].includes(b.ownership)) fail(400, "invalid_ownership", "Titularidad no válida."); patch.ownership = b.ownership; }
    if (b.stages !== undefined) patch.stages = b.stages ? String(b.stages).slice(0, 300) : null;
    if (b.num_students !== undefined) { const n = parseInt(b.num_students, 10); patch.num_students = Number.isFinite(n) ? n : null; }
    if (b.ccaa !== undefined) patch.ccaa = b.ccaa ? String(b.ccaa).slice(0, 120) : null;
    if (!Object.keys(patch).length) fail(400, "no_changes", "No hay cambios que guardar.");
    const updated = await store.updateCenter(req.auth.consultancyId, room.center.id, patch);
    if (!updated) fail(404, "not_found", "Centro no encontrado.");
    await audit(req.auth.consultancyId, { actor_user_id: req.auth.userId, action: "update_center", entity: "center", entity_id: room.center.id, ip: ipOf(req) });
    res.json({ center: { id: updated.id, name: updated.name, ownership: updated.ownership, stages: updated.stages, num_students: updated.num_students, ccaa: updated.ccaa } });
  }));

  // Autenticado: informe .docx completo (docgen.js) por código de sala.
  // Se pasan también los comentarios de las respuestas para que aparezcan en el informe.
  r.post("/rooms/:code/document", requireAuth, asyncH(async (req, res) => {
    const room = await store.getRoomForTenant(req.auth.consultancyId, req.params.code);
    if (!room || !room.campaign) fail(404, "not_found", "Modelo no encontrado.");
    if (!room.interviews.length) fail(409, "no_data", "El modelo no tiene entrevistas.");
    const st = await store.getModelStateByCode(req.auth.consultancyId, req.params.code);
    const overrides = (st && st.overrides) || {};
    const buffer = await buildDocxBuffer(toEngineCenter(room.center), room.interviews.map((i) => ({ role: i.role, answers: i.answers, comments: i.comments || {} })), overrides);
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
