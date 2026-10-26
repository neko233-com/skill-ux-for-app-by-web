#!/usr/bin/env python3
"""matrix_shot.py — 对 matrix 产物批量截图（仅首屏，390x844）"""
import pathlib
import sys
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
matrix = root / "tests" / "artifacts" / "matrix"
shots = root / "tests" / "screenshots" / "matrix"
shots.mkdir(parents=True, exist_ok=True)

files = sorted(matrix.glob("*.html"))
if not files:
    print("no matrix html found; run matrix-build.mjs first")
    sys.exit(1)

errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch()
    page = b.new_page(viewport={"width": 390, "height": 844})
    for f in files:
        page_errors = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.goto(f.resolve().as_uri())
        page.wait_for_timeout(450)
        out = shots / f"{f.stem}.png"
        page.screenshot(path=str(out))
        if page_errors:
            errors.append(f"{f.stem}: {page_errors}")
        print(f"  · {f.stem}")
    b.close()

if errors:
    print("FAIL", errors)
    sys.exit(1)
print(f"PASS — {len(files)} screenshots → {shots}")
