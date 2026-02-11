import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MENU_PATH = path.join(DATA_DIR, 'menu.json');
const META_PATH = path.join(DATA_DIR, 'menu.meta.json');

const REQUEST_TIMEOUT_MS = 15_000;
const RETRIES = 2;

const SOURCES = [
  {
    id: 'restaurace-xyz',
    name: 'Restaurace XYZ',
    url: 'https://example.com/menu',
    selector: {
      container: '.daily-menu',
      item: '.menu-item',
      title: '.title',
      price: '.price',
      note: '.note'
    }
  }
];

await run();

async function run() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const sources = [];
  for (const source of SOURCES) {
    const parsed = await processSource(source);
    sources.push(orderSource(parsed));
  }

  const previousJson = await readFileOrEmpty(MENU_PATH);
  const previousPayload = parseJsonSafe(previousJson);

  const previousSourcesJson = JSON.stringify(previousPayload?.sources ?? []);
  const nextSourcesJson = JSON.stringify(sources);

  if (previousSourcesJson === nextSourcesJson) {
    console.log('[menu] beze změny, soubor se nepřepisuje');
    return;
  }

  const payload = orderPayload({
    generatedAt: new Date().toISOString(),
    sources
  });

  const nextJson = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(MENU_PATH, nextJson, 'utf8');
  await fs.writeFile(
    META_PATH,
    `${JSON.stringify({ generatedAt: payload.generatedAt, sourceCount: sources.length }, null, 2)}\n`,
    'utf8'
  );

  console.log(`[menu] zapsáno: ${MENU_PATH}`);
}

async function processSource(source) {
  try {
    const response = await fetchWithRetry(source.url, RETRIES);
    console.log(`[menu] ${source.url} -> HTTP ${response.status}`);
    const html = await response.text();
    const items = parseSourceHtml(html, source.selector);

    return {
      id: source.id,
      name: source.name,
      url: source.url,
      items
    };
  } catch (error) {
    console.error(`[menu] chyba zdroje ${source.url}: ${error.message}`);
    return {
      id: source.id,
      name: source.name,
      url: source.url,
      error: error.message,
      items: []
    };
  }
}

function parseSourceHtml(html, selector) {
  const $ = cheerio.load(html);
  const container = selector.container ? $(selector.container).first() : $.root();
  const itemNodes = container.find(selector.item);

  const items = [];
  itemNodes.each((_, el) => {
    const node = $(el);
    const title = pickText(node, selector.title);
    const price = pickText(node, selector.price);
    const note = pickText(node, selector.note);

    if (!title && !price && !note) return;

    const entry = { title: title || '' };
    if (price) entry.price = price;
    if (note) entry.note = note;
    items.push(entry);
  });

  return items;
}

function pickText(node, selector) {
  if (!selector) return '';
  return node.find(selector).first().text().replace(/\s+/g, ' ').trim();
}

async function fetchWithRetry(url, retries) {
  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'menicka-bot/1.0 (+https://github.com/)'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      console.error(`[menu] pokus ${attempt}/${retries + 1} selhal pro ${url}: ${error.message}`);
      if (attempt <= retries) {
        await wait(500 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readFileOrEmpty(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function orderPayload(payload) {
  return {
    generatedAt: payload.generatedAt,
    sources: payload.sources
  };
}

function orderSource(source) {
  const ordered = {
    id: source.id,
    name: source.name,
    url: source.url
  };

  if (source.error) {
    ordered.error = source.error;
  }

  ordered.items = source.items;
  return ordered;
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
