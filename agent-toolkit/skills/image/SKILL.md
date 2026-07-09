---
name: image
version: "1.4"
description: Bilder in der AgentBox herunterladen, konvertieren, skalieren, zuschneiden, drehen, optimieren, untersuchen und zu Collagen zusammenbauen.
compatibility: opencode
features:
  - Bilder von URLs herunterladen und in ein anderes Format konvertieren
  - Bilder skalieren (Pixel oder Prozent) und zuschneiden
  - SVG zu PNG mit konfigurierbarem DPI konvertieren
  - Dateigröße ohne sichtbaren Qualitätsverlust optimieren
  - Metadaten (Format, Dimensionen, Dateigröße, Farbraum) auslesen
  - Mehrere Bilder zu Collagen oder NxM-Grids zusammenbauen
---

# Image Skill

Bildverarbeitung in der AgentBox via ImageMagick. Alle Abhängigkeiten sind im Image vorinstalliert; nichts nachinstallieren. OpenCode startet in `/workspace`, deshalb Ein- und Ausgabepfade bevorzugt relativ zum Workspace angeben.

## Befehl

```bash
agentbox-image <command> [optionen]
```

## Herunterladen

```bash
agentbox-image download "https://example.com/photo.png" --output bild.webp
agentbox-image download "https://example.com/photo.png" --output bild.jpg --max-size 800 --quality 90
```

## Konvertieren

```bash
agentbox-image convert input.png --output output.webp
agentbox-image convert input.jpg --output output.png
agentbox-image convert input.svg --output output.png --density 300
```

## Skalieren

```bash
agentbox-image resize input.png --output klein.png --size 800x600
agentbox-image resize input.png --output halb.png --percent 50
```

## Zuschneiden

```bash
agentbox-image crop input.png --output cropped.png --geometry 400x300+100+50
agentbox-image crop input.png --output cropped.png --gravity center --size 1200x630
```

## Drehen

```bash
agentbox-image rotate input.png --output gedreht.png --degrees 90
```

## Optimieren

```bash
agentbox-image optimize input.png --output optimiert.png
agentbox-image optimize input.jpg --output optimiert.jpg --quality 85
```

## Metadaten

```bash
agentbox-image info bild.png
```

## Collage

Mehrere Bilder zu einer Reihe, Spalte oder einem Raster zusammenbauen. Inputs mit abweichendem Seitenverhältnis werden im Default-Modus `cover` proportional gecroppt, sodass jede Zelle exakt ins gewünschte Format passt.

```bash
agentbox-image collage a.jpg b.jpg c.jpg d.jpg --output grid.jpg --tile 2x2 --gap 20
agentbox-image collage *.jpg --output square.jpg --tile 3x3 --cell-size 1080x1080
agentbox-image collage frame*.png --output sheet.jpg --tile 4x3 --cell-size 1600x900 --gap 8
agentbox-image collage *.jpg --output portrait.jpg --tile 2x2 --cell-size 1200x1600 --background "#111"
agentbox-image collage a.jpg b.jpg c.jpg --output contain.jpg --tile 3x1 --cell-size 600x600 --fit contain
```

Wichtige Flags:

| Option | Beschreibung |
| --- | --- |
| `--tile CxR` | Spalten mal Reihen; Default ist alle Bilder in einer Reihe |
| `--cell-size WxH` | Zellgröße in Pixel |
| `--fit` | `cover`, `contain`, `stretch` oder `none` |
| `--gap N` | Abstand in Pixel |
| `--background COLOR` | Hintergrundfarbe als Name oder Hex-Wert |

## Hinweise

- Ergebnisse immer nach `/workspace` bzw. in einen relativen Pfad schreiben, damit sie in der AgentBox-Dateiansicht sichtbar sind.
- Temporäre Zwischenstände gehören nach `/tmp`.
- Für gleichmäßige Grids `--fit cover` verwenden; für vollständig sichtbare Bilder `--fit contain`.
