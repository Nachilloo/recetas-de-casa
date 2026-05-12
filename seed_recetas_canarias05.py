"""
Importar recetas desde libro-canaria05.pdf (recetario CEIP Martín Chirino).

El PDF es irregular: títulos en mayúsculas, «ingredientes» / «Ingredientes:»,
notas con nombres, varias recetas sin lista clara en el extracto. Partición:
ancla en la primera línea de cada bloque «ingredientes» (sin mezclar con
«INGREDIENTES PREPARACIÓN»), título = líneas de título contiguas justo encima
(hasta elaboración o texto que no parece título).

Flujo:
  1. pdfplumber → bloques
  2. OpenAI → JSON (categoría + guia_casera)
  3. Spoonacular → Pexels
  4. Supabase upsert

Uso:
  python3 seed_recetas_canarias05.py

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

PDF_PATH = "libro-canaria05.pdf"

EMPEZAR_DESDE = 0
LOTE_INSERT = 50

ELAB_HEADER = re.compile(r"^(elaboración|como se hace)\b", re.I)

PROMPT_SISTEMA = f"""Eres un chef experto en cocina casera de las Islas Canarias.

Recibirás TEXTO BRUTO extraído de un PDF escolar (cabeceras, nombres de niños
omitidos en parte). Puede haber varias líneas que parezcan título u otros platos
cercanos; los ingredientes y pasos del bloque corresponden a UNA receta principal.

Tarea:
- Infiere un **title** claro del plato que encaja con la lista de ingredientes.
  Si sobran títulos de otros platos en el encabezado, ignóralos.
- REESCRIBE ingredientes y pasos con palabras propias.
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
- Si faltan porciones o tiempo en el texto, estima valores razonables.
"""


def limpiar_linea(line: str) -> str | None:
    s = line.strip()
    if not s:
        return None
    if re.match(r"^\d{1,3}$", s):
        return None
    if s.lstrip().startswith("*"):
        return None
    if re.match(r"^ÍNDICE$", s, re.I):
        return None
    if re.match(r"^\(\s*versión", s, re.I):
        return None
    if s.upper() in ("RECETARIO", "CANARIO"):
        return None
    if re.match(r"^CON COSTILLA$", s, re.I):
        return None
    su = s.upper()
    if su == "CEIP" or ("MARTÍN CHIRINO" in su and len(s) < 45):
        return None
    if su == "C" and len(s) <= 2:
        return None
    if re.search(r"\d+\s*años", s, re.I):
        return None
    s = re.sub(r"\s*CEIP\s*$", "", s, flags=re.I).strip()
    if not s:
        return None
    return s


def es_ancla_ingredientes(ln: str) -> bool:
    s = ln.strip()
    up = s.upper()
    if "PREPARACIÓN" in up and "INGREDIENTES" in up:
        return False
    if re.match(r"^ingredientes\s*(?:para|:|\s|$)", s, re.I):
        return True
    return False


def parece_titulo_plato_05(s: str) -> bool:
    if len(s) < 3 or len(s) > 78:
        return False
    low = s.lower()
    if any(
        x in low
        for x in (
            " y lo ",
            " que ",
            " con la ",
            " para que ",
            " cuando ",
            " si ",
            "añadimos",
            "vertemos",
            "mezclamos",
            "dejamos",
        )
    ):
        return False
    if re.search(r"\d\s*(g|gr|kg|ml)\b", low):
        return False
    if re.match(r"^\d+[\.)]\s", s):
        return False
    if s.startswith(("•", "·")) and len(s) > 4:
        return False
    if "," in s and len(s) > 42:
        return False
    letters = [c for c in s if c.isalpha()]
    if letters:
        frac_up = sum(c.isupper() for c in letters) / len(letters)
        if frac_up >= 0.38:
            return True
    words = s.split()
    if len(words) <= 8 and not any(len(w) > 5 and w.islower() for w in words):
        return True
    return False


def titulo_mira_atras(lines: list[str], si: int) -> list[str]:
    acc: list[str] = []
    j = si - 1
    while j >= 0:
        s = lines[j].strip()
        if es_ancla_ingredientes(lines[j]):
            break
        if ELAB_HEADER.match(s):
            break
        if parece_titulo_plato_05(s):
            acc.insert(0, lines[j])
            if len(acc) >= 6:
                break
        elif acc:
            break
        j -= 1

    if len(acc) > 2:
        acc = acc[-2:]
    return acc


def dividir_recetas_canarias05(ruta_pdf: str) -> list[dict]:
    print(f"📖 Analizando {ruta_pdf}…")
    lines: list[str] = []
    line_page: list[int] = []

    with pdfplumber.open(ruta_pdf) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            pno = page_idx + 1
            for ln in (page.extract_text() or "").splitlines():
                c = limpiar_linea(ln)
                if c is not None:
                    lines.append(c)
                    line_page.append(pno)

    anchors = [i for i, ln in enumerate(lines) if es_ancla_ingredientes(ln)]
    out: list[dict] = []

    for k, si in enumerate(anchors):
        titles = titulo_mira_atras(lines, si)
        hi = anchors[k + 1] if k + 1 < len(anchors) else len(lines)
        chunk = titles + lines[si:hi]
        texto = "\n".join(chunk).strip()
        if len(texto) < 40:
            continue
        out.append({"texto": texto, "pagina": line_page[si]})

    return out


def reescribir_receta(texto_bruto: str, client: openai.OpenAI) -> dict:
    user_msg = (
        "Reescribe la siguiente receta en el JSON solicitado.\n\n" f"{texto_bruto}"
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

    bloques = dividir_recetas_canarias05(PDF_PATH)
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
            slug = rec.get("slug") or f"canarias05-{num}"
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
            print(
                f"  [{num:03d}/{EMPEZAR_DESDE + total}] ✅ {titulo[:45]:<45} "
                f"{sym} {fuente:<14} ⏱ ~{h}h{m}m"
            )

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

    Path("recetas_canarias05_reescritas.json").write_text(
        json.dumps(ok, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    Path("errores_canarias05.json").write_text(
        json.dumps(err, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("=" * 60)
    print(f"✅ {len(ok)} recetas")
    print(f"❌ {len(err)} errores → errores_canarias05.json")
    print(f"📊 Imágenes: {stats}")
    print(f"⏱️  {(time.time() - t0) / 60:.1f} min")


if __name__ == "__main__":
    main()
