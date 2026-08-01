/* ================================================================== *
 *  docgen.js  (v2 — informe integrado)
 *  Genera un .docx que integra el diagnóstico personalizado del
 *  centro con el Modelo Integral de Prevención y Compliance
 *  (LOPIVI / ISO 37301:2021), a partir del JSON que exporta la app
 *  ({ center, interviews }).
 *
 *  Estructura del documento:
 *    Portada · Aviso · Resumen ejecutivo · Índice
 *    PARTE I   — Marco general de referencia (1-4)
 *    PARTE II  — Diagnóstico personalizado del centro (5-12)
 *    PARTE III — Modelo de prevención y compliance (13-16)
 *    PARTE IV  — Implantación y seguimiento (17-22)
 *    ANEXO A   — Cláusula informativa (arts. 13-14 RGPD)
 *
 *  Uso:  node docgen.js <entrada.json> [salida.docx]
 * ================================================================== */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak, TableOfContents,
} = require("docx");
const E = require("./engine/engine.js");
const J = require("./justificaciones-riesgos.js");

// Nombre de archivo seguro a partir del nombre del centro.
function safeName(name) { return (name || "centro").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, ""); }

/* ================================================================== *
 *  CONTENIDO ESTÁTICO (condensado del Modelo Integral de Prevención)
 * ================================================================== */

// --- Parte I · 3. Marco legal estatal (condensado) ---
const MARCO_ESTATAL = [
  ["LOPIVI — LO 8/2021 (capítulo educativo, arts. 30 y ss.)",
   "Protección integral frente a la violencia; prevención, sensibilización y detección precoz; cultura de buen trato y entornos seguros.",
   "Administración educativa, titularidad, dirección y todo el personal.",
   "Falta de cultura preventiva; sanción administrativa; responsabilidad por omisión de diligencia.",
   "Política de protección; plan de formación; registros de actuaciones."],
  ["LOPIVI — art. 35",
   "Designación del Coordinador/a de Bienestar y Protección en todo centro que escolarice a menores.",
   "Titularidad y dirección del centro.",
   "Incumplimiento legal directo; debilidad de todo el sistema de protección.",
   "Acta de designación; funciones definidas; formación acreditada."],
  ["LOPIVI — arts. 13, 15 y 16 (deber de comunicación)",
   "Comunicar situaciones de violencia: deber general (art. 13) y deber cualificado e inmediato del personal en contacto con menores (arts. 15-16).",
   "Toda persona; de forma cualificada, el personal del centro.",
   "Omisión de comunicación; posible responsabilidad penal por omisión; agravamiento del daño al menor.",
   "Registro de comunicaciones; formularios de derivación; acuses de recibo."],
  ["LOPIVI — art. 57 (certificación negativa)",
   "Acreditar mediante certificación negativa del Registro Central de Delincuentes Sexuales y de Trata la aptitud para trabajos habituales con menores.",
   "Titularidad, RR. HH., proveedores y entidades que aportan personal.",
   "Contratación o asignación irregular; responsabilidad in eligendo / in vigilando.",
   "Certificados negativos; registro de verificación y renovaciones; cláusulas contractuales."],
  ["LOPJM — LO 1/1996 (reformada en 2015)",
   "Protección jurídica del menor; interés superior (art. 2); deber de comunicar situaciones de riesgo o desamparo (art. 13).",
   "Administraciones, centros y profesionales.",
   "Inacción ante situaciones de riesgo; responsabilidad administrativa.",
   "Protocolo de detección; comunicaciones a servicios sociales."],
  ["LOE — LO 2/2006 (mod. LOMLOE)",
   "Convivencia escolar y plan de convivencia (art. 124); normas de organización y funcionamiento; derechos y deberes del alumnado (art. 108.4).",
   "Dirección, claustro, consejo escolar, titularidad.",
   "Convivencia deficiente; nulidad de medidas; reclamaciones.",
   "Plan de convivencia; NOF/RRI; actas del consejo escolar."],
  ["Código Civil — arts. 1902-1904",
   "Responsabilidad civil por culpa o negligencia; los titulares de centros docentes responden por daños de alumnos menores bajo control del profesorado.",
   "Titularidad del centro (privados y concertados).",
   "Indemnización de daños; la diligencia debida probada exonera (art. 1903 in fine).",
   "Protocolos de vigilancia; partes de incidencias; seguro de RC."],
  ["Código Penal — arts. 11, 31 bis y 450",
   "Comisión por omisión (posición de garante); responsabilidad penal de la persona jurídica y valor eximente/atenuante del modelo de organización.",
   "Personas con deber de garante; persona jurídica titular.",
   "Responsabilidad penal individual y de la entidad.",
   "Modelo de compliance penal; evidencias de supervisión y reacción."],
  ["Ley 40/2015 — responsabilidad patrimonial",
   "La Administración responde por daños derivados del funcionamiento de los servicios públicos; repetición por dolo o culpa grave.",
   "Administración educativa (centros públicos).",
   "Reclamación patrimonial (plazo: 1 año, Ley 39/2015).",
   "Expediente del incidente; informe de la dirección; trazabilidad de medidas."],
  ["RGPD (UE) 2016/679 y LOPDGDD (LO 3/2018)",
   "Licitud, minimización y seguridad del tratamiento; protección reforzada de datos de menores y de categorías especiales.",
   "Titularidad como responsable del tratamiento; DPD si procede.",
   "Sanciones; vulneración de confidencialidad; revictimización.",
   "Registro de actividades (RAT); EIPD; contratos de encargo (art. 28)."],
  ["Ley 2/2023 — protección de informantes",
   "Sistema interno de información y protección frente a represalias de quienes comunican infracciones.",
   "Entidades públicas y privadas en su ámbito de aplicación (verificar umbral).",
   "Falta de canal conforme; represalias; sanciones.",
   "Canal de denuncias; política de no represalias; registro confidencial."],
  ["Ley 31/1995 — prevención de riesgos laborales",
   "Seguridad y salud del personal; evaluación de riesgos y medidas preventivas.",
   "Empleador (titularidad / Administración).",
   "Responsabilidad administrativa y, en su caso, penal o recargo.",
   "Plan de prevención; evaluaciones de riesgo; formación PRL."],
  ["LO 1/2004 — violencia de género",
   "Protección integral contra la violencia de género; reconoce a los menores como víctimas con proyección educativa.",
   "Administración, centro y personal.",
   "No detección o derivación de menores víctimas.",
   "Protocolo de protección y derivación; coordinación especializada."],
  ["Ley 4/2015 — Estatuto de la víctima",
   "Derechos de información, protección y participación; protección reforzada del menor y prevención de la victimización secundaria.",
   "Centro y personal en su relación con víctimas menores.",
   "Revictimización; trato inadecuado a la víctima.",
   "Protocolo de escucha única; registro de derivaciones."],
  ["RD 393/2007 — Norma Básica de Autoprotección",
   "Plan de Autoprotección en centros docentes destinados a personas que no puedan evacuar por sus propios medios (Anexo I.e, sin umbral) y en centros con ocupación ≥ 2.000 personas o altura de evacuación ≥ 28 m; las CCAA pueden extender la exigencia (art. 2.2).",
   "Titularidad del centro (y Administración educativa en públicos).",
   "Sanción administrativa (art. 9, en relación con la Ley 17/2015); responsabilidad agravada ante una emergencia.",
   "Plan de Autoprotección registrado; actas de simulacro anual; designación de equipos de emergencia."],
  ["Normativa autonómica y sectorial",
   "Protocolos autonómicos de acoso, convivencia y violencia; normas de transporte, comedores, actividades deportivas y salidas.",
   "Centro, Administración autonómica, proveedores.",
   "Incumplimiento de protocolo oficial; sanción; responsabilidad.",
   "Protocolos oficiales aplicados; autorizaciones y ratios; contratos sectoriales."],
];

// --- Parte I · 4. Mapa de actores (condensado) ---
const ACTORES = [
  ["Titularidad del centro",
   "Garantizar medios y políticas; aprobar el sistema de protección; verificar certificados (art. 57).",
   "Civil (art. 1903 CC); penal de la persona jurídica (art. 31 bis CP); administrativa.", "Muy alta",
   "Política aprobada; presupuesto y RR. HH.; modelo de compliance; actas de aprobación."],
  ["Dirección del centro",
   "Implantar protocolos; activar comunicaciones; supervisar y decidir medidas.",
   "Administrativa/disciplinaria; civil; penal por omisión si concurre posición de garante.", "Muy alta",
   "Supervisión documentada; decisiones motivadas; expedientes y actas."],
  ["Coordinador/a de Bienestar y Protección",
   "Referente de protección; impulsar formación y protocolos; coordinar casos (art. 35 LOPIVI).",
   "Disciplinaria/laboral; soporte a la responsabilidad del centro.", "Alta",
   "Acta de designación; plan de actuación; bitácora de casos; formación acreditada."],
  ["Equipo docente",
   "Vigilancia y custodia; detección; deber de comunicación cualificado (arts. 15-16).",
   "Disciplinaria/laboral; penal por omisión en casos graves.", "Alta",
   "Formación; partes de incidencia; acuses de comunicación."],
  ["Personal no docente",
   "Colaborar en vigilancia y comunicación; cumplir el código de conducta.",
   "Disciplinaria/laboral; civil o penal según el caso.", "Media",
   "Código de conducta firmado; formación básica; registros de turnos."],
  ["Consejo escolar / órganos equivalentes",
   "Supervisar la convivencia; participar en medidas; control institucional.",
   "Institucional; corresponsabilidad en gobernanza.", "Media",
   "Actas y acuerdos; revisión de planes."],
  ["Familias y tutores legales",
   "Colaborar; informar; autorizar actividades; ejercer la guarda.",
   "Civil (patria potestad); deberes de colaboración.", "Media",
   "Autorizaciones firmadas; registro de avisos; datos de contacto."],
  ["Alumnado",
   "Respetar la convivencia; participar en la prevención según la edad.",
   "Medidas educativas/disciplinarias; en su caso, responsabilidad de progenitores.", "Variable",
   "Plan de convivencia; mediación; registros de convivencia."],
  ["Ayuntamiento",
   "Servicios sociales municipales; conservación de edificios públicos; actividades municipales.",
   "Patrimonial de la Administración local.", "Media",
   "Convenios; partes de mantenimiento; registro de derivaciones."],
  ["Administración educativa autonómica",
   "Dictar y supervisar protocolos; formación; financiación; titularidad de centros públicos.",
   "Patrimonial; institucional.", "Alta (en públicos)",
   "Protocolos oficiales; planes de formación; instrucciones y circulares."],
  ["Inspección educativa",
   "Supervisar el cumplimiento; asesorar; tramitar incidencias.",
   "Institucional.", "Media",
   "Informes de inspección; requerimientos."],
  ["Servicios sociales",
   "Valorar y atender situaciones de riesgo o desamparo; coordinación.",
   "Patrimonial / institucional.", "Media",
   "Derivaciones y respuestas; planes de caso."],
  ["Empresas externas / contratistas",
   "Cumplir el código de conducta; aportar personal con certificación; coordinarse con el centro.",
   "Contractual; civil; en su caso penal.", "Alta",
   "Contratos con cláusulas LOPIVI; certificados del personal; seguros."],
  ["Monitores, entrenadores y personal de actividades",
   "Vigilancia y custodia en su actividad; comunicación de incidencias; ratios.",
   "Civil; disciplinaria; penal según el caso.", "Alta",
   "Certificados; formación; hojas de ruta y ratios; registros de actividad."],
  ["AMPA / asociaciones",
   "Colaborar; ajustarse al marco del centro en las actividades que organicen.",
   "Civil de la asociación; colaboración.", "Media",
   "Convenios; certificados de colaboradores; autorizaciones."],
  ["FCSE / Fiscalía de Menores / autoridad judicial",
   "Recibir comunicaciones; investigar; proteger; resolver cuando proceda (actores externos de garantía).",
   "—", "—",
   "Cauces de comunicación definidos; denuncias y resoluciones."],
];

