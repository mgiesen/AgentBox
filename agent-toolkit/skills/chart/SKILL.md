---
name: chart
version: "1.1"
description: Diagramme und Charts in der AgentBox erzeugen (Linie, Balken, Kreis) als SVG oder PNG.
compatibility: opencode
features:
  - Linien-, Balken- und Kreisdiagramme aus JSON-Daten als SVG oder PNG erzeugen
  - Mehrere Datenreihen in einem Diagramm darstellen
  - Farbthemen wählen (academic, vibrant, mono, dark)
  - Achsenbeschriftungen, Titel, Breite und Höhe konfigurieren
  - Eigene Hex-Farben per --colors überschreiben
---

# Chart Skill

Erzeugt Diagramme in der AgentBox. Alle Abhängigkeiten sind im Image vorinstalliert; nichts nachinstallieren. OpenCode startet im Arbeitsverzeichnis `/workspace`, deshalb Ein- und Ausgabepfade bevorzugt relativ zum Workspace angeben.

## Befehl

```bash
agentbox-chart <type> --data <json-oder-datei> --output <pfad> [optionen]
```

`<type>` ist `line`, `bar` oder `pie`. Ausgabeformat wird über die Dateiendung bestimmt (`.svg` oder `.png`).

## Beispiele

```bash
agentbox-chart line \
  --data '{"labels":["Q1","Q2","Q3","Q4"],"values":[12,19,8,15],"ylabel":"Anzahl"}' \
  --title "Trend" \
  --output chart.svg

agentbox-chart bar \
  --data '{"labels":["A","B","C"],"values":[30,50,20]}' \
  --theme vibrant \
  --title "Vergleich" \
  --output chart.png

agentbox-chart line \
  --data '{"labels":["2022","2023","2024"],"series":[{"name":"A","values":[10,15,20]},{"name":"B","values":[5,12,18]}]}' \
  --title "Vergleich" \
  --output chart.svg
```

JSON kann direkt als String oder als Pfad zu einer JSON-Datei im Workspace übergeben werden.

## Datenformat

Einzelne Datenreihe:

```json
{ "labels": ["A", "B", "C"], "values": [10, 20, 30] }
```

Mehrere Datenreihen:

```json
{
  "labels": ["2022", "2023", "2024"],
  "series": [
    { "name": "Produkt A", "values": [10, 15, 20] },
    { "name": "Produkt B", "values": [5, 12, 18] }
  ],
  "xlabel": "Jahr",
  "ylabel": "Umsatz (Mio.)"
}
```

## Optionen

| Option | Beschreibung |
| --- | --- |
| `--theme` | Farbthema: `academic`, `vibrant`, `mono`, `dark` |
| `--colors` | Eigene Hex-Farben, kommagetrennt, überschreibt Theme |
| `--title` | Diagrammtitel |
| `--width` | Breite in Zoll |
| `--height` | Höhe in Zoll |
| `--output` | Ausgabepfad (`.svg` oder `.png`) |

## Hinweise

- Ergebnisse immer nach `/workspace` bzw. in einen relativen Pfad schreiben, damit sie in der AgentBox-Dateiansicht sichtbar sind.
- Für wissenschaftliche Berichte ist `--theme academic` der sinnvolle Default.
- Für Präsentationen oder README-Grafiken ist `--theme vibrant` meist besser lesbar.
