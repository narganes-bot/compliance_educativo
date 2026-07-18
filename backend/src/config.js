"use strict";
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  store: process.env.STORE || "memory", // 'memory' | 'pg'
  databaseUrl: process.env.DATABASE_URL || "",
  trustProxy: process.env.TRUST_PROXY === "true",
  rateLimits: {
    auth: { windowMs: 15 * 60 * 1000, max: parseInt(process.env.RL_AUTH_MAX || "20", 10) },
    participant: { windowMs: 15 * 60 * 1000, max: parseInt(process.env.RL_PARTICIPANT_MAX || "60", 10) },
  },
  // Recuperación de contraseña por correo (ver mailer.js)
  resendApiKey: process.env.RESEND_API_KEY || "",
  mailFrom: process.env.MAIL_FROM || "onboarding@resend.dev",
  frontendUrl: process.env.FRONTEND_URL || "",
  passwordResetExpiresMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRES_MIN || "60", 10),
};

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(n = 6) {
  const b = crypto.randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += CODE_CHARS[b[i] % CODE_CHARS.length];
  return s;
}
const genToken = () => crypto.randomBytes(24).toString("base64url");
const genId = () => crypto.randomUUID();
const hashPassword = (pw) => bcrypt.hash(pw, 10);
const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);
// Hash de un solo sentido para tokens de un solo uso (recuperación de contraseña):
// en la base de datos solo se guarda este hash, nunca el token que recibe el usuario.
const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");

module.exports = { config, genCode, genToken, genId, hashPassword, checkPassword, hashToken };
