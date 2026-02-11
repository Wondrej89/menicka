# Meníčka – agregátor poledních nabídek

Jednoduchá webová aplikace, která:

- načte menu vybraných restaurací z jejich webů,
- sjednotí výstup na společný formát (polévka / hlavní jídla / cena),
- ověřuje dostupnost dnešní nabídky (včetně týdenních menu),
- umožní v prohlížeči filtrovat a řadit restaurace,
- obsahuje základ pro budoucí práci s oblíbenými jídly přes klíčová slova,
- při nedostupnosti online zdroje zobrazí ukázkové offline menu, aby stránka nebyla prázdná.

## Spuštění

```bash
npm install
npm start
```

Aplikace poběží na `http://localhost:3000`.

## Přidání nové restaurace

V souboru `server.js` přidejte položku do pole `RESTAURANTS`:

```js
{
  id: 'unikatni-id',
  name: 'Název restaurace',
  url: 'https://...',
  parser: parseSimpleDailyPage // nebo vlastní parser
}
```

Pokud má restaurace specifický formát, vytvořte nový parser funkcí podobně jako `parseWeeklyPage`.

## Poznámka

Weby restaurací se mohou měnit. Pokud parser přestane fungovat, je potřeba jej upravit podle aktuální struktury stránky.

Pokud není možné z online zdroje menu stáhnout (např. blokace sítě), API vrací ukázkové offline menu se `source: "fallback"`.
