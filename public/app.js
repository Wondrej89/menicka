const state = {
  generatedAt: null,
  sources: [],
  favorites: loadFavorites()
};

const elements = {
  status: document.querySelector('#status'),
  menus: document.querySelector('#menus'),
  filter: document.querySelector('#restaurantFilter'),
  favoritesInput: document.querySelector('#favoriteKeywords'),
  saveFavoritesBtn: document.querySelector('#saveFavoritesBtn')
};

elements.favoritesInput.value = state.favorites.join(', ');

init();

async function init() {
  bindEvents();
  await loadMenus();
  render();
}

function bindEvents() {
  elements.filter.addEventListener('input', render);
  elements.saveFavoritesBtn.addEventListener('click', () => {
    state.favorites = elements.favoritesInput.value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    localStorage.setItem('favoriteKeywords', JSON.stringify(state.favorites));
    render();
  });
}

async function loadMenus() {
  elements.status.textContent = 'Načítám nabídky...';

  const base = new URL('.', window.location.href);
  const menuUrl = new URL('../data/menu.json', base);

  try {
    const response = await fetch(menuUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    state.generatedAt = data.generatedAt;
    state.sources = Array.isArray(data.sources) ? data.sources : [];

    elements.status.textContent = state.generatedAt
      ? `Poslední aktualizace: ${new Date(state.generatedAt).toLocaleString('cs-CZ')}`
      : 'Data načtena.';
  } catch (error) {
    elements.status.textContent = `Nepodařilo se načíst data menu: ${error.message}`;
    state.sources = [];
  }
}

function render() {
  const term = elements.filter.value.trim().toLowerCase();
  let sources = state.sources;

  if (term) {
    sources = sources.filter((source) => source.name.toLowerCase().includes(term));
  }

  elements.menus.innerHTML = '';

  for (const source of sources) {
    elements.menus.append(createCard(source));
  }

  if (!sources.length) {
    elements.menus.innerHTML = '<p>Nebyla nalezena žádná menu podle zvoleného filtru.</p>';
  }
}

function createCard(source) {
  const article = document.createElement('article');
  article.className = 'restaurant-card';

  const header = document.createElement('header');
  const title = document.createElement('h3');
  title.className = 'restaurant-name';
  title.textContent = source.name;

  const link = document.createElement('a');
  link.className = 'restaurant-link';
  link.href = source.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Web restaurace';

  header.append(title, link);
  article.append(header);

  const status = document.createElement('p');
  status.className = 'menu-status';

  if (source.error) {
    status.textContent = `Nepodařilo se načíst menu (${source.error})`;
    status.classList.add('menu-status-error');
  } else {
    status.textContent = 'Nabídka';
  }

  article.append(status);

  const list = document.createElement('ul');
  list.className = 'menu-items';

  const items = Array.isArray(source.items) ? source.items : [];
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'menu-item';
    li.innerHTML = '<span class="item-type">Info</span><span class="item-name">Menu není dostupné.</span><span class="item-price">—</span>';
    list.append(li);
  }

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'menu-item';

    if (isFavoriteItem(item.title || '')) {
      li.classList.add('favorite');
    }

    li.innerHTML = `
      <span class="item-type">${isSoup(item.title || '') ? 'Polévka' : 'Jídlo'}</span>
      <span class="item-name">${item.title || ''}${item.note ? ` (${item.note})` : ''}</span>
      <span class="item-price">${item.price || '—'}</span>
    `;

    list.append(li);
  }

  article.append(list);
  return article;
}

function isFavoriteItem(name) {
  const value = (name || '').toLowerCase();
  return state.favorites.some((keyword) => value.includes(keyword));
}

function isSoup(name) {
  const low = (name || '').toLowerCase();
  return ['polévka', 'polevka', 'soup', 'vývar', 'vyvar', 'krém', 'krem'].some((token) => low.includes(token));
}

function loadFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem('favoriteKeywords') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
