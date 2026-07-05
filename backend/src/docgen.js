/* ================================================================== *
 *  docgen.js
 *  Genera un informe .docx personalizado de diagnóstico y modelo de
 *  prevención y compliance para un centro, a partir del JSON que
 *  exporta la app ({ center, interviews }).
 *
 *  Uso:  node docgen.js <entrada.json> [salida.docx]
 * ================================================================== */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak,
} = require("docx");
const E = require("./engine/engine.js");
const J = require("./justificaciones-riesgos.js");

// Nombre de archivo seguro a partir del nombre del centro.
function safeName(name) { return (name || "centro").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, ""); }

/**
 * Construye el informe .docx personalizado y devuelve un Buffer.
 * @param {object} center     { name, tipo, etapas, alumnos, ccaa }
 * @param {Array}  interviews [{ role, answers: { q1: 'si', ... } }]
 * @returns {Promise<Buffer>}
 */
function buildDocxBuffer(center, interviews) {
  center = center || {};
  interviews = interviews || [];

  const risks = E.computeRisks(interviews);
  const coverage = E.computeCoverage(interviews);
  const rated = risks.filter((r) => r.status === "rated");
  const ratedSorted = [...rated].sort((a, b) => b.level - a.level);
  const critHigh = ratedSorted.filter((r) => ["crit", "high"].includes(r.band));
  const nCrit = rated.filter((r) => r.band === "crit").length;
  const nHigh = rated.filter((r) => r.band === "high").length;
  const nMed = rated.filter((r) => r.band === "med").length;
  const nLow = rated.filter((r) => r.band === "low").length;

  const tipoLabel = { publica: "pública", concertada: "concertada", privada: "privada" }[center.tipo] || "—";
  const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

// ---------- estilo (idéntico al modelo maestro) ----------
const DXA = WidthType.DXA;
const PORTRAIT_W = 9638;
const LAND_W = 14570;
const border = { style: BorderStyle.SINGLE, size: 1, color: "B8C2CC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 90, right: 90 };
const HEAD_FILL = "1F3864";
const ALT_FILL = "F2F5FA";
const BAND = {
  low: { fill: "EAF3EE", text: "2E6B4F", solid: "3F8F6B", label: "Bajo" },
  med: { fill: "F7EED9", text: "8A6414", solid: "C98A2B", label: "Medio" },
  high: { fill: "F7E7DB", text: "9A4A22", solid: "D06B3A", label: "Alto" },
  crit: { fill: "F4DEE2", text: "8C2C3A", solid: "B23A48", label: "Crítico" },
};
const EMPTY_FILL = "F7F9FC";

function p(text, opts = {}) {
  const { size = 20, bold = false, italics = false, after = 100, before = 0, align, color } = opts;
  return new Paragraph({ spacing: { after, before }, alignment: align,
    children: [new TextRun({ text, size, bold, italics, color })] });
}
function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] }); }
function bullet(text, opts = {}) {
  const { size = 20, level = 0, ref = "b1", after = 40 } = opts;
  const children = Array.isArray(text)
    ? text.map((x) => (typeof x === "string" ? new TextRun({ text: x, size }) : new TextRun({ text: x.text, size, bold: x.bold })))
    : [new TextRun({ text, size })];
  return new Paragraph({ numbering: { reference: ref, level }, spacing: { after }, children });
}
function cellParas(content, size = 15) {
  const arr = Array.isArray(content) ? content : [content];
  if (!arr.length) return [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "—", size })] })];
  return arr.map((it) => {
    if (typeof it === "string") return new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: it, size })] });
    if (it.bullet) return new Paragraph({ numbering: { reference: "bc", level: 0 }, spacing: { after: 10 }, children: [new TextRun({ text: it.bullet, size })] });
    return new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: it.l + ": ", bold: true, size }), new TextRun({ text: it.t, size })] });
  });
}
function headerCell(text, width, size = 16) {
  return new TableCell({ width: { size: width, type: DXA }, borders, margins: cellMargins,
    shading: { fill: HEAD_FILL, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text, bold: true, color: "FFFFFF", size })] })] });
}
function dataCell(content, width, size = 15, fill) {
  return new TableCell({ width: { size: width, type: DXA }, borders, margins: cellMargins, verticalAlign: VerticalAlign.TOP,
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined, children: cellParas(content, size) });
}
function table(headers, widths, rows, opts = {}) {
  const { size = 15, hsize = 16, zebra = true } = opts;
  const tableW = widths.reduce((a, b) => a + b, 0);
  const headRow = new TableRow({ tableHeader: true, children: headers.map((hh, i) => headerCell(hh, widths[i], hsize)) });
  const bodyRows = rows.map((r, ri) => new TableRow({ children: r.map((c, ci) => dataCell(c, widths[ci], size, zebra && ri % 2 === 1 ? ALT_FILL : undefined)) }));
  return new Table({ width: { size: tableW, type: DXA }, columnWidths: widths, rows: [headRow, ...bodyRows] });
}
function note(text) {
  return new Paragraph({ spacing: { after: 120, before: 40 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: "C00000", space: 8 } }, indent: { left: 120 },
    children: [new TextRun({ text: "⚠ ", bold: true, color: "C00000", size: 18 }), new TextRun({ text, italics: true, size: 18 })] });
}
// párrafo "Etiqueta: texto" con la etiqueta en negrita (para las justificaciones)
function labeled(label, text, opts = {}) {
  const { size = 20, after = 60 } = opts;
  return new Paragraph({ spacing: { after, line: 264 },
    children: [new TextRun({ text: label + ": ", bold: true, size, color: "2E4D7B" }), new TextRun({ text, size })] });
}

