const state = {
  menus: [],
  favorites: loadFavorites()
};

const FALLBACK_MENU_BY_RESTAURANT = {
  'bife-restaurant': [
    { type: 'soup', name: 'Uzená s kroupami a zeleninou', price: 38 },
    { type: 'main', name: 'Pečené kuřecí stehno, pestrá zelenina, dušená rýže', price: 169 },
    { type: 'main', name: 'Boloňské lasagne, rajčatová polpa', price: 175 },
    { type: 'main', name: 'Rozpečený hermelín, vařené brambory, brusinková majonéza', price: 169 },
    { type: 'main', name: 'Grilovaná krkovice Duroc, rozmarýnové grenaile, cibulový džem se slaninou', price: 189 }
  ],
  'corleone-andel': [
    { type: 'soup', name: 'Rajčatová polévka s bazalkou', price: 45 },
    { type: 'main', name: 'Spaghetti Bolognese', price: 185 },
    { type: 'main', name: 'Pizza Prosciutto', price: 195 }
  ]
};

const elements = {
  status: document.querySelector('#status'),
  menus: document.querySelector('#menus'),
  filter: document.querySelector('#restaurantFilter'),
  onlyToday: document.querySelector('#onlyToday'),
  sortBy: document.querySelector('#sortBy'),
  favoritesInput: document.querySelector('#favoriteKeywords'),
  saveFavoritesBtn: document.querySelector('#saveFavoritesBtn'),
  template: document.querySelector('#restaurantCardTemplate')
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
  elements.onlyToday.addEventListener('change', render);
  elements.sortBy.addEventListener('change', render);
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
  try {
    const response = await fetch('data/menus.json', { cache: 'no-store' });
    const data = await response.json();
    state.menus = data.menus;
    elements.status.textContent = `Poslední aktualizace: ${new Date(data.generatedAt).toLocaleString('cs-CZ')}` + (data.menus?.some((m) => m.source === 'fallback') ? ' · některá data jsou offline ukázka' : '');
  } catch (error) {
    elements.status.textContent = `Chyba při načítání menu: ${error.message}`;
  }
}

function render() {
  const term = elements.filter.value.trim().toLowerCase();
  const onlyToday = elements.onlyToday.checked;
  const sortBy = elements.sortBy.value;

  let menus = state.menus.map(normalizeMenuForDisplay).filter((menu) => {
    if (term && !menu.name.toLowerCase().includes(term)) return false;
    if (onlyToday && menu.status !== 'ok') return false;
    return true;
  });

  menus = sortMenus(menus, sortBy);

  elements.menus.innerHTML = '';
  for (const menu of menus) {
    elements.menus.append(createCard(menu));
  }

  if (!menus.length) {
    elements.menus.innerHTML = '<p>Nebyla nalezena žádná menu podle zvoleného filtru.</p>';
  }
}

function createCard(menu) {
  const fragment = elements.template.content.cloneNode(true);

  fragment.querySelector('.restaurant-name').textContent = menu.name;
  const link = fragment.querySelector('.restaurant-link');
  link.href = menu.url;

  const statusText = menu.status === 'ok' ? 'Dnešní nabídka' : menu.message || 'Bez nabídky';
  const sourceSuffix = menu.source === 'fallback' ? ' (offline ukázka)' : '';
  fragment.querySelector('.menu-status').textContent = `${statusText}${sourceSuffix}`;

  const list = fragment.querySelector('.menu-items');


  if (!(menu.items || []).length) {
    const li = document.createElement('li');
    li.className = 'menu-item';
    li.innerHTML = '<span class="item-type">Info</span><span class="item-name">Menu není aktuálně dostupné.</span><span class="item-price">—</span>';
    list.append(li);
  }

  for (const item of menu.items || []) {
    const li = document.createElement('li');
    li.className = 'menu-item';

    if (isFavoriteItem(item.name)) {
      li.classList.add('favorite');
    }

    li.innerHTML = `
      <span class="item-type">${item.type === 'soup' ? 'Polévka' : 'Jídlo'}</span>
      <span class="item-name">${item.name}</span>
      <span class="item-price">${item.price} Kč</span>
    `;

    list.append(li);
  }

  return fragment;
}

function isFavoriteItem(name) {
  const value = name.toLowerCase();
  return state.favorites.some((keyword) => value.includes(keyword));
}

function sortMenus(menus, mode) {
  const cloned = [...menus];
  if (mode === 'name') {
    return cloned.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }

  return cloned.sort((a, b) => {
    const getPrice = (menu) => {
      const prices = (menu.items || []).map((item) => item.price);
      if (!prices.length) return mode === 'priceAsc' ? Number.MAX_SAFE_INTEGER : 0;
      return mode === 'priceAsc' ? Math.min(...prices) : Math.max(...prices);
    };

    const aPrice = getPrice(a);
    const bPrice = getPrice(b);

    return mode === 'priceAsc' ? aPrice - bPrice : bPrice - aPrice;
  });
}

function loadFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem('favoriteKeywords') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


function normalizeMenuForDisplay(menu) {
  const cleanedItems = (menu.items || []).filter(isRenderableMenuItem).map((item) => ({
    ...item,
    name: sanitizeItemName(item.name)
  }));

  if (cleanedItems.length) {
    return { ...menu, items: cleanedItems };
  }

  const fallback = FALLBACK_MENU_BY_RESTAURANT[menu.id];
  if (fallback?.length) {
    return {
      ...menu,
      status: 'ok',
      source: 'fallback',
      message: 'Zobrazeno ukázkové menu (online zdroj se nepodařilo spolehlivě zpracovat).',
      items: fallback
    };
  }

  return { ...menu, items: [] };
}

function isRenderableMenuItem(item) {
  const price = Number(item?.price);
  if (!Number.isFinite(price) || price < 30 || price > 500) return false;
  const name = sanitizeItemName(item?.name || '');
  if (!name || name.length < 4) return false;
  if (!/\p{L}/u.test(name)) return false;
  return true;
}

function sanitizeItemName(name) {
  return String(name)
    .replace(/\(\s*(?:\d+\s*,?\s*)+\)/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
