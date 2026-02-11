# Meníčka (GitHub Pages + automatická aktualizace dat)

Tento projekt je statický web pro GitHub Pages.

- Frontend běží jako statické soubory v `public/`.
- Data se generují skriptem `scripts/fetch-menu.mjs`.
- Výstup je v `data/menu.json` (+ `data/menu.meta.json`).
- GitHub Actions workflow `.github/workflows/update-menu.yml` data pravidelně aktualizuje a commituje.

## Struktura

- `scripts/fetch-menu.mjs` – stažení + parsování + normalizace menu
- `data/menu.json` – data pro frontend
- `public/index.html`, `public/app.js`, `public/styles.css` – statický frontend
- `.github/workflows/update-menu.yml` – plánovaná aktualizace dat

## Lokální spuštění

```bash
npm ci
npm run update-menu
python -m http.server 3000
```

Pak otevři:
- `http://localhost:3000/public/index.html`

## Konfigurace zdrojů

Ve `scripts/fetch-menu.mjs` uprav pole `SOURCES` (URL + CSS selektory).

## Poznámky

- Skript má timeout, retry a je odolný proti chybě jednotlivého zdroje.
- Při chybě zdroje se zapíše `error` a `items: []`, ale běh pokračuje.
- Pokud se `data/menu.json` nezmění, soubor se nepřepíše.
