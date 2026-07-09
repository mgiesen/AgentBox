-- Entfernt explizite Spaltenbreiten aus Pandoc-Tabellen.
--
-- Hintergrund: Wenn eine Markdown-Pipe-Tabelle eine Quellzeile enthaelt, die
-- breiter als --columns (Default 72) ist, gibt pandoc die Spaltenbreiten als
-- Verhaeltnis der Strich-Laengen unter dem Header aus. Bei KI-/Hand-Markdown
-- sind die Striche meist alle gleich lang (`---`) — pandoc setzt dann 1/N je
-- Spalte, unabhaengig vom tatsaechlichen Zellinhalt. Das fuehrt zu unsinnigen
-- Spaltenverhaeltnissen im PDF.
--
-- Dieser Filter setzt die Spaltenbreiten zurueck, sodass das Output-Format
-- (typst/LaTeX/HTML) selbst entscheiden kann.
--
-- Quelle: https://pandoc.org/faqs.html (Issue jgm/pandoc#8139)

function Table (tbl)
  -- Pandoc 2.10+ und alle 3.x nutzen colspecs (Liste von {alignment, width}).
  -- Pandoc <2.10 nutzte tbl.widths. Wir unterstuetzen beides.
  local uses_colspecs = (PANDOC_VERSION[1] > 2) or
                        (PANDOC_VERSION[1] == 2 and PANDOC_VERSION[2] >= 10)
  if uses_colspecs then
    tbl.colspecs = tbl.colspecs:map(function (colspec)
      local align = colspec[1]
      return {align, nil}  -- nil = default width (= keine fixe Breite)
    end)
  else
    for i, _ in ipairs(tbl.widths) do
      tbl.widths[i] = 0
    end
  end
  return tbl
end
