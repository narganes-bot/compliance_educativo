/* ------------------------------------------------------------------ *
 *  justificaciones-riesgos.js
 *  Justificación de por qué cada riesgo (R01–R23) constituye un riesgo real.
 *  Se integra en el motor (@compliance/engine) y se muestra en el informe Word.
 *
 *  Cada riesgo tiene tres campos:
 *    - consecuencias : qué puede ocurrir si el riesgo se materializa.
 *    - obligacion    : la obligación normativa que lo respalda.
 *    - impacto       : el impacto en el centro y en los menores.
 *
 *  El contenido es orientativo y no constituye asesoramiento jurídico.
 * ------------------------------------------------------------------ */

const RISK_JUSTIFICATIONS = {
  R01: {
    consecuencias: "Sin protocolos, las situaciones de violencia se afrontan de forma improvisada, lo que retrasa la detección y la respuesta y aumenta la probabilidad de que el daño al menor se agrave o se repita.",
    obligacion: "La LOPIVI (LO 8/2021) obliga a los centros a disponer de protocolos de actuación frente a la violencia, y la LOPJM (LO 1/1996) refuerza el deber general de protección del menor.",
    impacto: "Para el centro supone un incumplimiento normativo y exposición a responsabilidad; para el menor, desprotección ante situaciones que el centro debería prevenir y gestionar.",
  },
  R02: {
    consecuencias: "Un protocolo aprobado pero no aplicado genera una falsa sensación de seguridad: ante un caso real, el personal no sabe cómo actuar y la respuesta falla en el momento crítico.",
    obligacion: "La LOPIVI exige que los protocolos estén implantados y difundidos, no solo redactados; los protocolos autonómicos concretan su contenido y su actualización.",
    impacto: "El centro no puede acreditar la diligencia debida; el menor queda expuesto a una gestión tardía o errónea de su situación.",
  },
  R03: {
    consecuencias: "Sin una figura responsable y formada, no hay quien lidere la prevención, reciba las comunicaciones ni coordine la respuesta, dejando el sistema de protección sin punto de referencia.",
    obligacion: "La LOPIVI obliga a todo centro educativo a designar un Coordinador o Coordinadora de Bienestar y Protección con formación específica acreditada.",
    impacto: "Incumplimiento directo de una obligación legal nuclear; para el menor, ausencia de un canal claro y competente para su protección.",
  },
  R04: {
    consecuencias: "No comunicar los indicios permite que la violencia continúe, impide la intervención de los servicios competentes y puede constituir, además, una infracción o incluso un delito de omisión.",
    obligacion: "La LOPIVI y la LOPJM imponen el deber de comunicar de forma inmediata a las autoridades y servicios competentes cualquier indicio de violencia sobre un menor.",
    impacto: "Grave responsabilidad legal para el centro y el personal; para el menor, la prolongación de un daño que debía haberse detenido.",
  },
  R05: {
    consecuencias: "Una gestión deficiente cronifica el acoso, agrava el sufrimiento de la víctima y puede derivar en consecuencias graves para su salud física y psicológica.",
    obligacion: "El art. 124 de la LOE exige planes de convivencia y una respuesta reglada ante el acoso; los protocolos autonómicos detallan el procedimiento.",
    impacto: "Responsabilidad del centro por falta de respuesta; para el menor, daño psicológico prolongado y vulneración de su derecho a un entorno seguro.",
  },
  R06: {
    consecuencias: "El ciberacoso traspasa los muros del centro y es continuo; su no abordaje deja a la víctima expuesta a todas horas y dificulta la obtención de pruebas.",
    obligacion: "El Convenio de Budapest y los protocolos autonómicos frente al ciberacoso obligan a disponer de medidas de detección, respuesta y uso seguro de las TIC.",
    impacto: "El centro puede incumplir sus deberes de convivencia digital; el menor sufre un acoso persistente y de difícil control.",
  },
  R07: {
    consecuencias: "Una respuesta inadecuada ante la sospecha de abuso puede destruir pruebas, revictimizar al menor y permitir que el abuso continúe.",
    obligacion: "La LOPIVI, la Directiva 2011/93/UE y el Convenio de Lanzarote imponen protocolos específicos de actuación, escucha única y comunicación inmediata ante indicios de violencia sexual.",
    impacto: "Es el riesgo de mayor gravedad: el fallo del centro tiene consecuencias irreparables para el menor y máxima responsabilidad institucional y penal.",
  },
  R08: {
    consecuencias: "La violencia entre iguales no atendida se normaliza, escala y deteriora el clima escolar, afectando tanto a las víctimas como a los observadores.",
    obligacion: "El art. 124 de la LOE y el deber general de custodia (arts. 1902-1903 del Código Civil) obligan al centro a prevenir y corregir estas conductas.",
    impacto: "El centro puede responder civilmente por falta de vigilancia; el menor ve mermado su bienestar y su rendimiento.",
  },
  R09: {
    consecuencias: "La violencia ejercida por quien debe proteger supone la más grave quiebra de la confianza y del deber de garante, con un daño profundo para el menor.",
    obligacion: "La LOPIVI exige entornos seguros, códigos de conducta y mecanismos de detección y respuesta frente a la violencia ejercida por adultos del entorno educativo.",
    impacto: "Responsabilidad institucional, disciplinaria y penal de máxima gravedad; para el menor, un daño agravado por la posición de autoridad del agresor.",
  },
  R10: {
    consecuencias: "La menor supervisión en actividades extraescolares eleva la probabilidad de accidentes o de situaciones de desprotección fuera del marco ordinario.",
    obligacion: "El deber de custodia y vigilancia (arts. 1902-1903 del Código Civil) se mantiene durante las actividades organizadas o autorizadas por el centro.",
    impacto: "Responsabilidad civil del centro por los daños; para el menor, riesgo físico y de desatención.",
  },
  R11: {
    consecuencias: "Los fallos en el transporte (acompañamiento, subidas y bajadas, control de asistencia) pueden derivar en accidentes o en la pérdida de control sobre el menor.",
    obligacion: "La normativa autonómica de transporte escolar regula las condiciones de seguridad y acompañamiento.",
    impacto: "Responsabilidad compartida entre el centro y el proveedor; para el menor, exposición a accidentes o desprotección en los trayectos.",
  },
  R12: {
    consecuencias: "La falta de control en el comedor puede provocar incidentes de seguridad, alérgenos no gestionados o situaciones de desprotección en un tiempo de menor supervisión docente.",
    obligacion: "La normativa autonómica de comedores escolares fija requisitos de seguridad, supervisión y gestión de alérgenos.",
    impacto: "Responsabilidad del centro por los incidentes; para el menor, riesgo para su salud y su seguridad.",
  },
  R13: {
    consecuencias: "Las salidas concentran riesgos (desplazamientos, pernoctas, entornos no controlados) que, sin planificación, pueden desembocar en accidentes o desprotección.",
    obligacion: "El deber de custodia (arts. 1902-1903 del Código Civil) persiste durante las salidas; se exigen autorizaciones, ratios y planificación de la seguridad.",
    impacto: "Responsabilidad civil del centro y del responsable de la salida; para el menor, exposición a riesgos en entornos no habituales.",
  },
  R14: {
    consecuencias: "Incorporar personal externo sin las debidas verificaciones introduce en el centro a personas cuyo contacto con menores no ha sido controlado.",
    obligacion: "La LOPIVI extiende las exigencias de entornos seguros y de verificación a los proveedores y al personal externo con contacto habitual con menores.",
    impacto: "El centro asume el riesgo de que terceros no verificados accedan a los menores; para estos, exposición directa a un peligro evitable.",
  },
  R15: {
    consecuencias: "No exigir el certificado permite que personas condenadas por delitos sexuales trabajen en contacto con menores, materializando precisamente el riesgo que la ley pretende evitar.",
    obligacion: "El art. 57 de la LOPIVI y la Directiva 2011/93/UE obligan a verificar el certificado negativo del Registro Central de Delincuentes Sexuales de todo el personal con contacto habitual con menores.",
    impacto: "Incumplimiento de una obligación legal expresa y verificable; para el menor, el mayor de los riesgos evitables.",
  },
  R16: {
    consecuencias: "Los descuidos en la vigilancia (recreos, entradas y salidas, espacios comunes) son el escenario habitual de accidentes y de situaciones de violencia no detectadas.",
    obligacion: "Los arts. 1902-1903 del Código Civil establecen la responsabilidad por culpa in vigilando durante el tiempo en que el menor está bajo la custodia del centro.",
    impacto: "Responsabilidad civil directa del centro; para el menor, riesgo físico y de desprotección en los momentos de menor control.",
  },
  R17: {
    consecuencias: "Reiterar declaraciones, exponer al menor o gestionar su caso sin cuidado añade un segundo daño al ya sufrido y dificulta su recuperación.",
    obligacion: "El Estatuto de la víctima (Ley 4/2015) y la LOPIVI imponen evitar la victimización secundaria, con medidas como la escucha única.",
    impacto: "El centro puede vulnerar los derechos de la víctima; para el menor, un daño añadido y evitable.",
  },
  R18: {
    consecuencias: "La difusión indebida de información sobre un menor o su caso puede exponerlo, estigmatizarlo y comprometer la investigación o la intervención.",
    obligacion: "El RGPD y la LOPDGDD exigen confidencialidad y acceso restringido a los datos, en especial en situaciones sensibles que afectan a menores.",
    impacto: "Responsabilidad del centro ante la autoridad de control; para el menor, exposición y daño reputacional o emocional.",
  },
  R19: {
    consecuencias: "Recoger, conservar o compartir datos sin base ni medidas adecuadas genera brechas, accesos indebidos y usos no consentidos, con especial gravedad tratándose de menores.",
    obligacion: "El RGPD y la LOPDGDD imponen licitud, minimización, seguridad y limitación de la finalidad en todo tratamiento de datos.",
    impacto: "Exposición a sanciones y reclamaciones; para el menor, riesgo sobre su intimidad y sus datos personales.",
  },
  R20: {
    consecuencias: "Un personal no formado no reconoce los indicios de violencia ni sabe activar los protocolos, de modo que el sistema falla en su primer eslabón: la detección.",
    obligacion: "La LOPIVI exige formación en protección a la infancia para el personal de los centros educativos.",
    impacto: "El centro no puede garantizar una detección temprana; para el menor, situaciones que pasan desapercibidas.",
  },
  R21: {
    consecuencias: "Sin registro de las actuaciones, el centro no puede acreditar qué hizo, cuándo y por qué, lo que impide demostrar la diligencia debida y dificulta el seguimiento de los casos.",
    obligacion: "La Ley 40/2015 y el RGPD exigen documentar las actuaciones y el tratamiento de datos con la debida trazabilidad.",
    impacto: "Debilita la posición del centro ante posibles responsabilidades; para el menor, riesgo de pérdida de continuidad en el seguimiento de su caso.",
  },
  R22: {
    consecuencias: "La falta de coordinación fragmenta la respuesta, retrasa la intervención de quien puede proteger al menor y deja casos sin el seguimiento externo necesario.",
    obligacion: "La LOPJM, la LOPIVI y la LO 1/2004 exigen la comunicación y coordinación con los servicios sociales, las fuerzas de seguridad y demás autoridades competentes.",
    impacto: "El centro incumple su deber de derivación; para el menor, una protección incompleta por falta de intervención externa.",
  },
  R23: {
    consecuencias: "Una mala gestión de un caso, aunque no derive en sanción, puede erosionar gravemente la confianza de las familias y de la comunidad, con efectos duraderos.",
    obligacion: "No deriva de una obligación normativa concreta, sino que es consecuencia de incumplir las anteriores; la prevención es la mejor protección reputacional.",
    impacto: "Para el centro, pérdida de confianza y de viabilidad; para el menor, un entorno debilitado en su función protectora.",
  },
};

/* Devuelve párrafos docx listos para insertar en el informe.
 * Se le pasa el objeto `docx` (require("docx")) para no depender de cómo
 * lo importe el generador. Uso: paras.push(...justificationBlocks("R07", docx)); */
function justificationBlocks(code, docx, opts = {}) {
  const { Paragraph, TextRun } = docx;
  const j = RISK_JUSTIFICATIONS[code];
  if (!j) return [];
  const size = opts.size || 18;      // media-punto: 18 = 9pt
  const navy = opts.navy || "1F3864";
  const line = (label, text) => new Paragraph({
    spacing: { after: 70, line: 264 },
    children: [
      new TextRun({ text: label + " ", bold: true, size }),
      new TextRun({ text, size }),
    ],
  });
  return [
    new Paragraph({ spacing: { before: 70, after: 30 }, children: [
      new TextRun({ text: "Por qué es un riesgo", bold: true, size, color: navy }),
    ]}),
    line("Consecuencias:", j.consecuencias),
    line("Obligación normativa:", j.obligacion),
    line("Impacto en el centro y en los menores:", j.impacto),
  ];
}

module.exports = { RISK_JUSTIFICATIONS, justificationBlocks };
