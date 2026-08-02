/* engine.js — Motor de reglas (copia de shared/engine/engine.js del repo) */
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
  { id: "rd393", label: "RD 393/2007 (Norma Básica de Autoprotección)", level: "Estatal" },
  { id: "auton", label: "Protocolos autonómicos", level: "Autonómico" },
];
const LAW_SHORT = {
  cdn: "CDN", lanzarote: "Lanzarote", budapest: "Budapest", dir2011: "Dir. 2011/93/UE",
  lopivi: "LOPIVI", lopjm: "LOPJM", loe124: "LOE 124", lo1_2004: "LO 1/2004",
  ley4_2015: "Ley 4/2015", rgpd: "RGPD", cc: "CC 1902-04", ley40: "Ley 40/2015", rd393: "RD 393/2007", auton: "Autonómica",
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
const CONSULTANT_ROLE = "consultor";

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
  { code: "R24", title: "Ausencia o falta de implantación del Plan de Autoprotección y medidas de emergencia", impact: 4, resp: "Titularidad / Dirección", laws: ["rd393", "auton"] },
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
  { id: "q30", q: "¿Dispone el centro de Plan de Autoprotección (o plan de emergencias) elaborado, actualizado y, cuando es exigible, registrado conforme al RD 393/2007 y la normativa autonómica?", roles: ["titularidad", "direccion"], risks: ["R24"], laws: ["rd393", "auton"] },
  { id: "q31", q: "¿Se realiza al menos un simulacro de evacuación al año y se registran sus resultados e incidencias?", roles: ["direccion", "jefatura", "profesorado"], risks: ["R24"], laws: ["rd393", "auton"] },
  { id: "q32", q: "¿El personal conoce sus funciones en caso de emergencia (alarma, evacuación, ayuda a personas con movilidad reducida, primeros auxilios)?", roles: ["profesorado", "nodocente"], risks: ["R24"], laws: ["rd393"] },
];

