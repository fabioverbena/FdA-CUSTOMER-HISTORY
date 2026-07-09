-- FDA Customer History — tutte le migration in sequenza
-- Incolla questo file nel Supabase SQL Editor ed eseguilo tutto in una volta.
-- Generato automaticamente da 001→006.
-- Sicuro da rieseguire: usa CREATE TABLE IF NOT EXISTS e CREATE INDEX IF NOT EXISTS.


-- ════════════════════════════════════════
-- 001_cap_comuni.sql
-- ════════════════════════════════════════
-- Lookup CAP → Comune → Provincia → Regione
-- Caricata una tantum da CSV ISTAT tramite seed/import_cap_comuni.py
-- Non toccare dopo il caricamento iniziale (salvo aggiornamenti ISTAT).
--
-- NOTA: in Italia uno stesso CAP può coprire più frazioni/comuni contigui
-- della stessa provincia. Usiamo (cap, comune) come PK composita.
-- Per il lookup daemon (cap → regione/sigla_provincia) basta fare:
--   SELECT DISTINCT sigla_provincia, regione FROM cap_comuni WHERE cap = $1 LIMIT 1

CREATE TABLE IF NOT EXISTS cap_comuni (
  cap             VARCHAR(5)   NOT NULL,
  comune          VARCHAR      NOT NULL,
  provincia       VARCHAR      NOT NULL,
  sigla_provincia CHAR(2)      NOT NULL,
  regione         VARCHAR      NOT NULL,
  PRIMARY KEY (cap, comune)
);

CREATE INDEX IF NOT EXISTS idx_cap_comuni_sigla ON cap_comuni (sigla_provincia);
CREATE INDEX IF NOT EXISTS idx_cap_comuni_regione ON cap_comuni (regione);

-- ════════════════════════════════════════
-- 002_anagrafica.sql
-- ════════════════════════════════════════
-- Anagrafica clienti e fornitori — master registry FdA
-- Fonte di verità unica per tutte le app (daemon, App Spedizioni, App Genera Documenti, frontend).
--
-- email e telefono sono nullable: presenti solo dopo la prima BC/BC3 (clienti)
-- o OF/BF (fornitori). Il daemon li popola in background.
-- comune, provincia, sigla_provincia, regione sono derivati da cap_comuni in fase di import;
-- il daemon li scrive direttamente dall'estrazione PDF.

CREATE TABLE IF NOT EXISTS clienti (
  piva              VARCHAR(11)  PRIMARY KEY,
  ragione_sociale   VARCHAR      NOT NULL,
  indirizzo         VARCHAR,
  cap               VARCHAR(5),
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
  piva              VARCHAR(11)  PRIMARY KEY,
  ragione_sociale   VARCHAR      NOT NULL,
  indirizzo         VARCHAR,
  cap               VARCHAR(5),
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

-- ════════════════════════════════════════
-- 003_articoli.sql
-- ════════════════════════════════════════
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

-- ════════════════════════════════════════
-- 004_espositori.sql
-- ════════════════════════════════════════
-- Espositori installati presso i clienti
-- La matricola viene estratta dalle note delle righe documento (campo note del PDF Mexal).
-- Collegamento al cliente e al modello avviene al momento dell'inserimento del documento.

CREATE TABLE IF NOT EXISTS espositori (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  matricola           VARCHAR      UNIQUE NOT NULL,
  codice_modello      VARCHAR      REFERENCES modelli_espositore (codice) ON DELETE SET NULL,
  piva_cliente        VARCHAR(11)  REFERENCES clienti (piva) ON DELETE SET NULL,
  data_prima_vendita  DATE,
  -- 'attivo' | 'reso' | 'dismesso'
  stato               VARCHAR      NOT NULL DEFAULT 'attivo',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_espositori_piva_cliente  ON espositori (piva_cliente);
CREATE INDEX IF NOT EXISTS idx_espositori_codice_modello ON espositori (codice_modello);
CREATE INDEX IF NOT EXISTS idx_espositori_stato         ON espositori (stato);

CREATE OR REPLACE TRIGGER trg_espositori_updated_at
  BEFORE UPDATE ON espositori
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ════════════════════════════════════════
-- 005_documenti.sql
-- ════════════════════════════════════════
-- Documenti Mexal e righe documento
-- Popolati dal daemon ad ogni PDF rilevato.
-- tipo: PC | OC | BC | BC3 | FTA | OF | BF
--   (nel daemon: DDT→BC, FC→FTA, PC→PC, OC→OC, OF→OF)

CREATE TABLE IF NOT EXISTS documenti (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_documento    VARCHAR      NOT NULL,
  tipo                VARCHAR      NOT NULL,
  data_documento      DATE         NOT NULL,
  piva_cliente        VARCHAR(11)  REFERENCES clienti (piva)    ON DELETE SET NULL,
  piva_fornitore      VARCHAR(11)  REFERENCES fornitori (piva)  ON DELETE SET NULL,
  totale              DECIMAL(10,2),
  percorso_pdf_locale VARCHAR,
  percorso_pdf_gdrive VARCHAR,      -- file ID Google Drive (se caricato)
  parsed_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Evita duplicati: stesso numero + tipo + data = stesso documento
  CONSTRAINT uq_documento UNIQUE (numero_documento, tipo, data_documento)
);

CREATE INDEX IF NOT EXISTS idx_documenti_piva_cliente   ON documenti (piva_cliente);
CREATE INDEX IF NOT EXISTS idx_documenti_piva_fornitore ON documenti (piva_fornitore);
CREATE INDEX IF NOT EXISTS idx_documenti_tipo           ON documenti (tipo);
CREATE INDEX IF NOT EXISTS idx_documenti_data           ON documenti (data_documento);


-- Righe del documento (articoli, quantità, prezzi)
-- tipo_riga: 'espositore' | 'ricambio' | 'servizio' | 'altro'
-- La classificazione usa codici_espositore_config (priorità) + fallback keyword "espositore".
-- espositore_id valorizzato solo per righe tipo 'espositore' con matricola nota.
-- collegamento_ambiguo = true quando la matricola non disambigua univocamente l'espositore.

CREATE TABLE IF NOT EXISTS righe_documento (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id         UUID         NOT NULL REFERENCES documenti (id) ON DELETE CASCADE,
  codice_articolo      VARCHAR      REFERENCES articoli (codice_mexal) ON DELETE SET NULL,
  descrizione          VARCHAR,
  quantita             DECIMAL(10,3),
  prezzo_unitario      DECIMAL(10,2),
  totale_riga          DECIMAL(10,2),
  note                 VARCHAR,      -- contiene la matricola per righe espositore
  tipo_riga            VARCHAR      NOT NULL DEFAULT 'altro',
  espositore_id        UUID         REFERENCES espositori (id) ON DELETE SET NULL,
  collegamento_ambiguo BOOLEAN      NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_righe_documento_id      ON righe_documento (documento_id);
CREATE INDEX IF NOT EXISTS idx_righe_espositore_id     ON righe_documento (espositore_id);
CREATE INDEX IF NOT EXISTS idx_righe_tipo              ON righe_documento (tipo_riga);
CREATE INDEX IF NOT EXISTS idx_righe_codice_articolo   ON righe_documento (codice_articolo);

-- ════════════════════════════════════════
-- 006_satellite.sql
-- ════════════════════════════════════════
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
