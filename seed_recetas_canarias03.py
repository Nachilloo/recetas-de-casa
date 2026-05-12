"""
Importar recetas desde libro-canaria03.pdf (misma colección / formato que volumen 2).

Partición: igual que seed_recetas_canarias02 — páginas que empiezan con testimonio “
o con el bloque editorial del mojo. Si este PDF maquetara distinto, ajusta es_inicio_bloque.

Flujo:
  1. pdfplumber → bloques de texto
  2. OpenAI → JSON (categoría + guia_casera)
  3. Spoonacular → Pexels → imagen
  4. Supabase upsert

Uso:
  python3 seed_recetas_canarias03.py

Coloca libro-canaria03.pdf en la raíz del proyecto. Reanudar: EMPEZAR_DESDE = n.
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

PDF_PATH = "libro-canaria03.pdf"

EMPEZAR_DESDE = 0
LOTE_INSERT = 50

PROMPT_SISTEMA = f"""Eres un chef experto en cocina casera de las Islas Canarias.

Recibirás el TEXTO BRUTO de una receta de un libro de recetas canarias (testimonios de mayores,
cocina casera km 0 o similar): recuerdo personal, datos de la persona/isla, ingredientes y pasos.

Tarea:
- Infiere un **title** claro del plato (corrige saltos de línea del PDF).
- REESCRIBE ingredientes y pasos con palabras propias. NO copies el testimonio literalmente.
- **Elige** la **categoria** del sitio más adecuada.

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
- Si no hay porciones claras, estima un número razonable (mínimo 2 si es guiso familiar).
"""


def limpiar_linea(line: str) -> str | None:
    s = line.strip()
    if not s:
        return None
    if re.match(r"^\d{1,3}$", s):
        return None
    return s


def es_inicio_bloque(lines: list[str]) -> bool:
    if not lines:
        return False
    s0 = lines[0].strip()
    if s0.startswith("\u201c") or s0.startswith('"'):
        return True
    if s0.startswith("El mojo es uno de los ingredientes"):
        return True
    return False


def dividir_recetas_canarias03(ruta_pdf: str) -> list[dict]:
    print(f"📖 Analizando {ruta_pdf}…")
    out: list[dict] = []
    cur: list[str] = []
    start_page = 1

    with pdfplumber.open(ruta_pdf) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            pno = page_idx + 1
            raw = page.extract_text() or ""
            lines = [limpiar_linea(ln) for ln in raw.splitlines()]
            lines = [x for x in lines if x is not None]
            if not lines:
                continue

            if es_inicio_bloque(lines) and cur:
                texto = "\n".join(cur).strip()
                if len(texto) >= 80:
                    out.append({"texto": texto, "pagina": start_page})
                cur = []

            if es_inicio_bloque(lines):
                start_page = pno
                cur.extend(lines)
            elif cur:
                cur.extend(lines)

    if cur:
        texto = "\n".join(cur).strip()
        if len(texto) >= 80:
            out.append({"texto": texto, "pagina": start_page})

    return out


def reescribir_receta(texto_bruto: str, client: openai.OpenAI) -> dict:
    user_msg = (
        "Extrae del siguiente bloque el plato y reescribe la receta en el JSON.\n\n"
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
        print(f"❌ No está {PDF_PATH} (colócalo en la raíz del proyecto)")
        return

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    oai = openai.OpenAI(api_key=OPENAI_API_KEY)
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("🔍 Slugs en Supabase…")
    cargar_slugs(sb)

    bloques = dividir_recetas_canarias03(PDF_PATH)
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
            slug = rec.get("slug") or f"canarias03-{num}"
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

    Path("recetas_canarias03_reescritas.json").write_text(
        json.dumps(ok, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    Path("errores_canarias03.json").write_text(
        json.dumps(err, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("=" * 60)
    print(f"✅ {len(ok)} recetas")
    print(f"❌ {len(err)} errores → errores_canarias03.json")
    print(f"📊 Imágenes: {stats}")
    print(f"⏱️  {(time.time() - t0) / 60:.1f} min")


if __name__ == "__main__":
    main()