// --- Parte III · 13. Sistema de gestión ISO 37301 (condensado) ---
const ISO_ELEMENTOS = [
  ["5.1 Contexto de la organización", "Analizar tipo de centro, etapas, actividades, proveedores y marco autonómico; mapear partes interesadas.", "Análisis de contexto; alcance del sistema", "Dirección / Coordinador/a"],
  ["5.2 Liderazgo y compromiso", "Aprobación formal de la política, asignación de presupuesto y respaldo público al Coordinador/a.", "Acta de compromiso; política firmada", "Titularidad"],
  ["5.3 Política de protección", "Documento breve, claro y público, alineado con la LOPIVI y difundido a toda la comunidad.", "Política de protección de la infancia", "Titularidad (aprueba) / Coordinador/a (impulsa)"],
  ["5.4 Identificación de obligaciones", "Catálogo actualizado de obligaciones (como el apartado 3) con responsable y evidencia; vigilancia normativa.", "Catálogo de obligaciones; registro de cambios", "Coordinador/a con apoyo jurídico"],
  ["5.5 Evaluación de riesgos", "Mantener viva la matriz de riesgos (Parte II) y revisarla tras incidentes o cambios.", "Matriz de riesgos; metodología", "Coordinador/a / calidad"],
  ["5.6 Planificación de controles y objetivos", "Plan anual de compliance con objetivos medibles, controles y responsables.", "Plan anual; objetivos e indicadores", "Dirección / Coordinador/a"],
  ["5.7 Recursos y responsabilidades", "Organigrama de protección; ficha de funciones del Coordinador/a; suplencias previstas.", "Organigrama; descripciones de funciones", "Titularidad / RR. HH."],
  ["5.8 Competencia y formación", "Plan de formación anual obligatorio, con evaluación y registro de asistencia.", "Plan de formación; registros y certificados", "Coordinador/a de Bienestar"],
  ["5.9 Comunicación interna y externa", "Difusión a familias, personal y alumnado; cartelería del canal; información a proveedores.", "Plan de comunicación; materiales", "Dirección / Coordinador/a"],
  ["5.10 Información documentada", "Sistema de versiones, custodia segura y plazos de conservación, especialmente de casos.", "Procedimiento documental; índice maestro", "Secretaría / DPD"],
  ["5.11 Controles operativos", "Implantar en el día a día los controles del apartado 15 (certificados, vigilancia, gestión de casos…).", "Protocolos operativos; listas de verificación", "Responsables de proceso"],
  ["5.12 Canal de comunicación o denuncia", "Canal con varias vías, accesible a menores y adultos, con confidencialidad y registro (ISO 37002; Ley 2/2023).", "Procedimiento del canal; registro confidencial", "Responsable del canal"],
  ["5.13 Investigación interna y respuesta", "Procedimiento de actuación con plazos, medidas cautelares y derivación a autoridades cuando proceda.", "Procedimiento de investigación; modelos de acta", "Dirección / Coordinador/a"],
  ["5.14 Protección frente a represalias", "Política de no represalias y medidas de protección del informante y de la víctima.", "Política de no represalias", "Titularidad / Coordinador/a"],
  ["5.15 Seguimiento y medición", "Cuadro de mando del apartado 19, revisado periódicamente y con análisis de resultados.", "Cuadro de indicadores; informes", "Coordinador/a / calidad"],
  ["5.16 Auditoría interna", "Programa anual de auditoría interna o revisión cruzada con lista de verificación.", "Plan de auditoría; informes; no conformidades", "Persona/área independiente"],
  ["5.17 Revisión por la dirección", "Reunión anual con entradas (indicadores, incidentes, auditorías) y salidas (decisiones y recursos).", "Acta de revisión por la dirección", "Titularidad / Dirección"],
  ["5.18 Mejora continua", "Acciones correctivas con responsable y plazo; lecciones aprendidas de incidentes y auditorías.", "Registro de acciones correctivas", "Coordinador/a / calidad"],
];

// --- Parte III · 14. Políticas y protocolos mínimos (condensado) ---
const POLITICAS = [
  ["Política de protección de la infancia y adolescencia", "Declarar principios, tolerancia cero a la violencia y compromisos del centro.", "Titularidad / Coordinador/a", "Documento firmado y publicado; acuses de difusión"],
  ["Código de conducta (personal y terceros)", "Fijar pautas de relación adecuada con menores y conductas prohibidas.", "Titularidad / RR. HH.", "Códigos firmados por todo el personal y terceros"],
  ["Protocolo de prevención y actuación frente a la violencia", "Prevenir, detectar, comunicar y actuar ante cualquier forma de violencia.", "Dirección / Coordinador/a", "Registro de actuaciones; comunicaciones"],
  ["Protocolo de acoso escolar y ciberacoso", "Actuar de forma estructurada ante acoso entre iguales y en entornos digitales.", "Dirección / tutoría / orientación", "Expedientes de caso; seguimiento"],
  ["Protocolo ante sospecha de abuso sexual o violencia grave", "Comunicación inmediata, protección y no revictimización (escucha única).", "Dirección / Titularidad", "Expediente reservado; registro de comunicaciones"],
  ["Protocolo de comunicación con familias", "Ordenar la información a tutores legales respetando confidencialidad y custodia.", "Dirección / tutorías", "Registro de avisos; autorizaciones"],
  ["Protocolo de coordinación con servicios sociales y autoridades", "Asegurar derivaciones ágiles y trazables con interlocutores definidos.", "Dirección / Coordinador/a", "Registro de derivaciones y respuestas"],
  ["Protocolo de extraescolares, excursiones y transporte", "Garantizar custodia, ratios y seguridad fuera del aula.", "Dirección / responsables de actividad", "Planes de salida; autorizaciones; ratios"],
  ["Procedimiento de selección y control de personal y proveedores", "Evitar la incorporación de personas no aptas (verificación art. 57; cláusulas LOPIVI).", "Titularidad / RR. HH.", "Registro de certificados; contratos con cláusulas"],
  ["Procedimiento del canal de comunicación o denuncia", "Habilitar un cauce accesible y seguro con confidencialidad y no represalias.", "Titularidad / responsable del canal", "Registro confidencial; acuses"],
  ["Procedimiento de gestión documental", "Asegurar trazabilidad, custodia, accesos y plazos de conservación.", "Titularidad / DPD / Secretaría", "Índice documental; control de accesos"],
  ["Plan de formación anual", "Capacitar a todo el personal y terceros, con evaluación y registro.", "Dirección / Coordinador/a", "Actas, certificados y evaluaciones"],
  ["Plan de auditoría y revisión", "Verificar y mejorar el sistema de forma periódica.", "Titularidad / auditor/a interno/a", "Plan e informes de auditoría; acciones"],
];

