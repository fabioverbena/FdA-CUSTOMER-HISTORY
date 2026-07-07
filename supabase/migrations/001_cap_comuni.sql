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
