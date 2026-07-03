-- ============================================================================
--  schema.sql — Modelo de datos multi-inquilino (PostgreSQL)
--  Herramienta de prevención y compliance educativo (LOPIVI)
--  Fase 1. Aislamiento por inquilino mediante Row-Level Security (RLS).
--
--  Principio: el "inquilino" es la consultora (consultancy). Todo dato de
--  centro/campaña/entrevista lleva consultancy_id denormalizado para que las
--  políticas RLS sean simples y robustas. La aplicación fija, por petición:
--      SET app.consultancy_id = '<uuid>';   (usuario autenticado)
--  y las políticas restringen automáticamente las filas visibles.
--
--  Minimización (ver dossier de gobernanza):
--   · Las entrevistas se identifican por rol + alias (iniciales), no por nombre.
--   · Las respuestas solo guardan el estado del control (si/parcial/no/ns).
--   · No se almacenan datos de menores ni texto libre de casos.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Consultora (inquilino raíz)
-- ---------------------------------------------------------------------------
CREATE TABLE consultancy (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  cif         text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Usuarios de la aplicación (coordinadores / consultores)
-- ---------------------------------------------------------------------------
CREATE TABLE app_user (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultancy_id uuid NOT NULL REFERENCES consultancy(id) ON DELETE CASCADE,
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,               -- bcrypt/argon2; NUNCA en claro
  display_name   text,
  role           text NOT NULL DEFAULT 'consultant'
                   CHECK (role IN ('owner','consultant')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_app_user_consultancy ON app_user(consultancy_id);

-- ---------------------------------------------------------------------------
-- Centro educativo
-- ---------------------------------------------------------------------------
CREATE TABLE center (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultancy_id uuid NOT NULL REFERENCES consultancy(id) ON DELETE CASCADE,
  name           text NOT NULL,
  ownership      text NOT NULL CHECK (ownership IN ('publica','concertada','privada')),
  stages         text,
  num_students   integer,
  ccaa           text,                         -- comunidad autónoma (parametriza normativa)
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_center_consultancy ON center(consultancy_id);

-- ---------------------------------------------------------------------------
-- Campaña (una ronda de diagnóstico de un centro) — equivale a la "sala"
-- ---------------------------------------------------------------------------
CREATE TABLE campaign (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultancy_id  uuid NOT NULL REFERENCES consultancy(id) ON DELETE CASCADE,
  center_id       uuid NOT NULL REFERENCES center(id) ON DELETE CASCADE,
  code            text NOT NULL UNIQUE,        -- código legible para compartir
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','closed','archived')),
  opens_at        timestamptz NOT NULL DEFAULT now(),
  closes_at       timestamptz,
  retention_until date,                         -- política de conservación (Fase 3)
  created_by      uuid REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_campaign_consultancy ON campaign(consultancy_id);
CREATE INDEX ix_campaign_center ON campaign(center_id);

-- ---------------------------------------------------------------------------
-- Enlace de participante (acceso por token, sin cuenta) — seudónimo
-- ---------------------------------------------------------------------------
CREATE TABLE participant_link (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultancy_id  uuid NOT NULL REFERENCES consultancy(id) ON DELETE CASCADE,
  campaign_id     uuid NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE,        -- aleatorio, sin datos personales
  assigned_role   text,                         -- opcional: fija el rol del participante
  expires_at      timestamptz,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_plink_campaign ON participant_link(campaign_id);

-- ---------------------------------------------------------------------------
-- Entrevista (una respuesta completa de una persona)
-- ---------------------------------------------------------------------------
CREATE TABLE interview (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultancy_id      uuid NOT NULL REFERENCES consultancy(id) ON DELETE CASCADE,
  campaign_id         uuid NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  participant_link_id uuid REFERENCES participant_link(id) ON DELETE SET NULL,
  role                text NOT NULL,            -- nivel jerárquico
  respondent_alias    text,                     -- iniciales; NO nombre completo
  submitted_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_interview_campaign ON interview(campaign_id);

-- ---------------------------------------------------------------------------
-- Respuesta (estado de un control) — sin texto libre
-- ---------------------------------------------------------------------------
CREATE TABLE response (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultancy_id  uuid NOT NULL REFERENCES consultancy(id) ON DELETE CASCADE,
  interview_id    uuid NOT NULL REFERENCES interview(id) ON DELETE CASCADE,
  question_id     text NOT NULL,                -- id del banco de preguntas (engine)
  answer          text NOT NULL CHECK (answer IN ('si','parcial','no','ns')),
  UNIQUE (interview_id, question_id)
);
CREATE INDEX ix_response_interview ON response(interview_id);

-- ---------------------------------------------------------------------------
-- Registro de accesos (auditoría / seguridad)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id              bigserial PRIMARY KEY,
  consultancy_id  uuid REFERENCES consultancy(id) ON DELETE SET NULL,
  actor_user_id   uuid REFERENCES app_user(id) ON DELETE SET NULL,
  action          text NOT NULL,                -- p. ej. 'login','create_campaign'
  entity          text,
  entity_id       uuid,
  ip              inet,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_consultancy ON audit_log(consultancy_id);

-- ===========================================================================
--  Row-Level Security: cada consultora solo ve sus propias filas
-- ===========================================================================
ALTER TABLE center           ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign         ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview        ENABLE ROW LEVEL SECURITY;
ALTER TABLE response         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;
-- Nota: app_user no lleva RLS porque el login busca por correo de forma global.
-- El acceso a usuarios se controla en la capa de aplicación.

-- Helper: uuid del inquilino de la sesión (fijado por la app en cada petición)
--   SELECT set_config('app.consultancy_id', '<uuid>', false);
CREATE OR REPLACE FUNCTION app_current_consultancy() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.consultancy_id', true), '')::uuid
$$;

-- Política uniforme por tabla (lectura y escritura restringidas al inquilino)
CREATE POLICY tenant_isolation_center           ON center
  USING (consultancy_id = app_current_consultancy())
  WITH CHECK (consultancy_id = app_current_consultancy());
CREATE POLICY tenant_isolation_campaign         ON campaign
  USING (consultancy_id = app_current_consultancy())
  WITH CHECK (consultancy_id = app_current_consultancy());
CREATE POLICY tenant_isolation_plink            ON participant_link
  USING (consultancy_id = app_current_consultancy())
  WITH CHECK (consultancy_id = app_current_consultancy());
CREATE POLICY tenant_isolation_interview        ON interview
  USING (consultancy_id = app_current_consultancy())
  WITH CHECK (consultancy_id = app_current_consultancy());
CREATE POLICY tenant_isolation_response         ON response
  USING (consultancy_id = app_current_consultancy())
  WITH CHECK (consultancy_id = app_current_consultancy());
CREATE POLICY tenant_isolation_audit            ON audit_log
  USING (consultancy_id = app_current_consultancy())
  WITH CHECK (consultancy_id = app_current_consultancy());

-- ===========================================================================
--  Envío de participante por token (sin contexto de inquilino en la sesión).
--  Función SECURITY DEFINER: valida el token, resuelve el inquilino y la
--  campaña, e inserta la entrevista y sus respuestas de forma atómica.
--  'answers' es un objeto JSON { "q1": "si", "q7": "no", ... }.
-- ===========================================================================
CREATE OR REPLACE FUNCTION submit_interview(
  p_token   text,
  p_role    text,
  p_alias   text,
  p_answers jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_link      participant_link%ROWTYPE;
  v_interview uuid;
  v_key       text;
  v_val       text;
BEGIN
  SELECT * INTO v_link FROM participant_link WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'token no válido'; END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RAISE EXCEPTION 'enlace caducado';
  END IF;

  INSERT INTO interview (consultancy_id, campaign_id, participant_link_id, role, respondent_alias)
  VALUES (v_link.consultancy_id, v_link.campaign_id, v_link.id,
          COALESCE(v_link.assigned_role, p_role), p_alias)
  RETURNING id INTO v_interview;

  FOR v_key, v_val IN SELECT * FROM jsonb_each_text(p_answers) LOOP
    IF v_val IN ('si','parcial','no','ns') THEN
      INSERT INTO response (consultancy_id, interview_id, question_id, answer)
      VALUES (v_link.consultancy_id, v_interview, v_key, v_val);
    END IF;
  END LOOP;

  UPDATE participant_link SET used_at = now() WHERE id = v_link.id;
  RETURN v_interview;
END;
$$;

-- ===========================================================================
--  Acceso público por CÓDIGO de sala (para el flujo simple de la app).
--  Los tokens de participante siguen siendo la vía preferente y más segura;
--  estas funciones dan soporte al flujo "unirse con el código de la sala".
-- ===========================================================================
CREATE OR REPLACE FUNCTION room_by_code(p_code text)
RETURNS TABLE (status text, center_name text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT cp.status, ct.name
    FROM campaign cp JOIN center ct ON ct.id = cp.center_id
   WHERE cp.code = p_code
$$;

CREATE OR REPLACE FUNCTION submit_interview_by_code(
  p_code    text,
  p_role    text,
  p_alias   text,
  p_answers jsonb
) RETURNS TABLE (id uuid, consultancy_id uuid)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cp        campaign%ROWTYPE;
  v_interview uuid;
  v_key text; v_val text;
BEGIN
  SELECT * INTO v_cp FROM campaign WHERE code = p_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'código no válido'; END IF;
  IF v_cp.status <> 'open' THEN RAISE EXCEPTION 'campaña cerrada'; END IF;

  INSERT INTO interview (consultancy_id, campaign_id, role, respondent_alias)
  VALUES (v_cp.consultancy_id, v_cp.id, p_role, p_alias)
  RETURNING interview.id INTO v_interview;

  FOR v_key, v_val IN SELECT * FROM jsonb_each_text(p_answers) LOOP
    IF v_val IN ('si','parcial','no','ns') THEN
      INSERT INTO response (consultancy_id, interview_id, question_id, answer)
      VALUES (v_cp.consultancy_id, v_interview, v_key, v_val);
    END IF;
  END LOOP;

  id := v_interview; consultancy_id := v_cp.consultancy_id; RETURN NEXT;
END;
$$;

-- Notas de despliegue:
--  · La app se conecta con un rol SIN BYPASSRLS y ejecuta set_config('app.consultancy_id', ...)
--    tras autenticar al usuario. Las peticiones de participante usan submit_interview().
--  · Cifrado en reposo a nivel de disco/gestor; TLS en tránsito.
--  · Backups cifrados con prueba de restauración; retención según retention_until.