// --- Parte III · 15. Catálogo de controles (con riesgos asociados) ---
const CONTROLES = [
  ["Plan de formación anual obligatorio", "Preventivo", "R03, R20", "Coordinador/a", "Anual", "Actas, certificados", "Alta"],
  ["Sensibilización del alumnado (buen trato, digital)", "Preventivo", "R06, R08", "Tutorías", "Trimestral", "Programación y registros", "Media"],
  ["Verificación del certificado de delitos sexuales (art. 57)", "Preventivo", "R09, R15", "RR. HH.", "Previa y anual", "Registro de certificados", "Alta"],
  ["Homologación de proveedores con cláusulas LOPIVI", "Preventivo", "R10, R14", "Administración", "Por contrato / anual", "Contratos y check-list", "Alta"],
  ["Mapa de vigilancia y ratios (patios, transiciones)", "Preventivo", "R16, R08", "Jefatura de estudios", "Mensual", "Cuadrantes de turnos", "Alta"],
  ["Planes de salida y autorizaciones", "Preventivo", "R13, R10", "Responsable de salida", "Por actividad", "Plan y autorizaciones", "Media"],
  ["Norma de uso de TIC y dispositivos", "Preventivo", "R06, R19", "Responsable TIC", "Anual", "Norma firmada", "Media"],
  ["Plan de Autoprotección, simulacro anual y equipos de emergencia", "Preventivo", "R24", "Titularidad / Dirección", "Anual", "Plan registrado; actas de simulacro", "Alta"],
  ["Supervisión documentada por la dirección", "Detectivo", "R04, R21", "Dirección", "Mensual", "Actas de supervisión", "Alta"],
  ["Canal de comunicación/denuncia accesible", "Detectivo", "R04, R07, R09", "Responsable del canal", "Continuo", "Registro confidencial", "Alta"],
  ["Indicadores de alerta y observación en aula", "Detectivo", "R05, R08", "Profesorado", "Continuo", "Partes de incidencia", "Media"],
  ["Encuestas de clima y percepción de seguridad", "Detectivo", "R05, R23", "Orientación", "Anual", "Resultados de encuesta", "Media"],
  ["Revisión de logs y accesos a datos sensibles", "Detectivo", "R18, R19", "DPD", "Trimestral", "Logs revisados", "Media"],
  ["Procedimiento de actuación ante indicios", "Reactivo", "R04, R07", "Coordinador/a", "Por caso", "Expediente del caso", "Alta"],
  ["Comunicación inmediata a Fiscalía/FCSE/servicios sociales", "Reactivo", "R07, R22", "Dirección", "Por caso", "Registro de derivaciones", "Alta"],
  ["Medidas cautelares y de protección de la víctima", "Reactivo", "R07, R17", "Dirección", "Por caso", "Acuerdos motivados", "Alta"],
  ["Plan de gestión de crisis y comunicación", "Reactivo", "R23", "Titularidad", "Por crisis", "Plan y bitácora", "Media"],
  ["Acciones correctivas tras incidentes", "Correctivo", "R02, R21", "Coordinador/a", "Por incidente", "Registro de acciones", "Alta"],
  ["Actualización de protocolos tras cambios o lecciones", "Correctivo", "R01, R02", "Coordinador/a", "Anual / ad hoc", "Control de versiones", "Media"],
  ["Revisión disciplinaria/laboral cuando proceda", "Correctivo", "R09", "RR. HH.", "Por caso", "Expediente laboral", "Media"],
  ["Cuadro de indicadores y seguimiento", "Seguimiento", "Todos", "Coordinador/a", "Trimestral", "Informe de indicadores", "Alta"],
  ["Auditoría interna del sistema", "Seguimiento", "Todos", "Auditor/a interno/a", "Anual", "Informe de auditoría", "Alta"],
  ["Revisión por la dirección", "Seguimiento", "Todos", "Titularidad", "Anual", "Acta de revisión", "Alta"],
];

// --- Parte III · 16. Tipos de responsabilidad ---
const TIPOS_RESP = [
  ["Civil", "Reparar el daño causado por culpa o negligencia (arts. 1902-1903 CC).", "Titularidad (privada/concertada), personal, terceros.", "La diligencia debida probada puede exonerar (art. 1903 CC)."],
  ["Penal", "Sancionar conductas dolosas o imprudentes; persona jurídica (art. 31 bis CP).", "Personas con deber de garante; entidad titular.", "Exige dolo/imprudencia y nexo causal; el compliance puede atenuar o eximir."],
  ["Administrativa", "Sancionar el incumplimiento de obligaciones (LOPIVI, educación, datos).", "Centro, titularidad, personal.", "Depende del régimen sancionador aplicable y de la CCAA."],
  ["Disciplinaria / laboral", "Corregir incumplimientos del personal.", "Personal docente y no docente.", "Sujeta a normativa laboral o funcionarial y a garantías."],
  ["Patrimonial de la Administración", "Indemnizar daños del servicio público educativo (Ley 40/2015).", "Administración (centros públicos).", "Repetición frente al personal por dolo o culpa grave."],
  ["Reputacional e institucional", "Pérdida de confianza y prestigio.", "Centro, titularidad, comunidad.", "No es jurídica en sentido estricto, pero condiciona la viabilidad."],
];

const ACTOR_ANALISIS = [
  ["Directores y equipos directivos", "Posición de garante reforzada por su deber de organizar, supervisar y reaccionar. La omisión documentada de medidas o de comunicación incrementa la exposición; la diligencia acreditada (protocolos aplicados, decisiones motivadas, derivaciones) es su principal defensa."],
  ["Titulares de centros privados o concertados", "Asumen responsabilidad civil (art. 1903 CC) y, como persona jurídica, posible responsabilidad penal (art. 31 bis CP), donde un modelo de compliance idóneo e implantado puede operar como eximente o atenuante."],
  ["Administración educativa", "En centros públicos los daños suelen canalizarse por la vía patrimonial (Ley 40/2015). Además dicta y supervisa protocolos y debe garantizar formación y medios."],
  ["Ayuntamientos", "Pueden responder por servicios sociales municipales, mantenimiento de edificios de titularidad municipal o actividades organizadas por ellos, normalmente por la vía patrimonial."],
  ["Personal docente y no docente", "Deber de vigilancia, detección y comunicación. La responsabilidad disciplinaria/laboral es la más frecuente; el cumplimiento del código de conducta y de los protocolos reduce la exposición."],
  ["Empresas contratistas, monitores y terceros", "Responden por su actividad (contractual y civil; penal según el caso). El centro responde por culpa in eligendo / in vigilando si no homologa ni controla: cláusulas LOPIVI, certificados y supervisión."],
  ["Familias, cuando proceda", "Pueden incurrir en responsabilidad civil por hechos de sus hijos menores (patria potestad) y tienen deberes de colaboración e información."],
];

// --- Parte IV · 18. Plan de implantación por fases (condensado) ---
const FASES = [
  ["Fase 1 — Diagnóstico inicial", "Conocer la situación de partida y las brechas (este informe cumple esta fase).", "Semanas 1-3", "Informe de diagnóstico; lista de brechas"],
  ["Fase 2 — Identificación normativa y mapa de riesgos", "Fijar obligaciones aplicables y priorizar riesgos, con validación jurídica.", "Semanas 3-6", "Catálogo de obligaciones; matriz de riesgos"],
  ["Fase 3 — Diseño documental", "Redactar política, código y protocolos (apartado 14); validación y aprobación.", "Semanas 6-12", "Política, código y protocolos aprobados"],
  ["Fase 4 — Formación y comunicación", "Capacitar por perfiles y difundir el sistema a la comunidad.", "Semanas 10-16", "Registros de formación; materiales difundidos"],
  ["Fase 5 — Implantación de controles", "Activar certificados, vigilancia, canal y gestión de casos (apartado 15).", "Semanas 12-20", "Controles operativos; registros"],
  ["Fase 6 — Pruebas, simulacros y revisión", "Verificar que el sistema funciona en la práctica.", "Semanas 18-24", "Informe de simulacros; ajustes"],
  ["Fase 7 — Auditoría interna", "Verificar conformidad y eficacia de forma independiente.", "Semanas 24-30", "Informe de auditoría; plan de acciones"],
  ["Fase 8 — Mejora continua", "Revisión por la dirección; acciones correctivas; actualización anual.", "Continuo / anual", "Acta de revisión; registro de mejoras"],
];

// --- Parte IV · 19. Cuadro de indicadores ---
const INDICADORES = [
  ["% de personal formado", "Cumplimiento", "Formados / total plantilla", "≥ 95 %", "Anual", "Registros de formación"],
  ["% personal con certificado vigente (art. 57)", "Cumplimiento", "Con certificado / total con contacto", "100 %", "Anual", "Registro de certificados"],
  ["% de protocolos aprobados y vigentes", "Cumplimiento", "Aprobados / previstos", "100 %", "Anual", "Control de versiones"],
  ["% de proveedores con cláusulas LOPIVI", "Cumplimiento", "Evaluados / total", "≥ 90 %", "Anual", "Check-list de proveedores"],
  ["% de expedientes documentales completos", "Cumplimiento", "Completos / total", "≥ 95 %", "Semestral", "Índice documental"],
  ["Simulacros de evacuación realizados y registrados", "Cumplimiento", "Recuento anual", "≥ 1/año", "Anual", "Actas de simulacro"],
  ["Nº de comunicaciones/alertas recibidas", "Eficacia", "Recuento", "Tendencia analizada", "Trimestral", "Registro del canal"],
  ["Tiempo medio de respuesta ante incidencias", "Eficacia", "Media de horas/días", "Según protocolo", "Trimestral", "Expedientes de caso"],
  ["% de medidas correctivas cerradas en plazo", "Eficacia", "Cerradas en plazo / total", "≥ 90 %", "Trimestral", "Registro de acciones"],
  ["Nº de auditorías realizadas", "Eficacia", "Recuento", "≥ 1/año", "Anual", "Informes de auditoría"],
  ["Incidencias repetidas (reincidencia)", "Alerta temprana", "Casos reabiertos / total", "Tendencia a la baja", "Trimestral", "Registro de casos"],
  ["Índice de seguridad percibida (encuestas)", "Alerta temprana", "Escala de encuesta", "Tendencia al alza", "Anual", "Resultados de encuesta"],
  ["Accesos indebidos a datos sensibles", "Alerta temprana", "Recuento", "0", "Trimestral", "Logs revisados"],
  ["Brecha protocolo-práctica (simulacros)", "Alerta temprana", "Desviaciones detectadas", "Tendencia a la baja", "Anual", "Informe de simulacros"],
  ["% de no conformidades cerradas", "Mejora continua", "Cerradas / detectadas", "≥ 90 %", "Anual", "Plan de acciones"],
  ["Nº de mejoras implantadas tras revisión", "Mejora continua", "Recuento", "Tendencia analizada", "Anual", "Acta de revisión"],
];

