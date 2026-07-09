// Research Report Template — Wissenschaftliche Berichte und Rechercheergebnisse
// Font: Charter (Serif Body), Avenir Next (Headings), Menlo (Code)
// Konventionen: IEEE-Stil Quellenangaben [1], nummerierte Abbildungen/Tabellen/Gleichungen

#let conf(
  title: none,
  subtitle: none,
  authors: (),
  keywords: (),
  date: none,
  abstract-title: none,
  abstract: none,
  thanks: none,
  cols: 1,
  margin: (x: 1.8cm, y: 2.2cm),
  paper: "a4",
  lang: "de",
  region: "DE",
  font: none,
  fontsize: 11pt,
  mathfont: none,
  codefont: none,
  linestretch: 1.5,
  sectionnumbering: "1.1",
  linkcolor: none,
  citecolor: none,
  filecolor: none,
  pagenumbering: "1",
  logo: none,
  version: none,
  briefing: none,
  metrics: (),
  doc,
) = {
  let primary-color = rgb("#013D3E")  // Cyprus — Body-Text, dunkles Grün
  let accent-color = rgb("#179C7D")   // Akzentgrün — Headings, Links, Akzente
  let light-gray = rgb("#EAF3EF")     // Sehr helles Grün — Abstract-/Code-Hintergrund
  let mid-gray = rgb("#6B7B7A")       // Gedämpfter Grau-Grün-Ton — Subtext
  let body-font = if font != none { font } else { ("Charter", "Libertinus Serif") }
  let heading-font = ("Avenir Next", "Libertinus Serif")
  let mono-font = if codefont != none { codefont } else { ("Menlo",) }

  set page(
    paper: paper,
    margin: margin,
    numbering: pagenumbering,
    header: context {
      if counter(page).get().first() > 1 {
        set text(size: 8.5pt, fill: mid-gray, font: body-font)
        if title != none { title }
      }
    },
    footer: context {
      set text(size: 8.5pt, fill: mid-gray, font: body-font)
      grid(
        columns: (1fr, 1fr),
        align: (left, right),
        if authors.len() > 0 {
          if type(authors.first()) == dictionary { authors.first().at("name", default: "") } else { authors.first() }
        } else { [] },
        counter(page).display("1 / 1", both: true),
      )
    },
  )

  set text(
    font: body-font,
    size: fontsize,
    fill: primary-color,
    lang: lang,
    region: region,
  )

  set par(justify: true, leading: linestretch * 0.65em)

  // Nummerierte Ueberschriften
  set heading(numbering: sectionnumbering)

  // Abbildungs- und Quellenverzeichnis starten immer auf eigener Seite.
  // weak: true verhindert eine leere Seite, falls die Vorseite ohnehin endet.
  show heading.where(level: 1): it => {
    let label = it.body
    if label == [Abbildungsverzeichnis] or label == [Quellenverzeichnis] {
      pagebreak(weak: true)
    }
    v(1.4em)
    block(below: 0.8em)[
      #set text(size: 1.4em, weight: "bold", fill: primary-color, font: heading-font)
      #it
    ]
  }

  show heading.where(level: 2): it => {
    v(1em)
    block(below: 0.6em)[
      #set text(size: 1.15em, weight: "semibold", fill: accent-color, font: heading-font)
      #it
    ]
  }

  show heading.where(level: 3): it => {
    v(0.6em)
    block(below: 0.4em)[
      #set text(size: 1.0em, weight: "medium", fill: primary-color, font: heading-font)
      #it
    ]
  }

  // Links
  show link: it => {
    let color = if linkcolor != none { rgb(linkcolor) } else { accent-color }
    set text(fill: color)
    underline(offset: 2pt, stroke: 0.5pt + color, it)
  }

  // Code
  show raw.where(block: true): it => {
    block(
      width: 100%,
      fill: light-gray,
      inset: (x: 14pt, y: 10pt),
      radius: 4pt,
      stroke: 0.5pt + rgb("#CDDED9"),
    )[
      #set text(font: mono-font, size: 0.85em)
      #set par(leading: 0.6em)
      #it
    ]
  }

  show raw.where(block: false): it => {
    box(
      fill: light-gray,
      inset: (x: 4pt, y: 2pt),
      radius: 2pt,
    )[#set text(font: mono-font, size: 0.85em); #it]
  }

  // Abbildungen: Beschriftung unter der Abbildung, nummeriert
  // typst-figure: eigene Nummerierung + supplement "Abb." statt "Abbildung",
  // damit Captions kompakt bleiben (kein redundantes "Abb. N:" im Markdown noetig)
  set figure(numbering: "1", supplement: [Abb.])
  set figure.caption(separator: [: ])
  show figure.caption: it => {
    set text(size: 0.9em, style: "italic", fill: rgb("#444"))
    it
  }

  // Tabellen: Beschriftung ueber der Tabelle
  show figure.where(kind: table): set figure.caption(position: top)
  // Tabellen ueber Seitengrenzen umbrechbar machen — pandoc wickelt Tabellen
  // in figure(), und figure-Bloecke sind by default NICHT breakable, was zum
  // Ueberlauf am Seitenende fuehrt. Der Header wird durch table.header() von
  // pandoc automatisch auf jeder Folgeseite wiederholt.
  show figure.where(kind: table): set block(breakable: true)
  set table(
    inset: 8pt,
    // Feines Gitter in x- und y-Richtung — verbessert Lesbarkeit bei
    // mehreren Datenspalten ohne dominantes Tabellengitter.
    stroke: 0.3pt + rgb("#CDDED9"),
  )
  show table.hline: none
  show table.cell: set align(left)
  show table.cell.where(y: 0): set text(weight: "semibold", fill: primary-color)
  set table(fill: (_, y) => if y == 0 { rgb("#D9EAE3") } else { none })

  // Gleichungen nummeriert
  set math.equation(numbering: "(1)")

  // Inhaltsverzeichnis (pandoc setzt #outline() wenn toc: true)
  show outline: it => {
    block[
      #set text(size: 1.5em, weight: "bold", fill: primary-color, font: heading-font)
      Inhaltsverzeichnis
    ]
    v(0.6cm)
    it
  }
  set outline(title: none, indent: auto, depth: 2)
  show outline.entry: it => {
    let lvl = it.level
    let body-size = if lvl == 1 { 1em } else { 0.9em }
    let body-weight = if lvl == 1 { "semibold" } else { "regular" }
    let body-fill = if lvl == 1 { primary-color } else { mid-gray }
    let above = if lvl == 1 { 0.6em } else { 0.2em }
    block(above: above)[
      #set text(size: body-size, weight: body-weight, fill: body-fill, font: body-font)
      #it
    ]
  }

  // Blockzitate (fuer Quellenangaben)
  show quote: it => {
    block(
      width: 100%,
      inset: (left: 16pt, y: 8pt),
      stroke: (left: 3pt + accent-color),
    )[
      #set text(style: "italic", fill: rgb("#555"))
      #it.body
    ]
  }

  // --- Titelseite (Magazine-Style, mehrseitig fliessend) ---
  if title != none {
    // Titelseite ohne Standard-Header/Footer/Pagenumber.
    // Normales Margin auf allen Seiten — Hero ueberschreibt das obere Margin
    // per negativem Pad auf der ERSTEN Seite. Folgeseiten (wenn Briefing
    // umbricht) bekommen so automatisch ein sauberes oberes Margin.
    set page(
      header: none,
      footer: none,
      numbering: none,
      margin: (left: 1.8cm, right: 1.8cm, top: 2cm, bottom: 1.8cm),
    )

    // ▓▓▓ HERO-BLOCK ▓▓▓ — Cyprus-Bereich oben, ueberschreibt links/rechts/oben
    // die Page-Margin per negativem Pad. So fuellt er die volle Seitenbreite
    // und sitzt buendig am oberen Seitenrand.
    pad(left: -1.8cm, right: -1.8cm, top: -2cm)[
      #block(
        width: 100%,
        fill: primary-color,
        inset: (x: 1.8cm, top: 1.6cm, bottom: 2cm),
      )[
        #set text(fill: white, font: heading-font)
        // Logo oben rechts auf dem Hero-Block
        #if logo != none {
          align(right)[
            #image(logo, height: 1.4cm)
          ]
          v(1.4cm)
        }
        // Label "RESEARCH REPORT · AGENT V<version>" oberhalb des Titels
        #text(size: 0.85em, weight: "medium", tracking: 2pt, fill: accent-color)[
          RESEARCH REPORT#if version != none [ · AGENT V#version]
        ]
        #v(0.3cm)
        #block[
          #set text(size: 2.6em, weight: "bold", fill: white)
          #title
        ]
        #if subtitle != none {
          v(0.3cm)
          block[
            #set text(size: 1.2em, weight: "regular", fill: rgb("#A8D5C7"))
            #subtitle
          ]
        }
      ]
    ]

    // ▓▓▓ RECHERCHEAUFTRAG ▓▓▓ — 1:1 vom Anwender uebernommen (mit Rechtschreib-/
    // Zeichensetzungs-Korrektur). Bricht automatisch ueber mehrere Seiten um.
    if briefing != none {
      v(1.2cm)
      text(size: 0.8em, weight: "bold", tracking: 1.5pt, fill: accent-color, font: heading-font)[RECHERCHEAUFTRAG]
      v(0.35cm)
      block[
        #set text(size: 1em, fill: primary-color)
        #set par(leading: 0.7em, justify: true, first-line-indent: 0pt)
        #briefing
      ]
    }

    // ▓▓▓ ZUSAMMENFASSUNG ▓▓▓ — Abstract, ggf. auf Folgeseite.
    if abstract != none {
      v(1cm)
      text(size: 0.8em, weight: "bold", tracking: 1.5pt, fill: accent-color, font: heading-font)[ZUSAMMENFASSUNG]
      v(0.35cm)
      block[
        #set text(size: 1em, fill: primary-color)
        #set par(leading: 0.7em, justify: true, first-line-indent: 0pt)
        #abstract
      ]
    }

    pagebreak()

    // Ab Folgeseiten: Standard-Layout wiederherstellen
    set page(
      paper: paper,
      margin: margin,
      numbering: pagenumbering,
      header: context {
        if counter(page).get().first() > 1 {
          set text(size: 8.5pt, fill: mid-gray, font: body-font)
          if title != none { title }
        }
      },
      footer: context {
        set text(size: 8.5pt, fill: mid-gray, font: body-font)
        grid(
          columns: (1fr, 1fr),
          align: (left, right),
          if authors.len() > 0 {
            if type(authors.first()) == dictionary { authors.first().at("name", default: "") } else { authors.first() }
          } else { [] },
          counter(page).display("1 / 1", both: true),
        )
      },
    )
    counter(page).update(1)
  }

  // --- Body ---
  set page(columns: cols)
  doc
}
