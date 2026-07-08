-- Anagrafica clienti e fornitori — master registry FdA
-- Fonte di verità unica per tutte le app (daemon, App Spedizioni, App Genera Documenti, frontend).
--
-- email e telefono sono nullable: presenti solo dopo la prima BC/BC3 (clienti)
-- o OF/BF (fornitori). Il daemon li popola in background.
-- comune, provincia, sigla_provincia, regione sono derivati da cap_comuni in fase di import;
-- il daemon li scrive direttamente dall'estrazione PDF.

CREATE TABLE IF NOT EXISTS clienti (
  piva              VARCHAR(30)  PRIMARY KEY,
  ragione_sociale   VARCHAR      NOT NULL,
  indirizzo         VARCHAR,
  cap               VARCHAR(10),
  comune            VARCHAR,
  provincia         VARCHAR,
  sigla_provincia   CHAR(2),
  regione           VARCHAR,
  email             VARCHAR,
  telefono          VARCHAR,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clienti_regione        ON clienti (regione);
CREATE INDEX IF NOT EXISTS idx_clienti_sigla_prov     ON clienti (sigla_provincia);
CREATE INDEX IF NOT EXISTS idx_clienti_ragione_sociale ON clienti (ragione_sociale);

-- Trigger: aggiorna updated_at ad ogni UPDATE
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_clienti_updated_at
  BEFORE UPDATE ON clienti
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();


CREATE TABLE IF NOT EXISTS fornitori (
  piva              VARCHAR(30)  PRIMARY KEY,
  ragione_sociale   VARCHAR      NOT NULL,
  indirizzo         VARCHAR,
  cap               VARCHAR(10),
  comune            VARCHAR,
  provincia         VARCHAR,
  sigla_provincia   CHAR(2),
  regione           VARCHAR,
  email             VARCHAR,
  telefono          VARCHAR,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornitori_regione    ON fornitori (regione);
CREATE INDEX IF NOT EXISTS idx_fornitori_sigla_prov ON fornitori (sigla_provincia);

CREATE OR REPLACE TRIGGER trg_fornitori_updated_at
  BEFORE UPDATE ON fornitori
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