// Acción correctora recomendada para cada control (pregunta). Cuando un control
// aparece como "a reforzar" (respuestas No / Parcial / No sé), el informe muestra
// esta medida —afirmativa, práctica y fundamentada— en lugar de repetir la pregunta.
const QUESTION_ACTIONS = {
  q1: "Designar formalmente y por escrito al Coordinador/a de Bienestar y Protección, y comunicar su nombramiento y funciones a toda la comunidad educativa (art. 35 LOPIVI).",
  q2: "Proporcionar al Coordinador/a formación específica y acreditada en protección a la infancia, y conservar los certificados como evidencia.",
  q3: "Aprobar por la titularidad una Política de protección de la infancia y la adolescencia, publicarla y difundirla a familias, personal y alumnado, recabando acuse de lectura.",
  q4: "Difundir los protocolos a todo el personal, formar en su aplicación y verificar su implantación mediante simulacros o casos prácticos, dejando registro.",
  q5: "Aprobar un código de conducta que regule el trato con menores, el contacto físico, la comunicación digital y las conductas prohibidas, y recabar la firma de todo el personal y de los terceros con contacto habitual con el alumnado, conservándola como evidencia.",
  q6: "Poner en funcionamiento el protocolo frente a la violencia y el acoso, designar responsables de su aplicación y registrar cada intervención y su seguimiento (art. 124 LOE y protocolo autonómico).",
  q7: "Aprobar un protocolo de ciberacoso y una norma de uso responsable de las TIC, e impartir educación digital al alumnado.",
  q8: "Implantar un protocolo específico ante sospecha de abuso sexual que garantice la escucha única, la comunicación inmediata a Fiscalía y a las Fuerzas y Cuerpos de Seguridad, y la no revictimización del menor.",
  q9: "Verificar, antes del inicio de la relación y con renovación periódica, el certificado negativo del Registro Central de Delincuentes Sexuales de todo el personal con contacto habitual con menores, y mantener un registro centralizado (art. 57 LOPIVI).",
  q10: "Extender la verificación del certificado negativo a proveedores, monitores y voluntariado, incluir cláusulas LOPIVI en los contratos y controlar la vigencia de los certificados.",
  q11: "Habilitar un canal de comunicación y denuncia accesible para menores y adultos, difundirlo (cartelería, web) y garantizar la confidencialidad y el registro de las comunicaciones.",
  q12: "Formar a todo el personal en el deber de comunicación inmediata ante indicios de violencia, indicando con claridad a quién y cómo comunicar (arts. 15-16 LOPIVI).",
  q13: "Implantar un procedimiento de registro y custodia de las comunicaciones, decisiones y derivaciones, con trazabilidad y plazos de conservación definidos.",
  q14: "Aprobar un plan de formación anual obligatorio en protección a la infancia, con evaluación y registro de asistencia por perfil.",
  q15: "Definir y documentar los ratios y turnos de vigilancia en patios, comedor, transporte y salidas, mediante un mapa de vigilancia y cuadrantes.",
  q16: "Aprobar un protocolo de actividades extraescolares y salidas con evaluación de riesgos, ratios, autorizaciones, seguros y contactos de emergencia.",
  q17: "Garantizar acompañante y control de listas en el transporte escolar conforme a la normativa autonómica, y registrar las incidencias.",
  q18: "Gestionar fichas de alergias e intolerancias y verificar el control de seguridad alimentaria (APPCC) del comedor, con supervisión suficiente del alumnado.",
  q19: "Documentar el tratamiento de datos (registro de actividades), fijar su base jurídica y aplicar medidas de seguridad, con especial protección de los datos de menores (RGPD y LOPDGDD).",
  q20: "Restringir el acceso a la información sensible según el principio de necesidad de conocer, con control de accesos y compromisos de confidencialidad firmados.",
  q21: "Designar un Delegado de Protección de Datos o documentar la evaluación de su necesidad conforme al RGPD.",
  q22: "Definir interlocutores y cauces de coordinación con los servicios sociales, las Fuerzas y Cuerpos de Seguridad y la Fiscalía de Menores, con formularios de derivación y registro de respuestas.",
  q23: "Programar al menos una auditoría o revisión interna anual del sistema, con informe de no conformidades y plan de acciones.",
  q24: "Elaborar un plan de gestión de crisis y comunicación, con portavocía definida y bitácora de actuación.",
  q25: "Aprobar por la titularidad la asignación de recursos y presupuesto al sistema de protección, dejando constancia en acta.",
  q26: "Establecer una supervisión documentada del sistema por parte de la dirección, con actas de supervisión periódicas.",
  q27: "Actualizar y aplicar el plan de convivencia conforme al art. 124 de la LOE, con seguimiento en el consejo escolar.",
  q28: "Aprobar una pauta de actuación y derivación cuando un menor sea víctima de violencia de género en su entorno, coordinada con los recursos especializados (LO 1/2004).",
  q29: "Aplicar los protocolos autonómicos vigentes de acoso, ciberacoso y maltrato, verificando su versión actualizada con la Consejería de Educación.",
  q30: "Elaborar, actualizar y —cuando sea exigible— registrar el Plan de Autoprotección conforme al RD 393/2007 y la normativa autonómica, integrándolo con las medidas de emergencia del centro.",
  q31: "Realizar al menos un simulacro de evacuación anual, registrar sus resultados e incidencias y adoptar las medidas de mejora que procedan.",
  q32: "Asignar y difundir las funciones del personal en caso de emergencia (alarma, evacuación, ayuda a personas con movilidad reducida, primeros auxilios) y formarlo periódicamente.",
};

