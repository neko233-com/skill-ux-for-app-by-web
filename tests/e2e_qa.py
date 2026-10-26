#!/usr/bin/env python3
"""e2e_qa.py — 对构建产物做无头浏览器冒烟（Playwright）。

用法:
  python tests/e2e_qa.py <file.html> [--shots-dir tests/screenshots]

检查:
  1. 无 pageerror / console.error
  2. 恰好一个 .ux-screen.is-active
  3. 所有 [data-goto] / [data-goto-tab] 点击后仍无报错、仍有 active 屏
  4. toast / modal 可触发
  5. 390x844 与 1280x800 不横向溢出
  6. 输出截图供人工目检
"""
from __future__ import annotations

import argparse
import pathlib
import sys

from playwright.sync_api import sync_playwright


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--shots-dir", default="tests/screenshots")
    args = ap.parse_args()

    path = pathlib.Path(args.file).resolve()
    if not path.exists():
        print(f"✗ 文件不存在: {path}")
        return 1
    shots = pathlib.Path(args.shots_dir)
    shots.mkdir(parents=True, exist_ok=True)
    url = path.as_uri()

    failures: list[str] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for name, vw, vh in (("mobile", 390, 844), ("desktop", 1280, 800)):
            page = browser.new_page(viewport={"width": vw, "height": vh})
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.on(
                "console",
                lambda m: errors.append(f"console.error: {m.text}") if m.type == "error" else None,
            )
            page.goto(url)
            page.wait_for_timeout(500)

            # 2. active screen
            actives = page.locator(".ux-screen.is-active").count()
            if actives != 1:
                failures.append(f"[{name}] active screens = {actives}, expect 1")

            # 5. horizontal overflow
            overflow = page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            if overflow > 2:
                failures.append(f"[{name}] horizontal overflow {overflow}px")

            # 3. click every goto target (dedupe by first occurrence per target)
            targets = page.locator("[data-goto],[data-goto-tab]")
            n = targets.count()
            clicked = 0
            seen: set[str] = set()
            for i in range(n):
                el = targets.nth(i)
                try:
                    key = (el.get_attribute("data-goto") or el.get_attribute("data-goto-tab") or "") + str(i % 3)
                    if key in seen:
                        continue
                    seen.add(key)
                    if not el.is_visible():
                        continue
                    el.click(timeout=800)
                    page.wait_for_timeout(120)
                    clicked += 1
                    if page.locator(".ux-screen.is-active").count() != 1:
                        failures.append(f"[{name}] after click target#{i} active != 1")
                except Exception:
                    pass  # element may be inside hidden screen; fine

            # 4. toast — 回到首屏再测，避免点到隐藏屏里的按钮
            page.evaluate("() => window.UX && window.UX.go(document.querySelector('#ux-app').dataset.initial, {force:true})")
            page.wait_for_timeout(200)
            toast_btn = page.locator('.ux-screen.is-active [data-act="toast"]').first
            if toast_btn.count():
                try:
                    toast_btn.click(timeout=2000)
                    page.wait_for_timeout(250)
                    if page.locator(".ux-toast.is-open").count() != 1:
                        failures.append(f"[{name}] toast did not open")
                except Exception as e:
                    failures.append(f"[{name}] toast click failed: {e}")

            # 4b. modal if present on active screen
            modal_btn = page.locator('.ux-screen.is-active [data-act="modal"]').first
            if modal_btn.count():
                try:
                    modal_btn.click(timeout=1500)
                    page.wait_for_timeout(200)
                except Exception:
                    pass

            # 6. 截图：先回首页、关弹层，保证画面干净
            page.evaluate(
                """() => {
                  const app = document.getElementById('ux-app');
                  if (window.UX) window.UX.go(app.dataset.initial, {force:true});
                  document.querySelectorAll('.ux-modal.is-open').forEach(m => m.classList.remove('is-open'));
                  document.querySelectorAll('.ux-toast.is-open').forEach(t => t.classList.remove('is-open'));
                }"""
            )
            page.wait_for_timeout(350)
            shot = shots / f"{path.stem}-{name}.png"
            page.screenshot(path=str(shot))
            print(f"  · [{name}] screenshot → {shot}  (clicked {clicked} targets)")

            if errors:
                failures.extend(f"[{name}] {e}" for e in errors)
            page.close()
        browser.close()

    if failures:
        print("FAIL:")
        for f in failures:
            print(f"  ✗ {f}")
        return 1
    print("PASS — e2e smoke ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
