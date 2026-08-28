#!/usr/bin/env python3
"""Convert markdown dossier test docs to PDF."""

from __future__ import annotations

import glob
import os
import re
import sys

import markdown
from fpdf import FPDF

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_ITALIC = "/System/Library/Fonts/Supplemental/Arial Italic.ttf"
FONT_BOLD_ITALIC = "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def preprocess_md(text: str) -> str:
    """Simplify markdown for fpdf2 HTML renderer."""
    text = text.replace("✅", "Oui").replace("❌", "Non")
    text = text.replace("1ʳᵉ", "1re").replace("2ᵉ", "2e")
    out: list[str] = []
    for line in text.splitlines():
        if "|" in line and line.strip().startswith("|"):
            line = line.replace("`", "")
            line = re.sub(r"\*\*([^*]+)\*\*", r"\1", line)
            line = re.sub(r"\*([^*]+)\*", r"\1", line)
        out.append(line)
    return "\n".join(out)


def md_to_pdf(md_path: str, pdf_path: str) -> None:
    with open(md_path, encoding="utf-8") as handle:
        text = preprocess_md(handle.read())

    html = markdown.markdown(text, extensions=["tables", "fenced_code", "nl2br"])

    pdf = FPDF(format="A4")
    pdf.set_margins(15, 15, 15)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.add_font("Body", "", FONT_REGULAR)
    pdf.add_font("Body", "B", FONT_BOLD)
    pdf.add_font("Body", "I", FONT_ITALIC)
    pdf.add_font("Body", "BI", FONT_BOLD_ITALIC)
    pdf.set_font("Body", size=10)
    pdf.write_html(html)
    pdf.output(pdf_path)


def main() -> int:
    if not os.path.exists(FONT_REGULAR):
        print(f"Font not found: {FONT_REGULAR}", file=sys.stderr)
        return 1

    md_files = sorted(glob.glob(os.path.join(SCRIPT_DIR, "*.md")))
    if not md_files:
        print("No markdown files found.", file=sys.stderr)
        return 1

    for md_path in md_files:
        pdf_path = md_path[:-3] + ".pdf"
        md_to_pdf(md_path, pdf_path)
        size = os.path.getsize(pdf_path)
        print(f"OK  {os.path.basename(pdf_path):35s} {size:>8,} bytes")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
