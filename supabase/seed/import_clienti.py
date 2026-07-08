"""
Import clienti da export Mexal (CLIENTI_FDA_2026.csv) → Supabase tabella clienti.

Mapping colonne Mexal:
  Descrizione   → ragione_sociale
  E-mail        → email
  Partita IVA   → piva (PK; fallback: Codice fiscale)
  Localita'     → comune
  C.A.P.        → cap
  Prov          → sigla_provincia
  Telefono      → telefono
  Indirizzo     → indirizzo

Arricchimento:
  CAP → provincia (nome esteso) + regione via comuni-json GitHub
  (solo per clienti IT; SM/esteri lasciano provincia/regione NULL)

Uso:
  python import_clienti.py
  python import_clienti.py --csv /altro/percorso.csv
  python import_clienti.py --dry-run
"""
import argparse
import csv
import json
import os
import sys
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

DEFAULT_CSV = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "..", "CLIENTI_FDA_2026.csv",
)

COMUNI_JSON_URL = (
    "https://raw.githubusercontent.com/matteocontrini/"
    "comuni-json/master/comuni.json"
)


def _load_cap_lookup() -> dict:
    """Restituisce {cap: (provincia_nome, sigla, regione)} per comuni italiani."""
    print("Download comuni-json per lookup CAP...", end=" ", flush=True)
    with urllib.request.urlopen(COMUNI_JSON_URL, timeout=30) as r:
        comuni = json.loads(r.read().decode("utf-8"))
    lookup: dict[str, tuple] = {}
    for c in comuni:
        sigla    = c.get("sigla", "").strip().upper()
        prov_nom = c.get("provincia", {}).get("nome", "").strip()
        reg_nom  = c.get("regione", {}).get("nome", "").strip()
        for cap in c.get("cap", []):
            cap = str(cap).strip().zfill(5)
            if cap not in lookup:
                lookup[cap] = (prov_nom, sigla, reg_nom)
    print(f"{len(lookup)} CAP caricati.")
    return lookup


def _post_batch(rows: list[dict]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/clienti"
    data = json.dumps(rows, default=str).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "resolution=merge-duplicates",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default=DEFAULT_CSV)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch", type=int, default=200)
    args = parser.parse_args()

    if not os.path.isfile(args.csv):
        print(f"ERRORE: file non trovato: {args.csv}", file=sys.stderr)
        sys.exit(1)

    if not args.dry_run and (not SUPABASE_URL or not SUPABASE_KEY):
        print("ERRORE: SUPABASE_URL e SUPABASE_KEY mancanti.", file=sys.stderr)
        sys.exit(1)

    cap_lookup = _load_cap_lookup()

    rows: list[dict] = []
    skipped_no_key = 0
    skipped_bad = 0

    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            with open(args.csv, encoding=enc, newline="") as f:
                reader = csv.reader(f, delimiter=";")
                header = [h.strip() for h in next(reader)]

                col = {h: i for i, h in enumerate(header)}
                i_desc   = col.get("Descrizione", 0)
                i_email  = col.get("E-mail", 1)
                i_cf     = col.get("Codice fiscale", 3)
                i_piva   = col.get("Partita IVA", 4)
                i_loc    = col.get("Localita'", 5)
                i_cap    = col.get("C.A.P.", 6)
                i_prov   = col.get("Prov", 7)
                i_pa     = col.get("Pa", 9)
                i_tel    = col.get("Telefono", 10)
                i_ind    = col.get("Indirizzo", 11)

                seen_piva: set[str] = set()

                for raw in reader:
                    if len(raw) < 5:
                        skipped_bad += 1
                        continue

                    def g(i):
                        return raw[i].strip() if i < len(raw) else ""

                    piva = g(i_piva)
                    cf   = g(i_cf)
                    key  = piva or cf   # usa CF come fallback

                    if not key:
                        skipped_no_key += 1
                        continue

                    # deduplication locale (il CSV può avere duplicati)
                    if key in seen_piva:
                        continue
                    seen_piva.add(key)

                    ragione   = g(i_desc)
                    email     = g(i_email) or None
                    comune    = g(i_loc)
                    cap_val   = g(i_cap).zfill(5) if g(i_cap) else None
                    nazione   = g(i_pa).upper()
                    prov_raw  = g(i_prov).upper()
                    # sigla_provincia è CHAR(2): valido solo per province italiane (2 char)
                    sigla     = prov_raw if (nazione == "IT" and len(prov_raw) == 2) else None
                    tel       = g(i_tel) or None
                    indirizzo = g(i_ind) or None

                    # arricchimento provincia/regione solo per clienti IT
                    provincia = None
                    regione   = None
                    if nazione == "IT" and cap_val and cap_val in cap_lookup:
                        prov_nome, sigla_lookup, reg = cap_lookup[cap_val]
                        provincia = prov_nome or None
                        regione   = reg or None
                        if not sigla:
                            sigla = sigla_lookup

                    rows.append({
                        "piva":            key,
                        "ragione_sociale": ragione,
                        "indirizzo":       indirizzo,
                        "cap":             cap_val,
                        "comune":          comune or None,
                        "provincia":       provincia,
                        "sigla_provincia": sigla,
                        "regione":         regione,
                        "email":           email,
                        "telefono":        tel,
                    })

            break
        except UnicodeDecodeError:
            rows.clear()
            seen_piva = set()
            continue

    print(f"Clienti da importare:  {len(rows)}")
    print(f"Saltati (no chiave):   {skipped_no_key}")
    print(f"Saltati (riga corta):  {skipped_bad}")
    it_con_reg = sum(1 for r in rows if r.get("regione"))
    print(f"Con regione (IT):      {it_con_reg}")

    if args.dry_run:
        print("\ndry-run: prime 3 righe:")
        for r in rows[:3]:
            print(json.dumps(r, ensure_ascii=False))
        return

    total = 0
    for i in range(0, len(rows), args.batch):
        batch = rows[i: i + args.batch]
        _post_batch(batch)
        total += len(batch)
        print(f"  {total}/{len(rows)} importati...")

    print(f"\nCompletato: {total} clienti in Supabase.")


if __name__ == "__main__":
    main()
