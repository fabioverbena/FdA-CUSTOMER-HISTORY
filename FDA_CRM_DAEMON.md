
All projects
FDA CRM & Daemon



How can I help you today?


Start a chat to keep conversations organized and re-use project knowledge.
Memory
Only you
Project memory will show here after a few chats.

Instructions
Add instructions to tailor Claude’s responses

Files
1% of project capacity used

FDA_CRM_BRIEFING (1).md
429 lines

md


FDA_CRM_BRIEFING (1).md


FDA Customer History — Briefing Document per CC
Documento prodotto in sessione di progettazione con Claude. Da consegnare a CC prima dell'analisi del codice esistente. CC dovrà leggere questo documento, analizzare il daemon esistente, e produrre il CLAUDE.md definitivo del progetto unificato.

Contesto generale
Fior d'Acqua (FdA) produce e commercializza espositori refrigerati per fiori recisi (B2B). Il gestionale in uso è Mexal, che emette documenti PDF salvati in una o due cartelle temp locali sul PC Lav (Windows).

Esiste già un daemon desktop (Python, app DT) che intercetta i PDF Mexal e gestisce workflow operativi. Il progetto consiste nell'estendere e adattare questo daemon, aggiungere un CRM verticale basato su Supabase/PostgreSQL, e integrare le app satellite esistenti.

Path daemon esistente: C:\Users\fabio\Documents\FDA PROGETTI DIGITALI\fda-orchestrator

Obiettivo del progetto
Realizzare un CRM verticale chiamato FDA Customer History che:

Riceva dati automaticamente dal parsing dei PDF Mexal tramite daemon
Riceva dati dalle app satellite (App Spedizioni, App Genera Documenti) quando finalizzano le loro procedure
Esponga una dashboard web (React/TypeScript su Vercel) per query e consultazione storico clienti/fornitori
Supporti query geografiche per area (regione/provincia)
Sia affiancato da Metabase (Docker su NAS Synology) per query esplorative e report ad hoc
Stack tecnologico
PC Lav - Windows (locale)
├── Mexal → emette PDF in cartella/e temp
└── Daemon Python (app desktop esistente, da estendere)
    ├── file watcher (watchdog)
    ├── parser PDF (pdfplumber)
    ├── interfaccia modale desktop
    └── HTTP client → POST a Supabase + chiamate app satellite

Cloud
├── Supabase (PostgreSQL + PostgREST + Auth)
│   └── movimento giornaliero garantito → no rischio sospensione
└── Vercel → Frontend React/TypeScript (dashboard CRM)

NAS Synology (da installare)
└── Docker → Metabase (query esplorative + report ad hoc)
    └── si connette direttamente a Supabase PostgreSQL
Struttura repository
fda-customer-history/          ← repo GitHub (da inizializzare)
├── daemon/                    ← codice Python daemon (da migrare da fda-orchestrator)
├── frontend/                  ← React/TypeScript dashboard
├── supabase/
│   ├── migrations/            ← schema SQL
│   └── seed/                  ← dati iniziali (cap_comuni, codici_espositore_config)
├── docs/                      ← documentazione
└── CLAUDE.md                  ← istruzioni per CC (da produrre dopo analisi codice)
Schema database
Tabelle principali
sql
clienti
  piva                VARCHAR PRIMARY KEY
  ragione_sociale     VARCHAR NOT NULL
  indirizzo           VARCHAR
  cap                 VARCHAR
  comune              VARCHAR        -- derivato da cap_comuni
  provincia           VARCHAR        -- derivato da cap_comuni
  sigla_provincia     CHAR(2)        -- derivato da cap_comuni
  regione             VARCHAR        -- derivato da cap_comuni
  email               VARCHAR        -- popolato da BC/BC3
  telefono            VARCHAR        -- popolato da BC/BC3
  created_at          TIMESTAMP
  updated_at          TIMESTAMP

fornitori
  piva                VARCHAR PRIMARY KEY
  ragione_sociale     VARCHAR NOT NULL
  indirizzo           VARCHAR
  cap                 VARCHAR
  comune              VARCHAR
  provincia           VARCHAR
  sigla_provincia     CHAR(2)
  regione             VARCHAR
  email               VARCHAR
  telefono            VARCHAR
  created_at          TIMESTAMP
  updated_at          TIMESTAMP

