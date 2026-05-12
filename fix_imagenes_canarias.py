#!/usr/bin/env python3
"""
Solo actualiza imágenes locales y campos imagen / imagen_alt en Supabase
para recetas marcadas con los tags del seed canario (canarias, cocina-canaria).

No vuelve a llamar a OpenAI para reescribir la receta: solo traducción del título
para la búsqueda de foto (Spoonacular → Pexels), igual que seed_recetas_canarias.py.

Uso:
  source venv/bin/activate
  python3 fix_imagenes_canarias.py
  python3 fix_imagenes_canarias.py --dry-run
  python3 fix_imagenes_canarias.py --slug papas-arrugadas
  python3 fix_imagenes_canarias.py --slugs-file canarias_slugs_seed79.txt

Requisitos .env: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY,
PEXELS_API_KEY, SPOONACULAR_API_KEY
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import openai
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# Reutiliza búsqueda y rutas del seed canario
from seed_recetas_canarias import IMAGES_DIR, obtener_imagen_remota

SUPABASE_URL = os.getenv("PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")
SPOONACULAR_KEY = os.getenv("SPOONACULAR_API_KEY")


def quitar_imagenes_locales(slug: str) -> None:
    """Borra archivos previos para forzar descarga (p. ej. JPG en blanco)."""
    for ext in ("jpg", "jpeg", "png", "webp"):
        p = IMAGES_DIR / f"{slug}.{ext}"
        if p.exists():
            p.unlink()


def leer_slugs_file(path: Path) -> list[str]:
    out: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            out.append(line)
    return out


def traer_por_slugs(sb, slugs: list[str]) -> list[dict]:
    found: dict[str, dict] = {}
    batch = 100
    for i in range(0, len(slugs), batch):
        chunk = slugs[i : i + batch]
        res = (
            sb.table("recetas")
            .select("slug,title,tags,imagen")
            .in_("slug", chunk)
            .execute()
        )
        for row in res.data or []:
            found[row["slug"]] = row
    ordenados: list[dict] = []
    for s in slugs:
        if s in found:
            ordenados.append(found[s])
        else:
            print(f"⚠️  Slug no encontrado en Supabase (revísalo en el .txt): {s}")
    return ordenados


def traer_recetas_canarias(sb, solo_slug: str | None) -> list[dict]:
    if solo_slug:
        r = (
            sb.table("recetas")
            .select("slug,title,tags,imagen")
            .eq("slug", solo_slug)
            .limit(1)
            .execute()
        )
        rows = r.data or []
        if not rows:
            print(f"❌ No hay receta con slug {solo_slug!r}")
            return []
        return rows

    por_slug: dict[str, dict] = {}
    for tag in ("canarias", "cocina-canaria"):
        start = 0
        while True:
            res = (
                sb.table("recetas")
                .select("slug,title,tags,imagen")
                .contains("tags", [tag])
                .range(start, start + 999)
                .execute()
            )
            chunk = res.data or []
            for row in chunk:
                por_slug[row["slug"]] = row
            if len(chunk) < 1000:
                break
            start += 1000

    return list(por_slug.values())


def main() -> None:
    ap = argparse.ArgumentParser(description="Actualizar solo imágenes de recetas canarias")
    ap.add_argument("--dry-run", action="store_true", help="No descarga ni actualiza Supabase")
    ap.add_argument("--slug", type=str, default=None, help="Solo un slug concreto")
    ap.add_argument(
        "--slugs-file",
        type=str,
        default=None,
        help="Un slug por línea (orden respetado); líneas # comentario",
    )
    args = ap.parse_args()

    if args.slug and args.slugs_file:
        print("❌ Usa solo uno: --slug o --slugs-file")
        sys.exit(1)

    if args.dry_run:
        required = [
            ("PUBLIC_SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY),
        ]
    else:
        required = [
            ("PUBLIC_SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY),
            ("OPENAI_API_KEY", OPENAI_API_KEY),
            ("PEXELS_API_KEY", PEXELS_API_KEY),
            ("SPOONACULAR_API_KEY", SPOONACULAR_KEY),
        ]
    missing = [n for n, v in required if not v]
    if missing:
        print("❌ Faltan en .env:", ", ".join(missing))
        sys.exit(1)

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    oai = openai.OpenAI(api_key=OPENAI_API_KEY)
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    if args.slug:
        rows = traer_recetas_canarias(sb, args.slug)
    elif args.slugs_file:
        path = Path(args.slugs_file)
        if not path.is_file():
            print(f"❌ No existe {path.resolve()}")
            sys.exit(1)
        slugs = leer_slugs_file(path)
        rows = traer_por_slugs(sb, slugs)
    else:
        rows = traer_recetas_canarias(sb, None)
        rows.sort(key=lambda r: r["slug"])

    if not rows:
        return

    print(f"→ {len(rows)} recetas a procesar\n")

    ok, fail = 0, 0
    t0 = time.time()

    for i, row in enumerate(rows):
        slug = row["slug"]
        title = row["title"] or slug
        titulo_corto = title[:52] + ("…" if len(title) > 52 else "")
        print(f"  [{i+1}/{len(rows)}] {titulo_corto}  ({slug}) … ", end="", flush=True)

        if args.dry_run:
            print("(dry-run)")
            ok += 1
            continue

        quitar_imagenes_locales(slug)
        img_rel, fuente = obtener_imagen_remota(title, slug, oai)
        if not img_rel:
            print(f"❌ sin imagen ({fuente})")
            fail += 1
            continue

        alt = f"{title} — receta canaria"
        try:
            sb.table("recetas").update({"imagen": img_rel, "imagen_alt": alt}).eq("slug", slug).execute()
        except Exception as e:
            print(f"❌ Supabase: {e}")
            fail += 1
            continue

        print(f"✅ {fuente}")
        ok += 1
        if (i + 1) % 12 == 0:
            time.sleep(0.5)

    print()
    print("─" * 50)
    print(f"✅ {ok}  ❌ {fail}  ⏱ {(time.time()-t0)/60:.1f} min")
    if args.dry_run:
        print("(dry-run: no se aplicaron cambios)")


if __name__ == "__main__":
    main()
