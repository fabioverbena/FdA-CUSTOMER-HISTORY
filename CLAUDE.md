# FDA Customer History — CLAUDE.md

Documento di riferimento per sessioni Claude Code. Leggi questo file prima di toccare qualsiasi cosa.

## Cos'è questo progetto

CRM verticale per **Fior d'Acqua (FdA)** — azienda che produce espositori refrigerati per fiori recisi (B2B, ~1800 clienti Italia).

Il sistema intercetta automaticamente i PDF emessi dal gestionale **Mexal** tramite un daemon desktop Python, arricchisce i dati e li salva su **Supabase/PostgreSQL**. Una dashboard React/TypeScript su Vercel permette di consultare lo storico clienti, espositori e postvendita.

## Due repository

| Repo | Contenuto | URL |
|---|---|---|
| `FdA-CUSTOMER-HISTORY` | Supabase migrations, frontend React, docs, questo CLAUDE.md | https://github.com/fabioverbena/FdA-CUSTOMER-HISTORY |
| `FdA-DAEMON` | Daemon Python Windows (mexal_daemon.py) | https://github.com/fabioverbena/FdA-DAEMON |

**Percorso locale daemon:** `C:\Users\Fabio\Desktop\FABIO APPLICAZIONI\AUTOMAZIONE_DOCUMENTI_MEXAL\`

## Stack tecnologico

```
PC Lav (Windows)
└── mexal_daemon.py          Python 3.12, tkinter/ttkbootstrap, PyPDF2
    ├── file watcher         polling ogni 1s su MEXAL_TEMP/stpvideo*/
    ├── parser PDF           estrae tipo, numero, data, destinatario, PIVA, matricola
    ├── GUI modal            ttkbootstrap (flatly theme)
    └── HTTP client          POST a Supabase PostgREST (stdlib urllib, no dipendenze extra)

Cloud
├── Supabase                 PostgreSQL + PostgREST + Auth
└── Vercel                   Frontend React/TypeScript (da costruire)

NAS Synology (da installare)
└── Docker → Metabase        query esplorative, connesso direttamente a Supabase PostgreSQL
```

## Struttura repository (FdA-CUSTOMER-HISTORY)

```
supabase/
├── migrations/
│   ├── 001_cap_comuni.sql       lookup CAP → comune/provincia/regione
│   ├── 002_anagrafica.sql       clienti + fornitori (master registry)
│   ├── 003_articoli.sql         articoli + modelli_espositore + codici_espositore_config
│   ├── 004_espositori.sql       espositori (matricola → cliente → modello)
│   ├── 005_documenti.sql        documenti + righe_documento
│   └── 006_satellite.sql        spedizioni + procedure_ce
└── seed/
    ├── import_cap_comuni.py     import CSV ISTAT → cap_comuni
    └── import_articoli.py       import ARTICOLI_FDA.csv → articoli
