#!/usr/bin/env bash
set -euo pipefail

# Image Skill – ImageMagick + Pillow Wrapper

usage() {
    echo "Usage: image.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  download <url> --output OUT [--max-size N] [--quality N]"
    echo "  convert <file> --output OUT [--density N]"
    echo "  resize <file> --output OUT (--size WxH | --percent N)"
    echo "  crop <file> --output OUT (--geometry BxH+X+Y | --gravity G --size WxH)"
    echo "  rotate <file> --output OUT --degrees N"
    echo "  optimize <file> --output OUT [--quality N]"
    echo "  info <file>"
    echo "  collage <file1> <file2> [...files] --output OUT [--tile CxR] [--cell-size WxH] [--fit cover|contain|stretch|none] [--gap N] [--background COLOR]"
    exit 1
}

require_file() {
    [[ -f "$1" ]] || { echo "Fehler: Datei nicht gefunden: $1" >&2; exit 1; }
}

file_size_bytes() {
    stat -c%s "$1"
}

file_size_kb() {
    awk -v bytes="$(file_size_bytes "$1")" 'BEGIN { printf "%.1f KB", bytes / 1024 }'
}

cmd_download() {
    local url="" output="" max_size="" quality=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output) output="$2"; shift 2 ;;
            --max-size) max_size="$2"; shift 2 ;;
            --quality) quality="$2"; shift 2 ;;
            *) url="$1"; shift ;;
        esac
    done

    [[ -z "$url" ]] && { echo "Fehler: Keine URL angegeben" >&2; exit 1; }
    [[ -z "$output" ]] && { echo "Fehler: --output erforderlich" >&2; exit 1; }

    local tmpfile
    tmpfile=$(mktemp /tmp/img_dl_XXXXXX)
    trap "rm -f '$tmpfile'" EXIT

    curl -fsSL -o "$tmpfile" -A "Mozilla/5.0" "$url"

    local args=("$tmpfile")
    [[ -n "$max_size" ]] && args+=("-resize" "${max_size}x${max_size}>")
    [[ -n "$quality" ]] && args+=("-quality" "$quality")

    mkdir -p "$(dirname "$output")"
    magick "${args[@]}" "$output"
    echo "Erstellt: $output ($(file_size_kb "$output"))"
}

cmd_convert() {
    local file="" output="" density=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output) output="$2"; shift 2 ;;
            --density) density="$2"; shift 2 ;;
            *) file="$1"; shift ;;
        esac
    done

    [[ -z "$file" ]] && { echo "Fehler: Keine Datei angegeben" >&2; exit 1; }
    require_file "$file"
    [[ -z "$output" ]] && { echo "Fehler: --output erforderlich" >&2; exit 1; }

    local args=()
    [[ -n "$density" ]] && args+=("-density" "$density")
    args+=("$file" "$output")

    mkdir -p "$(dirname "$output")"
    magick "${args[@]}"
    echo "Konvertiert: $file → $output"
}

cmd_resize() {
    local file="" output="" size="" percent=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output) output="$2"; shift 2 ;;
            --size) size="$2"; shift 2 ;;
            --percent) percent="$2"; shift 2 ;;
            *) file="$1"; shift ;;
        esac
    done

    [[ -z "$file" ]] && { echo "Fehler: Keine Datei angegeben" >&2; exit 1; }
    require_file "$file"
    [[ -z "$output" ]] && { echo "Fehler: --output erforderlich" >&2; exit 1; }

    local resize_arg=""
    if [[ -n "$size" ]]; then
        resize_arg="$size"
    elif [[ -n "$percent" ]]; then
        resize_arg="${percent}%"
    else
        echo "Fehler: --size oder --percent erforderlich" >&2; exit 1
    fi

    mkdir -p "$(dirname "$output")"
    magick "$file" -resize "$resize_arg" "$output"

    local dims
    dims=$(magick identify -format "%wx%h" "$output")
    echo "Erstellt: $output ($dims)"
}

