# Meníčka – statická aplikace pro GitHub Pages

Aplikace je navržená tak, aby fungovala na **GitHub Pages** bez vlastního backendu.

## Jak to funguje

- Frontend (`public/index.html`) je čistě statický.
- Data se načítají z `public/data/menus.json`.
- Soubor `menus.json` generuje skript `scripts/generate-menus.js`.
- GitHub Action `.github/workflows/update-menus.yml` pravidelně obnovuje data a commituje změny zpět do repozitáře.

Díky tomu stránka na GitHub Pages funguje bez Node serveru.

## Spuštění lokálně

```bash
node scripts/generate-menus.js
python -m http.server 3000 -d public
```

Pak otevři `http://localhost:3000`.

## Nasazení na GitHub Pages

1. Pushni repozitář na GitHub.
2. V **Settings → Pages** nastav zdroj na větev (typicky `main`) a složku `/public`.
3. Zapni workflow `Update menus data` (Permissions: Read and write).

## Přidání nové restaurace

V `scripts/generate-menus.js` přidej položku do `RESTAURANTS`:

```js
{ id: 'unikatni-id', name: 'Název', url: 'https://...', parser: parseSimpleDailyPage }
```

Pokud má web jiný formát, přidej nový parser.

## Poznámka k dostupnosti zdrojů

Některé weby mohou blokovat automatické načítání. V takovém případě generátor použije ukázkové fallback menu, aby stránka nebyla prázdná.
