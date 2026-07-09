#!/usr/bin/env python3
"""Erzeugt Diagramme als SVG oder PNG. Unterstuetzt Linien-, Balken- und Kreisdiagramme
mit konfigurierbaren Farbthemen."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ──────────────────────────────────────────────────────────────
# Themes
# ──────────────────────────────────────────────────────────────

THEMES = {
    "academic": {
        "colors": ["#2d5f9a", "#c0392b", "#27ae60", "#8e44ad", "#e67e22", "#16a085", "#7f8c8d"],
        "font_family": "serif",
        "font_serif": ["DejaVu Serif", "Liberation Serif", "Charter", "Georgia"],
        "bg": "white",
        "grid_alpha": 0.3,
        "title_size": 11,
        "label_size": 10,
        "spines_top": False,
        "spines_right": False,
    },
    "vibrant": {
        "colors": ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"],
        "font_family": "sans-serif",
        "font_serif": ["DejaVu Sans", "Liberation Sans", "Arial"],
        "bg": "white",
        "grid_alpha": 0.15,
        "title_size": 13,
        "label_size": 11,
        "spines_top": False,
        "spines_right": False,
    },
    "mono": {
        "colors": ["#374151", "#6b7280", "#9ca3af", "#d1d5db", "#4b5563", "#1f2937", "#e5e7eb"],
        "font_family": "sans-serif",
        "font_serif": ["DejaVu Sans", "Liberation Sans", "Arial"],
        "bg": "white",
        "grid_alpha": 0.2,
        "title_size": 11,
        "label_size": 10,
        "spines_top": False,
        "spines_right": False,
    },
    "dark": {
        "colors": ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#22d3ee"],
        "font_family": "sans-serif",
        "font_serif": ["DejaVu Sans", "Liberation Sans", "Arial"],
        "bg": "#1e1e2e",
        "fg": "#cdd6f4",
        "grid_alpha": 0.15,
        "title_size": 13,
        "label_size": 11,
        "spines_top": False,
        "spines_right": False,
    },
}


def apply_theme(theme_name: str) -> dict:
    theme = THEMES.get(theme_name, THEMES["academic"])
    fg = theme.get("fg", "#1a1a2e")
    plt.rcParams.update({
        "font.family": theme["font_family"],
        "font.serif": theme["font_serif"],
        "font.sans-serif": theme["font_serif"],
        "font.size": theme["label_size"],
        "axes.titlesize": theme["title_size"],
        "axes.labelsize": theme["label_size"],
        "axes.spines.top": theme["spines_top"],
        "axes.spines.right": theme["spines_right"],
        "axes.grid": True,
        "axes.facecolor": theme["bg"],
        "axes.edgecolor": fg,
        "axes.labelcolor": fg,
        "axes.titlecolor": fg,
        "grid.alpha": theme["grid_alpha"],
        "grid.linestyle": "--",
        "figure.facecolor": theme["bg"],
        "figure.dpi": 150,
        "savefig.bbox": "tight",
        "savefig.pad_inches": 0.15,
        "savefig.facecolor": theme["bg"],
        "text.color": fg,
        "xtick.color": fg,
        "ytick.color": fg,
    })
    return theme


# ──────────────────────────────────────────────────────────────
# Chart-Typen
# ──────────────────────────────────────────────────────────────

def _layout_xtick_labels(ax, labels: list[str]) -> None:
    """Entscheidet anhand von Anzahl und Laenge der Labels, ob die x-Achsen-Labels
    rotiert werden muessen, um Ueberlappungen zu vermeiden. Kalibriert fuer die
    Default-Plot-Breite (5 – 6 inch). Heuristik:

      - viele Labels (> 6)                 → rotieren
      - oder: ein Label laenger als 8 Z.    → rotieren
      - oder: Summe aller Labels > 40 Z.    → rotieren
    """
    n = len(labels)
    max_len = max((len(str(l)) for l in labels), default=0)
    total_len = sum(len(str(l)) for l in labels)
    rotate = n > 6 or max_len > 8 or total_len > 40
    if rotate:
        plt.setp(ax.get_xticklabels(), rotation=35, ha="right", rotation_mode="anchor")


def chart_line(data: dict, output: Path, title: str | None, colors: list) -> None:
    fig, ax = plt.subplots(figsize=(6, 3.5))
    labels = data["labels"]

    if "series" in data:
        for i, series in enumerate(data["series"]):
            ax.plot(labels, series["values"], marker="o", markersize=4,
                    color=colors[i % len(colors)], label=series["name"], linewidth=1.5)
        ax.legend(frameon=False, fontsize=9)
    else:
        ax.plot(labels, data["values"], marker="o", markersize=4,
                color=colors[0], linewidth=1.5)

    if title:
        ax.set_title(title, pad=10)
    if "xlabel" in data:
        ax.set_xlabel(data["xlabel"])
    if "ylabel" in data:
        ax.set_ylabel(data["ylabel"])

    _layout_xtick_labels(ax, labels)
    fig.tight_layout()
    fig.savefig(output, format=output.suffix.lstrip("."), bbox_inches="tight")
    plt.close(fig)


def chart_bar(data: dict, output: Path, title: str | None, colors: list) -> None:
    fig, ax = plt.subplots(figsize=(6, 3.5))
    labels = data["labels"]

    if "series" in data:
        import numpy as np
        x = np.arange(len(labels))
        n = len(data["series"])
        width = 0.7 / n
        for i, series in enumerate(data["series"]):
            offset = (i - n / 2 + 0.5) * width
            ax.bar(x + offset, series["values"], width, color=colors[i % len(colors)],
                   label=series["name"])
        ax.set_xticks(x)
        ax.set_xticklabels(labels)
        ax.legend(frameon=False, fontsize=9)
    else:
        ax.bar(labels, data["values"], color=colors[:len(labels)], width=0.5)

    if title:
        ax.set_title(title, pad=10)
    if "ylabel" in data:
        ax.set_ylabel(data["ylabel"])

    _layout_xtick_labels(ax, labels)
    fig.tight_layout()
    fig.savefig(output, format=output.suffix.lstrip("."), bbox_inches="tight")
    plt.close(fig)


def chart_pie(data: dict, output: Path, title: str | None, colors: list) -> None:
    fig, ax = plt.subplots(figsize=(5, 4))
    labels = data["labels"]
    values = data["values"]

    wedges, texts, autotexts = ax.pie(
        values, labels=labels, colors=colors[:len(labels)], autopct="%1.1f%%",
        startangle=90, pctdistance=0.75,
        wedgeprops={"linewidth": 0.5, "edgecolor": "white"},
    )
    for t in autotexts:
        t.set_fontsize(8)

    if title:
        ax.set_title(title, pad=15)

    fig.savefig(output, format=output.suffix.lstrip("."))
    plt.close(fig)


CHART_TYPES = {
    "line": chart_line,
    "bar": chart_bar,
    "pie": chart_pie,
}


# ──────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Erzeugt Diagramme als SVG/PNG.")
    parser.add_argument("type", choices=CHART_TYPES.keys(), help="Diagrammtyp")
    parser.add_argument("--data", required=True, help="JSON-String oder Pfad zu JSON-Datei")
    parser.add_argument("--output", required=True, help="Ausgabepfad (.svg oder .png)")
    parser.add_argument("--title", default=None, help="Diagrammtitel")
    parser.add_argument("--theme", default="academic", choices=THEMES.keys(),
                        help="Farbthema (default: academic)")
    parser.add_argument("--colors", default=None,
                        help="Eigene Farben als kommagetrennte Hex-Werte (ueberschreibt Theme)")
    parser.add_argument("--width", type=float, default=None, help="Breite in Zoll")
    parser.add_argument("--height", type=float, default=None, help="Hoehe in Zoll")
    args = parser.parse_args()

    try:
        data_path = Path(args.data)
        if data_path.exists():
            data = json.loads(data_path.read_text(encoding="utf-8"))
        else:
            data = json.loads(args.data)
    except json.JSONDecodeError as e:
        print(f"Fehler: Ungueltiges JSON: {e}", file=sys.stderr)
        return 1

    theme = apply_theme(args.theme)
    colors = args.colors.split(",") if args.colors else theme["colors"]

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    if args.width or args.height:
        w = args.width or 6
        h = args.height or 3.5
        plt.rcParams["figure.figsize"] = (w, h)

    CHART_TYPES[args.type](data, output, args.title, colors)
    print(f"CHART={output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