cmd_crop() {
    local file="" output="" geometry="" gravity="" size=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output) output="$2"; shift 2 ;;
            --geometry) geometry="$2"; shift 2 ;;
            --gravity) gravity="$2"; shift 2 ;;
            --size) size="$2"; shift 2 ;;
            *) file="$1"; shift ;;
        esac
    done

    [[ -z "$file" ]] && { echo "Fehler: Keine Datei angegeben" >&2; exit 1; }
    require_file "$file"
    [[ -z "$output" ]] && { echo "Fehler: --output erforderlich" >&2; exit 1; }

    mkdir -p "$(dirname "$output")"

    if [[ -n "$geometry" ]]; then
        magick "$file" -crop "$geometry" +repage "$output"
    elif [[ -n "$gravity" && -n "$size" ]]; then
        magick "$file" -gravity "$gravity" -crop "$size+0+0" +repage "$output"
    else
        echo "Fehler: --geometry oder --gravity+--size erforderlich" >&2; exit 1
    fi

    local dims
    dims=$(magick identify -format "%wx%h" "$output")
    echo "Erstellt: $output ($dims)"
}

cmd_rotate() {
    local file="" output="" degrees=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output) output="$2"; shift 2 ;;
            --degrees) degrees="$2"; shift 2 ;;
            *) file="$1"; shift ;;
        esac
    done

    [[ -z "$file" ]] && { echo "Fehler: Keine Datei angegeben" >&2; exit 1; }
    require_file "$file"
    [[ -z "$output" ]] && { echo "Fehler: --output erforderlich" >&2; exit 1; }
    [[ -z "$degrees" ]] && { echo "Fehler: --degrees erforderlich" >&2; exit 1; }

    mkdir -p "$(dirname "$output")"
    magick "$file" -rotate "$degrees" "$output"
    echo "Erstellt: $output (${degrees}° gedreht)"
}

cmd_optimize() {
    local file="" output="" quality="85"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output) output="$2"; shift 2 ;;
            --quality) quality="$2"; shift 2 ;;
            *) file="$1"; shift ;;
        esac
    done

    [[ -z "$file" ]] && { echo "Fehler: Keine Datei angegeben" >&2; exit 1; }
    require_file "$file"
    [[ -z "$output" ]] && { echo "Fehler: --output erforderlich" >&2; exit 1; }

    local size_before
    size_before=$(file_size_bytes "$file")

    mkdir -p "$(dirname "$output")"
    magick "$file" -strip -quality "$quality" "$output"

    local size_after
    size_after=$(file_size_bytes "$output")
    local pct=$((100 - (size_after * 100 / size_before)))
    echo "Erstellt: $output (${pct}% kleiner)"
}

cmd_info() {
    local file="$1"
    [[ -z "$file" ]] && { echo "Fehler: Keine Datei angegeben" >&2; exit 1; }
    require_file "$file"

    magick identify -format "Datei: %f\nFormat: %m\nDimensionen: %wx%h\nFarbraum: %[colorspace]\nBittiefe: %z-bit\nDateigroesse: %b\n" "$file"
}

