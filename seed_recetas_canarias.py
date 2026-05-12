"""
Importar recetas desde libro-canaria01.pdf («Las recetas de mi familia», Islas Canarias).

Edición digital BienMeSabe.org — uso no comercial.

Flujo (alineado con seed_recetas_economicas.py):
  1. pdfplumber: secciones + bloques «Las recetas de…» + Ingredientes
  2. OpenAI reescribe cada receta en JSON (guia_casera con Contexto / Cuándo / Beneficios)
  3. Imagen: Spoonacular → Pexels (titulo traducido al inglés)
  4. Supabase upsert por slug

Uso:
  source venv/bin/activate
  pip install -r requirements.txt
  python3 seed_recetas_canarias.py

Reanudar: EMPEZAR_DESDE = n (índice 0-based del bloque tras dividir_recetas_canarias).
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

import openai
import pdfplumber
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")
SPOONACULAR_KEY = os.getenv("SPOONACULAR_API_KEY")

PDF_PATH = "libro-canaria01.pdf"
IMAGES_DIR = Path("public/images/recetas")

EMPEZAR_DESDE = 0
LOTE_INSERT = 50
PRIMERA_PAGINA_RECETA = 15

RECETAS_HEADER_RE = re.compile(r"Las recetas de", re.I)
INGREDIENTES_RE = re.compile(r"ingredientes", re.I)

CATEGORIAS = [
    "arroz-paellas",
    "tortillas-pasta",
    "sopas-cremas",
    "carnes-aves",
    "pescados-mariscos",
    "pan-masas",
    "postres",
    "ensaladas-tapas",
    "air-fryer",
]

PROMPT_SISTEMA = f"""Eres un chef experto en cocina casera de las Islas Canarias y tradición española.

Recibirás el título y el texto de una receta extraída del PDF «Las recetas de mi familia» (edición cultural, Islas Canarias).
Tu tarea es REESCRIBIR la receta con palabras propias, clara y natural. NO copies el texto original.
Mantén el espíritu del plato canario o casero sin sonar a folleto turístico.

Devuelve SOLO un JSON válido (sin markdown) con esta estructura:
{{
  "title": "Nombre limpio en castellano (corrige mayúsculas raras del PDF)",
  "slug": "nombre-sin-acentos-en-minusculas-con-guiones",
  "categoria": "<se indica en el mensaje; no la cambies>",
  "dificultad": "facil | media | dificil",
  "tiempo": "ej: '40 min', '1 hora 30 min'",
  "porciones": número_entero,
  "descripcion": "2-3 frases propias",
  "ingredientes": ["cantidad + ingrediente", "..."],
  "pasos": ["pasos claros y reescritos", "..."],
  "tips": ["consejos prácticos; si no hay, []"],
  "guia_casera": "Entre 150 y 200 palabras en castellano. Texto ÚNICO y original. Tres partes; cada una empieza en su propia línea exactamente así:\\nContexto:\\n...\\n\\nCuándo hacerla:\\n...\\n\\nBeneficios:\\n...\\nEn Contexto: encaje en la cocina canaria o española y tipo de plato. En Cuándo: ocasión típica. En Beneficios: prácticos (sabor, aprovechamiento, convivencia…). SIN propiedades curativas ni promesas médicas.",
  "tags": ["3-6 tags en minúsculas sin acentos; añadiremos canarias por código"],
  "calorias": null,
  "historia": null,
  "destacada": false
}}

