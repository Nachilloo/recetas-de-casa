"""
Importar recetas desde libro-canaria04.pdf
(«Cuaderno Recetas para no olvidar», cuarta edición — estructura tipo ficha:
 título, N personas X min, Ingredientes, Preparación).

No usa el particionado de testimonios “…” del vol. 2/3: detecta cada receta
cuando una línea va seguida de «N personas … min» (opc. «Vegetariano»).

Flujo:
  1. pdfplumber → bloques
  2. OpenAI → JSON (categoría + guia_casera)
  3. Spoonacular → Pexels
  4. Supabase upsert

Uso:
  python3 seed_recetas_canarias04.py

Reanudar: EMPEZAR_DESDE = n (0-based).
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

import openai
import pdfplumber
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

from seed_recetas_canarias import (
    CATEGORIAS,
    IMAGES_DIR,
    cargar_slugs,
    insertar_lote,
    obtener_imagen_remota,
    preparar_fila_supabase,
)

SUPABASE_URL = os.getenv("PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")
SPOONACULAR_KEY = os.getenv("SPOONACULAR_API_KEY")

PDF_PATH = "libro-canaria04.pdf"

EMPEZAR_DESDE = 0
LOTE_INSERT = 50

META_RECETA = re.compile(
    r"^\d+\s+personas\s+\d+\s+min(?:\s+vegetariano)?\s*$",
    re.I,
)

PROMPT_SISTEMA = f"""Eres un chef experto en cocina casera de las Islas Canarias y España.

Recibirás el texto de una ficha de receta (título, raciones, tiempo, lista de ingredientes
y pasos numerados). REESCRIBE con palabras propias; no copies frases literales del PDF.
Elige la **categoria** del sitio más adecuada.

Devuelve SOLO un JSON válido (sin markdown) con esta estructura:
{{
  "title": "Nombre limpio del plato en castellano",
  "slug": "nombre-sin-acentos-minusculas-guiones",
  "categoria": "una de las categorías válidas listadas abajo",
  "dificultad": "facil | media | dificil",
  "tiempo": "ej: '40 min', '1 hora 30 min'",
  "porciones": número_entero,
  "descripcion": "2-3 frases propias",
  "ingredientes": ["cantidad + ingrediente", "..."],
  "pasos": ["pasos claros", "..."],
  "tips": ["consejos útiles o []"],
  "guia_casera": "Entre 150 y 200 palabras. Tres partes en líneas propias así:\\nContexto:\\n...\\n\\nCuándo hacerla:\\n...\\n\\nBeneficios:\\n...\\n Sin promesas médicas.",
  "tags": ["3-6 tags en minúsculas sin acentos"],
  "calorias": null,
  "historia": null,
  "destacada": false
}}

Categorías válidas: {", ".join(CATEGORIAS)}

