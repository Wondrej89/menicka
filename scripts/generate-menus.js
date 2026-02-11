const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'menus.json');
const TIMEZONE = 'Europe/Prague';

const WEEKDAY_ALIASES = {
  pondeli: 1,
  pondělí: 1,
  utery: 2,
  úterý: 2,
  streda: 3,
  středa: 3,
  ctvrtek: 4,
  čtvrtek: 4,
  patek: 5,
  pátek: 5,
  sobota: 6,
  nedele: 0,
  neděle: 0
};

const RESTAURANTS = [
  { id: 'bife-restaurant', name: 'Bife Restaurant', url: 'https://biferestaurant.cz/pages/denni-menu', parser: parseSimpleDailyPage },
  { id: 'corleone-andel', name: 'Corleone Anděl', url: 'https://www.corleone.cz/poledni-menu-andel', parser: parseSimpleDailyPage },
  { id: 'smichovna', name: 'Smíchovna', url: 'https://www.smichovna.cz/tydenni-nabidka', parser: parseWeeklyPage },
  { id: 'smichovska-formanka', name: 'Smíchovská Formanka', url: 'http://smichovskaformanka.cz/', parser: parseSimpleDailyPage },
  { id: 'u-mamlasu', name: 'U Mámy Lásu', url: 'https://www.umamlasu.cz/denni-menu-praha', parser: parseSimpleDailyPage }
];

const FALLBACK_MENU_BY_RESTAURANT = {
  'bife-restaurant': [
    { type: 'soup', name: 'Drůbeží vývar se zeleninou', price: 49 },
    { type: 'main', name: 'Kuřecí steak, pepřová omáčka, hranolky', price: 179 },
    { type: 'main', name: 'Smažený sýr, vařené brambory, tatarská omáčka', price: 169 }
  ],
  'corleone-andel': [
    { type: 'soup', name: 'Rajčatová polévka s bazalkou', price: 45 },
    { type: 'main', name: 'Spaghetti Bolognese', price: 185 },
    { type: 'main', name: 'Pizza Prosciutto', price: 195 }
  ],
  smichovna: [
    { type: 'soup', name: 'Hovězí vývar s nudlemi', price: 45 },
    { type: 'main', name: 'Svíčková na smetaně, houskový knedlík', price: 199 },
    { type: 'main', name: 'Vepřový řízek, bramborový salát', price: 189 }
  ],
  'smichovska-formanka': [
    { type: 'soup', name: 'Bramboračka', price: 42 },
    { type: 'main', name: 'Segedínský guláš, houskový knedlík', price: 175 },
    { type: 'main', name: 'Kuřecí nudličky na kari, rýže', price: 172 }
  ],
  'u-mamlasu': [
    { type: 'soup', name: 'Česnečka se sýrem', price: 49 },
    { type: 'main', name: 'Vídeňský řízek z vepřové kýty, bramborová kaše', price: 189 },
    { type: 'main', name: 'Penne arrabbiata', price: 169 }
  ]
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const today = getCzechWeekday();
  const menus = await Promise.all(RESTAURANTS.map((restaurant) => loadRestaurantMenu(restaurant, today)));

  const payload = {
    generatedAt: new Date().toISOString(),
    weekday: today,
    menus
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Vygenerováno: ${OUTPUT_FILE}`);
}

async function loadRestaurantMenu(restaurant, today) {
  try {
    const html = await fetchHtml(restaurant.url);
    const parsed = restaurant.parser(html, { today });
    return { id: restaurant.id, name: restaurant.name, url: restaurant.url, source: 'live', ...parsed };
  } catch (error) {
    const fallback = getFallbackMenu(restaurant.id, today);
    if (fallback) {
      return {
        id: restaurant.id,
        name: restaurant.name,
        url: restaurant.url,
        status: 'ok',
        source: 'fallback',
        message: 'Zobrazeno ukázkové menu (online zdroj je dočasně nedostupný).',
        items: fallback
      };
    }

    return {
      id: restaurant.id,
      name: restaurant.name,
      url: restaurant.url,
      status: 'error',
      source: 'live',
      message: `Nepodařilo se načíst menu: ${error.message}`,
      items: []
    };
  }
}

function getFallbackMenu(restaurantId, today) {
  if (today === 0 || today === 6) return null;
  return FALLBACK_MENU_BY_RESTAURANT[restaurantId] || null;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 MenickaBot/1.0' },
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseSimpleDailyPage(html, { today }) {
  const lines = extractTextLines(html);

  const hasAnotherDay = lines.some((line) => {
    const idx = weekdayFromLine(line);
    return idx !== null && idx !== today;
  });

  if (hasAnotherDay && !lines.some((line) => weekdayFromLine(line) === today)) {
    return { status: 'no-menu-for-today', message: 'Na stránce není menu pro dnešní den.', items: [] };
  }

  const items = parseMenuLines(lines);
  if (!items.length) return { status: 'error', message: 'Nepodařilo se rozpoznat položky menu.', items: [] };

  return { status: 'ok', message: 'Načteno.', items };
}

function parseWeeklyPage(html, { today }) {
  const lines = extractTextLines(html);
  let currentDay = null;
  const dayLines = [];

  for (const line of lines) {
    const weekday = weekdayFromLine(line);
    if (weekday !== null) {
      currentDay = weekday;
      continue;
    }
    if (currentDay === today) dayLines.push(line);
  }

  if (!dayLines.length) {
    return { status: 'no-menu-for-today', message: 'Týdenní menu pro dnešní den není dostupné.', items: [] };
  }

  const items = parseMenuLines(dayLines);
  return { status: items.length ? 'ok' : 'error', message: items.length ? 'Načteno.' : 'Nepodařilo se rozpoznat položky menu.', items };
}

function extractTextLines(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ');

  return text.split('\n').map((line) => line.trim()).filter(Boolean).filter((line) => line.length > 2);
}

function parseMenuLines(lines) {
  const items = [];

  for (const line of lines) {
    const priceMatch = line.match(/(\d{2,4})\s*(?:Kč|CZK)/i) || line.match(/(\d{2,4})\s*,-/);
    if (!priceMatch) continue;

    const price = Number(priceMatch[1]);
    if (!Number.isFinite(price)) continue;

    const name = line.replace(priceMatch[0], '').replace(/^\d+[\.|\)]\s*/, '').replace(/\s{2,}/g, ' ').trim();
    if (!name) continue;

    items.push({ type: isSoup(name) ? 'soup' : 'main', name, price });
  }

  return dedupeItems(items).slice(0, 12);
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.name.toLowerCase()}::${item.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCzechWeekday() {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TIMEZONE }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}

function weekdayFromLine(line) {
  const low = line.toLowerCase();
  for (const [name, idx] of Object.entries(WEEKDAY_ALIASES)) {
    if (low.includes(name)) return idx;
  }
  return null;
}

function isSoup(name) {
  const low = name.toLowerCase();
  return ['polévka', 'polevka', 'soup', 'vývar', 'vyvar', 'krém', 'krem'].some((token) => low.includes(token));
}
