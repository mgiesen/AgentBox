#!/usr/bin/env python3
"""Behebt typische Markdown-Formatierungsprobleme fuer sauberes PDF-Rendering.
Besonders relevant fuer KI-generiertes Markdown (fehlende Leerzeilen vor Listen)."""

import re
import sys
from pathlib import Path


def fix_list_spacing(content: str) -> str:
    lines = content.split("\n")
    fixed: list[str] = []

    for i, line in enumerate(lines):
        is_list = re.match(r"^(\s*)([-*+]|\d+\.)\s", line)

        if is_list and i > 0:
            prev = lines[i - 1]
            indent = len(is_list.group(1))

            if prev.strip() and not re.match(r"^(\s*)([-*+]|\d+\.)\s", prev):
                if indent == 0:
                    fixed.append("")

        fixed.append(line)

    return "\n".join(fixed)


def linkify_citations(content: str) -> str:
    """Wandelt IEEE-Quellenmarker [N] in klickbare Links zum Quellenverzeichnis um.

    Im Fliesstext: [1] -> [[1]](#ref-1) (Link zum Anker)
    Im Quellenverzeichnis: [1] am Zeilenanfang -> [[1]]{#ref-1} (Anker-Definition)
    """
    lines = content.split("\n")
    result: list[str] = []
    in_references = False
    in_code_block = False
    ref_ids: set[str] = set()

    # Pass 1: Quellenverzeichnis finden und Anker-IDs sammeln
    for line in lines:
        if line.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue
        if re.match(r"^#+\s+Quellenverzeichnis", line):
            in_references = True
            continue
        if in_references:
            m = re.match(r"^[-*]?\s*\[(\d+)\]", line)
            if m:
                ref_ids.add(m.group(1))

    if not ref_ids:
        return content

    # Pass 2: Transformieren
    in_references = False
    in_code_block = False
    for line in lines:
        if line.startswith("```"):
            in_code_block = not in_code_block
            result.append(line)
            continue

        if in_code_block:
            result.append(line)
            continue

        if re.match(r"^#+\s+Quellenverzeichnis", line):
            in_references = True
            result.append(line)
            continue

        if in_references and re.match(r"^#+\s", line):
            in_references = False

        if in_references:
            # Leerzeile vor jedem neuen Eintrag, damit pandoc separate Absaetze erzeugt
            if re.match(r"^[-*]?\s*\[\d+\]", line) and result and result[-1].strip():
                result.append("")
            # Quellenverzeichnis: Anker setzen [N] -> [\[N\]]{#ref-N}
            def _add_anchor(m: re.Match) -> str:
                n = m.group(1)
                return f"[\\[{n}\\]]{{#ref-{n}}}"
            line = re.sub(r"(?<=^)\[(\d+)\]|(?<=^[-*]\s)\[(\d+)\]", lambda m: _add_anchor(re.match(r"\[(\d+)\]", m.group())), line)
            result.append(line)
        else:
            # Fliesstext: Zitate verlinken [N] -> [\[N\]](#ref-N)
            # Nicht matchen wenn: Teil eines Links [text](url), Bild ![alt], Code
            def _add_link(m: re.Match) -> str:
                n = m.group(1)
                if n not in ref_ids:
                    return m.group()
                return f"[\\[{n}\\]](#ref-{n})"
            line = re.sub(r"(?<![!\]\w])\[(\d+)\](?!\()", _add_link, line)
            result.append(line)

    return "\n".join(result)


def fix_markdown(content: str) -> str:
    content = fix_list_spacing(content)
    content = linkify_citations(content)
    return content


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: fix_markdown.py <input.md> [output.md]", file=sys.stderr)
        return 1

    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2]) if len(sys.argv) > 2 else input_file

    if not input_file.exists():
        print(f"Fehler: {input_file} nicht gefunden", file=sys.stderr)
        return 1

    content = input_file.read_text(encoding="utf-8")
    fixed = fix_markdown(content)
    output_file.write_text(fixed, encoding="utf-8")

    if content != fixed:
        print(f"Markdown korrigiert: {output_file}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