REGLAS:
- El slug solo usa letras minúsculas, números y guiones.
- Ajusta porciones y tiempo según la ficha si son claras.
"""


def limpiar_linea(line: str) -> str | None:
    s = line.strip()
    if not s:
        return None
    if "CUADERNO RECETAS" in s.upper() and "OLVIDAR" in s.upper():
        return None
    if re.match(r"^\d{1,3}$", s):
        return None
    return s


def linea_parece_titulo_plato(s: str) -> bool:
    if len(s) < 2 or len(s) > 90:
        return False
    sl = s.lower()
    if sl.startswith("ingredientes"):
        return False
    if sl.startswith("preparación") or sl.startswith("preparacion"):
        return False
    if re.match(r"^\d+\.", s):
        return False
    if s.isupper() and len(s) > 35:
        return False
    if sl.startswith("índice") or sl.startswith("introducción") or sl.startswith("introduccion"):
        return False
    if "entidad certificada" in sl:
        return False
    return True


def dividir_recetas_canarias04(ruta_pdf: str) -> list[dict]:
    print(f"📖 Analizando {ruta_pdf}…")
    out: list[dict] = []
    cur: list[str] = []
    start_page = 1

    with pdfplumber.open(ruta_pdf) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            pno = page_idx + 1
            lines: list[str] = []
            for ln in (page.extract_text() or "").splitlines():
                c = limpiar_linea(ln)
                if c is not None:
                    lines.append(c)

            i = 0
            while i < len(lines):
                ln = lines[i]
                nxt = lines[i + 1] if i + 1 < len(lines) else ""
                if (
                    i + 1 < len(lines)
                    and linea_parece_titulo_plato(ln)
                    and META_RECETA.match(nxt.strip())
                ):
                    if cur and len("\n".join(cur).strip()) >= 80:
                        out.append(
                            {"texto": "\n".join(cur).strip(), "pagina": start_page}
                        )
                    cur = [ln]
                    start_page = pno
                    i += 1
                    continue
                if cur:
                    cur.append(ln)
                i += 1

    if cur and len("\n".join(cur).strip()) >= 80:
        out.append({"texto": "\n".join(cur).strip(), "pagina": start_page})

    return out


def reescribir_receta(texto_bruto: str, client: openai.OpenAI) -> dict:
    user_msg = (
        "Reescribe la siguiente ficha de receta en el JSON solicitado.\n\n"
        f"{texto_bruto}"
    )
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": PROMPT_SISTEMA},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.4,
        response_format={"type": "json_object"},
    )
    raw = r.choices[0].message.content
    data = json.loads(raw or "{}")
    cat = data.get("categoria")
    if cat not in CATEGORIAS:
        data["categoria"] = "sopas-cremas"
    return data


def normalizar_tags(tags: list | None) -> list[str]:
    extra = ["canarias", "cocina-canaria", "recetas-mayores"]
    base = [str(t).lower().strip() for t in (tags or []) if t]
    merged: list[str] = []
    seen: set[str] = set()
    for t in base + extra:
        t = re.sub(r"[^a-z0-9\-]", "", t.replace(" ", "-"))
        if t and t not in seen:
            seen.add(t)
            merged.append(t)
    return merged[:12]


def main():
    missing = [
        n
        for n, v in [
            ("PUBLIC_SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY),
            ("OPENAI_API_KEY", OPENAI_API_KEY),
            ("PEXELS_API_KEY", PEXELS_API_KEY),
            ("SPOONACULAR_API_KEY", SPOONACULAR_KEY),
        ]
        if not v
    ]
    if missing:
        print("❌ Faltan en .env:", ", ".join(missing))
        return

    if not Path(PDF_PATH).exists():
        print(f"❌ No está {PDF_PATH}")
        return

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    oai = openai.OpenAI(api_key=OPENAI_API_KEY)
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("🔍 Slugs en Supabase…")
    cargar_slugs(sb)

    bloques = dividir_recetas_canarias04(PDF_PATH)
    print(f"   → {len(bloques)} recetas detectadas\n")

    bloques = bloques[EMPEZAR_DESDE:]
    total = len(bloques)
    print(f"   → Procesando {total} (desde #{EMPEZAR_DESDE + 1})")
    print("─" * 60)

    ok: list[dict] = []
    err: list[dict] = []
    t0 = time.time()
    stats: dict[str, int] = {}

    for i, b in enumerate(bloques):
        num = i + EMPEZAR_DESDE + 1
        try:
            rec = reescribir_receta(b["texto"], oai)
            titulo = rec.get("title") or f"Receta canaria {num}"
            slug = rec.get("slug") or f"canarias04-{num}"
            rec["tags"] = normalizar_tags(rec.get("tags"))

            img_rel, fuente = obtener_imagen_remota(titulo, slug, oai)
            rec["imagen"] = img_rel or ""
            rec["imagen_alt"] = f"{titulo} — receta canaria"
            stats[fuente] = stats.get(fuente, 0) + 1

            fila = preparar_fila_supabase(rec)
            ok.append(fila)

            rest = (time.time() - t0) / (i + 1) * (total - i - 1)
            h, m = int(rest // 3600), int((rest % 3600) // 60)
            sym = "📷" if fuente in ("spoonacular", "pexels") else "⏭️"
            print(f"  [{num:03d}/{EMPEZAR_DESDE + total}] ✅ {titulo[:45]:<45} {sym} {fuente:<14} ⏱ ~{h}h{m}m")

            if len(ok) % LOTE_INSERT == 0:
                n = insertar_lote(ok[-LOTE_INSERT:], sb)
                print(f"\n  🗄️  {n} recetas guardadas\n")

            if (i + 1) % 15 == 0:
                time.sleep(1)

        except Exception as e:
            err.append({"num": num, "error": str(e)})
            print(f"  [{num:03d}/{EMPEZAR_DESDE + total}] ❌ {e}")

    resto = len(ok) % LOTE_INSERT
    if resto:
        n = insertar_lote(ok[-resto:], sb)
        print(f"\n  🗄️  Último lote: {n}\n")

    Path("recetas_canarias04_reescritas.json").write_text(
        json.dumps(ok, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    Path("errores_canarias04.json").write_text(
        json.dumps(err, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("=" * 60)
    print(f"✅ {len(ok)} recetas")
    print(f"❌ {len(err)} errores → errores_canarias04.json")
    print(f"📊 Imágenes: {stats}")
    print(f"⏱️  {(time.time() - t0) / 60:.1f} min")


if __name__ == "__main__":
    main()