documenti
  id                  UUID PRIMARY KEY
  numero_documento    VARCHAR NOT NULL
  tipo                VARCHAR NOT NULL  -- PC, OC, BC, BC3, FTA, OF, BF
  data_documento      DATE NOT NULL
  piva_cliente        VARCHAR REFERENCES clienti(piva)
  piva_fornitore      VARCHAR REFERENCES fornitori(piva)
  totale              DECIMAL(10,2)
  percorso_pdf_locale VARCHAR           -- path cartella locale
  percorso_pdf_gdrive VARCHAR           -- path Google Drive (se applicabile)
  parsed_at           TIMESTAMP

righe_documento
  id                  UUID PRIMARY KEY
  documento_id        UUID REFERENCES documenti(id)
  codice_articolo     VARCHAR REFERENCES articoli(codice_mexal)
  descrizione         VARCHAR
  quantita            DECIMAL(10,3)
  prezzo_unitario     DECIMAL(10,2)
  totale_riga         DECIMAL(10,2)
  note                VARCHAR           -- contiene matricola per espositori
  tipo_riga           VARCHAR           -- 'espositore' | 'ricambio' | 'servizio'
  espositore_id       UUID REFERENCES espositori(id)  -- nullable
  collegamento_ambiguo BOOLEAN DEFAULT false

articoli
  codice_mexal        VARCHAR PRIMARY KEY
  descrizione         VARCHAR NOT NULL
  categoria           VARCHAR           -- 'espositore' | 'ricambio' | 'servizio'
  is_espositore       BOOLEAN DEFAULT false
  prezzo_listino      DECIMAL(10,2)
  updated_at          TIMESTAMP

modelli_espositore
  codice              VARCHAR PRIMARY KEY
  nome                VARCHAR NOT NULL   -- es. Leo, Titano
  prezzo_listino      DECIMAL(10,2)
  descrizione         VARCHAR

espositori
  id                  UUID PRIMARY KEY
  matricola           VARCHAR UNIQUE NOT NULL
  codice_modello      VARCHAR REFERENCES modelli_espositore(codice)
  piva_cliente        VARCHAR REFERENCES clienti(piva)
  data_prima_vendita  DATE
  stato               VARCHAR DEFAULT 'attivo'  -- 'attivo' | 'reso' | 'dismesso'

codici_espositore_config
  codice_articolo     VARCHAR PRIMARY KEY REFERENCES articoli(codice_mexal)
  codice_modello      VARCHAR REFERENCES modelli_espositore(codice)
  created_at          TIMESTAMP

cap_comuni                             -- tabella lookup ISTAT, caricata una tantum
  cap                 VARCHAR PRIMARY KEY
  comune              VARCHAR NOT NULL
  provincia           VARCHAR NOT NULL
  sigla_provincia     CHAR(2) NOT NULL
  regione             VARCHAR NOT NULL

spedizioni                             -- popolata da App Spedizioni
  id                  UUID PRIMARY KEY
  documento_id        UUID REFERENCES documenti(id)
  corriere            VARCHAR
  tracking            VARCHAR
  data_spedizione     DATE
  stato               VARCHAR
  created_at          TIMESTAMP

procedure_ce                           -- popolata da App Genera Documenti
  id                  UUID PRIMARY KEY
  documento_id        UUID REFERENCES documenti(id)
  stato               VARCHAR
  data_completamento  DATE
  created_at          TIMESTAMP
Logica classificazione righe
Una riga è classificata espositore se:

codice_articolo è presente in codici_espositore_config (priorità, accurato), oppure
descrizione contiene la parola "espositore" (fallback per nuovi codici)
La matricola dell'espositore si trova nel campo note della riga.

Anagrafica clienti — nota importante
I campi email e telefono sono presenti solo nei documenti BC e BC3. Fino all'emissione della prima BC/BC3, l'anagrafica cliente resta priva di questi dati (email e telefono nullable).

Documenti Mexal e workflow daemon
Documenti verso CLIENTI
PC — Preventivo Cliente
Individua gli ultimi X documenti emessi in ordine temporale, prende l'ultimo
Salva PDF in cartella locale: VENDITE_ANNO\NOMECLIENTE_PIVA\ (crea se non esiste)
Salva record su DB CRM (documenti + righe)
Popup conferma salvataggi
Modale: stampa N copie?
Modale: invia email? → se sì: modale con testo editabile + campo email vuoto
OC — Ordine Cliente (raro, bassa priorità)
Stesso workflow di PC.