// Propósito de cada pregunta: qué comprueba y por qué se pregunta. Se muestra
// como ayuda en la aplicación y se recoge en el anexo del cuestionario del
// informe, junto al riesgo asociado (q.risks) y la norma (q.laws).
const QUESTION_HELP = {
  q1: "Comprueba que el centro ha designado formalmente y por escrito al Coordinador/a de Bienestar y Protección, figura obligatoria y eje de todo el sistema de protección.",
  q2: "Verifica que esa figura cuenta con formación específica y acreditada, no solo con el nombramiento.",
  q3: "Comprueba que existe una Política de protección de la infancia aprobada por la titularidad y publicada a la comunidad educativa.",
  q4: "Distingue entre tener protocolos aprobados y que estén realmente implantados y conocidos por quien debe aplicarlos.",
  q5: "Verifica que existe un código de conducta y que lo ha firmado todo el personal y los terceros con contacto con menores.",
  q6: "Comprueba que el protocolo frente a la violencia y el acoso no solo existe, sino que está operativo y se aplica.",
  q7: "Verifica que hay una respuesta estructurada ante el ciberacoso y una norma de uso de dispositivos y redes.",
  q8: "Comprueba el protocolo específico ante sospecha de abuso sexual, con escucha única, comunicación inmediata y no revictimización.",
  q9: "Verifica que todo el personal con contacto habitual con menores tiene el certificado negativo de delitos sexuales vigente.",
  q10: "Extiende esa verificación a proveedores, monitores y voluntariado con contacto habitual con el alumnado.",
  q11: "Comprueba que existe un canal de comunicación/denuncia accesible y difundido para comunicar indicios.",
  q12: "Verifica que el personal conoce el deber de comunicación y sabe a quién y cómo comunicar.",
  q13: "Comprueba la trazabilidad documental: que se registran y custodian las comunicaciones, decisiones y derivaciones.",
  q14: "Verifica que la formación es sistemática (plan anual) y que se registra la asistencia.",
  q15: "Comprueba la cobertura de vigilancia y los ratios en los momentos y espacios de mayor riesgo (patios, comedor, transporte, salidas).",
  q16: "Verifica que las actividades extraescolares y salidas se organizan con evaluación de riesgos, ratios, autorizaciones y seguros.",
  q17: "Comprueba las medidas de seguridad en el transporte escolar (acompañante y control de listas).",
  q18: "Verifica la gestión de alérgenos y la seguridad alimentaria, así como la supervisión del alumnado en el comedor.",
  q19: "Comprueba que los datos personales se tratan con base jurídica y medidas de seguridad conforme al RGPD.",
  q20: "Verifica la confidencialidad: que el acceso a información sensible se limita según el principio de necesidad de conocer.",
  q21: "Comprueba el cumplimiento en materia de Delegado de Protección de Datos (designación o evaluación de su necesidad).",
  q22: "Verifica que existen cauces definidos de coordinación con servicios sociales, FCSE y Fiscalía de Menores para derivar casos.",
  q23: "Comprueba que el sistema se revisa y mejora mediante auditoría o revisión interna al menos anual.",
  q24: "Verifica la preparación ante una crisis: plan de gestión de crisis y comunicación.",
  q25: "Comprueba el compromiso real de la titularidad: asignación de recursos y presupuesto al sistema de protección.",
  q26: "Verifica que la dirección ejerce una supervisión activa y documentada del sistema.",
  q27: "Comprueba que el centro tiene un plan de convivencia actualizado y aplicado (art. 124 LOE).",
  q28: "Verifica la actuación específica cuando un menor es víctima de violencia de género en su entorno.",
  q29: "Comprueba que se aplican los protocolos autonómicos vigentes de acoso, ciberacoso y maltrato de la CCAA.",
  q30: "Verifica la existencia y, cuando es exigible, el registro del Plan de Autoprotección (RD 393/2007).",
  q31: "Comprueba que la evacuación se practica de verdad: al menos un simulacro anual registrado.",
  q32: "Verifica que el personal conoce sus funciones en caso de emergencia (alarma, evacuación, ayuda a personas con movilidad reducida, primeros auxilios).",
};