REGLAS:
- guia_casera obligatoria, 150-200 palabras totales aproximadamente.
- El slug solo usa letras minúsculas, números y guiones.
- Categorías válidas del sitio: {", ".join(CATEGORIAS)}
"""


def section_to_categoria(raw: str) -> str | None:
    k = (
        raw.lower()
        .replace("“", "")
        .replace("”", "")
        .replace('"', "")
        .strip()
    )
    if k.startswith("entrant"):
        return "ensaladas-tapas"
    if k.startswith("sopa"):
        return "sopas-cremas"
    if "potaje" in k:
        return "sopas-cremas"
    if k.startswith("carn"):
        return "carnes-aves"
    if "pescado" in k:
        return "pescados-mariscos"
    if "granos" in k:
        return "sopas-cremas"
    if "arroc" in k or "pastas" in k:
        return "arroz-paellas"
    if "mojo" in k or "salsa" in k:
        return "ensaladas-tapas"
    if "postre" in k or "licor" in k:
        return "postres"
    return None


def limpia_linea_footer(line: str) -> str | None:
    s = line.strip()
    if not s:
        return None
    if re.match(r"^\d{1,3}$", s):
        return None
    return s


def dividir_recetas_canarias(ruta_pdf: str) -> list[dict]:
    print(f"📖 Analizando {ruta_pdf}...")
    recetas: list[dict] = []
    cur_cat = "ensaladas-tapas"
    cur: dict | None = None

    with pdfplumber.open(ruta_pdf) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            pno = page_idx + 1
            raw = page.extract_text() or ""
            lines: list[str] = []
            for ln in raw.split("\n"):
                c = limpia_linea_footer(ln)
                if c:
                    lines.append(c)

            if not lines:
                continue

            if len(lines) == 1:
                sec = section_to_categoria(lines[0])
                if sec:
                    cur_cat = sec
                continue

            if RECETAS_HEADER_RE.search(lines[0]):
                if pno < PRIMERA_PAGINA_RECETA:
                    continue
                if not INGREDIENTES_RE.search("\n".join(lines)):
                    continue
                if cur is not None and cur["lineas"]:
                    body = "\n".join(cur["lineas"]).strip()
                    if len(body) > 80:
                        recetas.append(
                            {
                                "titulo": cur["titulo"],
                                "texto": body,
                                "pagina": cur["pagina"],
                                "categoria": cur["categoria"],
                            }
                        )
                titulo = lines[1].strip() if len(lines) > 1 else "sin-titulo"
                cur = {
                    "titulo": titulo,
                    "lineas": lines[2:],
                    "pagina": pno,
                    "categoria": cur_cat,
                }
                continue

            if cur is not None:
                cur["lineas"].extend(lines)

    if cur is not None and cur["lineas"]:
        body = "\n".join(cur["lineas"]).strip()
        if len(body) > 80:
            recetas.append(
                {
                    "titulo": cur["titulo"],
                    "texto": body,
                    "pagina": cur["pagina"],
                    "categoria": cur["categoria"],
                }
            )

    return recetas


def reescribir_receta(titulo: str, texto: str, categoria: str, client: openai.OpenAI) -> dict:
    user_msg = (
        f"Categoría obligatoria para el campo categoria del JSON: {categoria}\n"
        f"Título original del PDF:\n{titulo}\n\n"
        f"Texto bruto (ingredientes y preparación):\n{texto}"
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
    data["categoria"] = categoria
    return data


def normalizar_tags(tags: list | None) -> list[str]:
    extra = ["canarias", "cocina-canaria"]
    base = [str(t).lower().strip() for t in (tags or []) if t]
    merged: list[str] = []
    seen: set[str] = set()
    for t in base + extra:
        t = re.sub(r"[^a-z0-9\-]", "", t.replace(" ", "-"))
        if t and t not in seen:
            seen.add(t)
            merged.append(t)
    return merged[:12]


def traducir_titulo(titulo: str, client: openai.OpenAI) -> str:
    try:
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Traduce el nombre de este plato casero español o canario al inglés. "
                        "Solo la traducción, sin comillas."
                    ),
                },
                {"role": "user", "content": titulo},
            ],
            temperature=0,
            max_tokens=50,
        )
        return (r.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"      ⚠️  Traducción: {e}")
        return titulo


_spoonacular_agotado = False


def buscar_spoonacular(titulo_en: str) -> str | None:
    global _spoonacular_agotado
    if _spoonacular_agotado:
        return None
    try:
        r = requests.get(
            "https://api.spoonacular.com/recipes/complexSearch",
            params={"query": titulo_en, "number": 1, "apiKey": SPOONACULAR_KEY},
            timeout=10,
        )
        if r.status_code == 402:
            print("\n   ⚠️  Spoonacular: límite diario → Pexels\n")
            _spoonacular_agotado = True
            return None
        r.raise_for_status()
        datos = r.json()
        if datos.get("results"):
            img_id = datos["results"][0]["id"]
            img_url = datos["results"][0].get("image", "")
            if img_url and not img_url.startswith("http"):
                img_url = f"https://img.spoonacular.com/recipes/{img_id}-636x393.jpg"
            return img_url or None
    except Exception as e:
        print(f"      ⚠️  Spoonacular: {e}")
    return None


_pexels_calls = 0
_pexels_window_start = time.time()


def buscar_pexels(titulo_en: str) -> str | None:
    global _pexels_calls, _pexels_window_start
    _pexels_calls += 1
    elapsed = time.time() - _pexels_window_start
    if _pexels_calls >= 190:
        espera = 3600 - elapsed
        if espera > 0:
            print(f"\n   ⏳ Pexels: espera {espera/60:.0f} min\n")
            time.sleep(espera + 15)
        _pexels_calls = 0
        _pexels_window_start = time.time()
    try:
        r = requests.get(
            "https://api.pexels.com/v1/search",
            headers={"Authorization": PEXELS_API_KEY},
            params={
                "query": f"{titulo_en} spanish home cooking food",
                "per_page": 1,
                "orientation": "landscape",
                "size": "large",
            },
            timeout=10,
        )
        r.raise_for_status()
        d = r.json()
        if d.get("photos"):
            return d["photos"][0]["src"]["large"]
    except Exception as e:
        print(f"      ⚠️  Pexels: {e}")
    return None


def descargar_imagen(url: str, path: Path) -> bool:
    if path.exists():
        return True
    try:
        r = requests.get(url, timeout=30, stream=True)
        r.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"      ⚠️  Descarga: {e}")
        return False


def obtener_imagen_remota(titulo: str, slug: str, client: openai.OpenAI) -> tuple[str, str]:
    en = traducir_titulo(titulo, client)
    url = buscar_spoonacular(en)
    src = "spoonacular"
    if not url:
        url = buscar_pexels(en)
        src = "pexels"
    if not url:
        return "", "sin-foto"
    path = IMAGES_DIR / f"{slug}.jpg"
    if descargar_imagen(url, path):
        return f"/images/recetas/{slug}.jpg", src
    return "", "error"


_slugs: set = set()


def cargar_slugs(sb):
    global _slugs
    rows = []
    start = 0
    while True:
        res = (
            sb.table("recetas")
            .select("slug")
            .range(start, start + 999)
            .execute()
        )
        chunk = res.data or []
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        start += 1000
    _slugs = {r["slug"] for r in rows}
    print(f"   → {len(_slugs)} slugs en Supabase\n")


def slug_unico(base: str) -> str:
    if base not in _slugs:
        return base
    n = 2
    while f"{base}-{n}" in _slugs:
        n += 1
    return f"{base}-{n}"


def insertar_lote(items: list[dict], sb) -> int:
    global _slugs
    n = 0
    for rec in items:
        slug_o = rec.get("slug") or "receta"
        slug_f = slug_unico(slug_o)
        if slug_f != slug_o:
            print(f"      🔀 Slug '{slug_o}' → '{slug_f}'")
            rec["slug"] = slug_f
            if rec.get("imagen", "").endswith(f"{slug_o}.jpg"):
                old_p = IMAGES_DIR / f"{slug_o}.jpg"
                new_p = IMAGES_DIR / f"{slug_f}.jpg"
                if old_p.exists() and not new_p.exists():
                    old_p.rename(new_p)
                rec["imagen"] = rec["imagen"].replace(f"{slug_o}.jpg", f"{slug_f}.jpg")
        try:
            sb.table("recetas").upsert(rec, on_conflict="slug").execute()
            _slugs.add(slug_f)
            n += 1
        except Exception as e:
            print(f"      ⚠️  {slug_f}: {e}")
    return n


def preparar_fila_supabase(rec: dict) -> dict:
    cat = rec["categoria"]
    return {
        "title": rec["title"],
        "slug": rec["slug"],
        "categoria": cat,
        "categorias": [cat],
        "dificultad": rec["dificultad"],
        "tiempo": rec["tiempo"],
        "porciones": rec["porciones"],
        "descripcion": rec.get("descripcion") or "",
        "ingredientes": rec.get("ingredientes") or [],
        "pasos": rec.get("pasos") or [],
        "tips": rec.get("tips") or [],
        "tags": rec.get("tags") or [],
        "guia_casera": (rec.get("guia_casera") or "").strip() or None,
        "imagen": rec.get("imagen") or "",
        "imagen_alt": rec.get("imagen_alt") or "",
        "calorias": rec.get("calorias"),
        "historia": rec.get("historia"),
        "destacada": bool(rec.get("destacada", False)),
    }


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

    bloques = dividir_recetas_canarias(PDF_PATH)
    print(f"   → {len(bloques)} recetas detectadas en el PDF\n")

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
            rec = reescribir_receta(b["titulo"], b["texto"], b["categoria"], oai)
            titulo = rec.get("title") or b["titulo"]
            slug = rec.get("slug") or f"canarias-{num}"
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
            err.append({"num": num, "titulo": b["titulo"], "error": str(e)})
            print(f"  [{num:03d}/{EMPEZAR_DESDE + total}] ❌ {e}")

    resto = len(ok) % LOTE_INSERT
    if resto:
        n = insertar_lote(ok[-resto:], sb)
        print(f"\n  🗄️  Último lote: {n}\n")

    Path("recetas_canarias_reescritas.json").write_text(
        json.dumps(ok, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    Path("errores_canarias.json").write_text(
        json.dumps(err, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("=" * 60)
    print(f"✅ {len(ok)} recetas")
    print(f"❌ {len(err)} errores → errores_canarias.json")
    print(f"📊 Imágenes: {stats}")
    print(f"⏱️  {(time.time() - t0) / 60:.1f} min")


if __name__ == "__main__":
    main()
