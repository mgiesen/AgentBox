#!/usr/bin/env python3
"""Installiert AgentBox-spezifische Skill-Runtime-Abhängigkeiten.

Die Skills deklarieren ihre Container-Runtime in install.yaml. Der Parser
unterstützt bewusst nur den kleinen YAML-Subset, den wir hier brauchen:

runtime:
  apt:
    - paket
  github:
    - name: tool
      repo: owner/repo
      release: latest
      asset: tool-{arch}.tar.xz
      extract: tool-{arch}/tool
      install_as: tool
      arch:
        amd64: x86_64
        arm64: aarch64
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def value(raw: str) -> str:
    raw = raw.strip()
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        return raw[1:-1]
    return raw


def parse_agentbox_yaml(path: Path) -> dict:
    apt: list[str] = []
    github: list[dict] = []
    current_github: dict | None = None
    section = ""
    in_arch = False

    def finish_github() -> None:
        nonlocal current_github
        if current_github:
            github.append(current_github)
            current_github = None

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()

        if indent == 0:
            section = ""
            in_arch = False
            continue
        if indent == 2 and stripped == "apt:":
            finish_github()
            section = "apt"
            in_arch = False
            continue
        if indent == 2 and stripped == "github:":
            finish_github()
            section = "github"
            in_arch = False
            continue

        if section == "apt" and indent == 4 and stripped.startswith("- "):
            apt.append(value(stripped[2:]))
            continue

        if section == "github":
            if indent == 4 and stripped.startswith("- "):
                finish_github()
                current_github = {"arch": {}}
                item = stripped[2:]
                if ":" in item:
                    key, val = item.split(":", 1)
                    current_github[key.strip()] = value(val)
                in_arch = False
                continue
            if current_github is None:
                continue
            if indent == 6 and stripped == "arch:":
                in_arch = True
                continue
            if indent == 6 and ":" in stripped:
                key, val = stripped.split(":", 1)
                current_github[key.strip()] = value(val)
                in_arch = False
                continue
            if indent == 8 and in_arch and ":" in stripped:
                key, val = stripped.split(":", 1)
                current_github["arch"][key.strip()] = value(val)
                continue

    finish_github()
    return {"apt": apt, "github": github}


def collect(toolkit: Path) -> tuple[list[str], list[dict]]:
    apt: list[str] = []
    github: list[dict] = []
    seen_apt: set[str] = set()
    for path in sorted(toolkit.glob("skills/*/install.yaml")):
        data = parse_agentbox_yaml(path)
        for package in data["apt"]:
            if package not in seen_apt:
                seen_apt.add(package)
                apt.append(package)
        github.extend(data["github"])
    return apt, github


def deb_arch() -> str:
    if os.environ.get("TARGETARCH"):
        return os.environ["TARGETARCH"]
    return subprocess.check_output(["dpkg", "--print-architecture"], text=True).strip()


def install_apt(packages: list[str]) -> None:
    if not packages:
        return
    run(["apt-get", "update"])
    run(["apt-get", "install", "-y", "--no-install-recommends", *packages])
    shutil.rmtree("/var/lib/apt/lists", ignore_errors=True)


def install_github_binary(spec: dict, arch: str) -> None:
    name = spec["name"]
    repo = spec["repo"]
    release = spec.get("release", "latest")
    mapped_arch = spec.get("arch", {}).get(arch, arch)
    asset = spec["asset"].format(arch=mapped_arch)
    extract = spec["extract"].format(arch=mapped_arch)
    install_as = spec.get("install_as", name)

    if release == "latest":
        url = f"https://github.com/{repo}/releases/latest/download/{asset}"
    else:
        tag = release if release.startswith("v") else f"v{release}"
        url = f"https://github.com/{repo}/releases/download/{tag}/{asset}"

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        archive = tmpdir / asset
        run(["curl", "-fL", "-o", str(archive), url])
        run(["tar", "-xJf", str(archive), "-C", str(tmpdir)])
        src = tmpdir / extract
        if not src.is_file():
            sys.exit(f"{name}: erwartete Binary nicht gefunden: {src}")
        dest = Path("/usr/local/bin") / install_as
        shutil.copy2(src, dest)
        dest.chmod(0o755)


def write_executable(path: Path, content: str) -> None:
    path.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")
    path.chmod(0o755)


def install_wrappers() -> None:
    """Erzeugt die stabilen AgentBox-Befehle im PATH."""
    bindir = Path("/usr/local/bin")
    write_executable(
        bindir / "agentbox-chart",
        """
        #!/usr/bin/env bash
        set -euo pipefail

        exec python3 /opt/agentbox/agent-toolkit/skills/chart/scripts/chart.py "$@"
        """,
    )
    write_executable(
        bindir / "agentbox-image",
        """
        #!/usr/bin/env bash
        set -euo pipefail

        exec bash /opt/agentbox/agent-toolkit/skills/image/scripts/image.sh "$@"
        """,
    )
    write_executable(
        bindir / "agentbox-pandoc-pdf",
        """
        #!/usr/bin/env bash
        set -euo pipefail

        exec python3 /opt/agentbox/agent-toolkit/skills/pandoc/scripts/build_pdf.py "$@"
        """,
    )
    write_executable(
        bindir / "agentbox-fix-markdown",
        """
        #!/usr/bin/env bash
        set -euo pipefail

        exec python3 /opt/agentbox/agent-toolkit/skills/pandoc/scripts/fix_markdown.py "$@"
        """,
    )
    write_executable(
        bindir / "magick",
        """
        #!/usr/bin/env bash
        set -euo pipefail

        # Ubuntu 24.04 liefert ImageMagick 6. Die Skills sprechen bewusst die
        # ImageMagick-7-CLI `magick`; dieser Wrapper bildet die benötigten
        # Subcommands auf die IM6-Binaries ab.
        if [[ $# -gt 0 ]]; then
            case "$1" in
                animate|compare|composite|conjure|convert|display|identify|import|mogrify|montage|stream)
                    cmd="$1"
                    shift
                    exec "$cmd" "$@"
                    ;;
            esac
        fi

        exec convert "$@"
        """,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--toolkit", required=True, type=Path)
    args = parser.parse_args()

    if not args.toolkit.is_dir():
        sys.exit(f"Toolkit-Verzeichnis nicht gefunden: {args.toolkit}")

    apt, github = collect(args.toolkit)
    print(f"AgentBox Toolkit Runtime: {len(apt)} apt packages, {len(github)} GitHub binaries")
    install_apt(apt)
    arch = deb_arch()
    for spec in github:
        install_github_binary(spec, arch)
    install_wrappers()
    return 0


if __name__ == "__main__":
    sys.exit(main())