// --- Parte IV · 20. Lista de autoevaluación ---
const AUTOEVAL = [
  "¿Está designado por escrito el Coordinador/a de Bienestar y Protección y conoce sus funciones?",
  "¿Ha recibido formación específica acreditada el Coordinador/a?",
  "¿Existe una Política de protección de la infancia aprobada y publicada?",
  "¿Hay un código de conducta firmado por todo el personal y los terceros?",
  "¿Dispone el centro de protocolos frente a la violencia, el acoso y el ciberacoso?",
  "¿Existe un protocolo específico ante sospecha de abuso sexual o violencia grave?",
  "¿Todo el personal con contacto con menores tiene certificado negativo vigente (art. 57)?",
  "¿Se verifica el certificado también para proveedores, monitores y voluntariado?",
  "¿Existe un canal de comunicación/denuncia accesible y difundido?",
  "¿Conoce el personal el deber de comunicación y cómo y a quién comunicar?",
  "¿Se registran y custodian las comunicaciones, decisiones y derivaciones?",
  "¿Hay un plan de formación anual con registro de asistencia?",
  "¿Están definidos los ratios y la vigilancia en patios, comedor, transporte y salidas?",
  "¿Se gestionan los datos personales con base jurídica, seguridad y confidencialidad?",
  "¿Está designado un DPD o evaluada su necesidad?",
  "¿Existen cauces definidos con servicios sociales, FCSE y Fiscalía de Menores?",
  "¿Se realiza al menos una auditoría/revisión interna anual?",
  "¿Se celebra una revisión por la dirección con decisiones documentadas?",
  "¿Se cierran las acciones correctivas en plazo?",
  "¿Existe un plan de gestión de crisis y comunicación?",
  "¿Dispone el centro de Plan de Autoprotección implantado, con simulacro de evacuación anual registrado (RD 393/2007)?",
];

/* ================================================================== *
 *  GENERADOR
 * ================================================================== */

/**
 * Construye el informe .docx integrado y devuelve un Buffer.
 * @param {object} center     { name, tipo, etapas, alumnos, ccaa }
 * @param {Array}  interviews [{ role, answers: { q1: 'si', ... }, comments: { q4: '...' } }]
 * @returns {Promise<Buffer>}
 */
function buildDocxBuffer(center, interviews, overrides, weights) {
  center = center || {};
  interviews = interviews || [];
  overrides = overrides || {};
  weights = weights || null;

  const risks = E.computeRisks(interviews, overrides, center, weights);
  const coverage = E.computeCoverage(interviews);
  const rd393 = (typeof E.rd393FromCenter === "function") ? E.rd393FromCenter(center) : null;
  // Config de pesos efectivamente aplicada (la del modelo o el predeterminado).
  const W = (weights && (weights.roles || weights.questions)) ? weights : (E.DEFAULT_WEIGHTS || { roles: {}, questions: {} });
  const roleW = (r) => (W.roles && W.roles[r] != null) ? W.roles[r] : 1;
  const roleLbl = (r) => E.roleLabel ? E.roleLabel(r) : r;
  const rolesWithWeight = (E.ROLES || []).map((r) => ({ id: r.id, label: r.label, w: roleW(r.id) }));
  const anyRoleAdj = rolesWithWeight.some((r) => r.w !== 1);
  const qWeightEntries = W.questions ? Object.keys(W.questions) : [];
  const rated = risks.filter((r) => r.status === "rated");
  const ratedSorted = [...rated].sort((a, b) => b.level - a.level);
  const critHigh = ratedSorted.filter((r) => ["crit", "high"].includes(r.band));
  const nCrit = rated.filter((r) => r.band === "crit").length;
  const nHigh = rated.filter((r) => r.band === "high").length;
  const nMed = rated.filter((r) => r.band === "med").length;
  const nLow = rated.filter((r) => r.band === "low").length;
  const anyOverride = rated.some((r) => r.overridden);
  const mark = (r, field) => (r.overriddenFields && r.overriddenFields.includes(field) ? " *" : "");
  const byCode = {}; risks.forEach((r) => { byCode[r.code] = r; });

  const tipoLabel = { publica: "pública", concertada: "concertada", privada: "privada" }[center.tipo] || "—";
  const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

// ---------- estilo ----------
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
// Portadilla de parte: título grande centrado en página propia.
function parte(num, titulo, descripcion) {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ spacing: { before: 2000, after: 100 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "PARTE " + num, bold: true, size: 26, color: "8496B0" })] }),
    new Paragraph({ spacing: { after: 160 }, alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "1F3864", space: 10 } },
      children: [new TextRun({ text: titulo, bold: true, size: 34, color: "1F3864" })] }),
    new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: descripcion, italics: true, size: 20, color: "595959" })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}
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
// párrafo "Etiqueta: texto" con la etiqueta en negrita (para las fichas)
function labeled(label, text, opts = {}) {
  const { size = 19, after = 60 } = opts;
  return new Paragraph({ spacing: { after, line: 264 },
    children: [new TextRun({ text: label + ": ", bold: true, size, color: "2E4D7B" }), new TextRun({ text, size })] });
}

// celda coloreada de la matriz de calor
function heatCell(content, width, fill, textColor) {
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

// Prioridad de un control según el diagnóstico del centro.
function expandCodes(spec) {
  if (/todos/i.test(spec)) return rated.map((r) => r.code);
  const out = [];
  const re = /R(\d+)(?:\s*-\s*R(\d+))?/g; let m;
  while ((m = re.exec(spec))) {
    const a = parseInt(m[1], 10); const b = m[2] ? parseInt(m[2], 10) : a;
    for (let i = a; i <= b; i++) out.push("R" + String(i).padStart(2, "0"));
  }
  return out;
}
function controlPriority(spec, base) {
  const codes = expandCodes(spec);
  const crit = codes.filter((c) => byCode[c] && byCode[c].status === "rated" && byCode[c].band === "crit");
  const high = codes.filter((c) => byCode[c] && byCode[c].status === "rated" && byCode[c].band === "high");
  if (crit.length) return { label: "INMEDIATA", detail: crit.join(", ") + " crítico(s)", fill: BAND.crit.fill, color: BAND.crit.text };
  if (high.length) return { label: "Alta (90 días)", detail: high.join(", ") + " alto(s)", fill: BAND.high.fill, color: BAND.high.text };
  return { label: base, detail: "", fill: undefined, color: undefined };
}

/* ---------- PORTADA · AVISO · RESUMEN · ÍNDICE ---------- */

const portada = [
  new Paragraph({ spacing: { before: 2200, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "MODELO DE PREVENCIÓN Y COMPLIANCE", bold: true, size: 40, color: "1F3864" })] }),
  new Paragraph({ spacing: { before: 60, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "con diagnóstico personalizado del centro", bold: true, size: 28, color: "1F3864" })] }),
  new Paragraph({ spacing: { before: 160, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "LOPIVI — Ley Orgánica 8/2021 · UNE-ISO 37301:2021", size: 22, color: "595959" })] }),
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

const aviso = [
  h1("Aviso legal y naturaleza del documento"),
  p("Este documento es una herramienta técnica de prevención y cumplimiento. No constituye asesoramiento jurídico individualizado ni sustituye la intervención de profesionales colegiados (abogacía, asesoría laboral, delegado de protección de datos) ni la supervisión de la Administración educativa competente y de la Inspección educativa.", { after: 100 }),
  p("El informe integra dos niveles: un marco general de referencia (Partes I y III-IV), común a todo centro educativo, y un diagnóstico personalizado (Parte II) generado automáticamente a partir de las respuestas de las entrevistas realizadas en el centro. Las puntuaciones de probabilidad y nivel de riesgo son estimaciones orientativas destinadas a priorizar actuaciones; no constituyen una calificación de responsabilidad.", { after: 100 }),
  p("Las referencias normativas se formulan con prudencia: cuando un artículo concreto es dudoso, depende de desarrollo reglamentario o varía por comunidad autónoma, debe verificarse antes de su aplicación. El modelo distingue entre obligaciones legales imperativas, buenas prácticas de protección (safeguarding) y recomendaciones basadas en estándares ISO de adopción voluntaria.", { after: 100 }),
  note("El nivel de riesgo depende de la calidad y cobertura de las respuestas. Un riesgo no evaluado o una norma sin cobertura no implica cumplimiento ni incumplimiento: indica que ese frente aún no se ha explorado en las entrevistas."),
  note("Antes de aprobar y publicar cualquier política o protocolo aquí esbozado, el centro debe validar su contenido con asesoramiento jurídico especializado y adaptarlo a su titularidad, a su CCAA y a sus circunstancias concretas."),
];

const resumen = [
  h1("Resumen ejecutivo (para el equipo directivo y la titularidad)"),
  p("La Ley Orgánica 8/2021 (LOPIVI) introduce un deber reforzado de protección de la infancia frente a la violencia que afecta de lleno a los centros educativos: designación de un Coordinador o Coordinadora de Bienestar y Protección, protocolos de actuación frente a la violencia, formación del personal, deber cualificado de comunicación ante indicios y certificación negativa del Registro Central de Delincuentes Sexuales para quienes trabajan con menores.", { after: 100 }),
  p("El riesgo jurídico para el centro y sus responsables no nace solo del hecho dañoso, sino, sobre todo, de la falta de diligencia debida: ausencia de protocolos, protocolos no implantados, omisión de comunicación o documentación insuficiente. Un sistema de compliance documentado, implantado y auditado es hoy el principal mecanismo de protección frente a la responsabilidad civil, administrativa, penal y patrimonial, además del eje ético de protección del menor.", { after: 120 }),
  h2("Resultado del diagnóstico del centro"),
  p(`${center.name || "El centro"} presenta, según las respuestas agregadas, ${nCrit} riesgo(s) crítico(s), ${nHigh} alto(s), ${nMed} medio(s) y ${nLow} bajo(s), sobre un total de ${rated.length} riesgos evaluados de ${E.RISKS.length}.`, { after: 100 }),
  table(["Banda", "Nº de riesgos", "Interpretación"], [2400, 2200, 5038], [
    [[{ bullet: "Crítico" }], String(nCrit), "Actuación inmediata; prioridad máxima en el plan."],
    [[{ bullet: "Alto" }], String(nHigh), "Actuación a corto plazo dentro del plan a 90 días."],
    [[{ bullet: "Medio" }], String(nMed), "Seguimiento y refuerzo progresivo."],
    [[{ bullet: "Bajo" }], String(nLow), "Mantenimiento y verificación periódica."],
  ], { zebra: true }),
  p(critHigh.length ? "Riesgos prioritarios: " + critHigh.slice(0, 8).map((r) => `${r.code} (${BAND[r.band].label.toLowerCase()})`).join(", ") + ". El detalle y su justificación figuran en la Parte II; los controles asociados, en el apartado 15." : "No se han detectado riesgos altos o críticos con los datos actuales.", { before: 80, after: 120, italics: true }),
  h2("Prioridades inmediatas de todo centro educativo"),
  bullet("Designar y capacitar al Coordinador/a de Bienestar y Protección y comunicar su existencia a la comunidad educativa."),
  bullet("Verificar que todo el personal y los terceros con contacto habitual con menores cuentan con certificación negativa vigente del Registro Central de Delincuentes Sexuales."),
  bullet("Aprobar o actualizar la Política de Protección de la Infancia, el Código de Conducta y los protocolos de actuación frente a la violencia y el acoso."),
  bullet("Activar un canal de comunicación/denuncia accesible y un procedimiento de actuación ante indicios con trazabilidad documental."),
  bullet("Planificar la formación anual y registrar todas las evidencias (asistencia, actas, comunicaciones, decisiones)."),
];

