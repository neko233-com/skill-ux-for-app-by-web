#!/usr/bin/env python3
"""e2e_game_qa.py — game-genres.html 的布局与玩法端到端测试（Playwright）。

用法:
  python tests/e2e_game_qa.py [tests/artifacts/game-genres.html]
      [--shots-dir tests/screenshots/game-genres]

目标 HTML 可由 examples/game-genres.spec.json 构建。每个用例使用独立页面，
收集 pageerror / console.error；任何失败都会明确输出，全部通过时输出 PASS。
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from functools import partial
import pathlib
import sys
import traceback
from typing import Callable

from playwright.sync_api import Browser, Page, sync_playwright, expect


SCREENS = ("home", "slg", "card", "poker", "tactics")
VIEWPORTS = (("390x844", 390, 844), ("844x390", 844, 390))
ORIENTATIONS = ("portrait", "landscape")
OVERFLOW_TOLERANCE = 2


@dataclass(frozen=True)
class Case:
    name: str
    run: Callable[[Page], None]
    width: int = 1280
    height: int = 800


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def wait_ready(page: Page) -> None:
    page.wait_for_function(
        "() => window.UX && document.querySelector('#ux-app') && "
        "document.querySelectorAll('.ux-screen.is-active').length === 1"
    )


def go(page: Page, screen: str) -> None:
    page.evaluate("(screen) => window.UX.go(screen)", screen)
    active = page.locator(".ux-screen.is-active")
    expect(active).to_have_count(1)
    expect(active).to_have_attribute("data-screen", screen)


def game_root(page: Page, name: str):
    root = page.locator(f'.ux-screen.is-active [data-game-root="{name}"]')
    expect(root).to_have_count(1)
    return root


def box(locator, label: str) -> dict[str, float]:
    result = locator.bounding_box()
    require(result is not None, f"{label} 没有 bounding box")
    return result


def require_inside(outer: dict[str, float], inner: dict[str, float], label: str) -> None:
    tolerance = 1
    inside = (
        inner["x"] >= outer["x"] - tolerance
        and inner["y"] >= outer["y"] - tolerance
        and inner["x"] + inner["width"] <= outer["x"] + outer["width"] + tolerance
        and inner["y"] + inner["height"] <= outer["y"] + outer["height"] + tolerance
    )
    require(inside, f"{label} 不在 frame 内: outer={outer}, inner={inner}")


def intersects(a: dict[str, float], b: dict[str, float]) -> bool:
    return not (
        a["x"] + a["width"] <= b["x"]
        or b["x"] + b["width"] <= a["x"]
        or a["y"] + a["height"] <= b["y"]
        or b["y"] + b["height"] <= a["y"]
    )


def test_desktop_orientation(page: Page) -> None:
    app = page.locator("#ux-app")
    expect(app).to_have_attribute("data-orientation", "portrait")

    page.evaluate("() => window.UX.toggleOrientation()")
    expect(app).to_have_attribute("data-orientation", "landscape")
    expect(page.locator("html")).to_have_attribute("data-orientation-view", "landscape")

    frame = box(app, ".ux-frame")
    require(
        frame["width"] > frame["height"],
        f"横屏 .ux-frame 应宽大于高，实际 {frame['width']}x{frame['height']}",
    )
    dock = page.locator(".ux-tabbar")
    expect(dock).to_be_visible()
    dock_box = box(dock, "右侧 Dock")
    require_inside(frame, dock_box, "右侧 Dock")
    require(
        dock.evaluate("(el) => getComputedStyle(el).flexDirection") == "column",
        "横屏右侧 Dock 的 flex-direction 应为 column",
    )
    require(
        dock_box["height"] > dock_box["width"]
        and dock_box["x"] + dock_box["width"] / 2 > frame["x"] + frame["width"] / 2,
        f"Dock 应位于 frame 右侧且为纵向: frame={frame}, dock={dock_box}",
    )


def test_layout_screen(
    page: Page,
    *,
    screen: str,
    orientation: str,
    viewport_name: str,
    shots: pathlib.Path,
) -> None:
    app = page.locator("#ux-app")
    expect(app).to_have_attribute("data-orientation", "portrait")
    if orientation == "landscape":
        page.evaluate("() => window.UX.toggleOrientation()")
    expect(app).to_have_attribute("data-orientation", orientation)
    go(page, screen)

    active_scroll = page.locator(".ux-screen.is-active .ux-scroll")
    expect(active_scroll).to_have_count(1)
    expect(active_scroll).to_be_visible()
    metrics = page.evaluate(
        """() => {
          const doc = document.documentElement;
          const scroll = document.querySelector('.ux-screen.is-active .ux-scroll');
          return {
            documentOverflow: doc.scrollWidth - doc.clientWidth,
            scrollOverflow: scroll ? scroll.scrollWidth - scroll.clientWidth : null,
            documentWidth: [doc.scrollWidth, doc.clientWidth],
            scrollWidth: scroll ? [scroll.scrollWidth, scroll.clientWidth] : null,
          };
        }"""
    )

    # 仅测文档与 active scroll；手牌/商店自身的 overflow-x:auto 不在此处展开。
    shot = shots / f"{viewport_name}-{screen}-{orientation}.png"
    page.screenshot(path=str(shot), animations="disabled")
    print(f"  · screenshot → {shot}")
    require(
        metrics["documentOverflow"] <= OVERFLOW_TOLERANCE,
        f"document 横向溢出 {metrics['documentOverflow']}px "
        f"(scrollWidth/clientWidth={metrics['documentWidth']})",
    )
    require(
        metrics["scrollOverflow"] is not None
        and metrics["scrollOverflow"] <= OVERFLOW_TOLERANCE,
        f"active .ux-scroll 横向溢出 {metrics['scrollOverflow']}px "
        f"(scrollWidth/clientWidth={metrics['scrollWidth']})",
    )


def test_home_item_and_overhead(page: Page) -> None:
    root = game_root(page, "overhead")
    item = root.locator('[data-game-act="use-item"]').first
    expect(item).to_have_count(1)
    require(root.get_attribute("data-hp") == "40", "主页初始 HP 应为 40")
    require(item.get_attribute("data-qty") == "2", "首个道具初始 qty 应为 2")

    item.click()
    expect(root).to_have_attribute("data-hp", "55")
    expect(item).to_have_attribute("data-qty", "1")
    expect(item.locator("[data-item-qty]")).to_have_text("1")

    # 等本组件的有限动画结束，避免缩放中的 bbox 造成误报。
    page.wait_for_function(
        "(el) => el.getAnimations({subtree:true}).every("
        "a => a.playState === 'finished' || a.playState === 'idle')",
        arg=root.element_handle(),
    )
    overhead = page.locator(".ux-screen.is-active [data-ux-overhead]")
    expect(overhead).to_have_count(1)
    overhead_box = box(overhead, "[data-ux-overhead]")
    frame_box = box(page.locator("#ux-app"), ".ux-frame")
    tabbar_box = box(page.locator(".ux-tabbar"), ".ux-tabbar")
    require_inside(frame_box, overhead_box, "[data-ux-overhead]")
    require(
        not intersects(overhead_box, tabbar_box),
        f"[data-ux-overhead] 与 .ux-tabbar 相交: overhead={overhead_box}, tabbar={tabbar_box}",
    )


def test_slg(page: Page) -> None:
    go(page, "slg")
    root = game_root(page, "slg")
    source = root.locator('[data-game-act="slg-select"][data-slot-index="1"]')
    target = root.locator('[data-game-act="slg-select"][data-slot-index="2"]')
    require(source.get_attribute("data-power") == "6", "SLG 源格初始兵力应为 6")
    require(target.get_attribute("data-power") == "4", "SLG 目标格初始兵力应为 4")

    source.click()
    expect(source).to_have_attribute("aria-selected", "true")
    root.locator('[data-game-act="slg-command"][data-command="attack"]').click()
    target.click()
    expect(source).to_have_attribute("data-power", "5")
    expect(target).to_have_attribute("data-power", "1")

    root.locator('[data-game-act="slg-end"]').click()
    expect(root.locator("[data-slg-turn]")).to_have_text("2")


def test_card_play(page: Page) -> None:
    go(page, "card")
    root = game_root(page, "card")
    hand = root.locator("[data-ux-hand]")
    cards = hand.locator("[data-ux-card]")
    fireball = hand.locator('[data-card-id="fireball"]')
    golem = root.locator('[data-unit-id="golem"]')
    expect(cards).to_have_count(5)
    expect(fireball).to_have_count(1)
    require(root.get_attribute("data-energy") == "3", "卡牌初始能量应为 3")
    require(golem.get_attribute("data-hp") == "18", "golem 初始 HP 应为 18")

    fireball.click()
    expect(fireball).to_have_attribute("aria-selected", "true")
    root.locator('[data-game-act="card-play"]').click()
    # 卡牌节点由移除动画结束后的回调删除；等待节点消失而非固定 sleep。
    expect(fireball).to_have_count(0)
    expect(cards).to_have_count(4)
    expect(root).to_have_attribute("data-energy", "1")
    expect(root.locator("[data-card-energy]")).to_have_text("1/3")
    expect(golem).to_have_attribute("data-hp", "12")


def test_card_end(page: Page) -> None:
    go(page, "card")
    root = game_root(page, "card")
    player = root.locator("[data-player]")
    expect(root.locator("[data-card-turn]")).to_have_text("1")
    require(player.get_attribute("data-hp") == "30", "玩家初始 HP 应为 30")
    require(root.get_attribute("data-energy") == "3", "卡牌初始能量应为 3")

    root.locator('[data-game-act="card-end"]').click()
    expect(root.locator("[data-card-turn]")).to_have_text("2")
    expect(player).to_have_attribute("data-hp", "25")
    expect(root).to_have_attribute("data-energy", "3")
    expect(root.locator("[data-card-energy]")).to_have_text("3/3")


def test_poker(page: Page) -> None:
    go(page, "poker")
    root = game_root(page, "poker")
    hand = root.locator("[data-ux-hand]")
    cards = hand.locator("[data-ux-card]")
    selected = hand.locator("[data-ux-card].is-selected")
    expect(cards).to_have_count(8)

    root.locator('[data-game-act="poker-hint"]').click()
    expect(selected).to_have_count(2)
    ranks = selected.evaluate_all("(cards) => cards.map(card => card.dataset.rank)")
    require(ranks == ["8", "8"], f"poker-hint 应选择两张 8，实际 ranks={ranks}")

    root.locator('[data-game-act="poker-play"]').click()
    # 等待两张手牌的移除动画及 DOM 删除完成。
    expect(cards).to_have_count(6)
    expect(root.locator("[data-poker-turn]")).to_have_text("2")
    expect(root.locator("[data-poker-count]")).to_have_text("6")


def tactics_slot(root, zone: str, index: int):
    return root.locator(
        f'[data-ux-slot][data-zone="{zone}"][data-slot-index="{index}"]'
    )


def check_tactics_population(root, board_units, bench_units, board: int, bench: int) -> None:
    expect(board_units).to_have_count(board)
    expect(bench_units).to_have_count(bench)
    expect(root.locator("[data-tactics-cap]")).to_have_text(f"{board}/3")
    require(
        board_units.count() + bench_units.count() == 4,
        f"棋子总数应守恒为 4，实际 board={board_units.count()}, bench={bench_units.count()}",
    )


def test_tactics(page: Page) -> None:
    go(page, "tactics")
    root = game_root(page, "tactics")
    bench = root.locator("[data-tactics-bench]")
    board_units = root.locator(
        '[data-ux-slot][data-zone="board"] [data-ux-unit][data-team="player"]'
    )
    bench_units = bench.locator("[data-ux-unit]")
    expect(board_units).to_have_count(3)
    expect(bench_units).to_have_count(2)
    require(root.get_attribute("data-enemy-power") == "8", "初始敌方战力应为 8")
    initial_power = sum(
        board_units.evaluate_all(
            "(units) => units.map(unit => Number(unit.dataset.attack) * Number(unit.dataset.star))"
        )
    )
    require(initial_power == 8, f"初始己方战力应为 8，实际 {initial_power}")

    root.locator('[data-game-act="tactics-buy"]').first.click()
    star_two = bench.locator('[data-unit-id="sprout"][data-star="2"]')
    expect(star_two).to_have_count(1)
    expect(bench.locator('[data-unit-id="sprout"]')).to_have_count(1)
    check_tactics_population(root, board_units, bench_units, board=3, bench=1)

    board18 = tactics_slot(root, "board", 18)
    bench1 = tactics_slot(root, "bench", 1)
    moving = board18.locator("[data-ux-unit]")
    expect(moving).to_have_count(1)
    require(moving.get_attribute("data-unit-id") == "guard", "board slot18 应为 guard")
    expect(bench1.locator("[data-ux-unit]")).to_have_count(0)

    board18.click()
    require(
        "is-selected" in (board18.get_attribute("class") or "").split(),
        "点击 board slot18 后应进入选中状态",
    )
    bench1.click()
    expect(board18.locator("[data-ux-unit]")).to_have_count(0)
    expect(bench1.locator('[data-ux-unit][data-unit-id="guard"]')).to_have_count(1)
    check_tactics_population(root, board_units, bench_units, board=2, bench=2)

    bench1.click()
    board18.click()
    expect(bench1.locator("[data-ux-unit]")).to_have_count(0)
    expect(board18.locator('[data-ux-unit][data-unit-id="guard"]')).to_have_count(1)
    check_tactics_population(root, board_units, bench_units, board=3, bench=1)

    root.locator('[data-game-act="tactics-battle"]').click()
    expect(root.locator("[data-tactics-turn]")).to_have_text("2")
    log = root.locator("[data-game-log]")
    expect(log).to_contain_text("战斗胜利")
    expect(log).to_contain_text("战力 8 vs 8")


def test_card_target_migration(page: Page) -> None:
    go(page, "card")
    root = game_root(page, "card")
    golem = root.locator('[data-unit-id="golem"]')
    void_unit = root.locator('[data-unit-id="void"]')
    golem.evaluate("(unit) => window.UXGame.setHp(unit, 6)")

    root.locator('[data-card-id="fireball"]').click()
    root.locator('[data-game-act="card-play"]').click()
    expect(golem).to_have_attribute("data-hp", "0")
    expect(golem).to_have_attribute("aria-pressed", "false")
    expect(void_unit).to_have_attribute("aria-pressed", "true")

    root.locator('[data-game-act="card-draw"]').click()
    spark = root.locator('[data-card-id="spark"]')
    spark.click()
    root.locator('[data-game-act="card-play"]').click()
    expect(spark).to_have_count(0)
    expect(void_unit).to_have_attribute("data-hp", "10")
    expect(void_unit).to_have_attribute("aria-pressed", "true")


def test_narrow_landscape_fallback(page: Page) -> None:
    go(page, "slg")
    page.evaluate("() => window.UX.toggleOrientation()")
    expect(page.locator("#ux-app")).to_have_attribute("data-orientation", "landscape")
    root = game_root(page, "slg")
    layout_box = box(root.locator(".ux-slg__layout"), "窄屏 SLG 布局")
    map_box = box(root.locator(".ux-slg__map"), "窄屏 SLG 地图")
    cell_box = box(root.locator('[data-slot-index="1"]'), "窄屏 SLG 格子")
    require(
        map_box["width"] >= layout_box["width"] * .85,
        f"窄屏应回退单栏地图: layout={layout_box}, map={map_box}",
    )
    require(cell_box["width"] >= 40, f"窄屏格子应至少 40px 宽，实际 {cell_box['width']}")
    require(
        page.locator(".ux-tabbar").evaluate("(el) => getComputedStyle(el).flexDirection") == "row",
        "窄屏强制横屏预览应保留底部横向 Dock",
    )


def test_auto_orientation(page: Page) -> None:
    app = page.locator("#ux-app")
    page.evaluate("() => window.UX.setOrientation('auto')")
    expect(page.locator("html")).to_have_attribute("data-orientation", "auto")
    expect(app).to_have_attribute("data-orientation", "portrait")

    page.set_viewport_size({"width": 844, "height": 390})
    expect(app).to_have_attribute("data-orientation", "landscape")
    expect(page.locator("html")).to_have_attribute("data-orientation-view", "landscape")
    page.set_viewport_size({"width": 390, "height": 844})
    expect(app).to_have_attribute("data-orientation", "portrait")


def test_slg_move_and_invalid_target(page: Page) -> None:
    go(page, "slg")
    root = game_root(page, "slg")
    source = root.locator('[data-slot-index="1"]')
    enemy = root.locator('[data-slot-index="2"]')
    destination = root.locator('[data-slot-index="6"]')
    source.click()
    root.locator('[data-command="move"]').click()

    enemy.click()
    expect(source).to_have_attribute("data-power", "6")
    expect(enemy).to_have_attribute("data-power", "4")
    expect(root.locator("[data-game-log]")).to_contain_text("目标不相邻或不符合")

    destination.click()
    expect(source).to_have_attribute("data-power", "3")
    expect(destination).to_have_attribute("data-power", "4")
    expect(destination).to_have_attribute("data-owner", "player")


def test_card_draw_and_insufficient_energy(page: Page) -> None:
    go(page, "card")
    root = game_root(page, "card")
    cards = root.locator("[data-ux-hand] [data-ux-card]")
    expect(root.locator("[data-card-deck-count]")).to_have_text("3")
    root.locator('[data-game-act="card-draw"]').click()
    expect(cards).to_have_count(6)
    expect(root.locator("[data-card-deck-count]")).to_have_text("2")

    meteor = root.locator('[data-card-id="meteor"]')
    meteor.click()
    root.locator('[data-game-act="card-play"]').click()
    expect(meteor).to_have_count(0)
    expect(cards).to_have_count(5)
    expect(root).to_have_attribute("data-energy", "0")

    missile = root.locator('[data-card-id="missile"]')
    expect(missile).to_have_attribute("aria-disabled", "true")
    # aria-disabled 用于表达不可用，但组件仍接受 pointer 点击来解释原因。
    missile.click(force=True)
    expect(missile).to_have_attribute("aria-selected", "false")
    expect(cards).to_have_count(5)
    expect(root).to_have_attribute("data-energy", "0")
    expect(root.locator("[data-game-log]")).to_contain_text("能量不足")


def test_poker_invalid_and_duplicate_guard(page: Page) -> None:
    go(page, "poker")
    root = game_root(page, "poker")
    cards = root.locator("[data-ux-hand] [data-ux-card]")
    play = root.locator('[data-game-act="poker-play"]')
    cards.first.click()
    play.click()
    expect(cards).to_have_count(8)
    expect(root.locator("[data-poker-turn]")).to_have_text("1")
    expect(root.locator("[data-game-log]")).to_contain_text("对子规则")

    root.evaluate(
        """(root) => {
          const action = (name) => root.querySelector(`[data-game-act="${name}"]`).click();
          action('poker-hint');
          action('poker-play');
          action('poker-hint');
          action('poker-play');
        }"""
    )
    expect(cards).to_have_count(6)
    expect(root.locator("[data-poker-turn]")).to_have_text("2")
    expect(root.locator("[data-opponent]").first).to_have_attribute("data-count", "6")


def test_tactics_cap_and_xp(page: Page) -> None:
    go(page, "tactics")
    root = game_root(page, "tactics")
    bench0 = tactics_slot(root, "bench", 0)
    empty_board = tactics_slot(root, "board", 17)
    board_units = root.locator('[data-zone="board"] [data-ux-unit][data-team="player"]')
    bench_units = root.locator("[data-tactics-bench] [data-ux-unit]")

    bench0.click()
    empty_board.click()
    expect(board_units).to_have_count(3)
    expect(bench_units).to_have_count(2)
    expect(root.locator("[data-game-log]")).to_contain_text("人口已满")

    root.locator('[data-game-act="tactics-xp"]').click()
    expect(root.locator("[data-tactics-level]")).to_have_text("4")
    expect(root.locator("[data-tactics-xp]")).to_have_text("0/16")
    expect(root.locator("[data-tactics-cap]")).to_have_text("3/4")
    expect(root.locator("[data-tactics-gold]")).to_have_text("6")


def test_reduced_motion(page: Page) -> None:
    page.emulate_media(reduced_motion="reduce")
    page.reload(wait_until="load")
    wait_ready(page)
    require(
        page.evaluate("() => matchMedia('(prefers-reduced-motion: reduce)').matches"),
        "reduced_motion=reduce 未生效",
    )
    root = game_root(page, "overhead")
    item = root.locator('[data-game-act="use-item"]').first
    item.click()
    expect(root).to_have_attribute("data-hp", "55")
    expect(item).to_have_attribute("data-qty", "1")

    running_infinite = page.evaluate(
        """() => document.getAnimations().flatMap(animation => {
          if (animation.playState !== 'running' || !animation.effect) return [];
          if (animation.effect.getTiming().iterations !== Infinity) return [];
          return [animation.animationName || animation.transitionProperty || 'unknown'];
        })"""
    )
    require(not running_infinite, f"reduced motion 后仍有无限运行动画: {running_infinite}")
    # 等待本次操作的临时浮字清理，也覆盖其异步回调中的浏览器错误。
    expect(page.locator(".ux-game-float")).to_have_count(0)


def run_case(browser: Browser, url: str, case: Case) -> list[str]:
    page = browser.new_page(viewport={"width": case.width, "height": case.height})
    page.set_default_timeout(8000)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
    page.on(
        "console",
        lambda message: errors.append(f"console.error: {message.text}")
        if message.type == "error"
        else None,
    )
    failures: list[str] = []
    try:
        page.goto(url, wait_until="load")
        wait_ready(page)
        case.run(page)
    except Exception:
        failures.append(traceback.format_exc().strip())
    finally:
        try:
            page.close()
        except Exception as error:
            failures.append(f"关闭页面失败: {type(error).__name__}: {error}")

    failures.extend(errors)
    if failures:
        print(f"  ✗ {case.name}")
    else:
        print(f"  ✓ {case.name}")
    return [f"[{case.name}] {failure}" for failure in failures]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("file", nargs="?", default="tests/artifacts/game-genres.html")
    parser.add_argument("--shots-dir", default="tests/screenshots/game-genres")
    args = parser.parse_args()

    path = pathlib.Path(args.file).resolve()
    if not path.exists():
        print(f"✗ 文件不存在: {path}")
        return 1
    shots = pathlib.Path(args.shots_dir).resolve()
    shots.mkdir(parents=True, exist_ok=True)
    url = path.as_uri()

    cases = [Case("desktop 1280x800 orientation + right Dock", test_desktop_orientation)]
    for viewport_name, width, height in VIEWPORTS:
        for orientation in ORIENTATIONS:
            for screen in SCREENS:
                cases.append(
                    Case(
                        f"layout {viewport_name} / {screen} / {orientation}",
                        partial(
                            test_layout_screen,
                            screen=screen,
                            orientation=orientation,
                            viewport_name=viewport_name,
                            shots=shots,
                        ),
                        width,
                        height,
                    )
                )
    cases.extend(
        [
            Case("home first use-item + overhead geometry", test_home_item_and_overhead),
            Case("SLG select/attack/end turn", test_slg),
            Case("card fireball play + removal", test_card_play),
            Case("card end turn on fresh page", test_card_end),
            Case("poker hint/play + removal", test_poker),
            Case("tactics combine/move/conserve/battle", test_tactics),
            Case("card dead target migration", test_card_target_migration),
            Case("narrow landscape single-column fallback", test_narrow_landscape_fallback, 390, 844),
            Case("auto orientation follows viewport", test_auto_orientation, 390, 844),
            Case("SLG invalid target + move", test_slg_move_and_invalid_target),
            Case("card deck + insufficient energy", test_card_draw_and_insufficient_energy),
            Case("poker invalid set + duplicate guard", test_poker_invalid_and_duplicate_guard),
            Case("tactics population cap + XP level", test_tactics_cap_and_xp),
            Case("reduced motion item + finite animations", test_reduced_motion),
        ]
    )

    failures: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            for case in cases:
                failures.extend(run_case(browser, url, case))
        finally:
            browser.close()

    if failures:
        print(f"\nFAIL — {len(failures)} 个失败项:")
        for failure in failures:
            print(f"\n✗ {failure}")
        return 1
    print(f"\nPASS — {len(cases)} 个游戏端到端用例通过；截图目录: {shots}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