BC / BC3 — Bolla Cliente / Bolla Cliente 3
Individua ultimo documento emesso
Controllo/creazione cartella locale cliente
Salva PDF locale
Salva record su DB CRM (aggiorna anche email e telefono cliente)
Popup conferma salvataggi
Modale: stampa N copie?
Modale: invia email? → se sì: modale con testo editabile + campo email pre-compilato (dal documento)
Modale: creare spedizione? → se sì: lancia procedura App Spedizioni
App Spedizioni quando finalizza → scrive record su tabella spedizioni nel CRM
FTA — Fattura a Cliente
Individua ultimo documento emesso
Controllo/creazione cartella locale cliente
Salva PDF locale
Salva record su DB CRM
Popup conferma salvataggi
Modale: stampa N copie?
Modale: invia email? → se sì: modale con testo editabile + campo email pre-compilato
Modale: avviare Procedura CE? → se sì: lancia App Genera Documenti
App Genera Documenti quando finalizza → scrive record su tabella procedure_ce nel CRM
Documenti verso FORNITORI
OF — Ordine Fornitore
Individua ultimo documento emesso
Controllo/creazione cartella locale fornitore
Salva PDF locale
Salva record su DB CRM Fornitori
Popup conferma salvataggi
Modale: stampa N copie?
Modale: invia email? → se sì: modale con testo editabile + campo email vuoto/compilato
BF — Bolla di Reso Fornitore
Stesso workflow di OF.

Sorgenti dati verso CRM
Il CRM riceve dati da tre sorgenti:

Sorgente	Quando	Cosa scrive
Daemon	Ad ogni PDF Mexal	documenti, righe_documento, clienti/fornitori
App Spedizioni	Quando spedizione finalizzata	record in spedizioni
App Genera Documenti	Quando procedura CE finalizzata	record in procedure_ce
Query base — frontend dashboard
Per cliente
Scheda cliente — tutti i documenti in ordine cronologico
Storico espositori acquistati (modello, matricola, data, prezzo)
Storico postvendita per cliente (ricambi + servizi nel tempo)
Postvendita per espositore specifico (matricola → tutto lo storico di quella macchina)
Per prodotto/modello
Espositori venduti per modello in un periodo
Clienti che hanno installato un determinato modello
Temporali / aggregate
Vendite espositori per periodo (mese/trimestre/anno)
Fatturato postvendita per periodo
Clienti dormienti — nessuna attività da X mesi
Top clienti per fatturato in un periodo
Geografiche
Clienti per regione / provincia
Espositori installati per regione / provincia
Postvendita (ricambi + servizi) per regione / provincia
Fatturato totale per regione / provincia in un periodo
Repository GitHub
Repo	URL
Frontend + Supabase	https://github.com/fabioverbena/FdA-CUSTOMER-HISTORY.git
Daemon Python	https://github.com/fabioverbena/FdA-DAEMON.git
Task per CC — sessione di avvio progetto
Leggere il codice daemon esistente in C:\Users\fabio\Documents\FDA PROGETTI DIGITALI\fda-orchestrator
Analizzare cosa è riutilizzabile e cosa va aggiunto/adattato
Inizializzare il repo fda-customer-history su GitHub (URL da fornire)
Migrare il codice daemon nella cartella daemon/ del nuovo repo
Creare le migration SQL in supabase/migrations/
Produrre il CLAUDE.md definitivo del progetto unificato basato sul codice reale
Task separato (NAS): installare Docker + Metabase su Synology NAS
Note architetturali importanti
Il daemon è l'unico pezzo locale — tutto il resto è cloud
Un solo daemon gestisce tutti i tipi di documento (no daemon separati)
Il daemon identifica il tipo documento dal nome file o dal contenuto PDF
La lookup cap_comuni viene caricata una tantum da CSV ISTAT al setup
La tabella codici_espositore_config è aggiornabile senza toccare il codice
Supabase con movimento giornaliero garantito — no rischio sospensione free tier
Il frontend React usa PostgREST di Supabase direttamente per le query standard
Metabase (quando installato) si connette al PostgreSQL Supabase per query esplorative
Master Data Registry — Anagrafica centralizzata
Concetto
Le tabelle clienti e fornitori su Supabase sono il master registry — fonte di verità unica per tutte le app FdA. Nessuna app gestisce anagrafiche proprie: tutte leggono e scrivono sulle stesse tabelle.

App che consumano il master registry:

Daemon/orchestratore
App Spedizioni
App Genera Documenti
Frontend CRM dashboard
Logica lookup P.IVA (eseguita in background)
PDF rilevato → parser estrae P.IVA → lookup su Supabase clienti/fornitori

  P.IVA nota
    → usa dati esistenti
    → se email vuota e documento è BC/BC3 → UPDATE email/tel
    → procede silenzioso → Fase 2 modale azioni

  P.IVA nuova + documento BC / BC3 / FTA
    → estrae tutti i dati disponibili (inclusi email e telefono)
    → INSERT completo su Supabase
    → procede silenzioso → Fase 2 modale azioni

  P.IVA nuova + documento PC / OC / OF / BF
    → estrae quello che può (no email/tel — non presenti nel documento)
    → INTERROMPE il background
    → modale "Nuovo cliente/fornitore rilevato"
        → campi pre-compilati con dati estratti
        → operatore aggiunge email e telefono mancanti
        → conferma → INSERT su Supabase
    → prosegue → Fase 2 modale azioni
Vantaggi architetturali
Il parser diventa molto più leggero — per clienti noti estrae solo P.IVA per il lookup, non tutti i campi
Le app satellite (Spedizioni, Genera Documenti) smettono di fare parsing autonomo
Dati anagrafici sempre aggiornati e consistenti tra tutte le app
Il modale operativo arriva all'utente solo quando tutto è già in DB — nessuna attesa, nessuna domanda su dati già noti
Architettura daemon — due fasi distinte
Fase 1 — Background (invisibile all'utente)
Eseguita automaticamente ad ogni PDF rilevato, senza interrupt salvo caso edge:

File watcher rileva nuovo PDF in cartella temp Mexal
Parser identifica tipo documento (PC/OC/BC/BC3/FTA/OF/BF)
Estrae P.IVA destinatario
Lookup su Supabase → gestione master registry (vedi logica sopra)
Lookup CAP → cap_comuni → deriva comune/provincia/regione
Salva record su documenti e righe_documento
Classifica righe (espositore vs ricambio vs servizio) via codici_espositore_config + fallback keyword
Estrae matricola dalle note delle righe espositore → collega/crea record espositori
Salva PDF in cartella locale VENDITE_ANNO\NOMECLIENTE_PIVA\
Fase 2 — Foreground (modale azioni, dati già pronti)
L'utente vede il modale solo quando Fase 1 è completata. Il modale è focalizzato esclusivamente sulle azioni operative:

Documento	Azioni proposte
PC	Stampa N copie / Invia email (campo vuoto)
OC	Stampa N copie / Invia email (campo vuoto)
BC / BC3	Stampa N copie / Invia email (pre-compilata) / Crea spedizione → App Spedizioni
FTA	Stampa N copie / Invia email (pre-compilata) / Avvia Procedura CE → App Genera Documenti
OF	Stampa N copie / Invia email (vuoto/compilato)
BF	Stampa N copie / Invia email (vuoto/compilato)
Import iniziale DB — sorgenti esistenti
Il caricamento iniziale non è una raccolta dati da zero — esistono già sorgenti utilizzabili:

Tabella	Sorgente	Note
articoli	App EventManager	~287 prodotti con codici Mexal originali
codici_espositore_config	App EventManager	Già distinti espositori da accessori/ricambi
clienti	Google Sheets regionale	~1800 aziende, 20 regioni — import iniziale
clienti	Export Mexal	Anagrafica più aggiornata — verificare se Mexal permette export CSV/Excel
cap_comuni	CSV ISTAT	Mappatura CAP → Comune → Provincia → Regione — caricamento una tantum
modelli_espositore	Inserimento manuale	Max ~10 modelli (Leo, Titano, ecc.)
Note sull'import
cap_comuni viene caricata una tantum al setup e non viene più toccata salvo aggiornamenti ISTAT
articoli da EventManager va verificata per codici e categorie prima dell'import
L'import da Google Sheets produrrà anagrafiche parziali (no email/tel) — si completano progressivamente con i PDF Mexal
Mexal export ha priorità su Google Sheets se disponibile — dati più freschi
Task aggiuntivi per CC
Aggiungere ai task già elencati:

Analizzare App EventManager — estrarre lista prodotti per import iniziale articoli
Script import iniziale — per cap_comuni (CSV ISTAT), articoli (da EventManager), clienti (da Google Sheets o Mexal export)
Adattare App Spedizioni — sostituire gestione anagrafica locale con lookup Supabase master registry
Adattare App Genera Documenti — stesso adattamento App Spedizioni
Verificare export Mexal — capire se Mexal permette export CSV anagrafiche clienti/fornitori