const indice = [
  new Paragraph({ children: [new PageBreak()] }),
  h1("Índice"),
  p("(En Word: clic derecho sobre el índice → «Actualizar campos» para generar la paginación.)", { size: 16, italics: true, color: "595959" }),
  new TableOfContents("Índice", { hyperlink: true, headingStyleRange: "1-2" }),
];

/* ---------- PARTE I — MARCO GENERAL DE REFERENCIA ---------- */

const sec1 = [
  h1("1. Nota metodológica y supuestos"),
  p("La construcción del modelo sigue una lógica encadenada: identificar obligaciones legales, identificar actores obligados, asociar riesgos a cada obligación, evaluar consecuencias, proponer controles alineados con ISO 37301:2021, traducirlos en protocolos, evidencias e indicadores, y organizarlo todo de forma implantable en un centro real.", { after: 100 }),
  h2("1.1. Cómo se ha elaborado el diagnóstico de este centro"),
  p(`El diagnóstico de la Parte II se ha elaborado a partir de ${interviews.length} entrevista(s) estructurada(s) realizadas al personal del centro por niveles jerárquicos, mediante un cuestionario de ${E.QUESTIONS.length} preguntas que cubren los controles esperables de los ${E.RISKS.length} riesgos del modelo. Las respuestas se agregan para estimar la probabilidad de cada riesgo; el impacto procede de la valoración experta del modelo. La cobertura de niveles condiciona la representatividad del resultado.`, { after: 100 }),
  h2("1.2. Cómo se calcula la probabilidad (P)"),
  p("La probabilidad no se fija de forma subjetiva: se deduce del grado de implantación de los controles que declaran las entrevistas. A cada control (pregunta) se le asigna un valor según la respuesta —Sí (control implantado) = 1; Parcial = 0,5; No = 0; No sé = 0,15, tratado como control prácticamente inexistente porque un control que el personal desconoce no protege—. Para cada riesgo se calcula una media ponderada (véase el apartado 1.4) de los valores de todas las respuestas a las preguntas que lo cubren, obteniendo un índice de cobertura de control de 0 a 1; ese índice se traduce a una escala de probabilidad de 1 a 5 de forma inversa (a mayor cobertura, menor probabilidad), mediante la fórmula P = 5 − cobertura × 4, redondeada al entero más cercano. En términos prácticos: cuantas más respuestas «No», «Parcial» o «No sé» acumula un riesgo, mayor es su probabilidad estimada.", { after: 100 }),
  h2("1.3. Cómo se determina el impacto (I)"),
  p("El impacto es una valoración experta previa y estable de cada riesgo, en una escala de 1 a 5, según la gravedad de sus consecuencias jurídicas (responsabilidad civil, penal, administrativa o patrimonial), del daño potencial para el menor y de la exposición reputacional del centro. No depende de las respuestas de las entrevistas —por eso un riesgo puede tener un impacto alto aunque el control esté bien implantado—: lo que cambia con las entrevistas es la probabilidad, no el impacto. La única excepción es el riesgo de autoprotección (R24), cuyo impacto sube a 5 cuando el centro entra en el ámbito del RD 393/2007, por tratarse entonces de una obligación legal directa y sancionable. El nivel de riesgo resulta de multiplicar probabilidad por impacto (P × I) y determina la banda (bajo, medio, alto o crítico).", { after: 100 }),
  h2("1.4. Ponderación de las respuestas y respuestas divergentes"),
  p("No todas las respuestas pesan necesariamente igual. La probabilidad se calcula como una media ponderada en la que cada respuesta tiene un peso según el rol de quien la da y, en algunas preguntas, según un ajuste específico. El criterio no es jerárquico —no se da más valor a quien ocupa un puesto superior—, sino de proximidad al control: quien ejecuta un control en el día a día suele conocer mejor si está realmente implantado. El caso típico es la difusión de un protocolo: que esté «difundido» lo acredita mejor el profesorado que debe aplicarlo que la dirección que lo aprobó; por eso, en esas preguntas, el «No» o el «No sé» del profesorado pesa más que el «Sí» de la dirección. Así, si un control existe sobre el papel pero no ha llegado a quien debe aplicarlo, la probabilidad refleja ese riesgo real en lugar de diluirlo.", { after: 80 }),
  p("Los pesos son un punto de partida razonado y pueden ajustarse por el consultor para cada centro. Cuando dos roles responden de forma divergente a un mismo control, la contradicción no se descarta ni se promedia sin más: además de entrar en la media ponderada, se marca como discrepancia y se detalla en el apartado 9, para que el centro la verifique en campo.", { after: 80 }),
  p("Pesos aplicados en este diagnóstico:", { bold: true, size: 19, after: 40, color: "2E4D7B" }),
  table(["Rol", "Peso base"], [6000, 3638],
    rolesWithWeight.map((r) => [r.label, r.w === 1 ? "1,0 (normal)" : String(r.w).replace(".", ",") + (r.w > 1 ? "  ↑" : "  ↓")]),
    { zebra: true }),
  ...(qWeightEntries.length ? [
    p("Ajustes específicos por pregunta (refuerzan a quien conoce de primera mano la implantación del control):", { size: 17, after: 40, before: 60, italics: true, color: "595959" }),
    table(["Pregunta", "Ajuste de peso por rol"], [5800, 3838],
      qWeightEntries.map((qid) => {
        const q = (E.QUESTIONS.find((x) => x.id === qid) || {}).q || qid;
        const adj = Object.entries(W.questions[qid]).map(([role, w]) => `${roleLbl(role)}: ${String(w).replace(".", ",")}`).join("; ");
        return [q, adj];
      }), { zebra: true }),
  ] : []),
  note("La ponderación afecta a la probabilidad (P), no al impacto (I). Un peso 0 excluiría por completo las respuestas de ese rol para esa pregunta. Los pesos deben interpretarse como criterio metodológico orientativo, no como un juicio sobre la fiabilidad de las personas."),
  h2("1.5. Supuestos declarados"),
  bullet("Se asume un centro educativo que atiende a alumnado menor de edad en enseñanzas no universitarias."),
  bullet("La numeración de algunos artículos del capítulo educativo de la LOPIVI y los protocolos de acoso/convivencia dependen de desarrollo normativo y de cada CCAA: se citan de forma prudente y deben verificarse."),
  bullet("Las metas e indicadores son orientativos; deben calibrarse según el tamaño y contexto del centro."),
  bullet("La asignación de responsables internos es una recomendación-tipo; se adaptará al organigrama real y a la titularidad."),
];

const sec2 = [
  h1("2. Alcance del modelo"),
  p("El modelo aplica a la gestión de riesgos derivados del deber de protección de la infancia y adolescencia frente a la violencia, así como de los deberes de vigilancia, custodia, organización, prevención y reacción del centro educativo y de los actores que intervienen en la vida escolar.", { after: 100 }),
  bullet([{ text: "Por titularidad: ", bold: true }, "centros públicos (responsabilidad patrimonial de la Administración, Ley 40/2015), concertados (titularidad privada y financiación pública; art. 1903 CC y obligaciones del concierto) y privados (responsabilidad civil y, en su caso, penal de la persona jurídica, art. 31 bis CP)."]),
  bullet([{ text: "Por personas: ", bold: true }, "alumnado menor de edad (con atención reforzada a situaciones de especial vulnerabilidad), personal docente y no docente, equipos directivos, titularidad y terceros (empresas externas, monitores, comedor, transporte, voluntariado y proveedores)."]),
  bullet([{ text: "Por actividades: ", bold: true }, "lectivas, complementarias y extraescolares; comedor y transporte; excursiones, salidas, campamentos y viajes; actividades deportivas y acuáticas; y actividades digitales (entornos virtuales, comunicaciones telemáticas, dispositivos y redes)."]),
  bullet([{ text: "Ámbito espacial: ", bold: true }, "dentro del recinto escolar y fuera de él cuando subsiste un deber de vigilancia, custodia, organización, prevención o reacción (salidas, transporte, ciberacoso conectado con la convivencia escolar)."]),
  bullet([{ text: "Ámbito relacional: ", bold: true }, "interacción con ayuntamientos, Administración educativa, Inspección, servicios sociales, FCSE, Fiscalía de Menores, autoridades judiciales y entidades colaboradoras."]),
  bullet([{ text: "Límites: ", bold: true }, "no regula el régimen interno de personal más allá de su conexión con la protección del menor; no sustituye los protocolos autonómicos oficiales (los integra y, en caso de conflicto, prevalece la norma oficial); no constituye dictamen jurídico."]),
  note("La calificación de la responsabilidad (patrimonial, civil, penal) depende de la titularidad y de las circunstancias: debe validarse caso a caso. Este modelo no atribuye responsabilidad automática a ningún actor."),
];

