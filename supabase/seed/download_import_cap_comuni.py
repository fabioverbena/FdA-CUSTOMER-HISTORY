"""
Scarica i comuni italiani da matteocontrini/comuni-json (GitHub)
e importa tutto nella tabella cap_comuni di Supabase.

Uso:
  python download_import_cap_comuni.py
  python download_import_cap_comuni.py --dry-run
"""
import argparse
import json
import os
import sys
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

SOURCE_URL = (
    "https://raw.githubusercontent.com/matteocontrini/"
    "comuni-json/master/comuni.json"
)


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
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch", type=int, default=500)
    args = parser.parse_args()

    if not args.dry_run and (not SUPABASE_URL or not SUPABASE_KEY):
        print("ERRORE: SUPABASE_URL e SUPABASE_KEY mancanti.", file=sys.stderr)
        sys.exit(1)

    print(f"Download da GitHub...")
    with urllib.request.urlopen(SOURCE_URL, timeout=30) as resp:
        comuni = json.loads(resp.read().decode("utf-8"))
    print(f"Scaricati {len(comuni)} comuni.")

    rows: list[dict] = []
    skipped = 0

    for c in comuni:
        nome    = c.get("nome", "").strip()
        caps    = c.get("cap", [])
        prov    = c.get("provincia", {})
        reg     = c.get("regione", {})

        sigla    = c.get("sigla", "").strip().upper()   # top-level nel JSON
        prov_nom = prov.get("nome", "").strip()
        reg_nom  = reg.get("nome", "").strip()

        if not nome or not sigla or not reg_nom:
            skipped += 1
            continue

        for cap in caps:
            cap = str(cap).strip().zfill(5)
            if not cap or len(cap) != 5:
                continue
            rows.append({
                "cap":             cap,
                "comune":          nome,
                "provincia":       prov_nom,
                "sigla_provincia": sigla,
                "regione":         reg_nom,
            })

    print(f"Righe da importare: {len(rows)} (comuni saltati: {skipped})")

    if args.dry_run:
        print("dry-run: nessuna scrittura su Supabase.")
        return

    total = 0
    for i in range(0, len(rows), args.batch):
        batch = rows[i : i + args.batch]
        _post_batch(batch)
        total += len(batch)
        print(f"  {total}/{len(rows)} righe importate...")

    print(f"\nCompletato: {total} righe in cap_comuni.")


if __name__ == "__main__":
    main()
