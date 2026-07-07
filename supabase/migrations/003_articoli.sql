-- Catalogo articoli Mexal + configurazione espositori
-- Fonte iniziale: ARTICOLI_FDA.csv (export EventManager, ~287 prodotti)
-- Aggiornabile senza toccare il codice daemon.

CREATE TABLE IF NOT EXISTS articoli (
  codice_mexal    VARCHAR      PRIMARY KEY,
  descrizione     VARCHAR      NOT NULL,
  -- 'espositore' | 'ricambio' | 'servizio' | 'altro'
  categoria       VARCHAR      NOT NULL DEFAULT 'altro',
  is_espositore   BOOLEAN      NOT NULL DEFAULT false,
  prezzo_listino  DECIMAL(10,2),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articoli_categoria    ON articoli (categoria);
CREATE INDEX IF NOT EXISTS idx_articoli_is_espositore ON articoli (is_espositore);

CREATE OR REPLACE TRIGGER trg_articoli_updated_at
  BEFORE UPDATE ON articoli
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();


-- Modelli espositore (Leo, Titano, Zen, …) — inserimento manuale, max ~10 righe
CREATE TABLE IF NOT EXISTS modelli_espositore (
  codice          VARCHAR      PRIMARY KEY,  -- es. 'LEO2', 'LEO3', 'TITANO'
  nome            VARCHAR      NOT NULL,     -- es. 'Leonardo 2 vasche'
  prezzo_listino  DECIMAL(10,2),
  descrizione     VARCHAR,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);


-- Mappa codice_articolo Mexal → modello espositore
-- Aggiornabile dall'operatore senza toccare il codice daemon.
-- Il daemon usa questa tabella per classificare le righe documento.
CREATE TABLE IF NOT EXISTS codici_espositore_config (
  codice_articolo VARCHAR  PRIMARY KEY REFERENCES articoli (codice_mexal) ON DELETE CASCADE,
  codice_modello  VARCHAR  REFERENCES modelli_espositore (codice) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
