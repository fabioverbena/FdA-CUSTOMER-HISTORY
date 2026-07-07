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