// Devuelve la ficha completa de una pregunta: número, texto, propósito, riesgos
// asociados (código y título) y normas donde se regula (id y etiqueta).
function questionMeta(qid) {
  const q = QUESTIONS.find((x) => x.id === qid);
  if (!q) return null;
  return {
    id: q.id,
    q: q.q,
    purpose: QUESTION_HELP[qid] || "",
    risks: (q.risks || []).map((code) => { const r = RISKS.find((x) => x.code === code); return { code, title: r ? r.title : code }; }),
    laws: (q.laws || []).map((id) => ({ id, label: lawLabel(id) })),
  };
}

const ANSWER_VALUE = { si: 1, parcial: 0.5, no: 0, ns: 0.15 };
const ANSWER_LABEL = { si: "Sí", parcial: "Parcial", no: "No", ns: "No sé" };
const bandOf = (level) => (level <= 4 ? "low" : level <= 10 ? "med" : level <= 15 ? "high" : "crit");
const BAND_LABEL = { low: "Bajo", med: "Medio", high: "Alto", crit: "Crítico" };
// ---------------------------------------------------------------------
// Ponderación de respuestas (peso base por rol + excepciones por pregunta).
// La probabilidad de cada riesgo se calcula como MEDIA PONDERADA de las
// respuestas: cada respuesta pesa según el rol de quien la da y, si procede,
// según un reparto específico para esa pregunta. Predeterminado razonado:
// se da algo más de peso a quien vive el control en el día a día, porque su
// conocimiento refleja la implantación real. El consultor puede ajustar estos
// pesos por modelo desde la aplicación.
//
// Un solo nivel: para CADA pregunta, un reparto de influencia expresado en %
// que suman 100 entre los roles que la contestan. El predeterminado incorpora la
// tendencia "front-line pesa más" pregunta a pregunta. El consultor puede
// personalizar el reparto de cualquier pregunta desde la aplicación; lo que no
// personaliza usa este reparto por defecto. (Los números se normalizan igual
// aunque no sumen exactamente 100.)
const DEFAULT_WEIGHTS = {
  questions: {
    q1: { titularidad: 50, direccion: 50 },
    q2: { titularidad: 48, coordinador: 52 },
    q3: { titularidad: 50, direccion: 50 },
    q4: { profesorado: 50, coordinador: 30, direccion: 20 },   // protocolos difundidos e implantados
    q5: { nodocente: 36, titularidad: 32, direccion: 32 },
    q6: { jefatura: 55, coordinador: 45 },                     // protocolo de violencia/acoso operativo
    q7: { coordinador: 48, profesorado: 52 },
    q8: { direccion: 48, coordinador: 52 },
    q9: { titularidad: 48, nodocente: 52 },
    q10: { direccion: 48, nodocente: 52 },
    q11: { profesorado: 50, coordinador: 30, direccion: 20 },  // canal accesible y difundido
    q12: { profesorado: 55, nodocente: 45 },                   // conocer el deber de comunicar
    q13: { coordinador: 35, nodocente: 34, direccion: 31 },
    q14: { direccion: 48, coordinador: 52 },
    q15: { profesorado: 55, jefatura: 45 },                    // ratios y vigilancia diaria
    q16: { direccion: 50, jefatura: 50 },
    q17: { nodocente: 100 },
    q18: { nodocente: 100 },
    q19: { dpd: 48, nodocente: 52 },
    q20: { dpd: 50, direccion: 50 },
    q21: { titularidad: 50, dpd: 50 },
    q22: { direccion: 48, coordinador: 52 },
    q23: { titularidad: 50, direccion: 50 },
    q24: { titularidad: 50, direccion: 50 },
    q25: { titularidad: 100 },
    q26: { direccion: 100 },
    q27: { direccion: 50, jefatura: 50 },
    q28: { direccion: 48, coordinador: 52 },
    q29: { coordinador: 55, jefatura: 45 },                    // protocolos autonómicos aplicados
    q30: { titularidad: 50, direccion: 50 },
    q31: { profesorado: 45, jefatura: 35, direccion: 20 },     // simulacros realizados
    q32: { profesorado: 50, nodocente: 50 },                   // funciones en emergencia
  },
};

