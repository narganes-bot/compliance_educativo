"use strict";
/* Envío de correo transaccional vía Resend (https://resend.com).
 * Requiere la variable de entorno RESEND_API_KEY. Si no está configurada,
 * NO falla la petición: registra un aviso en consola para no bloquear el
 * flujo en desarrollo/pruebas (útil con el memoryStore, sin claves reales). */
const { config } = require("./config");

async function sendMail({ to, subject, html }) {
  if (!config.resendApiKey) {
    console.warn("[mailer] RESEND_API_KEY no configurada; correo NO enviado ->", { to, subject });
    return { skipped: true };
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.resendApiKey}` },
    body: JSON.stringify({ from: config.mailFrom, to, subject, html }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Resend respondió ${r.status}: ${text}`);
  }
  return r.json();
}

// Plantilla del correo de restablecimiento de contraseña.
function passwordResetEmailHtml(link) {
  return `<div style="font-family:Arial,sans-serif;color:#16202E;max-width:480px;margin:0 auto;line-height:1.5">
    <p style="color:#1F3864;font-weight:700;font-size:16px;margin:0 0 14px">Forentia 360 · Compliance educativo</p>
    <p style="margin:0 0 10px">Hemos recibido una solicitud para restablecer tu contraseña.</p>
    <p style="margin:0 0 18px">
      <a href="${link}" style="background:#1F3864;color:#ffffff;padding:11px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Restablecer contraseña</a>
    </p>
    <p style="font-size:12.5px;color:#54627A;margin:0 0 4px">El enlace caduca en ${config.passwordResetExpiresMinutes} minutos y solo puede usarse una vez.</p>
    <p style="font-size:12.5px;color:#54627A;margin:0">Si no has sido tú, puedes ignorar este correo: tu contraseña no cambiará.</p>
  </div>`;
}

module.exports = { sendMail, passwordResetEmailHtml };
