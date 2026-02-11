function normalize(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

class Selection {
  constructor(htmlChunks = []) {
    this.htmlChunks = htmlChunks;
    this.length = htmlChunks.length;
  }

  first() {
    return new Selection(this.length ? [this.htmlChunks[0]] : []);
  }

  find(selector) {
    const all = [];
    for (const html of this.htmlChunks) {
      all.push(...findBySelector(html, selector));
    }
    return new Selection(all);
  }

  each(cb) {
    this.htmlChunks.forEach((chunk, i) => cb(i, chunk));
  }

  text() {
    return normalize(this.htmlChunks.map(stripTags).join(' '));
  }
}

function findBySelector(html, selector) {
  if (!selector) return [];
  if (selector.startsWith('.')) {
    const cls = selector.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<([a-zA-Z0-9]+)([^>]*class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*)>([\\s\\S]*?)<\\/\\1>`, 'g');
    const out = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      out.push(m[0]);
    }
    return out;
  }
  return [];
}

function stripTags(html) {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
}

export function load(html) {
  const root = new Selection([html]);

  function $(input) {
    if (typeof input === 'string') return root.find(input);
    if (typeof input === 'object') return new Selection([String(input)]);
    return new Selection([]);
  }

  $.root = () => root;
  return $;
}