// celda coloreada de la matriz de calor
function heatCell(content, width, fill, textColor, isLabel) {
  return new TableCell({ width: { size: width, type: DXA }, borders, margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER, shading: { fill, type: ShadingType.CLEAR },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 },
      children: content.length
        ? content.map((code, i) => new TextRun({ text: (i ? "  " : "") + code, bold: true, size: 16, color: textColor }))
        : [new TextRun({ text: "", size: 12 })] })] });
}

function heatMatrix() {
  const widths = [1400, 2634, 2634, 2634, 2634, 2634];
  const cellRisks = (pv, im) => ratedSorted.filter((r) => r.prob === pv && r.impact === im).map((r) => r.code);
  // fila de cabecera: esquina + Probabilidad 1..5
  const headRow = new TableRow({ children: [
    new TableCell({ width: { size: widths[0], type: DXA }, borders, margins: cellMargins, shading: { fill: HEAD_FILL, type: ShadingType.CLEAR },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "I \\ P", bold: true, color: "FFFFFF", size: 15 })] })] }),
    ...[1, 2, 3, 4, 5].map((pv) => new TableCell({ width: { size: widths[pv], type: DXA }, borders, margins: cellMargins,
      shading: { fill: HEAD_FILL, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "P=" + pv, bold: true, color: "FFFFFF", size: 15 })] })] })),
  ] });
  const bodyRows = [5, 4, 3, 2, 1].map((im) => new TableRow({ children: [
    new TableCell({ width: { size: widths[0], type: DXA }, borders, margins: cellMargins, shading: { fill: HEAD_FILL, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "I=" + im, bold: true, color: "FFFFFF", size: 15 })] })] }),
    ...[1, 2, 3, 4, 5].map((pv) => {
      const lvl = pv * im; const b = BAND[E.bandOf(lvl)]; const codes = cellRisks(pv, im);
      return heatCell(codes, widths[pv], codes.length ? b.fill : EMPTY_FILL, b.text);
    }),
  ] }));
  return new Table({ width: { size: LAND_W, type: DXA }, columnWidths: widths, rows: [headRow, ...bodyRows] });
}

const lawsShortJoin = (ids) => (ids && ids.length ? ids.map(E.lawShort).join(", ") : "—");

