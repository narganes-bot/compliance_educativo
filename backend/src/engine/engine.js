/* ================================================================== *
 *  engine.js — Motor de reglas de compliance educativo (LOPIVI)
 *  Réplica exacta de la lógica de la app. Reutilizable por la app,
 *  por el generador de Word y por una futura API/servidor.
 * ================================================================== */

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
const LAW_SHORT = {
  cdn: "CDN", lanzarote: "Lanzarote", budapest: "Budapest", dir2011: "Dir. 2011/93/UE",
  lopivi: "LOPIVI", lopjm: "LOPJM", loe124: "LOE 124", lo1_2004: "LO 1/2004",
  ley4_2015: "Ley 4/2015", rgpd: "RGPD", cc: "CC 1902-04", ley40: "Ley 40/2015", auton: "Autonómica",
};
const LAW_LEVELS = ["Internacional", "Consejo de Europa", "Unión Europea", "Estatal", "Autonómico"];
const lawShort = (id) => LAW_SHORT[id] || id;
const lawLabel = (id) => (LAW_CATALOG.find((l) => l.id === id) || {}).label || id;

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

const ANSWER_VALUE = { si: 1, parcial: 0.5, no: 0, ns: 0.15 };
const ANSWER_LABEL = { si: "Sí", parcial: "Parcial", no: "No", ns: "No sé" };

const bandOf = (level) => (level <= 4 ? "low" : level <= 10 ? "med" : level <= 15 ? "high" : "crit");
const BAND_LABEL = { low: "Bajo", med: "Medio", high: "Alto", crit: "Crítico" };

// Valida una sobrescritura manual de P/I: entero entre 1 y 5, o null.
const validPI = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);

/**
 * Calcula los riesgos a partir de las entrevistas.
 * @param {Array}  interviews  [{ role, answers }]
 * @param {Object} overrides   sobrescrituras manuales por riesgo:
 *                             { R07: { prob: 4, impact: 5 }, ... }
 *                             Solo se aplican valores enteros 1..5.
 *
 * Para cada riesgo se conservan SIEMPRE los valores sugeridos por el motor
 * (probSuggested / impactSuggested) y se calcula el valor final (prob / impact)
 * usando el manual cuando existe. `overridden` y `overriddenFields` permiten
 * marcar en la app y en el informe qué valores fijó el consultor a su criterio.
 */
function computeRisks(interviews, overrides = {}) {
  overrides = overrides && typeof overrides === "object" ? overrides : {};
  return RISKS.map((risk) => {
    const qs = QUESTIONS.filter((q) => q.risks.includes(risk.code));
    const answers = [];
    const discrepancies = [];
    qs.forEach((q) => {
      const perQ = [];
      interviews.forEach((iv) => {
        const a = iv.answers[q.id];
        if (a) { answers.push(a); perQ.push({ role: iv.role, val: ANSWER_VALUE[a], raw: a }); }
      });
      if (perQ.length >= 2) {
        const vals = perQ.map((x) => x.val);
        if (Math.max(...vals) - Math.min(...vals) >= 0.5) discrepancies.push({ q: q.q, detail: perQ });
      }
    });

    const nsCount = answers.filter((a) => a === "ns").length;
    const missing = qs.filter((q) => interviews.some((iv) => ["no", "parcial", "ns"].includes(iv.answers[q.id]))).map((q) => q.q);

    // Valores sugeridos por el motor
    let probSuggested = null, control = null;
    if (answers.length) {
      const scores = answers.map((a) => ANSWER_VALUE[a]);
      control = scores.reduce((s, x) => s + x, 0) / scores.length;
      probSuggested = Math.min(5, Math.max(1, Math.round(5 - control * 4)));
    }
    const impactSuggested = risk.impact;

    // Sobrescrituras manuales (criterio experto)
    const ov = overrides[risk.code] || null;
    const ovProb = ov ? validPI(ov.prob) : null;
    const ovImpact = ov ? validPI(ov.impact) : null;
    const overriddenFields = [];
    if (ovProb != null) overriddenFields.push("prob");
    if (ovImpact != null) overriddenFields.push("impact");
    const overridden = overriddenFields.length > 0;

    // Valores finales: el manual si existe; si no, el sugerido
    const prob = ovProb != null ? ovProb : probSuggested;
    const impact = ovImpact != null ? ovImpact : impactSuggested;

    const common = {
      ...risk,
      impact,              // valor final (compat. con docgen/app: r.impact)
      prob,                // valor final (compat. con docgen/app: r.prob)
      probSuggested, impactSuggested,
      overridden, overriddenFields,
      control, nsCount, missing, discrepancies,
    };

    // "rated" si tenemos P e I (por datos o por criterio experto)
    if (prob != null && impact != null) {
      const level = prob * impact;
      return { ...common, status: "rated", level, band: bandOf(level) };
    }
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

module.exports = {
  LAW_CATALOG, LAW_LEVELS, lawShort, lawLabel, ROLES, roleLabel, roleShort,
  RISKS, QUESTIONS, ANSWER_VALUE, ANSWER_LABEL, bandOf, BAND_LABEL,
  computeRisks, computeCoverage,
};