// Fusiona el reparto personalizado del modelo sobre los repartos por defecto:
// una pregunta usa el reparto del consultor si lo tiene; si no, el predeterminado.
function resolveWeights(weights) {
  const uq = (weights && typeof weights === "object" && weights.questions && typeof weights.questions === "object") ? weights.questions : {};
  return { questions: Object.assign({}, DEFAULT_WEIGHTS.questions, uq) };
}

function effectiveWeight(qid, role, W) {
  const qov = W && W.questions && W.questions[qid];
  if (qov && qov[role] != null && isFinite(qov[role])) return Math.max(0, qov[role]);
  return 1; // sin reparto definido para ese rol → peso neutro
}

// Reparto de influencia de una pregunta: cómo se distribuye el 100% entre los
// roles que la contestan (q.roles), según el reparto efectivo. La cuota de cada
// rol es peso ÷ Σpesos, de modo que las cuotas SIEMPRE suman 100%. Devuelve
// [{ role, label, weight, share }] ordenado de mayor a menor influencia.
function questionInfluence(qid, weights) {
  const W = resolveWeights(weights);
  const q = QUESTIONS.find((x) => x.id === qid);
  if (!q) return [];
  const rows = q.roles.map((role) => ({ role, label: roleLabel(role), weight: effectiveWeight(qid, role, W) }));
  const tot = rows.reduce((s, r) => s + r.weight, 0) || 1;
  rows.forEach((r) => { r.share = r.weight / tot; });
  return rows.sort((a, b) => b.share - a.share);
}

const validPI = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);

// Acepta el centro en cualquiera de sus formatos (app, backend o motor) y
// devuelve la evaluación RD 393/2007, o null si no hay datos del centro.
function rd393FromCenter(center) {
  if (!center) return null;
  if (center.rd393) return center.rd393;
  const pick = (...vals) => { for (const v of vals) if (v !== undefined && v !== null) return v; return null; };
  return rd393Assessment({
    num_students: pick(center.num_students, center.alumnos),
    num_teaching_staff: pick(center.num_teaching_staff, center.docentes),
    num_non_teaching_staff: pick(center.num_non_teaching_staff, center.noDocentes),
    num_other_people: pick(center.num_other_people, center.otras),
    height_ge_28m: pick(center.height_ge_28m, center.alturaGe28m, center.altura28) || false,
    special_evacuation: pick(center.special_evacuation, center.evacuacionEspecial, center.evacEspecial) || false,
  });
}

