/**
 * Lee recetas_airfryer_reescritas.json y genera SQL para asignar
 * categorías = { air-fryer, <tipo plato> } y categoria = <tipo plato>.
 *
 * Uso: node scripts/generate-airfryer-segunda-categoria-sql.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'recetas_airfryer_reescritas.json');
const outPath = path.join(
  root,
  'supabase/migrations/20260504160000_airfryer_segunda_categoria_corrige.sql'
);

const FOOD = [
  'arroz-paellas',
  'tortillas-pasta',
  'sopas-cremas',
  'carnes-aves',
  'pescados-mariscos',
  'pan-masas',
  'postres',
  'ensaladas-tapas',
];

function norm(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function blob(r) {
  return norm(
    [
      (r.slug || '').replace(/-/g, ' '),
      r.title,
      r.descripcion || '',
      ...(r.tags || []),
      ...(r.ingredientes || []),
      ...(r.pasos || []),
    ].join(' | ')
  );
}

/** Slug + título: señales fuertes sin “dorada” de cocción en los pasos. */
function headline(r) {
  return norm([(r.slug || '').replace(/-/g, ' '), r.title || ''].join(' '));
}

/** Coincidencia solo con tags normalizados del JSON (evita “pan” dentro de “acompañamiento”). */
const TAG_MAP = {
  postres: 'postres',
  desayuno: 'pan-masas',
  'media-manana': 'pan-masas',
  pasta: 'tortillas-pasta',
  ensalada: 'ensaladas-tapas',
  tapas: 'ensaladas-tapas',
  sopa: 'sopas-cremas',
  arroz: 'arroz-paellas',
  pan: 'pan-masas',
  gofres: 'pan-masas',
  waffles: 'pan-masas',
  pescado: 'pescados-mariscos',
  marisco: 'pescados-mariscos',
  vegetales: 'ensaladas-tapas',
  verduras: 'ensaladas-tapas',
  vegetariano: 'ensaladas-tapas',
  aperitivos: 'ensaladas-tapas',
  salchichas: 'carnes-aves',
  pollo: 'carnes-aves',
  cerdo: 'carnes-aves',
  pescados: 'pescados-mariscos',
  albondigas: 'carnes-aves',
  venado: 'carnes-aves',
  ternera: 'carnes-aves',
  cordero: 'carnes-aves',
  solomillo: 'carnes-aves',
  filete: 'carnes-aves',
  filetes: 'carnes-aves',
  morcilla: 'carnes-aves',
  tortilla: 'tortillas-pasta',
};

/**
 * @param {string} t Texto completo (slug, pasos…)
 * @param {unknown} tags Tags de la receta
 * @param {string} h headline(slug+título): evita “dorada/camar” ambiguos de los pasos
 */
