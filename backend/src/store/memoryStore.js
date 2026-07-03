"use strict";
/* Adaptador de almacenamiento en memoria. Implementa la misma interfaz que
 * pgStore para poder ejecutar y probar el backend sin base de datos.
 * El aislamiento por inquilino se aplica filtrando por consultancy_id, igual
 * que hace la RLS en PostgreSQL. */
const { genId, genCode, genToken } = require("../config");

function createMemoryStore() {
  const consultancies = new Map();
  const users = new Map();
  const centers = new Map();
  const campaigns = new Map();
  const links = new Map();
  const interviews = new Map();
  const audits = [];

  const byToken = (token) => [...links.values()].find((l) => l.token === token) || null;
  const uniqueCode = () => { let c; do { c = genCode(); } while ([...campaigns.values()].some((x) => x.code === c)); return c; };

  return {
    kind: "memory",

    // ---- consultora / usuarios ----
    async createConsultancy({ name, cif }) { const id = genId(); const row = { id, name, cif: cif || null, created_at: new Date().toISOString() }; consultancies.set(id, row); return row; },
    async createUser(consultancy_id, { email, password_hash, display_name, role = "consultant" }) {
      const id = genId(); const row = { id, consultancy_id, email: email.toLowerCase(), password_hash, display_name: display_name || null, role, created_at: new Date().toISOString() };
      users.set(id, row); return row;
    },
    async findUserByEmail(email) { return [...users.values()].find((u) => u.email === email.toLowerCase()) || null; },
    async getUserById(id) { return users.get(id) || null; },
    async getConsultancy(id) { return consultancies.get(id) || null; },

    // ---- centros ----
    async createCenter(consultancy_id, d) {
      const id = genId(); const row = { id, consultancy_id, name: d.name, ownership: d.ownership, stages: d.stages || null, num_students: d.num_students != null ? d.num_students : null, ccaa: d.ccaa || null, created_at: new Date().toISOString() };
      centers.set(id, row); return row;
    },
    async listCenters(consultancy_id) { return [...centers.values()].filter((c) => c.consultancy_id === consultancy_id); },
    async getCenter(consultancy_id, id) { const c = centers.get(id); return c && c.consultancy_id === consultancy_id ? c : null; },

    // ---- campañas ----
    async createCampaign(consultancy_id, center_id, d) {
      const id = genId(); const row = { id, consultancy_id, center_id, code: uniqueCode(), status: "open", opens_at: new Date().toISOString(), closes_at: null, retention_until: d.retention_until || null, created_by: d.created_by || null, created_at: new Date().toISOString() };
      campaigns.set(id, row); return row;
    },
    async getCampaign(consultancy_id, id) { const c = campaigns.get(id); return c && c.consultancy_id === consultancy_id ? c : null; },
    async updateCampaign(consultancy_id, id, patch) { const c = await this.getCampaign(consultancy_id, id); if (!c) return null; Object.assign(c, patch); return c; },

    // ---- enlaces de participante ----
    async createLink(consultancy_id, campaign_id, d) {
      const id = genId(); const row = { id, consultancy_id, campaign_id, token: genToken(), assigned_role: d.assigned_role || null, expires_at: d.expires_at || null, used_at: null, created_at: new Date().toISOString() };
      links.set(id, row); return row;
    },

    // ---- entrevistas ----
    async listInterviews(consultancy_id, campaign_id) {
      return [...interviews.values()].filter((i) => i.consultancy_id === consultancy_id && i.campaign_id === campaign_id)
        .map((i) => ({ id: i.id, role: i.role, alias: i.respondent_alias, submitted_at: i.submitted_at, answers: i.answers }));
    },
    async resetResponses(consultancy_id, campaign_id) {
      for (const [id, i] of interviews) if (i.consultancy_id === consultancy_id && i.campaign_id === campaign_id) interviews.delete(id);
    },

    // ---- acceso público por token (sin contexto de inquilino) ----
    async getPublicByToken(token) {
      const link = byToken(token); if (!link) return null;
      const campaign = campaigns.get(link.campaign_id); const center = centers.get(campaign.center_id);
      return { consultancy_id: link.consultancy_id, link, campaign, center };
    },
    async submitInterview(token, { role, alias, answers }) {
      const link = byToken(token); if (!link) throw Object.assign(new Error("token no válido"), { code: "invalid_token" });
      if (link.expires_at && new Date(link.expires_at) < new Date()) throw Object.assign(new Error("enlace caducado"), { code: "link_expired" });
      const campaign = campaigns.get(link.campaign_id);
      if (campaign.status !== "open") throw Object.assign(new Error("campaña cerrada"), { code: "campaign_closed" });
      const id = genId();
      interviews.set(id, { id, consultancy_id: link.consultancy_id, campaign_id: link.campaign_id, participant_link_id: link.id, role: link.assigned_role || role, respondent_alias: alias || null, submitted_at: new Date().toISOString(), answers });
      link.used_at = new Date().toISOString();
      return id;
    },

    // ---- acceso por código de sala (para el flujo de la app) ----
    async findCampaignByCode(code) { return [...campaigns.values()].find((c) => c.code === code) || null; },
    async getRoomForTenant(cid, code) {
      const campaign = [...campaigns.values()].find((c) => c.code === code);
      if (!campaign || campaign.consultancy_id !== cid) return null;
      const center = centers.get(campaign.center_id);
      const rows = [...interviews.values()].filter((i) => i.campaign_id === campaign.id)
        .map((i) => ({ id: i.id, role: i.role, alias: i.respondent_alias, submitted_at: i.submitted_at, answers: i.answers }));
      return { campaign, center, interviews: rows };
    },
    async getRoomPublic(code) {
      const campaign = [...campaigns.values()].find((c) => c.code === code);
      if (!campaign) return null;
      const center = centers.get(campaign.center_id);
      return { center: { name: center.name }, status: campaign.status };
    },
    async submitInterviewByCode(code, { role, alias, answers }) {
      const campaign = [...campaigns.values()].find((c) => c.code === code);
      if (!campaign) throw Object.assign(new Error("código no válido"), { code: "invalid_code" });
      if (campaign.status !== "open") throw Object.assign(new Error("campaña cerrada"), { code: "campaign_closed" });
      const id = genId();
      interviews.set(id, { id, consultancy_id: campaign.consultancy_id, campaign_id: campaign.id, participant_link_id: null, role, respondent_alias: alias || null, submitted_at: new Date().toISOString(), answers });
      return { id, consultancy_id: campaign.consultancy_id };
    },
    async resetByCodeForTenant(cid, code) {
      const campaign = [...campaigns.values()].find((c) => c.code === code && c.consultancy_id === cid);
      if (!campaign) return null;
      for (const [id, i] of interviews) if (i.campaign_id === campaign.id) interviews.delete(id);
      return { campaign_id: campaign.id };
    },

    // ---- auditoría ----
    async addAudit(consultancy_id, e) {
      const row = { id: audits.length + 1, consultancy_id, actor_user_id: e.actor_user_id || null, action: e.action, entity: e.entity || null, entity_id: e.entity_id || null, ip: e.ip || null, created_at: new Date().toISOString() };
      audits.push(row); return row;
    },
    async listAudit(consultancy_id, { limit = 50 } = {}) {
      return audits.filter((a) => a.consultancy_id === consultancy_id).slice(-limit).reverse();
    },
  };
}

module.exports = { createMemoryStore };