function computeRisks(interviews, overrides = {}, center = null, weights = null) {
  overrides = overrides && typeof overrides === "object" ? overrides : {};
  // Config de pesos: reparto por pregunta del modelo fusionado sobre el predeterminado.
  const W = resolveWeights(weights);
  // Si el RD 393/2007 es de aplicación al centro, el impacto del riesgo R24
  // sube a Muy alto (5): la autoprotección pasa de buena práctica exigible a
  // obligación legal directa y sancionable (arts. 2 y 9 RD 393/2007).
  const rd393 = rd393FromCenter(center);
  return RISKS.map((risk) => {
    const qs = QUESTIONS.filter((q) => q.risks.includes(risk.code));
    const answers = [];
    const discrepancies = [];
    qs.forEach((q) => {
      const perQ = [];
      interviews.forEach((iv) => {
        const a = iv.answers[q.id];
        if (a) { answers.push(a); if (iv.role !== CONSULTANT_ROLE) perQ.push({ role: iv.role, val: ANSWER_VALUE[a], raw: a }); }
      });
      if (perQ.length >= 2) {
        const vals = perQ.map((x) => x.val);
        if (Math.max(...vals) - Math.min(...vals) >= 0.5) discrepancies.push({ q: q.q, detail: perQ });
      }
    });
    const nsCount = answers.filter((a) => a === "ns").length;
    const missingQs = qs.filter((q) => interviews.some((iv) => ["no", "parcial", "ns"].includes(iv.answers[q.id])));
    const missing = missingQs.map((q) => q.q);                                   // preguntas (compat.)
    const actions = missingQs.map((q) => QUESTION_ACTIONS[q.id] || q.q);         // acciones correctoras
    // Probabilidad sugerida = media PONDERADA de las respuestas (peso por rol y
    // por pregunta, ver DEFAULT_WEIGHTS / config del modelo).
    let probSuggested = null, control = null;
    if (answers.length) {
      let num = 0, den = 0;
      qs.forEach((q) => {
        interviews.forEach((iv) => {
          const a = iv.answers[q.id];
          if (!a) return;
          const w = effectiveWeight(q.id, iv.role, W);
          num += ANSWER_VALUE[a] * w;
          den += w;
        });
      });
      control = den > 0 ? num / den : null;
      if (control != null) probSuggested = Math.min(5, Math.max(1, Math.round(5 - control * 4)));
    }
    const impactSuggested = (risk.code === "R24" && rd393 && rd393.applies) ? 5 : risk.impact;
    const ov = overrides[risk.code] || null;
    const ovProb = ov ? validPI(ov.prob) : null;
    const ovImpact = ov ? validPI(ov.impact) : null;
    const overriddenFields = [];
    if (ovProb != null) overriddenFields.push("prob");
    if (ovImpact != null) overriddenFields.push("impact");
    const overridden = overriddenFields.length > 0;
    const prob = ovProb != null ? ovProb : probSuggested;
    const impact = ovImpact != null ? ovImpact : impactSuggested;
    const common = { ...risk, impact, prob, probSuggested, impactSuggested, overridden, overriddenFields, control, nsCount, missing, actions, discrepancies };
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

const RD393_OCCUPANCY_THRESHOLD = 2000;
const RD393_HEIGHT_THRESHOLD_M = 28;
function rd393Assessment(center) {
  center = center || {};
  const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const students = n(center.num_students);
  const teaching = n(center.num_teaching_staff);
  const nonTeaching = n(center.num_non_teaching_staff);
  const others = n(center.num_other_people);
  const occupancy = students + teaching + nonTeaching + others;
  const byOccupancy = occupancy >= RD393_OCCUPANCY_THRESHOLD;
  const byHeight = !!center.height_ge_28m;
  // Anexo I.e, primer supuesto: centros especialmente destinados a personas con
  // discapacidad física o psíquica o que no puedan evacuar por sus propios
  // medios. Aplica SIN umbral de ocupación ni altura.
  const bySpecial = !!center.special_evacuation;
  const reasons = [];
  if (bySpecial) reasons.push("centro especialmente destinado a personas que no pueden realizar una evacuación por sus propios medios (Anexo I.e, sin umbral)");
  if (byOccupancy) reasons.push(`ocupación total de ${occupancy} personas (≥ ${RD393_OCCUPANCY_THRESHOLD})`);
  if (byHeight) reasons.push(`altura de evacuación ≥ ${RD393_HEIGHT_THRESHOLD_M} m (10 plantas)`);
  return { occupancy, byOccupancy, byHeight, bySpecial, applies: byOccupancy || byHeight || bySpecial, reasons };
}

module.exports = {
  LAW_CATALOG, LAW_LEVELS, lawShort, lawLabel, ROLES, roleLabel, roleShort,
  RISKS, QUESTIONS, QUESTION_ACTIONS, QUESTION_HELP, questionMeta, ANSWER_VALUE, ANSWER_LABEL, bandOf, BAND_LABEL,
  computeRisks, computeCoverage, CONSULTANT_ROLE,
  rd393Assessment, rd393FromCenter, RD393_OCCUPANCY_THRESHOLD, RD393_HEIGHT_THRESHOLD_M,
  DEFAULT_WEIGHTS, resolveWeights, effectiveWeight, questionInfluence,
};
