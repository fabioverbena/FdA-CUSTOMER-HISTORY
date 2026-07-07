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