frontend/                        React/TypeScript dashboard (da costruire)
docs/
└── ...
CLAUDE.md                        questo file
```

## Schema database (sintesi)

Le tabelle sono definite nelle migration. Dipendenze:

```
cap_comuni          (nessuna)
articoli            (nessuna)
modelli_espositore  (nessuna)
clienti             (nessuna — arricchiti da cap_comuni in fase daemon)
fornitori           (nessuna)
espositori          → modelli_espositore, clienti
codici_espositore_config → articoli, modelli_espositore
documenti           → clienti, fornitori
righe_documento     → documenti, articoli, espositori
spedizioni          → documenti
procedure_ce        → documenti
```

**Nota chiave:** `clienti` e `fornitori` sono il **master registry** — fonte di verità unica per tutte le app. Nessuna app gestisce anagrafiche proprie.

## Daemon — architettura

Il daemon ha **due fasi**:

### Fase 1 — Background (invisibile)
Ad ogni PDF rilevato in `MEXAL_TEMP/stpvideo*/`:
1. Stabilità file (size identica per 2 tick → file chiuso da Mexal)
2. Parse PDF → `ParsedDoc` (tipo, numero, data, destinatario, PIVA, CAP, tel, email, matricola, modello)
3. Upsert `clienti`/`fornitori` su Supabase
4. Insert `documenti` su Supabase
5. Salvataggio PDF locale in `DIRETTE_{anno}/{cliente}/{tipo}/`
6. Upload GDrive Inbox_PD (solo DDT espositori, se configurato)
7. Notifica Telegram con bottoni inline

### Fase 2 — Foreground (modal azioni)
Modale ttkbootstrap dopo salvataggio:

| Tipo doc | Azioni disponibili |
|---|---|
| DDT (= BC) | Stampa N copie / Email / Nuova Spedizione → App Spedizioni |
| DDT espositore | Stampa / Email / Avvia Procedura CE (se consegna diretta) |
| FC (= FTA) | Stampa / Email / Avvia Procedura CE → App Genera Documenti |
| PC | Stampa / Email |
| OC | Stampa / Email |
| OF | Stampa / Email |

### Mapping tipi documento

| Codice daemon | Tipo CRM (Supabase) | Descrizione |
|---|---|---|
| DDT | BC | Bolla Cliente / DDT |
| FC  | FTA | Fattura a Cliente |
| PC  | PC | Preventivo Cliente |
| OC  | OC | Ordine Cliente |
| OF  | OF | Ordine Fornitore |
| — | BF | Bolla Reso Fornitore (da implementare) |

### File chiave daemon

| File | Scopo |
|---|---|
| `mexal_daemon.py` | Tutto il daemon (2800 righe) |
| `mexal_watchdog.pyw` | Processo separato — rilancia daemon ogni 5min se morto |
| `ARTICOLI_FDA.csv` | Catalogo prodotti (~287 articoli, export EventManager) |
| `ARTICOLI_FDA.xml` | Stesso catalogo in formato XML |
| `.env` | Credenziali (NON committato) |
| `local.env` | Override locale (NON committato) |
| `documenti_state.json` | Stato runtime (saved/printed/emailed per doc_id) |
| `watcher_seen.json` | PDF già processati (mtime per path) |

### Variabili ambiente daemon

```
SUPABASE_URL            URL progetto Supabase
SUPABASE_KEY            service_role key Supabase
MEXAL_TEMP              override cartella temp Mexal (autodetect se non impostato)
BOLLE_DIR / FATTURE_DIR / ...   cartelle archiviazione locale (default: Desktop/{anno}/...)
SPEDIZIONI_API_URL      URL App Spedizioni Docker (default: http://localhost:8000)
GENERA_DOCUMENTI_BAT    percorso .bat App Genera Documenti
SMTP_HOST/PORT/USER/PASS/FROM   config email
TELEGRAM_BOT_TOKEN      notifiche Telegram
TELEGRAM_NOTIFY_CHAT_ID
GDRIVE_INBOX_PD_FOLDER_ID
GOOGLE_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN
```

## App satellite

### App Spedizioni
- Gira in Docker locale su `localhost:8000`
- Daemon la chiama su `POST /api/destinatari/upsert` (anagrafica) e `POST /api/spedizioni/da-ddt?draft=true` (crea bozza)
- Ha retry automatico se il container non è disponibile al momento del DDT

### App Genera Documenti (Procedura CE)
- Lanciata via `.bat` con `prefill.json` pre-compilato dal daemon
- Il prefill contiene: nomeAzienda, indirizzo, cap, citta, piva, email, matricola, modello

## Sorgenti dati — import iniziale

| Tabella | Sorgente | Script |
|---|---|---|
| `cap_comuni` | CSV ISTAT/open data | `seed/import_cap_comuni.py --csv file.csv` |
| `articoli` | `ARTICOLI_FDA.csv` | `seed/import_articoli.py` |
| `modelli_espositore` | Inserimento manuale | max ~10 righe (Leo, Titano, Zen, …) |
| `codici_espositore_config` | Inserimento manuale | mappa codice Mexal → modello |
| `clienti` | Export Mexal o Google Sheets | da fare |

## Cosa è implementato vs da fare

### Implementato (daemon)
- [x] File watcher + parser PDF completo
- [x] Upsert clienti/fornitori su Supabase
- [x] Insert documenti su Supabase
- [x] Salvataggio PDF locale (struttura DIRETTE_{anno}/{cliente}/{tipo}/)
- [x] Modal azioni (stampa, email, spedizione, procedura CE)
- [x] Integrazione App Spedizioni (upsert destinatario + crea bozza)
- [x] Integrazione App Genera Documenti (prefill.json)
- [x] Upload GDrive Inbox_PD (DDT espositori)
- [x] Notifiche Telegram con bottoni inline
- [x] Watchdog processo + Task Scheduler auto-install
- [x] Gestione GRENKE (DDT con cliente finale diverso dal fatturatario)
- [x] Single-instance mutex

### Da implementare
- [ ] Parsing `righe_documento` (righe PDF → tabella righe_documento)
- [ ] Upsert `espositori` (matricola estratta ma non scritta in DB)
- [ ] Lookup `cap_comuni` → `regione` (arricchimento nel daemon)
- [ ] `BF` (Bolla Reso Fornitore) tipo documento
- [ ] Modal "Nuovo cliente" per PIVA sconosciuta su PC/OC (senza email/tel)
- [ ] `percorso_pdf_gdrive` → scritto in `documenti` dopo upload
- [ ] Frontend React/TypeScript dashboard
- [ ] Installazione Docker + Metabase su NAS Synology

## Come applicare le migration

1. Aprire Supabase Dashboard → SQL Editor
2. Eseguire i file nell'ordine: 001 → 002 → 003 → 004 → 005 → 006
3. Poi eseguire i seed:
   ```bash
   cd supabase/seed
   # Imposta le variabili
   export SUPABASE_URL=https://xxx.supabase.co
   export SUPABASE_KEY=service_role_key
   # Import articoli (ARTICOLI_FDA.csv deve essere in daemon/)
   python import_articoli.py
   # Import CAP comuni (scarica il CSV prima)
   python import_cap_comuni.py --csv /percorso/cap_comuni.csv
   ```

## Note architetturali importanti

- Il daemon è l'**unico pezzo locale** — tutto il resto è cloud
- Un solo daemon gestisce **tutti** i tipi di documento (no daemon separati)
- La tabella `codici_espositore_config` è aggiornabile **senza toccare il codice**
- `cap_comuni` viene caricata una tantum e non viene più modificata (salvo update ISTAT)
- Supabase con movimento giornaliero garantito → no rischio sospensione free tier
- Il frontend usa **PostgREST di Supabase direttamente** per le query standard
- `documenti` ha un UNIQUE constraint su `(numero_documento, tipo, data_documento)` per evitare duplicati da doppi tick del daemon