cmd_collage() {
    local output="" tile="" cell_size="" gap="10" background="white" fit="cover"
    local files=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output) output="$2"; shift 2 ;;
            --tile) tile="$2"; shift 2 ;;
            --cell-size) cell_size="$2"; shift 2 ;;
            --fit) fit="$2"; shift 2 ;;
            --gap) gap="$2"; shift 2 ;;
            --background) background="$2"; shift 2 ;;
            *) files+=("$1"); shift ;;
        esac
    done

    [[ ${#files[@]} -lt 2 ]] && { echo "Fehler: Mindestens zwei Bilder erforderlich" >&2; exit 1; }
    [[ -z "$output" ]] && { echo "Fehler: --output erforderlich" >&2; exit 1; }

    case "$fit" in
        cover|contain|stretch|none) ;;
        *) echo "Fehler: --fit muss cover, contain, stretch oder none sein (war: $fit)" >&2; exit 1 ;;
    esac

    for f in "${files[@]}"; do
        require_file "$f"
    done

    [[ -z "$tile" ]] && tile="${#files[@]}x1"

    # Zellgröße aus erstem Bild ableiten, wenn fit ≠ none und nicht explizit gesetzt
    if [[ "$fit" != "none" && -z "$cell_size" ]]; then
        cell_size=$(magick identify -format "%wx%h" "${files[0]}")
    fi

    # Font-Fallback: montage lädt einen Font für Label-Rendering, auch wenn das
    # Label-Property via +set label entfernt wird. Ohne registrierte Fonts
    # (typisch bei Homebrew/macOS) würde der Befehl mit FreeType-Fehler abbrechen.
    local font_arg=()
    local candidate
    for candidate in \
        /System/Library/Fonts/Helvetica.ttc \
        /System/Library/Fonts/Supplemental/Arial.ttf \
        /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf \
        /usr/share/fonts/dejavu/DejaVuSans.ttf \
        /usr/share/fonts/TTF/DejaVuSans.ttf \
        /usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf \
        /usr/share/fonts/liberation/LiberationSans-Regular.ttf; do
        if [[ -f "$candidate" ]]; then
            font_arg=("-font" "$candidate")
            break
        fi
    done

    mkdir -p "$(dirname "$output")"

    # Gap so aufteilen, dass Innen- und Außenabstand gleich groß werden:
    # montage's -geometry +X+X erzeugt X Pixel um JEDES Tile → zwischen Bildern wird
    # daraus 2X, am Rand bleibt X. Damit innen = außen = gap gilt: half als Tile-
    # Padding (innen = 2*half), rest als nachgelagerter Border (außen = half + rest).
    local half=$((gap / 2))
    local rest=$((gap - half))

    local geometry
    local montage_inputs=("${files[@]}")
    local tmpdir=""

    case "$fit" in
        cover)
            # Pre-Crop: jedes Bild proportional auf cell-size füllen, mittig zuschneiden
            # (entspricht CSS object-fit: cover). Montage erhält fertige Tiles.
            tmpdir=$(mktemp -d "${TMPDIR:-/tmp}/img_collage.XXXXXX")
            trap "rm -rf '$tmpdir'" EXIT
            montage_inputs=()
            local idx=0
            local input
            for input in "${files[@]}"; do
                local tmp_out
                tmp_out="${tmpdir}/$(printf '%03d' "$idx").png"
                magick "$input" -resize "${cell_size}^" -gravity center -extent "$cell_size" "$tmp_out"
                montage_inputs+=("$tmp_out")
                idx=$((idx + 1))
            done
            geometry="+${half}+${half}"
            ;;
        contain)
            geometry="${cell_size}+${half}+${half}"
            ;;
        stretch)
            geometry="${cell_size}!+${half}+${half}"
            ;;
        none)
            geometry="+${half}+${half}"
            ;;
    esac

    if [[ $rest -gt 0 ]]; then
        magick montage "${montage_inputs[@]}" "${font_arg[@]}" +set label -tile "$tile" -geometry "$geometry" -background "$background" miff:- \
            | magick - -bordercolor "$background" -border "${rest}x${rest}" "$output"
    else
        magick montage "${montage_inputs[@]}" "${font_arg[@]}" +set label -tile "$tile" -geometry "$geometry" -background "$background" "$output"
    fi

    local dims
    dims=$(magick identify -format "%wx%h" "$output")
    local cs_info=""
    [[ -n "$cell_size" ]] && cs_info=", Cell $cell_size"
    echo "Erstellt: $output ($dims, ${#files[@]} Bilder, Tile $tile, Fit $fit${cs_info})"
}

[[ $# -lt 1 ]] && usage

command="$1"; shift
case "$command" in
    download)  cmd_download "$@" ;;
    convert)   cmd_convert "$@" ;;
    resize)    cmd_resize "$@" ;;
    crop)      cmd_crop "$@" ;;
    rotate)    cmd_rotate "$@" ;;
    optimize)  cmd_optimize "$@" ;;
    info)      cmd_info "$@" ;;
    collage)   cmd_collage "$@" ;;
    *)         usage ;;
esac