function scoreAll(t, tags, h) {
  /** @type {Record<string, number>} */
  const s = Object.fromEntries(FOOD.map((c) => [c, 0]));

  for (const tag of tags || []) {
    const k = norm(String(tag)).replace(/\s+/g, '-');
    if (TAG_MAP[k]) s[TAG_MAP[k]] += 8;
  }

  // Título/slug primero (desayunos, sandwiches, paella marina…)
  if (/\b(gofres?|waffles?|panqueques|pancakes?|hotcakes?|bagels?|torrijas|tostadas francesas)\b/.test(h))
    s['pan-masas'] += 22;
  if (/\b(sandwich|bocadillo|napolitana)\b/.test(h)) s['pan-masas'] += 16;
  if (/\bpaella\b|\barroz negro\b/.test(h)) s['arroz-paellas'] += 26;
  if (/\bcazuela\b.*huevo/.test(h)) {
    s['tortillas-pasta'] += 10;
    s['pan-masas'] += 6;
  } else if (
    /\bhuevos /.test(h) &&
    !/\b(pollo|pavo|ternera|cordero|cerdo|salchicha|chorizo|bacon|panceta|jamon)\b/.test(h)
  ) {
    s['tortillas-pasta'] += 10;
    s['pan-masas'] += 8;
  }
  if (
    /\b(gambas|gamba|camarones|camaron|langostinos|langostino|pulpos?|calamares|merluza|bacalao|atun|salmon|boqueron|sardin)/.test(
      h
    )
  )
    s['pescados-mariscos'] += 22;

  if (/\b(vegetarian[oae]|vegetariano|vegan[oae]|vegano)\b/.test(h)) {
    s['carnes-aves'] -= 30;
    s['ensaladas-tapas'] += 22;
  }

  if (/\btortas?\s+de\s+(pavo|pollo|ternera)\b/.test(h)) s['carnes-aves'] += 20;
  if (/\bcorona\s+de\s+pavo|pavo\s+asado|rollo\s+de\s+pavo\b/.test(h)) s['carnes-aves'] += 18;

  if (/\btortilla\b.*\b(salchicha|salchichas|pepperoni|longaniza|chorizo|morcilla|butifarra|panceta|jamon|bacon)\b/.test(h))
    s['carnes-aves'] += 30;

  if (/\btortilla\b.*\bcerezas?\b|\bcerezas?\b.*\btortilla\b/.test(h)) s.postres += 26;

  if (/\b(bolas? de arroz|arroz .* bolas)\b/.test(h)) s['arroz-paellas'] += 26;

  if (/\balcachofas?\b.*(?:horno|queso)|alcachofa.*(?:horno|queso)/.test(h)) s['ensaladas-tapas'] += 14;

  // Postres dulces
  if (/\bflan\b|tarta|pastel|pudin|mousse|brownie|cheesecake|natillas|crema catalana|compota|arandanos|cerezas|cereza\b|frambuesa|fresa\b|zarzamora|manzanas asadas|peras al|helado|sorbete|bizcocho|postre\b|galleta\b|tiramisu|crepe\b|filloas|filloa|torrija|torrijas|arroz con leche|cobbler|crumble/.test(t))
    s.postres += 12;
  if (/\bcazuela de (arandanos|manzana|fresa|fruta|limon)/.test(t)) s.postres += 14;
  if (
    /\b(dona|donut|churro|magdalena|muffin|muffins|bollo|rollo de canela|waffle|gofres?|gofre|tostadas francesas|french toast|bagel|brioche|pancake|hotcake)\b/.test(
      t
    )
  )
    s['pan-masas'] += 10;
  if (/\b(pizza|focaccia|empanada gallega|pan de|hogaza|baguette)\b/.test(t)) s['pan-masas'] += 10;

  // Sopas y cremas (sin “caldo” suelto: suele ser ingrediente en carnes/pollo)
  if (/\bsopa\b|gazpacho|salmorejo|minestrone|consome|crema de |crema\b.*(calabacin|brocoli|verdura|tomate|zanahoria)/.test(t))
    s['sopas-cremas'] += 12;
  if (/\bguiso\b|estofado|cazuela\b.*(pollo|carne|cerdo|pavo)/.test(t)) s['sopas-cremas'] += 4;
  if (/\balubias\b|\bjudias\b.*(rojas|verdes|guis)/.test(t)) s['sopas-cremas'] += 8;

  // Ensaladas y tapas ligeras
  if (/\bensalada\b|ensaladilla|tapas?\b|aperitivo|croqueta\b|bruschetta|pinchos?\b/.test(t))
    s['ensaladas-tapas'] += 11;
  if (
    /\bverduras mixtas|verduras asadas|vegetales asados|brocoli\b|coliflor\b|alcachofa\b|esparrago\b|zanahoria\b|calabacin\b|berenjena\b|rabano\b|remolacha\b|setas\b|champinones|champiñones/.test(
      t
    )
  )
    s['ensaladas-tapas'] += 7;

  // Pescados y mariscos (evitar “dorada” = color; evitar \bcamar\b suelto)
  if (
    /\b(salmon|merluza|bacalao|atun|bonito|caballa|lubina|rape|boqueron|sardina|sardinas|anchoa|sepia|pulpo|calamar|calamares|mejillon|mejillones|almeja|almejas|gambas?|camarones|langostinos?|bogavante|cangrejo|surimi|pescado)\b/.test(
      t
    ) ||
    /\bdorada\s+(frita|asada|al\s+horno|a\s+la\s+sal|en\s+salsa|gratinada|rellena|plancha)\b/.test(t) ||
    /\bfiletes?\s+de\s+dorada\b/.test(t)
  )
    s['pescados-mariscos'] += 14;

  // Arroz (no leche)
  if (/\barroz con leche\b/.test(t)) s.postres += 16;
  else if (/\barroz\b|paella|risotto/.test(t)) s['arroz-paellas'] += 10;

  // Pasta italiana / fideos (evitar «obtener una pasta» = roux)
  if (
    /\b(espagueti|espaghetti|fideos|tallarines|macarrones|lasana|canelones|ravioli|ravioles|ñoquis|gnocchi|tortiglioni|penne|canelon)\b/.test(
      t
    ) ||
    (/\bpasta\b/.test(t) &&
      /\b(plato|servir|mezclar|cocer|hornear|cocinar)\s+(de\s+)?(pasta|espagueti|macarrones)/.test(t))
  )
    s['tortillas-pasta'] += 12;
  if (/\btortilla de patata|tortilla espanola|tortilla\b.*(patata|calabacin|esparrago)/.test(t))
    s['tortillas-pasta'] += 11;
  if (/\bhuevo(s)? revuelto|huevos al horno|huevos estrellados/.test(t)) s['tortillas-pasta'] += 6;
  if (/\btortilla\b/.test(t) && !/\btortilla de (cerezas|cereza|frambuesa|fruta|manzana|fresa)\b/.test(t))
    s['tortillas-pasta'] += 8;

  // Carnes y aves (no contar “carne” en “calabaza”, “champiñones”…)
  if (
    /\b(pollo|pavo|pato|codorniz|codornices|conejo|liebre|faisan|cerdo|cordero|ternera|vacuno|carne molida|hamburguesa|chuleta|costilla|solomillo|lomo|bistec|filetes?\s+de\s+res\b|\bde\s+res\b|albondiga|albondigas|carne de|chorizo|morcilla|salchicha|salchichas|butifarra|bacon|panceta|tocino|jamon|fiambre|magret|carnitas|cochinillo|venado|ciervo)\b/.test(
      t
    )
  )
    s['carnes-aves'] += 12;
  if (/\bcarne\b/.test(t) && !/\bcalabaza\b|\bchampin\b|\bchampiñ/.test(t)) s['carnes-aves'] += 8;

  // “Pan de carne” / pastel salado = carne, no panadería
  if (/\bpan de carne\b|pastel de carne\b|rollo de carne\b|meatloaf\b/.test(t)) s['carnes-aves'] += 18;

  return s;
}

