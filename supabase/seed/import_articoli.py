"""
Import tabella articoli da ARTICOLI_FDA.csv (export EventManager).

Formato CSV atteso (separatore ;):
  Codice;Descrizione;Listino

Classificazione automatica:
  - is_espositore = True  se il codice è in ESPOSITORE_CODES o la descrizione contiene
                          parole chiave (ESPOSITORE, LEONARDO, TITANO, ZEN)
  - categoria = 'espositore' | 'ricambio' | 'servizio' | 'altro'
    (la categoria può essere corretta manualmente in Supabase dopo l'import)

Uso:
  python import_articoli.py
  python import_articoli.py --csv /percorso/ARTICOLI_FDA.csv
  python import_articoli.py --dry-run
"""
import argparse
import csv
import json
import os
import re
import sys
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

DEFAULT_CSV = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "..", "daemon", "ARTICOLI_FDA.csv",
)

# Codici articolo confermati come espositori (da daemon _ESPOSITORE_CODES)
ESPOSITORE_CODES: set[str] = {
    "FDA-002", "FDA-003", "FDA-004", "FDA-014", "FDA-045",
}

_KW_ESPOSITORE = re.compile(
    r"\b(espositore|leonardo|titano|zen)\b", re.IGNORECASE
)
_KW_SERVIZIO = re.compile(
    r"\b(installazione|assistenza|trasporto|consegna|visione|garanzia|contratto)\b",
    re.IGNORECASE,
)


def _classify(codice: str, descrizione: str) -> tuple[bool, str]:
    cod_up = codice.upper().replace(" ", "-")
    is_esp = cod_up in ESPOSITORE_CODES or bool(_KW_ESPOSITORE.search(descrizione))
    if is_esp:
        return True, "espositore"
    if bool(_KW_SERVIZIO.search(descrizione)):
        return False, "servizio"
    return False, "ricambio"


def _post_batch(rows: list[dict]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/articoli"
    data = json.dumps(rows).encode()
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
    parser.add_argument("--csv", default=DEFAULT_CSV, help="Percorso a ARTICOLI_FDA.csv")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not os.path.isfile(args.csv):
        print(f"ERRORE: file non trovato: {args.csv}", file=sys.stderr)
        sys.exit(1)

    if not args.dry_run:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERRORE: SUPABASE_URL e SUPABASE_KEY devono essere nel .env", file=sys.stderr)
            sys.exit(1)

    rows: list[dict] = []
    skipped = 0

    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            with open(args.csv, encoding=enc, newline="") as f:
                reader = csv.reader(f, delimiter=";")
                header = [h.strip().lower() for h in next(reader)]
                for raw in reader:
                    if len(raw) < 2:
                        skipped += 1
                        continue
                    codice = raw[0].strip()
                    descrizione = raw[1].strip()
                    listino_raw = raw[2].strip() if len(raw) > 2 else "0"
                    if not codice or codice.lower() == "codice":
                        continue
                    try:
                        listino = float(listino_raw.replace(",", ".")) if listino_raw else None
                    except ValueError:
                        listino = None

                    is_esp, categoria = _classify(codice, descrizione)
                    rows.append({
                        "codice_mexal":   codice,
                        "descrizione":    descrizione,
                        "categoria":      categoria,
                        "is_espositore":  is_esp,
                        "prezzo_listino": listino,
                    })
            break
        except UnicodeDecodeError:
            rows.clear()
            continue

    print(f"Articoli letti: {len(rows)} (saltati: {skipped})")

    espositori = [r for r in rows if r["is_espositore"]]
    print(f"  → espositori classificati: {len(espositori)}")
    for e in espositori:
        print(f"     {e['codice_mexal']:12s}  {e['descrizione']}")

    if not args.dry_run:
        _post_batch(rows)
        print("Import completato su Supabase.")
    else:
        print("(dry-run: nessuna scrittura su Supabase)")


if __name__ == "__main__":
    main()
