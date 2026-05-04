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
  'supabase/migrations/20260427180000_airfryer_segunda_categoria.sql'
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

/** Coincidencia solo con tags normalizados del JSON (evita “pan” dentro de “acompañamiento”). */
const TAG_MAP = {
  postres: 'postres',
  desayuno: 'pan-masas',
  pasta: 'tortillas-pasta',
  ensalada: 'ensaladas-tapas',
  tapas: 'ensaladas-tapas',
  sopa: 'sopas-cremas',
  arroz: 'arroz-paellas',
  pan: 'pan-masas',
  pescado: 'pescados-mariscos',
  marisco: 'pescados-mariscos',
  vegetales: 'ensaladas-tapas',
  verduras: 'ensaladas-tapas',
  aperitivos: 'ensaladas-tapas',
  salchichas: 'carnes-aves',
  pollo: 'carnes-aves',
  cerdo: 'carnes-aves',
  pescados: 'pescados-mariscos',
  albondigas: 'carnes-aves',
  venado: 'carnes-aves',
  ternera: 'carnes-aves',
  cordero: 'carnes-aves',
};

/** @param {string} t */
function scoreAll(t, tags) {
  /** @type {Record<string, number>} */
  const s = Object.fromEntries(FOOD.map((c) => [c, 0]));

  for (const tag of tags || []) {
    const k = norm(String(tag)).replace(/\s+/g, '-');
    if (TAG_MAP[k]) s[TAG_MAP[k]] += 8;
  }

  // Postres dulces
  if (/\bflan\b|tarta|pastel|pudin|mousse|brownie|cheesecake|natillas|crema catalana|compota|arandanos|frambuesa|fresa\b|zarzamora|manzanas asadas|peras al|helado|sorbete|dulce\b|postre\b|galleta\b|bizcocho|tiramisu|crepe\b|filloas|filloa|torrija|torrijas|arroz con leche|cobbler|crumble/.test(t))
    s.postres += 12;
  if (/\bcazuela de (arandanos|manzana|fresa|fruta|limon)/.test(t)) s.postres += 14;
  if (/\b(dona|donut|churro|magdalena|muffin|bollo|rollo de canela|waffle|gofre|tostadas francesas|french toast|bagel|brioche|pancake|hotcake)\b/.test(t))
    s['pan-masas'] += 10;
  if (/\b(pizza|focaccia|empanada gallega|pan de|hogaza|baguette)\b/.test(t)) s['pan-masas'] += 10;

  // Sopas y cremas (sin “caldo” suelto: suele ser ingrediente en carnes/pollo)
  if (/\bsopa\b|gazpacho|salmorejo|minestrone|consome|crema de |crema\b.*(calabacin|brocoli|verdura|tomate|zanahoria)/.test(t))
    s['sopas-cremas'] += 12;
  if (/\bguiso\b|estofado|cazuela\b.*(pollo|carne|cerdo|pavo)/.test(t)) s['sopas-cremas'] += 4;

  // Ensaladas y tapas ligeras
  if (/\bensalada\b|ensaladilla|tapas?\b|aperitivo|croqueta\b|bruschetta|pincho\b/.test(t))
    s['ensaladas-tapas'] += 11;
  if (
    /\bverduras mixtas|verduras asadas|vegetales asados|brocoli\b|coliflor\b|alcachofa\b|esparrago\b|zanahoria\b|calabacin\b|berenjena\b|rabano\b|remolacha\b/.test(
      t
    )
  )
    s['ensaladas-tapas'] += 7;

  // Pescados
  if (/\b(salmon|merluza|bacalao|atun|bonito|caballa|dorada|lubina|rape|boqueron|sardina|anchoa|sepia|pulpo|calamar|mejillon|almeja|gamba|camar|langostino|bogavante|cangrejo|surimi|pescado)\b/.test(t))
    s['pescados-mariscos'] += 14;

  // Arroz (no leche)
  if (/\barroz con leche\b/.test(t)) s.postres += 16;
  else if (/\barroz\b|paella|risotto/.test(t)) s['arroz-paellas'] += 10;

  // Pasta / tortillas
  if (/\b(pasta|espagueti|fideos|tallarines|macarrones|lasaña|canelon|ravio|gnocchi|noqui)\b/.test(t))
    s['tortillas-pasta'] += 12;
  if (/\btortilla de patata|tortilla espanola|tortilla\b.*(patata|calabacin|esparrago)/.test(t))
    s['tortillas-pasta'] += 11;
  if (/\bhuevo(s)? revuelto|huevos al horno|huevos estrellados/.test(t)) s['tortillas-pasta'] += 6;

  // Carnes y aves (amplio)
  if (
    /\b(pollo|pavo|pato|codorniz|codornices|conejo|liebre|faisan|cerdo|cordero|ternera|vacuno|carne molida|hamburguesa|chuleta|costilla|solomillo|lomo|bistec|albondiga|albondigas|carne de|carne\b|chorizo|morcilla|salchicha|salchichas|butifarra|bacon|panceta|tocino|jamon|fiambre|magret|carnitas|cochinillo|venado|ciervo)\b/.test(
      t
    )
  )
    s['carnes-aves'] += 12;

  // “Pan de carne” / pastel salado = carne, no panadería
  if (/\bpan de carne\b|pastel de carne\b|rollo de carne\b|meatloaf\b/.test(t)) s['carnes-aves'] += 18;

  return s;
}

function pickCategory(t, tags) {
  const s = scoreAll(t, tags);
  let best = FOOD[0];
  let bestV = s[best];
  for (const c of FOOD) {
    if (s[c] > bestV) {
      best = c;
      bestV = s[c];
    }
  }
  if (bestV === 0) {
    // Heurística mínima por palabras muy genéricas
    if (/\b(verdura|vegetal|brocoli|calabacin|berenjena|patata asada|patatas)\b/.test(t))
      return 'ensaladas-tapas';
    return 'carnes-aves';
  }
  return best;
}

function escSql(str) {
  return str.replace(/'/g, "''");
}

const raw = fs.readFileSync(jsonPath, 'utf8');
const recetas = JSON.parse(raw);

const lines = [
  '-- Asigna segunda categoría (tipo de plato) a recetas air-fryer.',
  '-- Generado por scripts/generate-airfryer-segunda-categoria-sql.mjs',
  '',
];

let n = 0;
for (const r of recetas) {
  if (r.categoria !== 'air-fryer') continue;
  const secondary = pickCategory(blob(r), r.tags);
  const slug = escSql(r.slug);
  lines.push(
    `UPDATE public.recetas SET categorias = ARRAY['${secondary}', 'air-fryer']::text[], categoria = '${secondary}' WHERE slug = '${slug}' AND (categoria = 'air-fryer' OR 'air-fryer' = ANY (COALESCE(categorias, ARRAY[]::text[])));`
  );
  n++;
}

lines.push('');
lines.push(`-- Filas previstas: ${n}`);

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Escrito ${outPath} (${n} updates)`);
