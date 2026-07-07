"""
Import tabella cap_comuni da CSV ISTAT.

Dataset consigliato (gratuito, aggiornato):
  https://github.com/matteocontrini/comuni-json  →  cap.csv
  oppure qualsiasi CSV con colonne: cap;comune;provincia;sigla;regione

Il CSV deve avere intestazione. Separatore: ; oppure ,
Encoding: UTF-8 oppure latin-1 (rilevato automaticamente).

Uso:
  python import_cap_comuni.py --csv cap_comuni.csv
  python import_cap_comuni.py --csv cap_comuni.csv --dry-run
"""
import argparse
import csv
import json
import os
import sys
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# Nomi colonna accettati (case-insensitive) per ogni campo atteso
_COL_CAP      = {"cap", "cod_cap", "codice_avviamento_postale", "cap_cod"}
_COL_COMUNE   = {"comune", "denominazione_comune", "nome_comune", "denom_comune"}
_COL_PROV     = {"provincia", "nome_provincia", "denominazione_provincia"}
_COL_SIGLA    = {"sigla", "sigla_provincia", "prov", "provincia_sigla", "sigla_prov"}
_COL_REGIONE  = {"regione", "nome_regione", "denominazione_regione"}


def _detect_col(header: list[str], candidates: set[str]) -> int:
    for i, h in enumerate(header):
        if h.strip().lower() in candidates:
            return i
    return -1


def _post_batch(rows: list[dict]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/cap_comuni"
    data = json.dumps(rows).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "resolution=ignore-duplicates",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Percorso al file CSV")
    parser.add_argument("--batch", type=int, default=500, help="Righe per batch POST (default 500)")
    parser.add_argument("--dry-run", action="store_true", help="Non scrive su Supabase")
    args = parser.parse_args()

    if not args.dry_run:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERRORE: SUPABASE_URL e SUPABASE_KEY devono essere nel .env", file=sys.stderr)
            sys.exit(1)

    # Rileva encoding
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            with open(args.csv, encoding=enc, newline="") as f:
                f.read(1024)
            encoding = enc
            break
        except UnicodeDecodeError:
            continue
    else:
        encoding = "latin-1"

    print(f"Encoding rilevato: {encoding}")

    with open(args.csv, encoding=encoding, newline="") as f:
        # Rileva separatore
        sample = f.read(2048)
        f.seek(0)
        sep = ";" if sample.count(";") > sample.count(",") else ","
        print(f"Separatore: '{sep}'")

        reader = csv.reader(f, delimiter=sep)
        header_raw = next(reader)
        header = [h.strip().lower() for h in header_raw]

        idx_cap     = _detect_col(header, _COL_CAP)
        idx_comune  = _detect_col(header, _COL_COMUNE)
        idx_prov    = _detect_col(header, _COL_PROV)
        idx_sigla   = _detect_col(header, _COL_SIGLA)
        idx_regione = _detect_col(header, _COL_REGIONE)

        missing = [
            name for name, idx in [
                ("cap", idx_cap), ("comune", idx_comune),
                ("provincia", idx_prov), ("sigla", idx_sigla),
                ("regione", idx_regione),
            ] if idx < 0
        ]
        if missing:
            print(f"ERRORE: colonne non trovate: {missing}", file=sys.stderr)
            print(f"Intestazione CSV: {header}", file=sys.stderr)
            sys.exit(1)

        print(f"Colonne: cap={header[idx_cap]} comune={header[idx_comune]} "
              f"provincia={header[idx_prov]} sigla={header[idx_sigla]} regione={header[idx_regione]}")

        batch: list[dict] = []
        total = skipped = 0

        for row in reader:
            if len(row) <= max(idx_cap, idx_comune, idx_prov, idx_sigla, idx_regione):
                skipped += 1
                continue
            cap     = row[idx_cap].strip().zfill(5)
            comune  = row[idx_comune].strip()
            prov    = row[idx_prov].strip()
            sigla   = row[idx_sigla].strip().upper()[:2]
            regione = row[idx_regione].strip()

            if not cap or not comune or not sigla or not regione:
                skipped += 1
                continue

            batch.append({
                "cap":             cap,
                "comune":          comune,
                "provincia":       prov,
                "sigla_provincia": sigla,
                "regione":         regione,
            })
            total += 1

            if len(batch) >= args.batch:
                if not args.dry_run:
                    _post_batch(batch)
                print(f"  → {total} righe elaborate...")
                batch.clear()

        if batch:
            if not args.dry_run:
                _post_batch(batch)
            print(f"  → {total} righe elaborate (ultimo batch)")

    print(f"\nCompletato: {total} righe importate, {skipped} saltate.")
    if args.dry_run:
        print("(dry-run: nessuna scrittura su Supabase)")


if __name__ == "__main__":
    main()
