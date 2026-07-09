---
name: pandoc
version: "2.1"
description: Dokumente in der AgentBox mit pandoc und typst konvertieren, insbesondere Markdown zu PDF, Word, PowerPoint, EPUB und HTML.
compatibility: opencode
features:
  - Markdown zu PDF konvertieren (typst-Engine, optionales Typst-Template)
  - Markdown zu Word (.docx), PowerPoint (.pptx), EPUB und HTML konvertieren
  - Word/PPTX zurück zu Markdown extrahieren
  - Inhaltsverzeichnis, Abschnittsnummerierung und Syntax-Highlighting konfigurieren
  - KI-generiertes Markdown vorbereiten (Listen-Spacing, IEEE-Zitations-Linkung)
---

# Pandoc Skill

Dokumentkonvertierung in der AgentBox via `pandoc`, `typst` und Ghostscript. Alle Abhängigkeiten sind im Image vorinstalliert; nichts nachinstallieren. OpenCode startet in `/workspace`, deshalb Ein- und Ausgabepfade bevorzugt relativ zum Workspace angeben.

## Markdown zu PDF

Empfohlener Weg ist der AgentBox-Helper. Er korrigiert typisches KI-Markdown, entfernt problematische Pandoc-Tabellenbreiten für typst und nutzt Ghostscript zur optionalen PDF-Verkleinerung.

```bash
agentbox-pandoc-pdf --input report.md --output report.pdf
```

Mit eigenem Typst-Template:

```bash
agentbox-pandoc-pdf \
  --input report.md \
  --output report.pdf \
  --template templates/report.typ
```

Mit zusätzlichen Pandoc-Variablen:

```bash
agentbox-pandoc-pdf \
  --input report.md \
  --output report.pdf \
  -V toc=true \
  -V "title=Mein Dokument"
```

Wichtige Optionen:

| Option | Beschreibung |
| --- | --- |
| `--template FILE` | Typst-Template; relativer oder absoluter Pfad |
| `-V key=value` | Pandoc-/Typst-Variable setzen, mehrfach möglich |
| `--skip-fix` | Markdown-Vorverarbeitung überspringen |
| `--keep-table-widths` | Pandoc-Tabellenbreiten behalten |
| `--no-optimize` | Ghostscript-Komprimierung überspringen |

## Markdown vorbereiten

Wenn nur die Markdown-Korrektur benötigt wird:

```bash
agentbox-fix-markdown input.md output_fixed.md
```

Der Helper behebt fehlende Leerzeilen vor Listen und verlinkt IEEE-Zitate `[1]` zum Quellenverzeichnis, wenn ein Quellenverzeichnis vorhanden ist.

## Markdown zu Word

```bash
pandoc input.md -o output.docx
pandoc input.md --toc -o output.docx
pandoc input.md --reference-doc=template.docx -o output.docx
pandoc input.md -s --metadata title="Dokumenttitel" -o output.docx
```

## Markdown zu PowerPoint

Pandoc erzeugt direkt Präsentationen. Überschriften strukturieren die Folien:

- `# Heading 1` erzeugt eine Abschnittstrenner-Folie
- `## Heading 2` erzeugt eine neue Folie
- `---` erzeugt eine manuelle Folientrennung

```bash
pandoc input.md -o output.pptx
pandoc input.md --reference-doc=template.pptx -o output.pptx
pandoc input.md --slide-level=2 -o output.pptx
```

## Markdown zu EPUB

```bash
pandoc input.md -o output.epub
pandoc input.md --epub-cover-image=cover.jpg \
  --metadata title="Buchtitel" \
  --metadata author="Autor" \
  --toc \
  -o output.epub
```

## Markdown zu HTML

Für KI-generiertes Markdown bevorzugt `-f gfm`, damit Listen und Tabellen zuverlässig interpretiert werden.

```bash
pandoc -f gfm -s --embed-resources --standalone input.md -o output.html
pandoc -f gfm -s -H styling.html input.md -o output.html
```

## Word zu Markdown

```bash
pandoc input.docx -o output.md
pandoc input.docx --track-changes=all -o output.md
```

## Templates

Der Skill bringt einen internen Pandoc-Wrapper für typst mit. Fachliche oder Corporate-Design-Templates bleiben Eingaben des jeweiligen Projekts oder Agents. Übergib Template-Pfade relativ zu `/workspace` oder absolut.

Typst-Templates lesen üblicherweise YAML-Frontmatter-Variablen wie `title`, `subtitle`, `author`, `date`, `abstract`, `toc` und `toc-depth`. Das konkrete Set hängt vom Template ab.

## Hinweise

- Ergebnisse immer nach `/workspace` bzw. in einen relativen Pfad schreiben, damit sie in der AgentBox-Dateiansicht sichtbar sind.
- Für PDF immer zuerst `agentbox-pandoc-pdf` verwenden; direkte `pandoc`-Aufrufe sind nur nötig, wenn ein anderes Ausgabeformat gebraucht wird.
- Wenn typst absolute Pfade nicht auflösen kann: Der Helper setzt bereits `--pdf-engine-opt=--root=/`; bei manuellen Aufrufen muss diese Option ebenfalls gesetzt werden.
