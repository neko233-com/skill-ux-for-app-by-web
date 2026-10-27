/* game-core.js — 游戏玩法状态与反馈运行时（构建时内联，零依赖） */
(function () {
  "use strict";
  var doc = document;
  var app = doc.getElementById("ux-app");
  if (!app || !window.UX) return;

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function num(value, fallback) { var n = Number(value); return isFinite(n) ? n : (fallback || 0); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function gameRoot(el) { return el && el.closest ? el.closest("[data-game-root]") : null; }
  function reducedMotion() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

  function replay(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }

  function announce(root, message, showToast) {
    var log = root ? $("[data-game-log]", root) : null;
    if (log) log.textContent = message;
    if (showToast || !log) window.UX.toast(message);
  }

  function emit(action, source, root) {
    try {
      doc.dispatchEvent(new CustomEvent("ux:game", { detail: { action: action, source: source, root: root } }));
    } catch (e) { /* CustomEvent is optional in older embedded browsers. */ }
  }

  function floatText(el, text, tone) {
    if (!el) return;
    var frameRect = app.getBoundingClientRect();
    var rect = el.getBoundingClientRect();
    var label = doc.createElement("span");
    label.className = "ux-game-float" + (tone ? " ux-game-float--" + tone : "");
    label.textContent = text;
    label.style.left = (rect.left - frameRect.left + rect.width / 2) + "px";
    label.style.top = (rect.top - frameRect.top + Math.min(30, rect.height / 2)) + "px";
    app.appendChild(label);
    setTimeout(function () { if (label.parentNode) label.parentNode.removeChild(label); }, reducedMotion() ? 120 : 900);
  }

  function setHp(unit, value) {
    if (!unit) return 0;
    var max = Math.max(1, num(unit.getAttribute("data-max-hp"), 100));
    var hp = clamp(num(value, 0), 0, max);
    unit.setAttribute("data-hp", String(hp));
    var fill = $("[data-hp-fill]", unit);
    var text = $("[data-hp-text]", unit);
    var health = $(".ux-unit-health", unit);
    if (fill) fill.style.width = (hp / max * 100) + "%";
    if (text) text.textContent = hp + "/" + max;
    if (health) health.setAttribute("aria-label", "生命 " + hp + " / " + max);
    unit.classList.toggle("is-dead", hp <= 0);
    return hp;
  }

  function changeHp(unit, delta) {
    if (!unit) return 0;
    var before = num(unit.getAttribute("data-hp"), 0);
    var after = setHp(unit, before + delta);
    var actual = after - before;
    if (actual) {
      floatText(unit, (actual > 0 ? "+" : "") + actual, actual > 0 ? "heal" : "damage");
      replay(unit, actual > 0 ? "anim-heal" : "anim-hit");
    }
    return actual;
  }

  /* ── 头顶道具栏 ─────────────────────────────── */
  function useItem(button, root) {
    var qty = Math.max(0, num(button.getAttribute("data-qty"), 0));
    var name = button.getAttribute("data-item-name") || "道具";
    if (!qty) { announce(root, name + "已用完", true); return; }
    qty -= 1;
    button.setAttribute("data-qty", String(qty));
    var qtyEl = $("[data-item-qty]", button);
    if (qtyEl) qtyEl.textContent = String(qty);
    button.setAttribute("aria-label", name + "，剩余 " + qty);
    if (!qty) button.disabled = true;
    var value = num(button.getAttribute("data-value"), 10);
    var effect = button.getAttribute("data-effect") || "heal";
    if (effect === "heal") changeHp(root, value);
    else if (effect === "damage") changeHp(root, -value);
    else if (effect === "shield") {
      root.setAttribute("data-shield", String(num(root.getAttribute("data-shield"), 0) + value));
      floatText(root, "护盾 +" + value, "shield");
      replay(root, "anim-glow-once");
    } else {
      floatText(root, name, "buff");
      replay(root, "anim-glow-once");
    }
    replay(button, "anim-pop");
    announce(root, "已使用" + name + "，剩余 " + qty);
  }

  /* ── SLG：选择 → 指令 → 相邻目标 ────────────── */
  var ownerNames = { player: "己方", enemy: "敌方", neutral: "中立" };

  function slgCells(root) { return $$(".ux-slg__cell", root); }
  function updateSlgCell(cell) {
    var power = Math.max(0, num(cell.getAttribute("data-power"), 0));
    cell.setAttribute("data-power", String(power));
    var label = cell.getAttribute("data-label") || "地块";
    var owner = cell.getAttribute("data-owner") || "neutral";
    var powerEl = $("[data-cell-power]", cell);
    if (powerEl) powerEl.textContent = String(power);
    cell.setAttribute("aria-label", label + "，" + (ownerNames[owner] || owner) + "，兵力 " + power);
  }

  function clearSlgTargets(root) {
    root._slgCommand = null;
    root._slgSource = null;
    root.classList.remove("is-targeting");
    slgCells(root).forEach(function (cell) { cell.classList.remove("is-target"); });
    $$('[data-game-act="slg-command"]', root).forEach(function (button) {
      button.classList.remove("is-active");
      if (button.getAttribute("data-command") === "cancel") button.disabled = true;
    });
  }

  function selectSlg(cell, root) {
    if (root._slgCommand && cell !== root._slgSource) { resolveSlgTarget(cell, root); return; }
    clearSlgTargets(root);
    slgCells(root).forEach(function (item) {
      item.classList.toggle("is-selected", item === cell);
      item.setAttribute("aria-selected", item === cell ? "true" : "false");
    });
    root._slgSelected = cell;
    var owner = cell.getAttribute("data-owner") || "neutral";
    var power = num(cell.getAttribute("data-power"), 0);
    var label = cell.getAttribute("data-label") || "地块";
    var selection = $("[data-slg-selection]", root);
    var detail = $("[data-slg-detail]", root);
    if (selection) selection.textContent = label + " · " + (ownerNames[owner] || owner) + " · 兵力 " + power;
    if (detail) detail.textContent = owner === "player" ? "可侦察，或向相邻地块行军/进攻。" : "可侦察；进攻需先选择相邻的己方地块。";
    $$('[data-game-act="slg-command"]', root).forEach(function (button) {
      var command = button.getAttribute("data-command");
      if (command === "scout") button.disabled = false;
      if (command === "move" || command === "attack") button.disabled = owner !== "player" || power < 2;
    });
    replay(cell, "anim-pop");
  }

  function slgTargetable(source, target, command) {
    var distance = Math.abs(num(source.getAttribute("data-x"), 0) - num(target.getAttribute("data-x"), 0)) + Math.abs(num(source.getAttribute("data-y"), 0) - num(target.getAttribute("data-y"), 0));
    if (distance !== 1) return false;
    var terrain = target.getAttribute("data-terrain");
    if (terrain === "water" || terrain === "mountain") return false;
    var owner = target.getAttribute("data-owner");
    return command === "attack" ? owner === "enemy" : owner !== "enemy";
  }

  function commandSlg(button, root) {
    var command = button.getAttribute("data-command");
    if (command === "cancel") {
      clearSlgTargets(root);
      announce(root, "已取消指令。");
      return;
    }
    var selected = root._slgSelected;
    if (!selected) { announce(root, "请先选择地块", true); return; }
    if (command === "scout") {
      selected.classList.add("is-scouted");
      replay(selected, "anim-glow-once");
      var owner = selected.getAttribute("data-owner") || "neutral";
      announce(root, (selected.getAttribute("data-label") || "地块") + " 侦察完成：" + (ownerNames[owner] || owner) + "，兵力 " + selected.getAttribute("data-power") + "。");
      return;
    }
    if (selected.getAttribute("data-owner") !== "player" || num(selected.getAttribute("data-power"), 0) < 2) {
      announce(root, "行军与进攻需要至少 2 点兵力的己方地块", true);
      return;
    }
    clearSlgTargets(root);
    root._slgCommand = command;
    root._slgSource = selected;
    root.classList.add("is-targeting");
    button.classList.add("is-active");
    var cancel = $('[data-command="cancel"]', root);
    if (cancel) cancel.disabled = false;
    slgCells(root).forEach(function (cell) {
      cell.classList.toggle("is-target", slgTargetable(selected, cell, command));
    });
    var detail = $("[data-slg-detail]", root);
    if (detail) detail.textContent = command === "attack" ? "选择一个高亮的相邻敌方地块。" : "选择一个高亮的相邻可通行地块。";
    announce(root, command === "attack" ? "进攻模式：请选择相邻敌方目标。" : "行军模式：请选择相邻目标格。");
  }

  function resolveSlgTarget(target, root) {
    var source = root._slgSource;
    var command = root._slgCommand;
    if (!source || !command) { selectSlg(target, root); return; }
    if (!slgTargetable(source, target, command)) {
      announce(root, "目标不相邻或不符合当前指令，请选择高亮地块", true);
      replay(target, "anim-shake");
      return;
    }
    var sourcePower = num(source.getAttribute("data-power"), 0);
    var targetPower = num(target.getAttribute("data-power"), 0);
    if (command === "move") {
      var amount = Math.max(1, Math.floor(sourcePower / 2));
      source.setAttribute("data-power", String(sourcePower - amount));
      target.setAttribute("data-power", String(targetPower + amount));
      if (target.getAttribute("data-owner") === "neutral") target.setAttribute("data-owner", "player");
      updateSlgCell(source);
      updateSlgCell(target);
      floatText(source, "-" + amount, "damage");
      floatText(target, "+" + amount, "heal");
      replay(target, "anim-land");
      announce(root, "已调动 " + amount + " 点兵力至 " + target.getAttribute("data-label") + "。");
    } else {
      var damage = Math.min(targetPower, Math.max(1, Math.ceil(sourcePower / 2)));
      var loss = Math.min(sourcePower - 1, Math.max(1, Math.floor(targetPower / 3)));
      source.setAttribute("data-power", String(sourcePower - loss));
      target.setAttribute("data-power", String(targetPower - damage));
      if (targetPower - damage <= 0) target.setAttribute("data-owner", "neutral");
      updateSlgCell(source);
      updateSlgCell(target);
      floatText(target, "-" + damage, "damage");
      replay(source, "anim-lunge");
      replay(target, "anim-hit");
      announce(root, "进攻结算：敌方损失 " + damage + "，己方损失 " + loss + (targetPower - damage <= 0 ? "；守军已溃散，可行军占领。" : "。"));
    }
    clearSlgTargets(root);
    selectSlg(source, root);
  }

  function endSlgTurn(root) {
    clearSlgTargets(root);
    var turn = num(root.getAttribute("data-turn"), 1) + 1;
    root.setAttribute("data-turn", String(turn));
    var turnEl = $("[data-slg-turn]", root);
    if (turnEl) { turnEl.textContent = String(turn); turnEl.setAttribute("data-ux-turn", String(turn)); }
    announce(root, "第 " + turn + " 回合：行军与攻击指令已就绪。");
  }

  /* ── 卡牌战斗：手牌、目标、费用、回合 ────────── */
  function cardHand(root) { return $("[data-ux-hand]", root); }
  function handCards(root) { var hand = cardHand(root); return hand ? $$("[data-ux-card]", hand) : []; }
  function livingEnemies(root) {
    return $$(".ux-cardbattle__enemy", root).filter(function (unit) { return num(unit.getAttribute("data-hp"), 0) > 0; });
  }

  function updateCardEnergy(root) {
    var energy = Math.max(0, num(root.getAttribute("data-energy"), 0));
    var max = Math.max(0, num(root.getAttribute("data-max-energy"), 3));
    var energyEl = $("[data-card-energy]", root);
    if (energyEl) energyEl.textContent = energy + "/" + max;
    handCards(root).forEach(function (card) {
      var unavailable = num(card.getAttribute("data-cost"), 0) > energy;
      card.classList.toggle("is-disabled", unavailable);
      card.setAttribute("aria-disabled", unavailable ? "true" : "false");
    });
  }

  function selectCard(card, root) {
    var cost = num(card.getAttribute("data-cost"), 0);
    var energy = num(root.getAttribute("data-energy"), 0);
    if (cost > energy) {
      announce(root, "能量不足：需要 " + cost + "，当前 " + energy, true);
      replay(card, "anim-shake");
      return;
    }
    handCards(root).forEach(function (item) {
      item.classList.toggle("is-selected", item === card);
      item.setAttribute("aria-selected", item === card ? "true" : "false");
    });
    var name = $(".ux-game-card__name", card);
    announce(root, "已选择「" + (name ? name.textContent : "卡牌") + "」，点击「打出卡牌」确认。");
    replay(card, "anim-pop");
  }

  function selectCardTarget(target, root) {
    if (num(target.getAttribute("data-hp"), 0) <= 0) { announce(root, "该目标已被击败", true); return; }
    $$(".ux-cardbattle__enemy", root).forEach(function (unit) {
      unit.classList.toggle("is-selected", unit === target);
      unit.setAttribute("aria-pressed", unit === target ? "true" : "false");
    });
    announce(root, "目标：" + (target.getAttribute("data-name") || "敌人") + "。");
  }

  function checkCardResult(root) {
    var alive = livingEnemies(root);
    var selectedAlive = $$(".ux-cardbattle__enemy.is-selected", root).filter(function (unit) { return num(unit.getAttribute("data-hp"), 0) > 0; })[0];
    if (!selectedAlive) {
      var nextTarget = alive[0] || null;
      $$(".ux-cardbattle__enemy", root).forEach(function (unit) {
        unit.classList.toggle("is-selected", unit === nextTarget);
        unit.setAttribute("aria-pressed", unit === nextTarget ? "true" : "false");
      });
    }
    if (!alive.length) {
      root.setAttribute("data-result", "victory");
      root.classList.add("is-victory");
      announce(root, "胜利！所有敌方目标均已被击败。");
      return true;
    }
    var player = $("[data-player]", root);
    if (player && num(player.getAttribute("data-hp"), 0) <= 0) {
      root.setAttribute("data-result", "defeat");
      root.classList.add("is-defeat");
      announce(root, "挑战失败：请调整卡组后重试。", true);
      return true;
    }
    return false;
  }

  function playCard(root) {
    if (root.getAttribute("data-result")) { announce(root, "本局已结算", true); return; }
    var card = handCards(root).filter(function (item) { return item.classList.contains("is-selected"); })[0];
    if (!card) { announce(root, "请先选择一张手牌", true); return; }
    var cost = num(card.getAttribute("data-cost"), 0);
    var energy = num(root.getAttribute("data-energy"), 0);
    if (cost > energy) { announce(root, "能量不足", true); return; }
    var targetType = card.getAttribute("data-target") || "enemy";
    var targets = [];
    if (targetType === "all") targets = livingEnemies(root);
    else if (targetType === "self") targets = [$("[data-player]", root)];
    else {
      var selected = $$(".ux-cardbattle__enemy.is-selected", root).filter(function (unit) { return num(unit.getAttribute("data-hp"), 0) > 0; })[0];
      targets = [selected || livingEnemies(root)[0]];
    }
    targets = targets.filter(Boolean);
    if (!targets.length) { announce(root, "没有可用目标", true); return; }
    var damage = num(card.getAttribute("data-damage"), 0);
    var heal = num(card.getAttribute("data-heal"), 0);
    var block = num(card.getAttribute("data-block"), 0);
    var player = $("[data-player]", root);
    if (damage) targets.forEach(function (unit) { changeHp(unit, -damage); });
    if (heal && player) changeHp(player, heal);
    if (block && player) {
      player.setAttribute("data-block", String(num(player.getAttribute("data-block"), 0) + block));
      floatText(player, "护盾 +" + block, "shield");
      replay(player, "anim-glow-once");
    }
    root.setAttribute("data-energy", String(energy - cost));
    updateCardEnergy(root);
    var name = $(".ux-game-card__name", card);
    card.classList.remove("is-selected");
    card.setAttribute("aria-selected", "false");
    card.classList.add("is-leaving");
    setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, reducedMotion() ? 10 : 240);
    announce(root, "已打出「" + (name ? name.textContent : "卡牌") + "」，消耗 " + cost + " 点能量。");
    checkCardResult(root);
  }

  function drawCard(root, silent) {
    var hand = cardHand(root);
    var deck = $("[data-card-deck]", root);
    if (!hand || !deck || !deck.content.firstElementChild) {
      if (!silent) announce(root, "牌库已空", true);
      return false;
    }
    if (handCards(root).length >= num(root.getAttribute("data-max-hand"), 7)) {
      if (!silent) announce(root, "手牌已满", true);
      return false;
    }
    var source = deck.content.firstElementChild;
    var card = source.cloneNode(true);
    deck.content.removeChild(source);
    hand.appendChild(card);
    replay(card, "anim-deal");
    var count = $("[data-card-deck-count]", root);
    if (count) count.textContent = String(deck.content.children.length);
    updateCardEnergy(root);
    if (!silent) announce(root, "已抽 1 张牌，牌库剩余 " + deck.content.children.length + " 张。");
    return true;
  }

  function endCardTurn(root) {
    if (root.getAttribute("data-result")) { announce(root, "本局已结算", true); return; }
    var player = $("[data-player]", root);
    var attack = livingEnemies(root).reduce(function (sum, unit) { return sum + num(unit.getAttribute("data-attack"), 1); }, 0);
    var block = player ? num(player.getAttribute("data-block"), 0) : 0;
    var damage = Math.max(0, attack - block);
    livingEnemies(root).forEach(function (unit) { replay(unit, "anim-lunge"); });
    if (player) {
      player.setAttribute("data-block", "0");
      if (damage) changeHp(player, -damage);
      else if (attack) floatText(player, "格挡", "shield");
    }
    if (checkCardResult(root)) return;
    var turn = num(root.getAttribute("data-turn"), 1) + 1;
    root.setAttribute("data-turn", String(turn));
    var turnEl = $("[data-card-turn]", root);
    if (turnEl) { turnEl.textContent = String(turn); turnEl.setAttribute("data-ux-turn", String(turn)); }
    root.setAttribute("data-energy", root.getAttribute("data-max-energy") || "3");
    updateCardEnergy(root);
    drawCard(root, true);
    announce(root, "第 " + turn + " 回合：敌方造成 " + damage + " 点伤害，能量已恢复并抽 1 张牌。");
  }

  /* ── 打牌：多选、提示、理牌、出牌 ────────────── */
  function pokerCards(root) { var hand = $("[data-ux-hand]", root); return hand ? $$("[data-ux-card]", hand) : []; }
  function availablePoker(root) { return pokerCards(root).filter(function (card) { return !card.disabled && !card.classList.contains("is-leaving"); }); }
  function selectedPoker(root) { return availablePoker(root).filter(function (card) { return card.classList.contains("is-selected"); }); }
  function setPokerSelected(card, selected) {
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-selected", selected ? "true" : "false");
  }
  function validPokerSet(cards, rule) {
    if (!cards.length) return false;
    if (rule === "single") return cards.length === 1;
    if (rule === "pair") return cards.length === 2 && cards[0].getAttribute("data-rank") === cards[1].getAttribute("data-rank");
    return true;
  }

  function selectPoker(card, root) {
    if (card.disabled || card.classList.contains("is-leaving")) return;
    setPokerSelected(card, !card.classList.contains("is-selected"));
    replay(card, "anim-pop");
    var count = selectedPoker(root).length;
    announce(root, count ? "已选择 " + count + " 张牌。" : "已取消选择。");
  }

  function hintPoker(root) {
    var cards = availablePoker(root);
    var rule = root.getAttribute("data-rule") || "free";
    cards.forEach(function (card) { setPokerSelected(card, false); });
    var chosen = [];
    if (rule === "pair") {
      for (var i = 0; i < cards.length && !chosen.length; i++) {
        for (var j = i + 1; j < cards.length; j++) {
          if (cards[i].getAttribute("data-rank") === cards[j].getAttribute("data-rank")) { chosen = [cards[i], cards[j]]; break; }
        }
      }
    } else chosen = cards.slice(0, rule === "single" ? 1 : Math.min(2, cards.length));
    chosen.forEach(function (card) { setPokerSelected(card, true); replay(card, "anim-deal"); });
    announce(root, chosen.length ? "已为你选择 " + chosen.length + " 张可出的牌。" : "当前没有符合规则的牌型。", !chosen.length);
  }

  function sortPoker(root) {
    var hand = $("[data-ux-hand]", root);
    if (!hand) return;
    root._pokerDescending = !root._pokerDescending;
    var direction = root._pokerDescending ? -1 : 1;
    availablePoker(root).sort(function (a, b) {
      var diff = num(a.getAttribute("data-value"), 0) - num(b.getAttribute("data-value"), 0);
      if (!diff) return String(a.getAttribute("data-suit")).localeCompare(String(b.getAttribute("data-suit"))) * direction;
      return diff * direction;
    }).forEach(function (card) { hand.appendChild(card); });
    announce(root, root._pokerDescending ? "已按牌点从大到小整理。" : "已按牌点从小到大整理。");
  }

  function advancePokerTurn(root, message) {
    var opponents = $$("[data-opponent]", root);
    var opponent = opponents.filter(function (item) { return num(item.getAttribute("data-count"), 0) > 0; })[0];
    if (opponent) {
      var remaining = num(opponent.getAttribute("data-count"), 0) - 1;
      opponent.setAttribute("data-count", String(remaining));
      var count = $("[data-opponent-count]", opponent);
      if (count) count.textContent = String(remaining);
      replay(opponent, "anim-deal");
    }
    var turn = num(root.getAttribute("data-turn"), 1) + 1;
    root.setAttribute("data-turn", String(turn));
    var turnEl = $("[data-poker-turn]", root);
    if (turnEl) { turnEl.textContent = String(turn); turnEl.setAttribute("data-ux-turn", String(turn)); }
    setTimeout(function () { announce(root, message + (opponent ? " 对手跟出 1 张。" : "")); }, reducedMotion() ? 20 : 320);
  }

  function playPoker(root) {
    var cards = selectedPoker(root);
    var rule = root.getAttribute("data-rule") || "free";
    if (!validPokerSet(cards, rule)) {
      var message = rule === "pair" ? "对子规则：请选择两张点数相同的牌" : rule === "single" ? "单张规则：请只选择一张牌" : "请先选择要出的牌";
      announce(root, message, true);
      return;
    }
    var trick = $("[data-poker-trick]", root);
    if (trick) {
      trick.textContent = "";
      var set = doc.createElement("div");
      set.className = "ux-poker__played-set";
      cards.forEach(function (card) {
        var played = card.cloneNode(true);
        played.removeAttribute("data-game-act");
        played.removeAttribute("data-ux-card");
        played.setAttribute("aria-selected", "false");
        played.disabled = true;
        played.classList.remove("is-selected");
        played.classList.add("ux-poker-card--played");
        set.appendChild(played);
      });
      trick.appendChild(set);
    }
    var hand = $("[data-ux-hand]", root);
    cards.forEach(function (card) {
      setPokerSelected(card, false);
      card.disabled = true;
      card.classList.add("is-leaving");
      setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, reducedMotion() ? 10 : 220);
    });
    var remaining = pokerCards(root).length - cards.length;
    var count = $("[data-poker-count]", root);
    if (count) count.textContent = String(remaining);
    if (!remaining) root.setAttribute("data-result", "victory");
    advancePokerTurn(root, "已打出 " + cards.length + " 张牌。" + (!remaining ? " 你已出完手牌，获胜！" : ""));
    if (hand) replay(hand, "anim-glow-once");
  }

  function passPoker(root) {
    pokerCards(root).forEach(function (card) { setPokerSelected(card, false); });
    advancePokerTurn(root, "你选择不出。");
  }

  /* ── 自走棋：购买、站位、羁绊、升星、回合 ────── */
  function tacticsSlots(root, zone) {
    var selector = "[data-ux-slot]" + (zone ? '[data-zone="' + zone + '"]' : "");
    return $$(selector, root);
  }
  function slotUnit(slot) { return slot ? $("[data-ux-unit]", slot) : null; }
  function tacticsUnits(root, zone, playerOnly) {
    return tacticsSlots(root, zone).map(slotUnit).filter(function (unit) { return unit && (!playerOnly || unit.getAttribute("data-team") !== "enemy"); });
  }
  function updateTacticsSlot(slot) {
    var unit = slotUnit(slot);
    slot.classList.toggle("is-occupied", !!unit);
    var zone = slot.getAttribute("data-zone") === "board" ? "棋盘" : "备战席";
    slot.setAttribute("aria-label", unit ? (unit.getAttribute("data-name") || "单位") + "，" + zone : zone + "空位 " + (num(slot.getAttribute("data-slot-index"), 0) + 1));
  }

  function updateTactics(root) {
    var gold = num(root.getAttribute("data-gold"), 0);
    var level = num(root.getAttribute("data-level"), 1);
    var xp = num(root.getAttribute("data-xp"), 0);
    var xpNext = Math.max(1, num(root.getAttribute("data-xp-next"), 8));
    var cap = Math.max(1, num(root.getAttribute("data-cap"), level));
    var turn = num(root.getAttribute("data-turn"), 1);
    var values = {
      "[data-tactics-gold]": gold,
      "[data-tactics-level]": level,
      "[data-tactics-xp]": xp + "/" + xpNext,
      "[data-tactics-cap]": tacticsUnits(root, "board", true).length + "/" + cap,
      "[data-tactics-turn]": turn,
    };
    Object.keys(values).forEach(function (selector) {
      var el = $(selector, root);
      if (el) el.textContent = String(values[selector]);
    });
    var turnEl = $("[data-tactics-turn]", root);
    if (turnEl) turnEl.setAttribute("data-ux-turn", String(turn));
    var traits = {};
    tacticsUnits(root, "board", true).forEach(function (unit) {
      var trait = unit.getAttribute("data-trait");
      if (trait) traits[trait] = (traits[trait] || 0) + 1;
    });
    $$("[data-trait-chip]", root).forEach(function (chip) {
      var count = traits[chip.getAttribute("data-trait-chip")] || 0;
      var countEl = $("[data-trait-count]", chip);
      var need = countEl ? Math.max(1, num(countEl.getAttribute("data-need"), 2)) : 1;
      if (countEl) countEl.textContent = count + "/" + need;
      chip.classList.toggle("is-active", count >= need);
    });
    $$(".ux-tactics__offer", root).forEach(function (offer) {
      var poor = num(offer.getAttribute("data-cost"), 1) > gold;
      offer.classList.toggle("is-unaffordable", poor);
      offer.setAttribute("aria-disabled", poor || offer.disabled ? "true" : "false");
    });
  }

  function clearTacticsSelection(root) {
    tacticsSlots(root).forEach(function (slot) { slot.classList.remove("is-selected"); });
    root._tacticsSelected = null;
  }

  function combineTactics(root) {
    var combined = true;
    var any = false;
    while (combined) {
      combined = false;
      var groups = {};
      tacticsUnits(root, null, true).forEach(function (unit) {
        var key = (unit.getAttribute("data-unit-id") || unit.getAttribute("data-name")) + "@" + (unit.getAttribute("data-star") || "1");
        if (!groups[key]) groups[key] = [];
        groups[key].push(unit);
      });
      var keys = Object.keys(groups);
      for (var i = 0; i < keys.length; i++) {
        var group = groups[keys[i]];
        if (group.length < 3) continue;
        var keep = group[0];
        group.slice(1, 3).forEach(function (unit) {
          var slot = unit.parentNode;
          if (unit.parentNode) unit.parentNode.removeChild(unit);
          if (slot && slot.hasAttribute("data-ux-slot")) updateTacticsSlot(slot);
        });
        var star = num(keep.getAttribute("data-star"), 1) + 1;
        keep.setAttribute("data-star", String(star));
        keep.setAttribute("data-attack", String(Math.ceil(num(keep.getAttribute("data-attack"), 1) * 1.5)));
        var maxHp = Math.ceil(num(keep.getAttribute("data-max-hp"), 100) * 1.5);
        keep.setAttribute("data-max-hp", String(maxHp));
        setHp(keep, maxHp);
        var stars = $("[data-unit-stars]", keep);
        if (stars) stars.textContent = "★".repeat(star);
        replay(keep, "anim-level-up");
        floatText(keep, star + " 星", "buff");
        announce(root, "合成成功：" + (keep.getAttribute("data-name") || "棋子") + " 升至 " + star + " 星！");
        any = true;
        combined = true;
        break;
      }
    }
    return any;
  }

  function selectTacticsSlot(slot, root) {
    if (root._tacticsBusy) return;
    var selected = root._tacticsSelected;
    var unit = slotUnit(slot);
    if (!selected) {
      if (!unit || unit.getAttribute("data-team") === "enemy") {
        announce(root, unit ? "敌方单位不能在准备阶段移动" : "请先选择一个己方棋子", true);
        return;
      }
      root._tacticsSelected = slot;
      slot.classList.add("is-selected");
      announce(root, "已选择 " + (unit.getAttribute("data-name") || "棋子") + "，点击目标格移动；再次点击取消。");
      return;
    }
    if (selected === slot) {
      clearTacticsSelection(root);
      announce(root, "已取消站位调整。");
      return;
    }
    var moving = slotUnit(selected);
    var target = slotUnit(slot);
    if (!moving) { clearTacticsSelection(root); return; }
    if (target && target.getAttribute("data-team") === "enemy") {
      announce(root, "不能与敌方单位交换位置", true);
      return;
    }
    var fromBoard = selected.getAttribute("data-zone") === "board";
    var toBoard = slot.getAttribute("data-zone") === "board";
    if (!fromBoard && toBoard && !target && tacticsUnits(root, "board", true).length >= num(root.getAttribute("data-cap"), 1)) {
      announce(root, "人口已满：升级或下阵后再试", true);
      replay($("[data-tactics-cap]", root), "anim-shake");
      return;
    }
    if (target) selected.appendChild(target);
    slot.appendChild(moving);
    updateTacticsSlot(selected);
    updateTacticsSlot(slot);
    clearTacticsSelection(root);
    replay(moving, "anim-land");
    if (!combineTactics(root)) announce(root, toBoard ? "已上阵并更新站位与羁绊。" : "已下阵至备战席。");
    updateTactics(root);
  }

  function buyTactics(offer, root) {
    if (offer.disabled || root._tacticsBusy) return;
    var cost = num(offer.getAttribute("data-cost"), 1);
    var gold = num(root.getAttribute("data-gold"), 0);
    if (cost > gold) { announce(root, "金币不足，需要 " + cost, true); replay(offer, "anim-shake"); return; }
    var empty = tacticsSlots(root, "bench").filter(function (slot) { return !slotUnit(slot); })[0];
    if (!empty) { announce(root, "备战席已满，请先上阵或调整棋子", true); return; }
    var template = $("[data-unit-template]", offer);
    if (!template || !template.content.firstElementChild) return;
    var unit = template.content.firstElementChild.cloneNode(true);
    empty.appendChild(unit);
    updateTacticsSlot(empty);
    root.setAttribute("data-gold", String(gold - cost));
    offer.disabled = true;
    offer.classList.add("is-sold");
    replay(unit, "anim-deal");
    announce(root, "已购买 " + (unit.getAttribute("data-name") || "棋子") + "，消耗 " + cost + " 金币。");
    combineTactics(root);
    updateTactics(root);
  }

  function refreshTactics(root) {
    var cost = num(root.getAttribute("data-refresh-cost"), 2);
    var gold = num(root.getAttribute("data-gold"), 0);
    if (cost > gold) { announce(root, "金币不足，无法刷新", true); return; }
    var shop = $("[data-tactics-shop]", root);
    var offers = $$(".ux-tactics__offer", root);
    if (!shop || !offers.length) return;
    root.setAttribute("data-gold", String(gold - cost));
    shop.appendChild(offers[0]);
    $$(".ux-tactics__offer", root).forEach(function (offer) {
      offer.disabled = false;
      offer.classList.remove("is-sold");
      replay(offer, "anim-deal");
    });
    announce(root, "商店已刷新，消耗 " + cost + " 金币。");
    updateTactics(root);
  }

  function buyTacticsXp(root) {
    var cost = num(root.getAttribute("data-xp-cost"), 4);
    var gold = num(root.getAttribute("data-gold"), 0);
    if (cost > gold) { announce(root, "金币不足，无法购买经验", true); return; }
    root.setAttribute("data-gold", String(gold - cost));
    var xp = num(root.getAttribute("data-xp"), 0) + 4;
    var next = Math.max(1, num(root.getAttribute("data-xp-next"), 8));
    var level = num(root.getAttribute("data-level"), 1);
    var leveled = false;
    while (xp >= next) {
      xp -= next;
      level += 1;
      next = level * 4;
      root.setAttribute("data-level", String(level));
      root.setAttribute("data-cap", String(Math.max(num(root.getAttribute("data-cap"), 1), level)));
      root.setAttribute("data-xp-next", String(next));
      leveled = true;
    }
    root.setAttribute("data-xp", String(xp));
    if (leveled) {
      var status = $(".ux-tactics__status", root);
      replay(status, "anim-level-up");
      floatText(status, "Lv." + level, "buff");
    }
    announce(root, leveled ? "升级至 Lv." + level + "，上阵人口已提升。" : "已购买 4 点经验。");
    updateTactics(root);
  }

  function battleTactics(root) {
    if (root._tacticsBusy) return;
    var players = tacticsUnits(root, "board", true);
    if (!players.length) { announce(root, "请先至少上阵一个棋子", true); return; }
    root._tacticsBusy = true;
    var enemies = tacticsSlots(root, "board").map(slotUnit).filter(function (unit) { return unit && unit.getAttribute("data-team") === "enemy"; });
    players.concat(enemies).forEach(function (unit) {
      setHp(unit, num(unit.getAttribute("data-max-hp"), 100));
    });
    var power = players.reduce(function (sum, unit) { return sum + num(unit.getAttribute("data-attack"), 1) * num(unit.getAttribute("data-star"), 1); }, 0);
    var enemyPower = num(root.getAttribute("data-enemy-power"), 6);
    var victory = power >= enemyPower;
    players.forEach(function (unit, index) {
      setTimeout(function () {
        replay(unit, "anim-lunge");
        floatText(unit, String(num(unit.getAttribute("data-attack"), 1)), "damage");
      }, reducedMotion() ? 0 : index * 70);
    });
    if (enemies.length) {
      var damage = Math.max(1, Math.ceil(power / enemies.length));
      enemies.forEach(function (unit) { changeHp(unit, -damage); });
    }
    var board = $("[data-tactics-board]", root);
    floatText(board, victory ? "胜利" : "失利", victory ? "heal" : "damage");
    var turn = num(root.getAttribute("data-turn"), 1) + 1;
    var income = victory ? 5 : 3;
    root.setAttribute("data-turn", String(turn));
    root.setAttribute("data-gold", String(num(root.getAttribute("data-gold"), 0) + income));
    root.setAttribute("data-enemy-power", String(enemyPower + 2));
    announce(root, (victory ? "战斗胜利" : "战斗失利") + "：战力 " + power + " vs " + enemyPower + "，获得 " + income + " 金币。");
    updateTactics(root);
    setTimeout(function () { root._tacticsBusy = false; }, reducedMotion() ? 30 : 750);
  }

  /* ── 事件委托与键盘支持 ─────────────────────── */
  app.addEventListener("click", function (event) {
    var target = event.target.closest ? event.target.closest("[data-game-act]") : null;
    if (!target || !app.contains(target)) return;
    var action = target.getAttribute("data-game-act");
    var root = gameRoot(target);
    if (!root) return;
    emit(action, target, root);
    switch (action) {
      case "use-item": useItem(target, root); break;
      case "slg-select": selectSlg(target, root); break;
      case "slg-command": commandSlg(target, root); break;
      case "slg-end": endSlgTurn(root); break;
      case "card-select": selectCard(target, root); break;
      case "card-target": selectCardTarget(target, root); break;
      case "card-play": playCard(root); break;
      case "card-draw": drawCard(root, false); break;
      case "card-end": endCardTurn(root); break;
      case "poker-select": selectPoker(target, root); break;
      case "poker-play": playPoker(root); break;
      case "poker-hint": hintPoker(root); break;
      case "poker-sort": sortPoker(root); break;
      case "poker-pass": passPoker(root); break;
      case "tactics-slot": selectTacticsSlot(target, root); break;
      case "tactics-buy": buyTactics(target, root); break;
      case "tactics-refresh": refreshTactics(root); break;
      case "tactics-xp": buyTacticsXp(root); break;
      case "tactics-battle": battleTactics(root); break;
    }
  });

  app.addEventListener("keydown", function (event) {
    var target = event.target.closest ? event.target.closest('[role="button"][data-game-act]') : null;
    if (!target || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    target.click();
  });

  $$('[data-game-root="card"]', app).forEach(updateCardEnergy);
  $$('[data-game-root="tactics"]', app).forEach(updateTactics);

  window.UXGame = {
    setHp: setHp,
    changeHp: changeHp,
    floatText: floatText,
    replay: replay,
    announce: announce,
    refresh: function (root) {
      if (!root) return;
      if (root.getAttribute("data-game-root") === "card") updateCardEnergy(root);
      if (root.getAttribute("data-game-root") === "tactics") updateTactics(root);
    },
    reducedMotion: reducedMotion,
  };
})();