const sec3 = [
  h1("3. Marco legal y obligaciones relevantes"),
  p("El marco aplicable a un centro educativo es multinivel. En el plano internacional y europeo destacan la Convención sobre los Derechos del Niño (interés superior del menor, art. 3; protección frente a toda forma de violencia, art. 19; derecho a ser oído, art. 12) y sus Protocolos Facultativos; los convenios del Consejo de Europa de Lanzarote (explotación y abuso sexual), Estambul (violencia contra la mujer), Budapest (ciberdelincuencia) y contra la trata; y, en la Unión Europea, la Directiva 2011/93/UE (que fundamenta la comprobación de antecedentes, en conexión con el art. 57 LOPIVI), la Carta de Derechos Fundamentales (art. 24) y el art. 3 del TUE. Operan como marco interpretativo, de principios o mediante su transposición al Derecho interno.", { after: 100 }),
  p("El catálogo estatal siguiente no es exhaustivo y se formula con prudencia: los artículos concretos y la normativa autonómica deben verificarse en su redacción vigente antes de su aplicación.", { after: 100 }),
  table(
    ["Norma", "Obligación principal", "Sujetos obligados", "Riesgo por incumplimiento", "Evidencia recomendada"],
    [1750, 2450, 1550, 1900, 1988],
    MARCO_ESTATAL
  ),
  note("La normativa autonómica y los protocolos de cada Consejería de Educación son de aplicación directa y, en muchas actuaciones, prevalente; su denominación, numeración y vigencia varían por comunidad autónoma y deben verificarse. La cobertura normativa alcanzada por las entrevistas de este centro se muestra en el apartado 12."),
];

const sec4 = [
  h1("4. Mapa de actores y responsabilidades"),
  p("Para cada actor se indican obligaciones principales, tipo de responsabilidad potencial, nivel de exposición y controles y evidencias recomendados. La responsabilidad efectiva dependerá del deber de garante, la competencia, el conocimiento del riesgo, la capacidad de actuación y la diligencia probada.", { after: 100 }),
  table(
    ["Actor", "Obligaciones principales", "Tipo de responsabilidad", "Exposición", "Controles y evidencias"],
    [1600, 2400, 2100, 1000, 2538],
    ACTORES
  ),
];

/* ---------- PARTE II — DIAGNÓSTICO PERSONALIZADO ---------- */

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
  ...(rd393 ? [
    ["Ocupación total (RD 393/2007)", `${rd393.occupancy} persona(s) (alumnado + personal + otras personas habituales)`],
    ["Plan de Autoprotección exigible (RD 393/2007)", rd393.applies
      ? "SÍ — " + rd393.reasons.join("; ") + ". Véase el riesgo R24."
      : "No se alcanzan los supuestos del Anexo I.e con los datos actuales; siguen siendo exigibles medidas de emergencia y simulacros (normativa laboral, educativa y autonómica)."],
  ] : []),
];
const sec5 = [
  h1("5. Datos del centro y alcance del diagnóstico"),
  p("El diagnóstico se basa en las entrevistas recogidas por nivel jerárquico. La cobertura de niveles condiciona la representatividad del resultado.", { after: 100 }),
  table(["Campo", "Valor"], [3000, 6638], datosRows, { zebra: true }),
];

const sec6 = [
  h1("6. Resultados del diagnóstico"),
  p(`Sobre ${E.RISKS.length} riesgos del modelo, se han evaluado ${rated.length} con las respuestas disponibles: ${nCrit} en banda crítica, ${nHigh} alta, ${nMed} media y ${nLow} baja. La distribución completa se visualiza en la matriz de calor del apartado 7; la justificación de cada riesgo, en las fichas del apartado 8.`, { after: 100 }),
  ...(critHigh.length
    ? [p("Riesgos que requieren actuación prioritaria:", { after: 60, bold: true }),
       ...critHigh.map((r) => bullet([{ text: `${r.code} — ${r.title}`, bold: true }, `  [${BAND[r.band].label}, nivel ${r.level}]`]))]
    : [p("No se han detectado riesgos altos o críticos con los datos actuales.", { italics: true })]),
];

// 7. Matriz (landscape): heat + tabla
const matrizRows = ratedSorted.map((r) => [
  r.code, r.title, String(r.prob) + mark(r, "prob"), String(r.impact) + mark(r, "impact"), String(r.level), BAND[r.band].label,
  lawsShortJoin(r.laws), r.resp, (r.actions && r.actions.length) ? r.actions.map((m) => ({ bullet: m })) : "Controles conformes según respuestas.",
]);
const unratedList = risks.filter((r) => r.status === "unrated").map((r) => r.code);
const sec7 = [
  h1("7. Matriz de riesgos personalizada"),
  p("Este apartado sitúa cada uno de los riesgos del centro en función de su probabilidad y su impacto, calculados según la metodología del apartado 1 (probabilidad deducida de los controles declarados en las entrevistas; impacto por valoración experta). Se presenta primero de forma visual, mediante una matriz de calor, y después en detalle, con una tabla que incluye la puntuación de cada riesgo y las medidas de corrección recomendadas.", { after: 100 }),
  h2("7.1. Matriz de calor (Impacto × Probabilidad)"),
  p("El cuadro siguiente es una representación visual de conjunto: cada casilla corresponde a una combinación de probabilidad (columnas, P = 1 a 5) e impacto (filas, I = 5 a 1), y dentro de ella aparecen los códigos (Rxx) de los riesgos del centro que caen en esa posición. El color indica la banda de nivel resultante (P × I): verde para bajo, ámbar para medio, naranja para alto y rojo para crítico. Permite ver de un vistazo dónde se concentran los riesgos y cuáles exigen atención prioritaria (esquina superior derecha).", { after: 80 }),
  heatMatrix(),
  p("Lectura: filas = Impacto (I), columnas = Probabilidad (P); el color indica la banda de nivel (P×I).", { before: 60, after: 120, size: 16, italics: true, color: "595959" }),
  h2("7.2. Detalle de riesgos priorizados"),
  p("La tabla siguiente desglosa, riesgo a riesgo y ordenados de mayor a menor nivel, los datos que resumen su evaluación: la probabilidad (P) y el impacto (I) con su producto (Nivel) y banda, el fundamento normativo abreviado, el responsable sugerido y —en la última columna— las medidas de corrección concretas recomendadas para su centro cuando el control no está plenamente implantado. La justificación detallada de cada riesgo se desarrolla en las fichas del apartado 8.", { after: 100 }),
  table(
    ["Cód.", "Riesgo", "P", "I", "Niv.", "Banda", "Fundamento", "Responsable", "Medidas de corrección recomendadas"],
    [700, 3000, 460, 460, 540, 1000, 1600, 2240, 4570],
    matrizRows.length ? matrizRows : [["—", "Sin riesgos evaluados", "—", "—", "—", "—", "—", "—", "—"]]
  ),
  ...(anyOverride ? [p("*  Valor de Probabilidad (P) o Impacto (I) ajustado por el consultor a criterio experto. El valor sugerido por el motor se conserva y puede consultarse en la aplicación.", { before: 80, size: 16, italics: true, color: "595959" })] : []),
  ...(unratedList.length ? [p("Riesgos aún no evaluados (sin respuestas que cubran sus controles): " + unratedList.join(", ") + ".", { before: 80, size: 16, italics: true, color: "595959" })] : []),
];

// 8. Fichas de los 23 riesgos (justificación + situación del centro)
function fichaRiesgo(r, i) {
  const j = J.RISK_JUSTIFICATIONS[r.code];
  const isRated = r.status === "rated";
  const b = isRated ? BAND[r.band] : null;
  const out = [
    new Paragraph({ spacing: { before: i ? 160 : 0, after: 20 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "B8C2CC", space: 2 } },
      children: [
        new TextRun({ text: `${r.code} — ${r.title}`, bold: true, size: 21, color: "1F3864" }),
        new TextRun({ text: isRated ? `   [${b.label} · P ${r.prob}${mark(r, "prob")} × I ${r.impact}${mark(r, "impact")} = ${r.level}]` : "   [No evaluado en las entrevistas]",
          bold: true, size: 18, color: isRated ? b.solid : "808080" }),
      ] }),
  ];
  if (j) {
    out.push(labeled("Consecuencias", j.consecuencias));
    out.push(labeled("Obligación normativa", j.obligacion));
    out.push(labeled("Impacto en el centro y en los menores", j.impacto));
  }
  if (isRated) {
    if (r.actions && r.actions.length) {
      out.push(p("Medidas de corrección recomendadas para su centro:", { bold: true, size: 19, after: 30, color: "2E4D7B" }));
      r.actions.forEach((m) => out.push(bullet(m, { size: 19 })));
    } else {
      out.push(p("Controles conformes según las respuestas recogidas.", { italics: true, size: 18, after: 40 }));
    }
    out.push(p(`Responsable: ${r.resp}. Fundamento: ${lawsShortJoin(r.laws)}.`, { size: 16, italics: true, color: "595959", after: 40 }));
  }
  return out;
}
const sec8 = [
  h1("8. Fichas de los riesgos: por qué importan y qué hacer"),
  p("Cada ficha explica por qué el riesgo constituye un riesgo real (consecuencias, obligación normativa que lo respalda e impacto en el centro y en los menores) y, cuando ha sido evaluado, muestra su puntuación (P × I) y las medidas de corrección concretas recomendadas para su centro —redactadas como acciones prácticas y fundamentadas, no como preguntas—. Los riesgos aparecen ordenados de mayor a menor nivel; al final, los aún no evaluados por falta de respuestas.", { after: 120 }),
  ...[...ratedSorted, ...risks.filter((r) => r.status !== "rated")].flatMap((r, i) => fichaRiesgo(r, i)),
];

// 9. Discrepancias
const discrepancias = risks.flatMap((r) => r.discrepancies.map((d) => ({ code: r.code, ...d })));
const sec9 = [
  h1("9. Discrepancias entre niveles jerárquicos"),
  p("Como se explica en el apartado 1.4, todas las respuestas pesan por igual en el cálculo de la probabilidad, sin privilegiar a ningún nivel jerárquico. Cuando dos roles responden de forma divergente a un mismo control (por ejemplo, la dirección afirma que existe y el profesorado lo niega o lo desconoce), esa contradicción, además de computar en la media, se registra aquí como discrepancia. No es un error del diagnóstico, sino un hallazgo valioso: suele revelar que un control existe sobre el papel pero no ha llegado a quienes deben aplicarlo, o que su implantación es desigual. Cada discrepancia debe verificarse en campo antes de darla por resuelta. El cuadro siguiente enumera las divergencias detectadas, indicando para cada control qué respondió cada rol.", { after: 100 }),
  ...(discrepancias.length ? discrepancias.slice(0, 10).map((d) =>
    bullet([{ text: d.code + " — ", bold: true }, `"${d.q}": ` + d.detail.map((x) => `${E.roleShort(x.role)} (${E.ANSWER_LABEL[x.raw]})`).join(" vs ")])
  ) : [p("No se detectan divergencias significativas entre roles.", { italics: true })]),
];

