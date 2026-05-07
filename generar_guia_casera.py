#!/usr/bin/env python3
"""
Rellena el campo guia_casera en todas las recetas de Supabase usando OpenAI.

Usa el mismo tono de sistema que seed_recetas.py:
  «Eres un chef español experto en cocina tradicional casera»

Requisitos .env:
  PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY

Uso:
  python3 generar_guia_casera.py              # solo filas con guia_casera vacía
  python3 generar_guia_casera.py --force      # regenerar todas
  python3 generar_guia_casera.py --limit 10 # prueba con 10 recetas
  python3 generar_guia_casera.py --dry-run    # no escribe en Supabase
"""

from __future__ import annotations

import argparse
import json
import os
import time

import openai
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

PROMPT_SISTEMA = """Eres un chef español experto en cocina tradicional casera.

Te damos los datos de una receta ya publicada (título, descripción, ingredientes, pasos y tips del chef).
Tu tareas:
1) Redactar un texto ÚNICO y original en castellano (no copies literalmente los pasos ni la descripción).
2) Entre 150 y 200 palabras en total.
3) Organizar en tres partes claras. Cada parte debe empezar exactamente con una de estas líneas en su propia línea:
   Contexto:
   Cuándo hacerla:
   Beneficios:
4) Contenido:
   - Contexto: qué tipo de plato es, encaje en la mesa casera española, por qué merece la pena.
   - Cuándo hacerla: estación u ocasión (familia, invitados, día entre semana…), momento del día si encaja.
   - Beneficios: aspectos prácticos (económico, saciante, reconfortante, aprovechar ingredientes, sencillez…).
     NO inventes propiedades curativas ni promesas médicas; sé prudente y realista.

Devuelve SOLO un JSON válido (sin markdown): {"guia_casera": "..."}
La clave guia_casera debe ser un único string con saltos de línea reales entre párrafos."""


def contar_palabras(s: str) -> int:
    return len(s.split())


def generar_guia(receta: dict, client: openai.OpenAI) -> str:
    tips = receta.get("tips") or []
    tips_txt = "\n".join(f"- {t}" for t in tips) if tips else "(ninguno)"

    user = (
        f"Título: {receta.get('title', '')}\n\n"
        f"Descripción:\n{receta.get('descripcion') or ''}\n\n"
        f"Ingredientes:\n"
        + "\n".join(f"- {i}" for i in (receta.get("ingredientes") or []))
        + f"\n\nPasos:\n"
        + "\n".join(f"{n}. {p}" for n, p in enumerate(receta.get("pasos") or [], start=1))
        + f"\n\nTips del chef:\n{tips_txt}"
    )

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": PROMPT_SISTEMA},
            {"role": "user", "content": user},
        ],
        temperature=0.45,
        response_format={"type": "json_object"},
    )
    raw = r.choices[0].message.content
    if not raw:
        raise ValueError("Respuesta vacía de OpenAI")
    data = json.loads(raw)
    guia = data.get("guia_casera", "").strip()
    if not guia:
        raise ValueError("JSON sin guia_casera")
    return guia


def fetch_recetas(sb, force: bool, limit: int | None):
    page_size = 500
    start = 0
    all_rows: list[dict] = []

    while True:
        q = (
            sb.table("recetas")
            .select("id,title,descripcion,ingredientes,pasos,tips,guia_casera")
            .order("id")
            .range(start, start + page_size - 1)
        )
        res = q.execute()
        chunk = res.data or []
        if not chunk:
            break
        all_rows.extend(chunk)
        if len(chunk) < page_size:
            break
        start += page_size

    if not force:
        all_rows = [r for r in all_rows if not (r.get("guia_casera") or "").strip()]

    if limit is not None:
        all_rows = all_rows[:limit]

    return all_rows


def main():
    ap = argparse.ArgumentParser(description="Generar guia_casera para recetas en Supabase")
    ap.add_argument("--force", action="store_true", help="Incluir recetas que ya tienen guia_casera")
    ap.add_argument("--limit", type=int, default=None, help="Máximo de recetas a procesar")
    ap.add_argument("--dry-run", action="store_true", help="No actualizar Supabase")
    ap.add_argument("--sleep", type=float, default=0.35, help="Pausa entre llamadas OpenAI (s)")
    args = ap.parse_args()

    missing = [
        n
        for n, v in [
            ("PUBLIC_SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY),
            ("OPENAI_API_KEY", OPENAI_API_KEY),
        ]
        if not v
    ]
    if missing:
        print("❌ Faltan variables en .env:", ", ".join(missing))
        return 1

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    oai = openai.OpenAI(api_key=OPENAI_API_KEY)

    recetas = fetch_recetas(sb, args.force, args.limit)
    total = len(recetas)
    print(f"📋 Recetas a procesar: {total}\n")

    ok = 0
    err = 0

    for i, receta in enumerate(recetas, 1):
        rid = receta["id"]
        title = receta.get("title", "")[:60]

        try:
            guia = generar_guia(receta, oai)
            nw = contar_palabras(guia)
            if nw < 120 or nw > 240:
                print(f"  ⚠️  [{i}/{total}] Palabras={nw} (objetivo 150-200): {title}")

            if args.dry_run:
                print(f"  ✅ [{i}/{total}] (dry-run) {title}")
                ok += 1
            else:
                sb.table("recetas").update({"guia_casera": guia}).eq("id", rid).execute()
                print(f"  ✅ [{i}/{total}] {title}")
                ok += 1

        except Exception as e:
            err += 1
            print(f"  ❌ [{i}/{total}] {title} — {e}")

        time.sleep(args.sleep)

    print(f"\nHecho: {ok} bien, {err} errores")
    return 0 if err == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
