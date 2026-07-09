#!/usr/bin/env python3
"""Erzeugt ein JSON-Manifest aller eingebackenen Agents und Skills.

Liest die Frontmatter-Blöcke aus
- agent-toolkit/agents/*.md
- agent-toolkit/skills/*/SKILL.md
und schreibt eine kompakte Zusammenfassung nach /srv/agent-toolkit.json.
Aufruf zur Build-Zeit im Dockerfile — das Manifest wird statisch
ausgeliefert und im Werkzeuge-Modal des Frontends gerendert.

Bewusst ohne PyYAML: unsere Frontmatter ist ein begrenzter YAML-Subset
(flache `key: value`-Paare plus optionale `features:`-Liste). Stdlib
reicht; weniger Abhängigkeiten im Build.
"""

import argparse
import json
import re
import sys
from pathlib import Path


FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---", re.DOTALL)


def parse_frontmatter(text: str) -> dict:
    """Parst den Frontmatter-Block eines Markdown-Dokuments.

    Unterstützt: skalare Felder (key: value), Listen-Felder (key: \n  - item).
    Hochkommas um den Wert werden entfernt; Werte werden als String belassen.
    """
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}

    result: dict = {}
    current_list_key: str | None = None
    for raw_line in match.group(1).splitlines():
        # Listen-Eintrag fortsetzen
        if current_list_key and raw_line.startswith("  - "):
            result[current_list_key].append(raw_line[4:].strip())
            continue
        if current_list_key and (not raw_line.strip() or raw_line.startswith(" ")):
            # Leere oder weiter eingerückte Zeile beendet die Liste nicht
            continue
        current_list_key = None

        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        if ":" not in raw_line:
            continue
        key, _, value = raw_line.partition(":")
        key = key.strip()
        value = value.strip()
        if value == "":
            # Listen-Start (z.B. "features:")
            result[key] = []
            current_list_key = key
            continue
        # Quotes entfernen
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        result[key] = value
    return result


def load_agent(path: Path) -> dict:
    """Agent-Frontmatter + Name (aus Dateiname) sammeln."""
    fm = parse_frontmatter(path.read_text(encoding="utf-8"))
    return {
        "name": path.stem,
        "version": fm.get("version", ""),
        "description": fm.get("description", ""),
        "mode": fm.get("mode", ""),
    }


def load_skill(path: Path) -> dict:
    """SKILL.md-Frontmatter parsen; Name aus Frontmatter oder Ordnername."""
    fm = parse_frontmatter(path.read_text(encoding="utf-8"))
    return {
        "name": fm.get("name", path.parent.name),
        "version": fm.get("version", ""),
        "description": fm.get("description", ""),
        "features": fm.get("features", []) if isinstance(fm.get("features"), list) else [],
    }


def build_manifest(toolkit_dir: Path) -> dict:
    agents_dir = toolkit_dir / "agents"
    skills_dir = toolkit_dir / "skills"

    agents = []
    if agents_dir.is_dir():
        for path in sorted(agents_dir.glob("*.md")):
            agents.append(load_agent(path))

    skills = []
    if skills_dir.is_dir():
        for skill_dir in sorted(p for p in skills_dir.iterdir() if p.is_dir()):
            skill_md = skill_dir / "SKILL.md"
            if skill_md.is_file():
                skills.append(load_skill(skill_md))

    return {"agents": agents, "skills": skills}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--toolkit", required=True, type=Path,
                        help="Pfad zum agent-toolkit-Verzeichnis (mit agents/ und skills/)")
    parser.add_argument("--output", required=True, type=Path,
                        help="Pfad zur JSON-Ausgabedatei")
    args = parser.parse_args()

    if not args.toolkit.is_dir():
        print(f"toolkit-Pfad existiert nicht: {args.toolkit}", file=sys.stderr)
        return 1

    manifest = build_manifest(args.toolkit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {args.output} "
          f"({len(manifest['agents'])} agents, {len(manifest['skills'])} skills)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
