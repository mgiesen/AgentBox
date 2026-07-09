#!/usr/bin/env python3
"""Markdown -> PDF via pandoc + typst.

AgentBox-Helper. Erwartet, dass der Aufrufer optionale Template-Pfade
aus dem Workspace oder aus einem Agent/Skill-Verzeichnis selbst uebergibt.

Pipeline:
  1. fix_markdown.py (Listen-Spacing, optional IEEE-Zitations-Linkung)
  2. pandoc --pdf-engine=typst mit -V template=<abs-path> + --root=/

Usage:
  build_pdf.py --input report.md --output report.pdf \\
    --template /abs/path/to/template.typ

  # ohne Template: pandoc-Default
  build_pdf.py --input report.md --output report.pdf

  # zusaetzliche pandoc-Variablen
  build_pdf.py --input r.md --output r.pdf \\
    --template tpl.typ -V mainfont="Helvetica Neue" -V toc=true
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
FIX_MARKDOWN = SCRIPT_DIR / "fix_markdown.py"
NOWIDTHS_LUA = SCRIPT_DIR / "nowidths.lua"
PANDOC_TYPST_TEMPLATE = SCRIPT_DIR / "pandoc-typst.template"


def require(binary: str) -> None:
    if shutil.which(binary) is None:
        sys.exit(
            f"FEHLT: {binary} nicht im PATH. Das AgentBox-Image ist unvollstaendig "
            "und muss neu gebaut werden."
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, help="Markdown-Eingabedatei")
    parser.add_argument("--output", required=True, help="PDF-Ausgabedatei")
    parser.add_argument("--template", help="Absoluter Pfad zum Typst-Template (.typ). Optional.")
    parser.add_argument("-V", "--var", action="append", default=[],
                        help="Pandoc-Variable, mehrfach: -V key=value")
    parser.add_argument("--skip-fix", action="store_true",
                        help="fix_markdown.py-Vorverarbeitung ueberspringen")
    parser.add_argument("--keep-table-widths", action="store_true",
                        help="Pandoc-Spaltenbreiten in Tabellen NICHT entfernen "
                             "(Default: nowidths.lua-Filter aktiv, damit typst "
                             "die Spaltenbreiten selbst bestimmt)")
    parser.add_argument("--no-optimize", action="store_true",
                        help="Ghostscript-Postprocessing zur PDF-Verkleinerung "
                             "ueberspringen (Default: optimieren, wenn gs "
                             "verfuegbar — verkleinert PDFs mit Bildern stark)")
    args = parser.parse_args()

    require("pandoc")
    require("typst")

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    if not input_path.is_file():
        sys.exit(f"Input nicht gefunden: {input_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if args.template:
        template_path = Path(args.template).resolve()
        if not template_path.is_file():
            sys.exit(f"Template nicht gefunden: {template_path}")
    else:
        template_path = None

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        if args.skip_fix:
            fixed = input_path
        else:
            fixed = tmp_dir / "input_fixed.md"
            subprocess.run(
                [sys.executable, str(FIX_MARKDOWN), str(input_path), str(fixed)],
                check=True,
            )

        cmd: list[str] = [
            "pandoc", str(fixed),
            "-f", "markdown+autolink_bare_uris",
            "--pdf-engine=typst",
            "--pdf-engine-opt=--root=/",
            "--template", str(PANDOC_TYPST_TEMPLATE),
            "-o", str(output_path),
        ]
        if not args.keep_table_widths:
            cmd += ["--lua-filter", str(NOWIDTHS_LUA)]
        if template_path is not None:
            cmd += ["-V", f"template={template_path}"]
        for v in args.var:
            cmd += ["-V", v]

        subprocess.run(cmd, check=True)

    # Optionale Ghostscript-Komprimierung (typst bettet WebP/PNG unkomprimiert
    # ein — gs reduziert das auf ~20 % der Ausgangsgroesse bei /printer-Qualitaet)
    if not args.no_optimize and shutil.which("gs"):
        size_before = output_path.stat().st_size
        tmp_optimized = output_path.with_suffix(".optimized.pdf")
        try:
            subprocess.run(
                ["gs", "-sDEVICE=pdfwrite", "-dPDFSETTINGS=/printer",
                 "-dNOPAUSE", "-dQUIET", "-dBATCH",
                 f"-sOutputFile={tmp_optimized}", str(output_path)],
                check=True,
            )
            size_after = tmp_optimized.stat().st_size
            if size_after < size_before:
                tmp_optimized.replace(output_path)
                print(f"PDF erzeugt: {output_path} "
                      f"({size_before // 1024} KB -> {size_after // 1024} KB)")
                return 0
            tmp_optimized.unlink(missing_ok=True)
        except subprocess.CalledProcessError:
            tmp_optimized.unlink(missing_ok=True)

    print(f"PDF erzeugt: {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
