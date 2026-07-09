# Frontend

Statisches Frontend in `frontend/`. **Kein Build-Schritt** — keine npm-Toolchain, kein Bundler, kein Compile. Caddy serviert die Dateien direkt; der Browser löst ES-Module nativ auf.

## Verzeichnis

```
frontend/
├── index.html        Markup, ~120 LOC; lädt /css/app.css und /js/app.js als ES-Modul
├── css/app.css       Stylesheet
├── icons/sprite.svg  SVG-Sprite, alle UI-Icons als <symbol id="...">
├── assets/           Logo
└── js/               13 ES-Module
    ├── app.js        Entry: importiert + initialisiert alle Module
    ├── api.js        fetch-Wrapper für /api/*
    ├── files.js      Baum-Listing, Render, Ordner-, Single- und Bulk-Aktionen
    ├── menu.js       Kontextmenü (Single + Bulk)
    ├── upload.js     Upload + Drag&Drop + Progress
    ├── selection.js  Multi-Selection-State + Toolbar
    ├── sidebar.js    Sidebar-Toggle
    ├── help.js       Anleitung-Modal (Tabbed)
    ├── config.js     Settings-Modal + Restart-Button
    ├── modals.js     Generische promptModal, confirmModal, tabbedModal
    ├── sse.js        Live-Sync via EventSource
    ├── icons.js      Datei-Typ-Icons (mappt Endung → Sprite-ID)
    └── format.js     fmtSize, fmtTime
```

Jedes Modul ist deutlich unter 200 LOC. Cross-Imports sind erlaubt; circular Imports zwischen `files.js` ↔ `menu.js` lösen sich auf, weil die geteilten Funktionen erst in Event-Handlern aufgerufen werden (deferred), nicht beim Modul-Laden.

## Warum kein Bundler?

Feature-Scope ist bewusst klein: Header-Menü, Sidebar mit Dateibaum, optional künftig ein Agent-Dropdown. Bei dieser Codegröße lohnt kein Toolchain-Aufwand. ES-Module sind seit ~2018 in allen relevanten Browsern; sie ersetzen funktional, was früher ein Bundler tat. Wenn das Frontend doch wachsen sollte (Editor inline, mehrere Tabs, Realtime-Cursors), wäre **Preact + htm via ESM-CDN** der nächste sinnvolle Schritt — weiter ohne Bundler.

## SVG-Sprite

Alle UI-Icons leben in `frontend/icons/sprite.svg` als `<symbol id="...">`-Einträge. Markup referenziert sie:

```html
<svg class="icon" width="20" height="20" aria-hidden="true">
  <use href="/icons/sprite.svg#book-open"/>
</svg>
```

Quelle der Symbole: überwiegend [Lucide](https://lucide.dev)-Icons, ein Phosphor (`file-pdf`, da Lucide kein PDF-Symbol hat) und zwei "Bold"-Varianten (`check-bold`, `minus-bold`) für die kleinen 10×10-Checkboxen. Die Lucide-Defaults mit `stroke-width=2` wirken bei dieser Größe zu dünn.

`currentColor` läuft via CSS-`color`-Cascade durch — Themes (Hover, Selected, Danger) funktionieren wie bei inline-SVG. Dass die Sprite-Datei extern liegt (statt inline ins HTML eingefügt) bedeutet, dass CSS-Selektoren nicht durch die Symbol-Boundary durchgreifen können; die Symbole müssen ihre Stroke-Werte selbst tragen.

### Icon hinzufügen

```bash
python3 ~/.config/opencode/skills/iconify/scripts/iconify.py download lucide:NAME --output /tmp/NAME.svg
```

Inhalt von `<svg>` zu `<symbol id="NAME" viewBox="0 0 24 24">…</symbol>` umwandeln und in `frontend/icons/sprite.svg` einfügen.

## Modal-Architektur

`modals.js` exportiert drei generische Modal-Typen:

| Funktion | Layout | Einsatz |
|---|---|---|
| `promptModal(title, label, default)` | Single-Page mit Input | Dateinamen abfragen (z.B. Rename) |
| `confirmModal(title, msg, okLabel, variant)` | Single-Page mit Bestätigung | Lösch-Bestätigungen, OpenCode-Restart |
| `tabbedModal({ title, tabs, initialTab, closeLabel })` | Sidebar links + Inhalt rechts | Mehrseitige Inhalte wie die Anleitung |

`tabbedModal` setzt das ARIA-Tab-Pattern um (`role="tablist" / "tab" / "tabpanel"`, `aria-selected`, `aria-controls`). Pfeiltasten / Home / End auf einem Tab navigieren. ESC und Klick auf den Backdrop schließen, Footer-Button auch.

Feature-spezifische Modale (Konfigurations-Editor in `config.js`) bauen ihren Backdrop weiterhin direkt — sie brauchen Layout, das in der generischen Helper-Signatur zu eng wäre.

## Live-Sync

`sse.js` öffnet `EventSource('/api/events')` und triggert `files.refresh()` bei jedem `refresh`-Event sowie initial bei `hello`. Heartbeats (`: ping`) der Files-API alle 15 s halten die Verbindung am Leben. Browser-seitig kommt automatisches Reconnect mit `retry: 2000`.

## Was Du beim Erweitern beachten solltest

- **Feste DOM-IDs.** Markup-IDs wie `files-list`, `select-all-btn`, `bulk-menu-btn` sind die Schnittstelle zwischen HTML und JS. Beim Umbenennen müssen beide Seiten gleichzeitig.
- **Keine globalen Variablen.** Module kapseln ihren State; was geteilt werden muss, läuft über Exports.
- **Kein neues CSS-Framework.** OpenProps liefert die Design-Tokens; alles andere ist handgeschrieben in `css/app.css`. Tailwind o.ä. wäre für die Code-Menge eine Mehrbelastung.