function pickCategory(r) {
  const t = blob(r);
  const h = headline(r);
  const s = scoreAll(t, r.tags, h);
  let best = 'ensaladas-tapas';
  let bestV = s[best];
  for (const c of FOOD) {
    if (s[c] > bestV) {
      best = c;
      bestV = s[c];
    }
  }
  if (bestV === 0) {
    if (/\b(verdura|vegetal|brocoli|calabacin|berenjena|patata asada|patatas|setas|champin)\b/.test(t))
      return 'ensaladas-tapas';
    if (/\bhuevo|huevo(s)?\b/.test(t)) return 'tortillas-pasta';
    return 'ensaladas-tapas';
  }
  return best;
}

function escSql(str) {
  return str.replace(/'/g, "''");
}

const raw = fs.readFileSync(jsonPath, 'utf8');
const recetas = JSON.parse(raw);

const lines = [
  '-- Corrige categoría secundaria de recetas air-fryer (heurística v2; evita “dorada” de cocción, fallbacks a carnes, etc.).',
  '-- Generado por scripts/generate-airfryer-segunda-categoria-sql.mjs',
  '-- Aplicar después de 20260427180000_airfryer_segunda_categoria.sql. Actualiza filas con air-fryer en categorías o categoria legada.',
  '',
];

let n = 0;
for (const r of recetas) {
  if (r.categoria !== 'air-fryer') continue;
  const secondary = pickCategory(r);
  const slug = escSql(r.slug);
  lines.push(
    `UPDATE public.recetas SET categorias = ARRAY['${secondary}', 'air-fryer']::text[], categoria = '${secondary}' WHERE slug = '${slug}' AND ('air-fryer' = ANY (COALESCE(categorias, ARRAY[]::text[])) OR categoria = 'air-fryer');`
  );
  n++;
}

lines.push('');
lines.push(`-- Filas previstas: ${n}`);

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Escrito ${outPath} (${n} updates)`);
