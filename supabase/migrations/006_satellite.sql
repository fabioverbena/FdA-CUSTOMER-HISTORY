-- Tabelle popolate dalle app satellite (non dal daemon)

-- Spedizioni — popolata da App Spedizioni quando la spedizione viene finalizzata
CREATE TABLE IF NOT EXISTS spedizioni (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id    UUID         REFERENCES documenti (id) ON DELETE SET NULL,
  corriere        VARCHAR,
  tracking        VARCHAR,
  data_spedizione DATE,
  -- 'bozza' | 'inviata' | 'consegnata' | 'annullata'
  stato           VARCHAR      NOT NULL DEFAULT 'bozza',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spedizioni_documento_id ON spedizioni (documento_id);
CREATE INDEX IF NOT EXISTS idx_spedizioni_stato        ON spedizioni (stato);

CREATE OR REPLACE TRIGGER trg_spedizioni_updated_at
  BEFORE UPDATE ON spedizioni
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();


-- Procedure CE — popolata da App Genera Documenti quando la procedura viene completata
CREATE TABLE IF NOT EXISTS procedure_ce (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id        UUID         REFERENCES documenti (id) ON DELETE SET NULL,
  -- 'avviata' | 'completata' | 'annullata'
  stato               VARCHAR      NOT NULL DEFAULT 'avviata',
  data_completamento  DATE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procedure_ce_documento_id ON procedure_ce (documento_id);

CREATE OR REPLACE TRIGGER trg_procedure_ce_updated_at
  BEFORE UPDATE ON procedure_ce
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
