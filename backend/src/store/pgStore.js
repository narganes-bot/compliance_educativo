"use strict";
/* Adaptador PostgreSQL. Cada operación autenticada fija app.consultancy_id en
 * la conexión para que la RLS (ver schema.sql) restrinja las filas al inquilino.
 * El envío de participante usa la función submit_interview(). */
const { Pool } = require("pg");
const { genToken } = require("../config");

function createPgStore(connectionString) {
  const pool = new Pool({ connectionString });

  // Ejecuta fn con app.consultancy_id fijado (transacción por petición).
  async function withTenant(consultancyId, fn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.consultancy_id', $1, true)", [consultancyId]);
      const r = await fn(client);
      await client.query("COMMIT");
      return r;
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
  }
  const q = (text, params) => pool.query(text, params);

  return {
    kind: "pg",

    async createConsultancy({ name, cif }) { const { rows } = await q("INSERT INTO consultancy(name,cif) VALUES($1,$2) RETURNING *", [name, cif || null]); return rows[0]; },
    async createUser(consultancy_id, u) { const { rows } = await q("INSERT INTO app_user(consultancy_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5) RETURNING *", [consultancy_id, u.email.toLowerCase(), u.password_hash, u.display_name || null, u.role || "consultant"]); return rows[0]; },
    async findUserByEmail(email) { const { rows } = await q("SELECT * FROM app_user WHERE email=$1", [email.toLowerCase()]); return rows[0] || null; },
    async getUserById(id) { const { rows } = await q("SELECT * FROM app_user WHERE id=$1", [id]); return rows[0] || null; },
    async updateUserPassword(id, password_hash) { const { rows } = await q("UPDATE app_user SET password_hash=$2 WHERE id=$1 RETURNING id", [id, password_hash]); return rows[0] || null; },
    async updateUserDisplayName(id, display_name) { const { rows } = await q("UPDATE app_user SET display_name=$2 WHERE id=$1 RETURNING *", [id, display_name || null]); return rows[0] || null; },
    async listUsers(consultancy_id) { const { rows } = await q("SELECT * FROM app_user WHERE consultancy_id=$1 ORDER BY created_at ASC", [consultancy_id]); return rows; },
    async deleteUser(consultancy_id, id) { const { rows } = await q("DELETE FROM app_user WHERE id=$1 AND consultancy_id=$2 RETURNING id", [id, consultancy_id]); return rows[0] || null; },
    async countOwners(consultancy_id) { const { rows } = await q("SELECT count(*)::int AS n FROM app_user WHERE consultancy_id=$1 AND role='owner'", [consultancy_id]); return rows[0].n; },
    async getConsultancy(id) { const { rows } = await q("SELECT * FROM consultancy WHERE id=$1", [id]); return rows[0] || null; },

    // ---- recuperación de contraseña por correo ----
    async createPasswordResetToken(userId, tokenHash, expiresAt) {
      const { rows } = await q("INSERT INTO password_reset_token(user_id,token_hash,expires_at) VALUES($1,$2,$3) RETURNING *", [userId, tokenHash, expiresAt]);
      return rows[0];
    },
    async getPasswordResetToken(tokenHash) { const { rows } = await q("SELECT * FROM password_reset_token WHERE token_hash=$1", [tokenHash]); return rows[0] || null; },
    async markPasswordResetTokenUsed(id) { await q("UPDATE password_reset_token SET used_at=now() WHERE id=$1", [id]); },
    async invalidateUserResetTokens(userId) { await q("UPDATE password_reset_token SET used_at=now() WHERE user_id=$1 AND used_at IS NULL", [userId]); },

    async createCenter(cid, d) {
      return withTenant(cid, async (c) => (await c.query(
        "INSERT INTO center(consultancy_id,name,ownership,stages,num_students,ccaa) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [cid, d.name, d.ownership, d.stages || null, d.num_students != null ? d.num_students : null, d.ccaa || null])).rows[0]);
    },
    async listCenters(cid) { return withTenant(cid, async (c) => (await c.query("SELECT * FROM center WHERE consultancy_id=$1 ORDER BY created_at DESC", [cid])).rows); },
    async getCenter(cid, id) { return withTenant(cid, async (c) => (await c.query("SELECT * FROM center WHERE id=$1 AND consultancy_id=$2", [id, cid])).rows[0] || null); },
    async updateCenter(cid, id, patch) {
      const fields = Object.keys(patch); if (!fields.length) return this.getCenter(cid, id);
      const set = fields.map((f, i) => `${f}=$${i + 3}`).join(",");
      return withTenant(cid, async (c) => (await c.query(`UPDATE center SET ${set} WHERE id=$1 AND consultancy_id=$2 RETURNING *`, [id, cid, ...fields.map((f) => patch[f])])).rows[0] || null);
    },

    async createCampaign(cid, center_id, d) {
      return withTenant(cid, async (c) => {
        // reintenta si el código aleatorio colisiona
        for (let i = 0; i < 4; i++) {
          try {
            const { rows } = await c.query(
              "INSERT INTO campaign(consultancy_id,center_id,code,retention_until,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
              [cid, center_id, require("../config").genCode(), d.retention_until || null, d.created_by || null]);
            return rows[0];
          } catch (e) { if (!String(e.message).includes("duplicate")) throw e; }
        }
        throw new Error("no se pudo generar un código único");
      });
    },
    async getCampaign(cid, id) { return withTenant(cid, async (c) => (await c.query("SELECT * FROM campaign WHERE id=$1 AND consultancy_id=$2", [id, cid])).rows[0] || null); },
    async updateCampaign(cid, id, patch) {
      const fields = Object.keys(patch); if (!fields.length) return this.getCampaign(cid, id);
      const set = fields.map((f, i) => `${f}=$${i + 3}`).join(",");
      return withTenant(cid, async (c) => (await c.query(`UPDATE campaign SET ${set} WHERE id=$1 AND consultancy_id=$2 RETURNING *`, [id, cid, ...fields.map((f) => patch[f])])).rows[0] || null);
    },

    // ---- modelos guardados (listar y estado editable) ----
    async listCampaigns(cid) {
      return withTenant(cid, async (c) => (await c.query(
        `SELECT cp.id, cp.code, cp.status, cp.created_at, cp.retention_until,
                ct.name AS center_name, ct.ownership, ct.stages, ct.num_students,
                (SELECT count(*) FROM interview i WHERE i.campaign_id = cp.id) AS interview_count
           FROM campaign cp JOIN center ct ON ct.id = cp.center_id
          WHERE cp.consultancy_id = $1
          ORDER BY cp.created_at DESC`, [cid])).rows);
    },
    async deleteCampaignByCode(cid, code) {
      return withTenant(cid, async (c) => {
        const cp = (await c.query("SELECT id FROM campaign WHERE code=$1 AND consultancy_id=$2", [code, cid])).rows[0];
        if (!cp) return null;
        // El borrado de la campaña arrastra en cascada entrevistas y respuestas (ver schema.sql).
        await c.query("DELETE FROM campaign WHERE id=$1 AND consultancy_id=$2", [cp.id, cid]);
        return { campaign_id: cp.id };
      });
    },
    async getModelState(cid, id) {
      return withTenant(cid, async (c) => {
        const { rows } = await c.query("SELECT model_state FROM campaign WHERE id=$1 AND consultancy_id=$2", [id, cid]);
        return rows[0] ? (rows[0].model_state || null) : null;
      });
    },
    async saveModelState(cid, id, state) {
      return withTenant(cid, async (c) => {
        const { rows } = await c.query(
          "UPDATE campaign SET model_state=$3::jsonb WHERE id=$1 AND consultancy_id=$2 RETURNING model_state",
          [id, cid, JSON.stringify(state)]);
        return rows[0] ? rows[0].model_state : null;
      });
    },
    // Variantes por código de sala (las que usa la app, que trabaja por código).
    async getModelStateByCode(cid, code) {
      return withTenant(cid, async (c) => {
        const { rows } = await c.query("SELECT model_state FROM campaign WHERE code=$1 AND consultancy_id=$2", [code, cid]);
        return rows.length ? (rows[0].model_state || null) : undefined; // undefined = campaña inexistente
      });
    },
    async saveModelStateByCode(cid, code, state) {
      return withTenant(cid, async (c) => {
        const { rows } = await c.query(
          "UPDATE campaign SET model_state=$3::jsonb WHERE code=$1 AND consultancy_id=$2 RETURNING model_state",
          [code, cid, JSON.stringify(state)]);
        return rows.length ? rows[0].model_state : undefined;
      });
    },

    async createLink(cid, campaign_id, d) {
      return withTenant(cid, async (c) => (await c.query(
        "INSERT INTO participant_link(consultancy_id,campaign_id,token,assigned_role,expires_at) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [cid, campaign_id, genToken(), d.assigned_role || null, d.expires_at || null])).rows[0]);
    },

    async listInterviews(cid, campaign_id) {
      return withTenant(cid, async (c) => {
        const { rows } = await c.query(
          `SELECT i.id, i.role, i.respondent_alias AS alias, i.submitted_at,
                  COALESCE(jsonb_object_agg(r.question_id, r.answer) FILTER (WHERE r.id IS NOT NULL), '{}'::jsonb) AS answers,
                  COALESCE(jsonb_object_agg(r.question_id, r.comment) FILTER (WHERE r.comment IS NOT NULL), '{}'::jsonb) AS comments
             FROM interview i LEFT JOIN response r ON r.interview_id=i.id
            WHERE i.campaign_id=$1 AND i.consultancy_id=$2 GROUP BY i.id ORDER BY i.submitted_at`, [campaign_id, cid]);
        return rows;
      });
    },
    async resetResponses(cid, campaign_id) { return withTenant(cid, async (c) => { await c.query("DELETE FROM interview WHERE campaign_id=$1 AND consultancy_id=$2", [campaign_id, cid]); }); },

    // público (sin contexto de inquilino): consulta directa por token
    async getPublicByToken(token) {
      const { rows } = await q(
        `SELECT pl.consultancy_id, pl.expires_at, pl.assigned_role,
                cp.id AS campaign_id, cp.code, cp.status,
                ct.name AS center_name, ct.ownership, ct.stages, ct.num_students, ct.ccaa
           FROM participant_link pl JOIN campaign cp ON cp.id=pl.campaign_id JOIN center ct ON ct.id=cp.center_id
          WHERE pl.token=$1`, [token]);
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        consultancy_id: r.consultancy_id, link: { assigned_role: r.assigned_role, expires_at: r.expires_at },
        campaign: { id: r.campaign_id, code: r.code, status: r.status },
        center: { name: r.center_name, ownership: r.ownership, stages: r.stages, num_students: r.num_students, ccaa: r.ccaa },
      };
    },
    async submitInterview(token, { role, alias, answers, comments }) {
      const { rows } = await q("SELECT submit_interview($1,$2,$3,$4::jsonb,$5::jsonb) AS id", [token, role, alias || null, JSON.stringify(answers), JSON.stringify(comments || {})]);
      return rows[0].id;
    },

    // ---- acceso por código de sala ----
    async getRoomForTenant(cid, code) {
      return withTenant(cid, async (c) => {
        const cp = (await c.query("SELECT * FROM campaign WHERE code=$1 AND consultancy_id=$2", [code, cid])).rows[0];
        if (!cp) return null;
        const center = (await c.query("SELECT * FROM center WHERE id=$1 AND consultancy_id=$2", [cp.center_id, cid])).rows[0];
        const rows = (await c.query(
          `SELECT i.id, i.role, i.respondent_alias AS alias, i.submitted_at,
                  COALESCE(jsonb_object_agg(r.question_id, r.answer) FILTER (WHERE r.id IS NOT NULL), '{}'::jsonb) AS answers,
                  COALESCE(jsonb_object_agg(r.question_id, r.comment) FILTER (WHERE r.comment IS NOT NULL), '{}'::jsonb) AS comments
             FROM interview i LEFT JOIN response r ON r.interview_id=i.id
            WHERE i.campaign_id=$1 AND i.consultancy_id=$2 GROUP BY i.id ORDER BY i.submitted_at`, [cp.id, cid])).rows;
        return { campaign: cp, center, interviews: rows };
      });
    },
    async getRoomPublic(code) {
      const { rows } = await q("SELECT * FROM room_by_code($1)", [code]);
      if (!rows[0]) return null;
      return { center: { name: rows[0].center_name }, status: rows[0].status };
    },
    async submitInterviewByCode(code, { role, alias, answers, comments }) {
      const { rows } = await q("SELECT * FROM submit_interview_by_code($1,$2,$3,$4::jsonb,$5::jsonb) AS r", [code, role, alias || null, JSON.stringify(answers), JSON.stringify(comments || {})]);
      return { id: rows[0].id, consultancy_id: rows[0].consultancy_id };
    },
    // Actualiza una entrevista ya enviada (respuestas, comentarios, rol y alias).
    // El consultor autenticado puede reescribir las respuestas (RLS por inquilino).
    async updateInterview(cid, interviewId, { role, alias, answers, comments }) {
      return withTenant(cid, async (c) => {
        const iv = (await c.query("SELECT id FROM interview WHERE id=$1 AND consultancy_id=$2", [interviewId, cid])).rows[0];
        if (!iv) return null;
        await c.query("UPDATE interview SET role=COALESCE($3,role), respondent_alias=$4 WHERE id=$1 AND consultancy_id=$2", [interviewId, cid, role || null, alias || null]);
        await c.query("DELETE FROM response WHERE interview_id=$1 AND consultancy_id=$2", [interviewId, cid]);
        for (const [qid, ans] of Object.entries(answers || {})) {
          if (!["si", "parcial", "no", "ns"].includes(ans)) continue;
          const cm = (ans === "parcial" || ans === "ns") ? ((comments && comments[qid]) || null) : null;
          await c.query("INSERT INTO response (consultancy_id, interview_id, question_id, answer, comment) VALUES ($1,$2,$3,$4,$5)", [cid, interviewId, qid, ans, cm]);
        }
        return { id: interviewId };
      });
    },
    async resetByCodeForTenant(cid, code) {
      return withTenant(cid, async (c) => {
        const cp = (await c.query("SELECT id FROM campaign WHERE code=$1 AND consultancy_id=$2", [code, cid])).rows[0];
        if (!cp) return null;
        await c.query("DELETE FROM interview WHERE campaign_id=$1 AND consultancy_id=$2", [cp.id, cid]);
        return { campaign_id: cp.id };
      });
    },

    async addAudit(cid, e) {
      return withTenant(cid, async (c) => (await c.query(
        "INSERT INTO audit_log(consultancy_id,actor_user_id,action,entity,entity_id,ip) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [cid, e.actor_user_id || null, e.action, e.entity || null, e.entity_id || null, e.ip || null])).rows[0]);
    },
    async listAudit(cid, { limit = 50 } = {}) {
      return withTenant(cid, async (c) => (await c.query("SELECT * FROM audit_log WHERE consultancy_id=$1 ORDER BY created_at DESC LIMIT $2", [cid, limit])).rows);
    },
  };
}

module.exports = { createPgStore };