// 10. Brechas de conocimiento
const brechas = risks.filter((r) => r.nsCount > 0);
const sec10 = [
  h1("10. Brechas de conocimiento"),
  p("Riesgos con respuestas «No sé»: señalan falta de información o de difusión interna, no necesariamente un incumplimiento.", { after: 100 }),
  ...(brechas.length ? brechas.map((r) => bullet([{ text: r.code + " — ", bold: true }, `${r.title}: ${r.nsCount} respuesta(s) «No sé».`]))
    : [p("Sin respuestas «No sé» relevantes.", { italics: true })]),
];

// 11. Observaciones de las personas entrevistadas
const obsRows = [];
E.QUESTIONS.forEach((qq) => {
  interviews.forEach((iv) => {
    const c = iv.comments && iv.comments[qq.id];
    if (typeof c === "string" && c.trim()) {
      const who = iv.role === E.CONSULTANT_ROLE ? "Consultor/a" : E.roleShort(iv.role);
      obsRows.push([qq.q, who, E.ANSWER_LABEL[iv.answers[qq.id]] || "—", c.trim().slice(0, 500)]);
    }
  });
});
const sec11 = [
  h1("11. Observaciones de las personas entrevistadas"),
  p("Comentarios aportados junto a las respuestas «Parcial» y «No sé». Matizan el resultado cuantitativo del diagnóstico y orientan la verificación en campo.", { after: 100 }),
  ...(obsRows.length
    ? [
        table(["Pregunta", "Rol", "Respuesta", "Comentario"], [3238, 1300, 900, 4200], obsRows, { zebra: true }),
        p("Los comentarios se transcriben tal como fueron escritos (máx. 500 caracteres). No deben contener datos personales; si detecta alguno, elimínelo de la entrevista desde la aplicación y vuelva a generar el informe. El tratamiento de estos comentarios se rige por la cláusula informativa del Anexo A.", { before: 80, size: 16, italics: true, color: "595959" }),
      ]
    : [p("Las entrevistas no incluyen comentarios.", { italics: true })]),
];

// 12. Cobertura normativa
const cobRows = E.LAW_LEVELS.map((lvl) => {
  const items = coverage.filter((l) => l.level === lvl);
  if (!items.length) return null;
  return [lvl, items.map((l) => ({ bullet: `${l.covered ? "✓" : "○"}  ${l.label}` }))];
}).filter(Boolean);
const sec12 = [
  h1("12. Cobertura normativa del diagnóstico"),
  p("Niveles del marco legal (apartado 3) respaldados por al menos una respuesta (✓) frente a los aún no explorados (○). Orienta sobre a qué perfiles conviene seguir entrevistando.", { after: 100 }),
  table(["Nivel del marco", "Normas y estado de cobertura"], [3200, 6438], cobRows, { zebra: true }),
  note("La normativa autonómica y los protocolos de cada Consejería de Educación son de aplicación directa y prevalente en muchas actuaciones; su denominación y vigencia varían por comunidad y deben verificarse."),
];

/* ---------- PARTE III — MODELO DE PREVENCIÓN Y COMPLIANCE ---------- */

const sec13 = [
  h1("13. Sistema de gestión de compliance (ISO 37301:2021)"),
  p("Adaptación de los componentes de ISO 37301:2021 al contexto educativo y a la protección de la infancia. Cada elemento indica su aplicación práctica en un colegio, los documentos necesarios y el responsable recomendado. El error transversal a evitar: sistemas «de papel» que no se ejecutan ni se revisan.", { after: 100 }),
  table(
    ["Elemento del sistema", "Aplicación práctica en el centro", "Documentos clave", "Responsable"],
    [1900, 3450, 2288, 2000],
    ISO_ELEMENTOS
  ),
];

const sec14 = [
  h1("14. Políticas y protocolos mínimos"),
  p("Arquitectura documental mínima recomendada, ordenada de lo general (política) a lo operativo (procedimientos). Todos los documentos deben validarse jurídicamente, adaptarse al protocolo autonómico aplicable y revisarse al menos una vez al año.", { after: 100 }),
  table(
    ["Documento", "Finalidad", "Aprueba / ejecuta", "Evidencias"],
    [2450, 3100, 1900, 2188],
    POLITICAS
  ),
];

const controlesRows = CONTROLES.map(([ctrl, tipo, cods, resp, frec, evid, base]) => {
  const pr = controlPriority(cods, base);
  return { row: [ctrl, tipo, cods, resp, frec, evid, pr.detail ? `${pr.label} — ${pr.detail}` : pr.label], fill: pr.fill };
});
const sec15 = [
  h1("15. Controles del sistema, priorizados según el diagnóstico"),
  p("Catálogo de controles preventivos, detectivos, reactivos, correctivos y de seguimiento. La última columna traduce el diagnóstico de la Parte II a prioridad operativa: los controles que mitigan riesgos en banda crítica o alta en su centro aparecen marcados para actuación inmediata o a 90 días; el resto conserva la prioridad general del modelo.", { after: 100 }),
  new Table({
    width: { size: LAND_W, type: DXA },
    columnWidths: [2900, 1050, 1250, 1650, 1300, 1900, 4520],
    rows: [
      new TableRow({ tableHeader: true, children: ["Control", "Tipo", "Riesgos", "Responsable", "Frecuencia", "Evidencia", "Prioridad en su centro"].map((hh, i) => headerCell(hh, [2900, 1050, 1250, 1650, 1300, 1900, 4520][i])) }),
      ...controlesRows.map(({ row, fill }, ri) => new TableRow({
        children: row.map((c, ci) => dataCell(c, [2900, 1050, 1250, 1650, 1300, 1900, 4520][ci], 15,
          ci === 6 && fill ? fill : (ri % 2 === 1 ? ALT_FILL : undefined))),
      })),
    ],
  }),
  p("Las referencias «Rxx» remiten a la matriz del apartado 7 y a las fichas del apartado 8.", { before: 80, size: 16, italics: true, color: "595959" }),
];

const sec16 = [
  h1("16. Responsabilidad de directivos, ayuntamientos y otros actores"),
  note("La responsabilidad nunca es automática. Depende del deber de garante, la competencia, el conocimiento del riesgo, la capacidad real de actuación, la existencia y aplicación de protocolos, la diligencia debida, la prueba documental y la respuesta ante los hechos. Este apartado es orientativo y requiere validación jurídica caso a caso."),
  h2("16.1. Tipos de responsabilidad"),
  table(
    ["Tipo", "En qué consiste", "Sujetos típicos", "Factores y cautelas"],
    [1700, 2900, 2350, 2688],
    TIPOS_RESP
  ),
  h2("16.2. Análisis por actor"),
  ...ACTOR_ANALISIS.flatMap(([actor, texto]) => [
    p(actor, { bold: true, size: 20, before: 80, after: 20, color: "2E4D7B" }),
    p(texto, { after: 60 }),
  ]),
];

/* ---------- PARTE IV — IMPLANTACIÓN Y SEGUIMIENTO ---------- */

const planItems = critHigh.slice(0, 8);
const sec17 = [
  h1("17. Plan de actuación a 90 días"),
  p("Este plan concreta las prioridades derivadas de los riesgos altos y críticos del diagnóstico. Para cada uno se enumeran las medidas de corrección concretas a acometer, el responsable sugerido y el fundamento normativo. Constituye, para su centro, la traducción a acciones de las fases 1 a 4 del plan de implantación del apartado 18.", { after: 100 }),
  ...(planItems.length ? planItems.flatMap((r, i) => [
    p(`${String(i + 1).padStart(2, "0")} · ${r.code} — ${r.title}  [${BAND[r.band].label}]`, { bold: true, after: 30, before: i ? 80 : 0, size: 21 }),
    ...((r.actions && r.actions.length) ? r.actions.slice(0, 4).map((m) => bullet(m)) : [bullet("Mantener y documentar los controles existentes.")]),
    p(`Responsable: ${r.resp}. Fundamento: ${lawsShortJoin(r.laws)}.`, { after: 40, size: 17, italics: true, color: "595959" }),
  ]) : [p("No se han detectado riesgos altos o críticos con los datos actuales. Se recomienda seguir la pauta general: días 1-30, designación del Coordinador/a, certificados del art. 57, canal provisional y diagnóstico; días 31-60, política, código de conducta, protocolos y primera formación; días 61-90, vigilancia y ratios, control de proveedores, simulacro, indicadores y primera revisión por la dirección.", { italics: true })]),
];

const sec18 = [
  h1("18. Plan de implantación por fases"),
  p("Secuencia recomendada de 8 fases para un curso escolar. Los plazos son orientativos y deben ajustarse al calendario y a los recursos del centro. La Fase 1 queda cubierta por el diagnóstico de este informe.", { after: 100 }),
  table(
    ["Fase", "Objetivo", "Plazo", "Entregables"],
    [2300, 3338, 1400, 2600],
    FASES
  ),
];

const sec19 = [
  h1("19. Cuadro de indicadores"),
  p("Indicadores clasificados en cumplimiento, eficacia, alerta temprana y mejora continua. Las metas son orientativas y deben calibrarse por el centro.", { after: 100 }),
  table(
    ["Indicador", "Tipo", "Cálculo / medición", "Meta orientativa", "Frecuencia", "Fuente / evidencia"],
    [2350, 1300, 1900, 1400, 1000, 1688],
    INDICADORES
  ),
];

