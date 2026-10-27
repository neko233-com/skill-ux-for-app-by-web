#!/usr/bin/env python3
"""modal_e2e.py — 验证道具栏/背包点击弹窗"""
import pathlib
import sys
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
html = root / "examples" / "demo-game-anime.html"
shots = root / "tests" / "screenshots"
shots.mkdir(parents=True, exist_ok=True)

fails = []
with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(html.resolve().as_uri())
    pg.wait_for_timeout(450)

    # currency modal
    pg.locator(".ux-currency__item").first.click()
    pg.wait_for_timeout(280)
    if pg.locator(".ux-modal.is-open").count() != 1:
        fails.append("currency modal not open")
    else:
        print("currency modal:", pg.locator(".ux-modal__title").inner_text())
        pg.screenshot(path=str(shots / "modal-currency.png"))
        pg.locator(".ux-modal [data-modal-ok]").click()
        pg.wait_for_timeout(180)

    # plus button
    pg.locator(".ux-currency__plus").first.click()
    pg.wait_for_timeout(250)
    if pg.locator(".ux-modal.is-open").count() != 1:
        fails.append("plus modal not open")
    else:
        print("plus modal:", pg.locator(".ux-modal__title").inner_text())
        pg.locator(".ux-modal [data-modal-ok]").click()
        pg.wait_for_timeout(150)

    # inventory modal
    pg.locator("[data-goto-tab=bag]").click()
    pg.wait_for_timeout(320)
    pg.locator(".ux-inv__slot").first.click()
    pg.wait_for_timeout(280)
    if pg.locator(".ux-modal.is-open").count() != 1:
        fails.append("inventory modal not open")
    else:
        print("inv modal:", pg.locator(".ux-modal__title").inner_text())
        body = pg.locator(".ux-modal__body").inner_text()
        print("inv body:", body.replace("\n", " | "))
        pg.screenshot(path=str(shots / "modal-inventory.png"))

    if errs:
        fails.extend(errs)
    b.close()

if fails:
    print("FAIL:", fails)
    sys.exit(1)
print("MODAL E2E PASS")