// ---------- contenido ----------
const portada = [
  new Paragraph({ spacing: { before: 2400, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "INFORME DE DIAGNÓSTICO Y MODELO PERSONALIZADO", bold: true, size: 40, color: "1F3864" })] }),
  new Paragraph({ spacing: { before: 120, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Prevención de riesgos y compliance (LOPIVI / ISO 37301:2021)", bold: true, size: 30, color: "1F3864" })] }),
  new Paragraph({ spacing: { before: 500, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: center.name || "Centro educativo", bold: true, size: 32, color: "16202E" })] }),
  new Paragraph({ spacing: { before: 80, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Titularidad ${tipoLabel}${center.etapas ? " · " + center.etapas : ""}${center.alumnos ? " · " + center.alumnos + " alumnos/as" : ""}`, size: 24, italics: true, color: "595959" })] }),
  new Paragraph({ spacing: { before: 700, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Generado el ${fecha} a partir de ${interviews.length} entrevista(s)`, size: 22, color: "595959" })] }),
  new Paragraph({ spacing: { before: 40, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Borrador orientativo · requiere validación jurídica e institucional", size: 20, color: "595959" })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

const disclaimer = [
  h1("Aviso"),
  p("Este informe se genera automáticamente a partir de las respuestas de las entrevistas realizadas en el centro. Las puntuaciones de probabilidad y de nivel de riesgo, así como la cobertura normativa, son estimaciones orientativas destinadas a priorizar actuaciones. No constituyen asesoramiento jurídico ni una calificación de responsabilidad, y no sustituyen la validación profesional ni la supervisión de la Administración educativa competente.", { after: 120 }),
  note("El nivel de riesgo depende de la calidad y cobertura de las respuestas. Un riesgo no evaluado o una norma sin cobertura no implica cumplimiento ni incumplimiento: indica que ese frente aún no se ha explorado en las entrevistas."),
];

// 1. Datos del centro
const porRol = {};
interviews.forEach((iv) => { porRol[iv.role] = (porRol[iv.role] || 0) + 1; });
const datosRows = [
  ["Centro", center.name || "—"],
  ["Titularidad", tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)],
  ["Etapas educativas", center.etapas || "—"],
  ["Alumnado", center.alumnos || "—"],
  ["Entrevistas realizadas", String(interviews.length)],
  ["Niveles entrevistados", Object.keys(porRol).length ? Object.keys(porRol).map((r) => `${E.roleShort(r)} (${porRol[r]})`).join(", ") : "—"],
  ["Fecha del informe", fecha],
];
const sec1 = [
  h1("1. Datos del centro y alcance del diagnóstico"),
  p("El diagnóstico se basa en las entrevistas recogidas por nivel jerárquico. La cobertura de niveles condiciona la representatividad del resultado.", { after: 100 }),
  table(["Campo", "Valor"], [3000, 6638], datosRows, { zebra: true }),
];

// 2. Resumen ejecutivo
const sec2 = [
  h1("2. Resumen ejecutivo del diagnóstico"),
  p(`${center.name || "El centro"} presenta, según las respuestas agregadas, ${nCrit} riesgo(s) crítico(s), ${nHigh} alto(s), ${nMed} medio(s) y ${nLow} bajo(s), sobre un total de ${rated.length} riesgos evaluados de ${E.RISKS.length}.`, { after: 100 }),
  table(["Banda", "Nº de riesgos", "Interpretación"], [2400, 2200, 5038], [
    [[{ bullet: "Crítico" }], String(nCrit), "Actuación inmediata; prioridad máxima en el plan."],
    [[{ bullet: "Alto" }], String(nHigh), "Actuación a corto plazo dentro del plan a 90 días."],
    [[{ bullet: "Medio" }], String(nMed), "Seguimiento y refuerzo progresivo."],
    [[{ bullet: "Bajo" }], String(nLow), "Mantenimiento y verificación periódica."],
  ], { zebra: true }),
  p(critHigh.length ? "Riesgos prioritarios: " + critHigh.slice(0, 8).map((r) => r.code).join(", ") + "." : "No se han detectado riesgos altos o críticos con los datos actuales.", { before: 80, after: 40, italics: true }),
];

// 3. Matriz de riesgos (landscape): heat + tabla
const matrizRows = ratedSorted.map((r) => [
  r.code, r.title, String(r.prob), String(r.impact), String(r.level), BAND[r.band].label,
  lawsShortJoin(r.laws), r.resp, r.missing.length ? r.missing.map((m) => ({ bullet: m })) : "Controles conformes según respuestas.",
]);
const unratedList = risks.filter((r) => r.status === "unrated").map((r) => r.code);
const sec3 = [
  h1("3. Matriz de riesgos personalizada"),
  p("Probabilidad estimada a partir de los controles declarados en las entrevistas × impacto del riesgo. La ubicación de cada riesgo (código Rxx) en la matriz de calor refleja el resultado del centro.", { after: 100 }),
  h2("3.1. Matriz de calor (Impacto × Probabilidad)"),
  heatMatrix(),
  p("Lectura: filas = Impacto (I), columnas = Probabilidad (P); el color indica la banda de nivel (P×I).", { before: 60, after: 120, size: 16, italics: true, color: "595959" }),
  h2("3.2. Detalle de riesgos priorizados"),
  table(
    ["Cód.", "Riesgo", "P", "I", "Niv.", "Banda", "Fundamento", "Responsable", "Controles a reforzar"],
    [700, 3000, 460, 460, 540, 1000, 1600, 2240, 4570],
    matrizRows.length ? matrizRows : [["—", "Sin riesgos evaluados", "—", "—", "—", "—", "—", "—", "—"]]
  ),
  ...(unratedList.length ? [p("Riesgos aún no evaluados (sin respuestas que cubran sus controles): " + unratedList.join(", ") + ".", { before: 80, size: 16, italics: true, color: "595959" })] : []),
];

// 4. Justificación de los riesgos (por qué cada riesgo es un riesgo real)
const secJust = [
  h1("4. Por qué estos riesgos importan"),
  p("Para cada riesgo evaluado se explica por qué constituye un riesgo real: sus consecuencias, la obligación normativa que lo respalda y su impacto en el centro y en los menores.", { after: 120 }),
  ...(ratedSorted.length ? ratedSorted.flatMap((r, i) => {
    const j = J.RISK_JUSTIFICATIONS[r.code];
    if (!j) return [];
    return [
      p(`${r.code} — ${r.title}  [${BAND[r.band].label}]`, { bold: true, size: 21, before: i ? 120 : 0, after: 40 }),
      labeled("Consecuencias", j.consecuencias),
      labeled("Obligación normativa", j.obligacion),
      labeled("Impacto en el centro y en los menores", j.impacto),
    ];
  }) : [p("No hay riesgos evaluados que justificar con los datos actuales.", { italics: true })]),
];

// 5. Plan 90 días
const planItems = critHigh.slice(0, 8);
const sec4 = [
  h1("5. Plan de actuación a 90 días"),
  p("Prioridades derivadas de los riesgos altos y críticos. Cada acción indica el control a reforzar, el responsable sugerido y su fundamento normativo.", { after: 100 }),
  ...(planItems.length ? planItems.flatMap((r, i) => [
    p(`${String(i + 1).padStart(2, "0")} · ${r.code} — ${r.title}  [${BAND[r.band].label}]`, { bold: true, after: 30, before: i ? 80 : 0, size: 21 }),
    ...(r.missing.length ? r.missing.slice(0, 4).map((m) => bullet(m)) : [bullet("Mantener y documentar los controles existentes.")]),
    p(`Responsable: ${r.resp}. Fundamento: ${lawsShortJoin(r.laws)}.`, { after: 40, size: 17, italics: true, color: "595959" }),
  ]) : [p("No se han detectado riesgos altos o críticos con los datos actuales.", { italics: true })]),
];

// 5. Discrepancias
const discrepancias = risks.flatMap((r) => r.discrepancies.map((d) => ({ code: r.code, ...d })));
const sec5 = [
  h1("6. Discrepancias entre niveles jerárquicos"),
  p("Divergencias en las respuestas a un mismo control entre distintos roles. Suelen indicar que un control existe formalmente pero no ha llegado a todos los niveles; conviene verificarlo en campo.", { after: 100 }),
  ...(discrepancias.length ? discrepancias.slice(0, 10).map((d) =>
    bullet([{ text: d.code + " — ", bold: true }, `"${d.q}": ` + d.detail.map((x) => `${E.roleShort(x.role)} (${E.ANSWER_LABEL[x.raw]})`).join(" vs ")])
  ) : [p("No se detectan divergencias significativas entre roles.", { italics: true })]),
];

// 6. Brechas de conocimiento
const brechas = risks.filter((r) => r.nsCount > 0);
const sec6 = [
  h1("7. Brechas de conocimiento"),
  p("Riesgos con respuestas «No sé»: señalan falta de información o de difusión interna, no necesariamente un incumplimiento.", { after: 100 }),
  ...(brechas.length ? brechas.map((r) => bullet([{ text: r.code + " — ", bold: true }, `${r.title}: ${r.nsCount} respuesta(s) «No sé».`]))
    : [p("Sin respuestas «No sé» relevantes.", { italics: true })]),
];

// 7. Cobertura normativa
const cobRows = E.LAW_LEVELS.map((lvl) => {
  const items = coverage.filter((l) => l.level === lvl);
  if (!items.length) return null;
  return [lvl, items.map((l) => ({ bullet: `${l.covered ? "✓" : "○"}  ${l.label}` }))];
}).filter(Boolean);
const sec7 = [
  h1("8. Cobertura normativa"),
  p("Niveles del marco legal respaldados por al menos una respuesta (✓) frente a los aún no explorados (○). Orienta sobre a qué perfiles conviene seguir entrevistando.", { after: 100 }),
  table(["Nivel del marco", "Normas y estado de cobertura"], [3200, 6438], cobRows, { zebra: true }),
  note("La normativa autonómica y los protocolos de cada Consejería de Educación son de aplicación directa y prevalente en muchas actuaciones; su denominación y vigencia varían por comunidad y deben verificarse."),
];

// 8. Cierre
const sec8 = [
  h1("9. Continuidad y remisión al modelo integral"),
  p("Este informe personalizado se integra como diagnóstico inicial del Modelo Integral de Prevención de Riesgos y Compliance del centro (apartados 1–12: alcance, marco legal multinivel, mapa de actores, matriz de riesgos, modelo ISO 37301, políticas y protocolos, controles, responsabilidades, plan de implantación e indicadores).", { after: 100 }),
  bullet("Validar el diagnóstico con la dirección, el Coordinador/a de Bienestar y el asesoramiento jurídico."),
  bullet("Ejecutar y hacer seguimiento del plan a 90 días, asignando responsables y evidencias."),
  bullet("Completar las entrevistas de los niveles con menor cobertura para afinar el resultado."),
  bullet("Revisar periódicamente (al menos anualmente) y actualizar tras incidentes o cambios normativos."),
  note("Documento de trabajo. No sustituye el asesoramiento jurídico profesional ni la supervisión de la Administración educativa competente."),
];

// ---------- numbering / styles / secciones ----------
const numbering = {
  config: [
    { reference: "b1", levels: [
      { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } },
      { level: 1, format: LevelFormat.BULLET, text: "\u2013", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 880, hanging: 260 } } } },
    ] },
    { reference: "bc", levels: [
      { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 200, hanging: 160 } } } },
    ] },
  ],
};
const styles = {
  default: { document: { run: { font: "Arial", size: 20 } } },
  paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 30, bold: true, font: "Arial", color: "1F3864" },
      paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "1F3864", space: 4 } } } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 25, bold: true, font: "Arial", color: "2E4D7B" },
      paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
  ],
};
function footer() {
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: "B8C2CC", space: 4 } },
    children: [
      new TextRun({ text: `Informe personalizado — ${center.name || "centro"} (LOPIVI / ISO 37301:2021) · requiere validación jurídica · `, size: 14, color: "808080" }),
      new TextRun({ text: "Pág. ", size: 14, color: "808080" }),
      new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "808080" }),
    ] })] });
}
function header() {
  return new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: "Diagnóstico de prevención y compliance en centros educativos", size: 14, color: "A6A6A6", italics: true })] })] });
}
const portraitPage = { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } };
const landscapePage = { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } };
const secP = (children) => ({ properties: { page: portraitPage }, headers: { default: header() }, footers: { default: footer() }, children });
const secL = (children) => ({ properties: { page: landscapePage }, headers: { default: header() }, footers: { default: footer() }, children });
const br = () => new Paragraph({ children: [new PageBreak()] });

const doc = new Document({
  styles, numbering,
  sections: [
    secP([...portada, ...disclaimer, br(), ...sec1, br(), ...sec2]),
    secL([...sec3]),
    secP([...secJust, br(), ...sec4, br(), ...sec5, br(), ...sec6, br(), ...sec7, br(), ...sec8]),
  ],
});

  return Packer.toBuffer(doc);
}

module.exports = { buildDocxBuffer, safeName };