const sec20 = [
  h1("20. Lista de autoevaluación"),
  p("Responda Sí / Parcial / No a cada ítem. Cada «No» o «Parcial» debe generar una acción con responsable y plazo. Esta lista sirve también para las revisiones periódicas del sistema (fases 6-8).", { after: 100 }),
  table(
    ["#", "Ítem de verificación", "Sí / Parcial / No", "Acción / responsable / plazo"],
    [500, 5038, 1500, 2600],
    AUTOEVAL.map((item, i) => [String(i + 1), item, "", ""])
  ),
];

const sec21 = [
  h1("21. Cautelas, límites y validaciones necesarias"),
  p("El modelo adopta un enfoque preventivo, documentado, auditable y orientado a la diligencia debida. Para su uso seguro deben observarse las siguientes cautelas.", { after: 100 }),
  h2("21.1. Diferenciación de niveles"),
  bullet([{ text: "Obligaciones legales: ", bold: true }, "de cumplimiento imperativo (Coordinador/a de Bienestar, certificados del art. 57, deber de comunicación, protección de datos)."]),
  bullet([{ text: "Buenas prácticas de protección (safeguarding): ", bold: true }, "recomendables y exigibles como estándar de diligencia, aunque no siempre tipificadas."]),
  bullet([{ text: "Recomendaciones de compliance: ", bold: true }, "basadas en estándares ISO, de adopción voluntaria salvo imposición normativa o contractual."]),
  h2("21.2. Puntos que requieren validación profesional"),
  bullet("Redacción y aprobación de políticas y protocolos: validación por abogacía especializada."),
  bullet("Encaje con el protocolo autonómico de acoso/convivencia y con la normativa sectorial (transporte, comedor, deporte): verificación con la Administración educativa."),
  bullet("Tratamiento de datos y necesidad de DPD: validación por el delegado de protección de datos."),
  bullet("Aspectos laborales y disciplinarios: validación por asesoría laboral o servicio jurídico."),
  bullet("Calificación de responsabilidades concretas: análisis jurídico caso a caso."),
  h2("21.3. Cautelas sobre referencias normativas"),
  p("Las citas indican la norma y, cuando es razonablemente seguro, el artículo o bloque. La numeración del capítulo educativo de la LOPIVI y los protocolos autonómicos deben verificarse en su redacción vigente antes de aplicarse. No deben darse por ciertos artículos no confirmados.", { after: 100 }),
  note("Este modelo no sustituye el asesoramiento jurídico profesional ni la supervisión de la Administración educativa competente. Es una base de trabajo que debe adaptarse, validarse y mantenerse en el tiempo."),
];

const sec22 = [
  h1("22. Continuidad del modelo"),
  p("Este documento integra el diagnóstico inicial del centro (Parte II) con el modelo de prevención y compliance de referencia (Partes I, III y IV). Para mantenerlo vivo:", { after: 100 }),
  bullet("Validar el diagnóstico con la dirección, el Coordinador/a de Bienestar y el asesoramiento jurídico."),
  bullet("Ejecutar y hacer seguimiento del plan a 90 días (apartado 17), asignando responsables y evidencias."),
  bullet("Completar las entrevistas de los niveles con menor cobertura para afinar el resultado (apartado 12)."),
  bullet("Avanzar por las fases del plan de implantación (apartado 18) y medir con el cuadro de indicadores (apartado 19)."),
  bullet("Revisar periódicamente (al menos anualmente) y actualizar tras incidentes o cambios normativos."),
  note("Documento de trabajo. No sustituye el asesoramiento jurídico profesional ni la supervisión de la Administración educativa competente."),
];

/* ---------- ANEXO A — Cláusula informativa (arts. 13-14 RGPD) ---------- */

const anexoA = [
  new Paragraph({ children: [new PageBreak()] }),
  h1("Anexo A. Cláusula informativa para las personas entrevistadas (arts. 13-14 RGPD)"),
  p("Modelo de texto que el centro debe facilitar a las personas participantes en las entrevistas del diagnóstico, antes de su realización. Debe completarse con los datos del centro y validarse por su delegado de protección de datos o asesoramiento jurídico.", { italics: true, after: 120 }),
  labeled("Responsable del tratamiento", `${center.name || "[Nombre del centro]"} [completar: dirección postal, correo electrónico de contacto y, en su caso, datos del Delegado de Protección de Datos].`, { size: 20 }),
  labeled("Encargado del tratamiento", "La consultora que presta el servicio de diagnóstico actúa como encargada del tratamiento, en virtud del contrato de encargo suscrito conforme al art. 28 RGPD.", { size: 20 }),
  labeled("Finalidad", "Elaborar el diagnóstico de prevención de riesgos y compliance del centro (LOPIVI / ISO 37301:2021) a partir de las respuestas agregadas por nivel jerárquico. Las respuestas se utilizan para estimar riesgos organizativos; no se evalúa el desempeño individual de las personas participantes.", { size: 20 }),
  labeled("Datos tratados", "Nivel o rol profesional en el centro, respuestas al cuestionario y, en su caso, comentarios de texto libre asociados a las respuestas. Los comentarios no deben incluir datos personales propios ni de terceros (nombres, casos concretos identificables); si se detectan, serán eliminados.", { size: 20 }),
  labeled("Base jurídica", "[Seleccionar y validar según el caso: cumplimiento de obligaciones legales del centro en materia de protección de la infancia (art. 6.1.c RGPD, en relación con la LO 8/2021); interés legítimo del centro en evaluar y mejorar su sistema de protección (art. 6.1.f RGPD); o consentimiento de la persona participante (art. 6.1.a RGPD) si así se articula la participación].", { size: 20 }),
  labeled("Destinatarios", "No se ceden datos a terceros, salvo obligación legal. El informe resultante muestra resultados agregados por nivel jerárquico y los comentarios de texto libre transcritos sin identificación nominal de su autor/a.", { size: 20 }),
  labeled("Conservación", "Los datos se conservarán durante la elaboración del diagnóstico y los plazos necesarios para atender responsabilidades derivadas; después se suprimirán o anonimizarán. [Completar con el plazo concreto definido por el centro].", { size: 20 }),
  labeled("Derechos", "Puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad ante el responsable del tratamiento, y presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).", { size: 20 }),
  note("Este texto es un modelo orientativo. Antes de su uso debe completarse con los datos del centro, elegirse y justificarse la base jurídica adecuada y validarse por el delegado de protección de datos o asesoramiento jurídico. Si el diagnóstico incorpora comentarios de texto libre, se recomienda recordar a las personas participantes, en el propio formulario, que no incluyan datos personales."),
];

/* ---------- numbering / styles / secciones ---------- */

const numbering = {
  config: [
    { reference: "b1", levels: [
      { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } },
      { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 880, hanging: 260 } } } },
    ] },
    { reference: "bc", levels: [
      { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 200, hanging: 160 } } } },
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
      new TextRun({ text: `Modelo de prevención y compliance — ${center.name || "centro"} (LOPIVI / ISO 37301:2021) · requiere validación jurídica · `, size: 14, color: "808080" }),
      new TextRun({ text: "Pág. ", size: 14, color: "808080" }),
      new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "808080" }),
    ] })] });
}
function header() {
  return new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: "Prevención y compliance en centros educativos — diagnóstico y modelo", size: 14, color: "A6A6A6", italics: true })] })] });
}
const portraitPage = { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } };
const landscapePage = { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } };
const secP = (children) => ({ properties: { page: portraitPage }, headers: { default: header() }, footers: { default: footer() }, children });
const secL = (children) => ({ properties: { page: landscapePage }, headers: { default: header() }, footers: { default: footer() }, children });
const br = () => new Paragraph({ children: [new PageBreak()] });

const doc = new Document({
  features: { updateFields: true },
  styles, numbering,
  sections: [
    // Portada, aviso, resumen, índice + Parte I + Parte II (5-6)
    secP([
      ...portada, ...aviso, br(), ...resumen, ...indice,
      ...parte("I", "MARCO GENERAL DE REFERENCIA", "Metodología, alcance, marco legal multinivel y mapa de actores: el contexto común a todo centro educativo."),
      ...sec1, br(), ...sec2, br(), ...sec3, br(), ...sec4,
      ...parte("II", "DIAGNÓSTICO PERSONALIZADO DEL CENTRO", `Resultados de las entrevistas realizadas en ${center.name || "el centro"}: matriz de riesgos, fichas justificadas, discrepancias, brechas, observaciones y cobertura normativa.`),
      ...sec5, br(), ...sec6,
    ]),
    // Matriz de calor y detalle (apaisado)
    secL([...sec7]),
    // Fichas y resto de Parte II + Parte III (13-14)
    secP([
      ...sec8, br(), ...sec9, br(), ...sec10, br(), ...sec11, br(), ...sec12,
      ...parte("III", "MODELO DE PREVENCIÓN Y COMPLIANCE", "El sistema de gestión ISO 37301, la arquitectura documental, los controles priorizados según su diagnóstico y el régimen de responsabilidades."),
      ...sec13, br(), ...sec14,
    ]),
    // Controles priorizados (apaisado)
    secL([...sec15]),
    // Resto Parte III + Parte IV + Anexo
    secP([
      ...sec16,
      ...parte("IV", "IMPLANTACIÓN Y SEGUIMIENTO", "Del diagnóstico a la acción: plan a 90 días, fases de implantación, indicadores, autoevaluación y cautelas."),
      ...sec17, br(), ...sec18, br(), ...sec19, br(), ...sec20, br(), ...sec21, br(), ...sec22,
      ...anexoA,
    ]),
  ],
});

  return Packer.toBuffer(doc);
}

/* ---------- CLI ---------- */
if (require.main === module) {
  const fs = require("fs");
  const inFile = process.argv[2];
  if (!inFile) { console.error("Uso: node docgen.js <entrada.json> [salida.docx]"); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(inFile, "utf8"));
  const out = process.argv[3] || `Informe_${safeName((data.center || {}).name)}.docx`;
  buildDocxBuffer(data.center, data.interviews, data.overrides, data.weights).then((buf) => {
    fs.writeFileSync(out, buf);
    console.log("Generado:", out);
  });
}

module.exports = { buildDocxBuffer, safeName };
