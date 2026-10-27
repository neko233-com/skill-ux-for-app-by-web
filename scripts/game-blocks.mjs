/* game-blocks.mjs — 游戏玩法 block 的确定性 HTML 渲染器（零依赖） */

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function statusList(unit) {
  return (unit.statuses || []).map((status) => {
    const item = typeof status === "string" ? { label: status } : status;
    return { icon: item.icon || "", label: item.label || item.name || "", tone: item.tone || "accent" };
  }).filter((item) => item.label || item.icon);
}

export function renderGameBlock(block, ctx, { esc, iconHtml }) {
  const p = block.props || {};
  const art = (value, size = 24, fallback = "✦") => value ? iconHtml(value, size) : esc(fallback);
  const iconName = (value, fallback = "✦") => value || fallback;

  function unitData(unit) {
    const maxHp = Math.max(1, number(unit.maxHp ?? unit.max ?? unit.hp, 100));
    const hp = clamp(number(unit.hp, maxHp), 0, maxHp);
    return [
      `data-unit-id="${esc(unit.id || unit.name || "unit")}"`,
      `data-name="${esc(unit.name || "单位")}"`,
      `data-icon="${esc(iconName(unit.icon))}"`,
      `data-hp="${hp}"`,
      `data-max-hp="${maxHp}"`,
      `data-attack="${Math.max(0, number(unit.attack, 1))}"`,
      `data-cost="${Math.max(0, number(unit.cost, 1))}"`,
      `data-star="${Math.max(1, number(unit.star, 1))}"`,
      `data-team="${esc(unit.team || "player")}"`,
      `data-trait="${esc(unit.trait || "")}"`,
    ].join(" ");
  }

  function healthHtml(unit) {
    const maxHp = Math.max(1, number(unit.maxHp ?? unit.max ?? unit.hp, 100));
    const hp = clamp(number(unit.hp, maxHp), 0, maxHp);
    return `<span class="ux-unit-health" aria-label="生命 ${hp} / ${maxHp}"><i data-hp-fill style="width:${hp / maxHp * 100}%"></i></span><span class="ux-unit-health__text" data-hp-text>${hp}/${maxHp}</span>`;
  }

  function miniOverhead(unit) {
    const statuses = statusList(unit).map((item) =>
      `<span class="ux-unit__status" data-tone="${esc(item.tone)}" title="${esc(item.label)}">${art(item.icon, 12, "✦")}<span class="u-sr-only">${esc(item.label)}</span></span>`
    ).join("");
    const items = (unit.items || []).map((item) =>
      `<span class="ux-unit__item" title="${esc(item.name || "道具")}">${art(item.icon, 12, "🎒")}${item.qty != null ? `<b>${esc(item.qty)}</b>` : ""}</span>`
    ).join("");
    if (!statuses && !items) return "";
    return `<span class="ux-unit__overhead" data-ux-overhead><span class="ux-unit__statuses">${statuses}</span><span class="ux-unit__items">${items}</span></span>`;
  }

  function unitInner(unit, compact = false) {
    return `${miniOverhead(unit)}<span class="ux-unit__stars" data-unit-stars>${"★".repeat(Math.max(1, number(unit.star, 1)))}</span><span class="ux-unit__avatar">${art(unit.icon, compact ? 22 : 30)}</span><span class="ux-unit__name">${esc(unit.name || "单位")}</span>${healthHtml(unit)}`;
  }

  function unitToken(unit, compact = false) {
    return `<div class="ux-unit${compact ? " ux-unit--compact" : ""}" data-ux-unit ${unitData(unit)}>${unitInner(unit, compact)}</div>`;
  }

  function logHtml(text) {
    return `<div class="ux-game-log" data-game-log role="status" aria-live="polite">${esc(text)}</div>`;
  }

  function actionButton(action, label, icon, extra = "", className = "") {
    return `<button class="ux-game-action${className ? " " + className : ""}" type="button" data-game-act="${esc(action)}" ${extra}>${icon ? art(icon, 16) : ""}<span>${esc(label)}</span></button>`;
  }

  switch (block.type) {
    case "overhead-bar": {
      const unit = { ...p, id: p.id || p.name || "player", icon: p.avatar || p.icon };
      const statuses = statusList(p).map((item) =>
        `<span class="ux-overhead__status" data-tone="${esc(item.tone)}">${art(item.icon, 13, "✦")}${esc(item.label)}</span>`
      ).join("");
      const items = (p.items || []).map((item, index) => {
        const qty = Math.max(0, number(item.qty, 1));
        const disabled = item.disabled || qty === 0;
        return `<button class="ux-overhead__item" type="button" data-game-act="use-item" data-item-index="${index}" data-item-name="${esc(item.name || "道具")}" data-qty="${qty}" data-effect="${esc(item.effect || "heal")}" data-value="${number(item.value, 10)}" aria-label="${esc(item.name || "道具")}，剩余 ${qty}" ${disabled ? "disabled" : ""}>${art(item.icon, 20, "🎒")}<span class="ux-overhead__qty" data-item-qty>${qty}</span></button>`;
      }).join("");
      return `<div class="ux-overhead" data-game-root="overhead" data-ux-overhead data-ux-unit ${unitData(unit)}><div class="ux-overhead__statuses">${statuses}</div><div class="ux-overhead__items" aria-label="头顶道具栏">${items}</div><div class="ux-overhead__avatar">${art(unit.icon, 34, "🙂")}</div><div class="ux-overhead__name">${esc(p.name || "玩家")}${p.level != null ? `<span>Lv.${esc(p.level)}</span>` : ""}</div><div class="ux-overhead__health">${healthHtml(unit)}</div></div>`;
    }

    case "turn-bar": {
      const items = p.items || [
        { icon: "refresh", label: "回合", value: p.turn ?? 1, key: "turn" },
        { icon: "clock", label: "阶段", value: p.phase || "行动中", key: "phase" },
        { icon: "zap", label: "倒计时", value: p.timer || "30s", key: "timer" },
      ];
      const chips = items.map((item) => `<span class="ux-turnbar__item"${item.tone ? ` data-tone="${esc(item.tone)}"` : ""}>${art(item.icon, 15)}<span>${esc(item.label || "")}</span><strong data-game-value="${esc(item.key || item.label || "value")}"${item.key === "turn" ? ` data-ux-turn="${esc(item.value ?? 1)}"` : ""}>${esc(item.value ?? "")}</strong></span>`).join("");
      return `<div class="ux-turnbar">${chips}</div>`;
    }

    case "slg-map": {
      const cols = clamp(Math.round(number(p.cols, 5)), 3, 8);
      const source = p.cells || [];
      const rows = clamp(Math.round(number(p.rows, Math.ceil(source.length / cols) || 5)), 2, 8);
      const cells = Array.from({ length: rows * cols }, (_, index) => {
        const cell = source[index] || {};
        const x = index % cols;
        const y = Math.floor(index / cols);
        const owner = cell.owner || "neutral";
        const terrain = cell.terrain || "plain";
        const power = Math.max(0, number(cell.power, 0));
        const label = cell.label || `${x + 1}-${y + 1}`;
        return `<button class="ux-slg__cell" type="button" role="gridcell" data-game-act="slg-select" data-ux-slot data-slot-index="${index}" data-x="${x}" data-y="${y}" data-owner="${esc(owner)}" data-terrain="${esc(terrain)}" data-power="${power}" data-label="${esc(label)}" aria-selected="false" aria-label="${esc(label)}，${esc(owner)}，兵力 ${power}"><span class="ux-slg__terrain">${art(cell.icon || (terrain === "mountain" ? "⛰️" : terrain === "water" ? "🌊" : terrain === "city" ? "🏰" : "🌾"), 22, "·")}</span><span class="ux-slg__label">${esc(label)}</span><span class="ux-slg__power" data-cell-power>${power}</span></button>`;
      }).join("");
      return `<div class="ux-slg" data-game-root="slg" data-turn="1"><div class="ux-game-status"><span>回合 <strong data-ux-turn="1" data-slg-turn>1</strong></span><span data-slg-selection>未选择地块</span></div><div class="ux-slg__layout"><div class="ux-slg__map" role="grid" aria-label="战略地图" style="--slg-cols:${cols}">${cells}</div><aside class="ux-slg__panel"><div class="ux-slg__detail" data-slg-detail>选择己方地块后，可移动或攻击相邻地块。</div><div class="ux-game-actions">${actionButton("slg-command", "侦察", "eye", 'data-command="scout" disabled')}${actionButton("slg-command", "行军", "flag", 'data-command="move" disabled')}${actionButton("slg-command", "进攻", "swords", 'data-command="attack" disabled')}${actionButton("slg-command", "取消", "x", 'data-command="cancel" disabled', "ux-game-action--ghost")}${actionButton("slg-end", "结束回合", "clock", "", "ux-game-action--primary")}</div>${logHtml(p.hint || "第一步：选择带兵力的己方地块。")}</aside></div></div>`;
    }

    case "card-battle": {
      const energy = Math.max(0, number(p.energy, 3));
      const maxEnergy = Math.max(energy, number(p.maxEnergy, 3));
      const player = { name: "召唤师", icon: "🧙", hp: 30, attack: 0, ...(p.player || {}) };
      const enemies = (p.enemies || []).map((unit, index) => `<button class="ux-combat-unit ux-cardbattle__enemy${index === 0 ? " is-selected" : ""}" type="button" data-game-act="card-target" data-ux-unit ${unitData({ team: "enemy", ...unit })} aria-pressed="${index === 0 ? "true" : "false"}">${unitInner(unit)}</button>`).join("");
      const renderCard = (card, index) => `<button class="ux-game-card" type="button" data-ux-card data-card-id="${esc(card.id || card.name || `card-${index}`)}" data-game-act="card-select" data-cost="${Math.max(0, number(card.cost, 1))}" data-damage="${Math.max(0, number(card.damage, 0))}" data-heal="${Math.max(0, number(card.heal, 0))}" data-block="${Math.max(0, number(card.block, 0))}" data-target="${esc(card.target || (card.heal || card.block ? "self" : "enemy"))}" data-rarity="${esc(card.rarity || "common")}" aria-selected="false"><span class="ux-game-card__cost">${Math.max(0, number(card.cost, 1))}</span><span class="ux-game-card__art">${art(card.icon, 32, "🃏")}</span><strong class="ux-game-card__name">${esc(card.name || "卡牌")}</strong><span class="ux-game-card__desc">${esc(card.desc || card.description || "")}</span><span class="ux-game-card__type">${esc(card.type || "技能")}</span></button>`;
      const hand = (p.hand || []).map(renderCard).join("");
      const deckCards = p.deck || [];
      const deck = deckCards.map(renderCard).join("");
      return `<div class="ux-cardbattle" data-game-root="card" data-energy="${energy}" data-max-energy="${maxEnergy}" data-turn="1" data-max-hand="${Math.max(1, number(p.maxHand, 7))}"><div class="ux-game-status"><span>回合 <strong data-ux-turn="1" data-card-turn>1</strong></span><span>能量 <strong data-card-energy>${energy}/${maxEnergy}</strong></span><span>牌库 <strong data-card-deck-count>${deckCards.length}</strong></span></div><div class="ux-cardbattle__arena"><div class="ux-cardbattle__enemies" aria-label="敌方目标">${enemies}</div><div class="ux-combat-unit ux-cardbattle__player" data-player data-ux-unit ${unitData(player)}>${unitInner(player)}</div></div><div class="ux-card-hand" data-ux-hand aria-label="手牌">${hand}</div><div class="ux-game-actions ux-game-actions--spread">${actionButton("card-play", "打出卡牌", "play", "", "ux-game-action--primary")}${actionButton("card-draw", "抽一张", "plus")}${actionButton("card-end", "结束回合", "clock")}</div><template data-card-deck>${deck}</template>${logHtml(p.hint || "选择卡牌与敌方目标，再点击「打出卡牌」。")}</div>`;
    }

    case "poker-table": {
      const suits = {
        spades: { symbol: "♠", label: "黑桃", color: "black" },
        hearts: { symbol: "♥", label: "红桃", color: "red" },
        clubs: { symbol: "♣", label: "梅花", color: "black" },
        diamonds: { symbol: "♦", label: "方块", color: "red" },
        joker: { symbol: "★", label: "王牌", color: "red" },
      };
      const rankValues = { J: 11, Q: 12, K: 13, A: 14, "2": 15, "小王": 98, "大王": 99 };
      const cards = p.hand || [];
      const hand = cards.map((card, index) => {
        const suit = suits[card.suit] || suits.spades;
        const rank = card.rank || "A";
        const value = number(card.value, rankValues[rank] || number(rank, index + 1));
        return `<button class="ux-poker-card" type="button" data-ux-card data-game-act="poker-select" data-suit="${esc(card.suit || "spades")}" data-rank="${esc(rank)}" data-value="${value}" data-color="${suit.color}" aria-selected="false" aria-label="${suit.label}${esc(rank)}"><span class="ux-poker-card__rank">${esc(rank)}</span><span class="ux-poker-card__suit">${suit.symbol}</span><span class="ux-poker-card__suit ux-poker-card__suit--large">${suit.symbol}</span></button>`;
      }).join("");
      const opponents = (p.opponents || []).map((unit) => `<div class="ux-poker-opponent" data-opponent data-count="${Math.max(0, number(unit.cardCount, 10))}"><span class="ux-poker-opponent__avatar">${art(unit.icon, 24, "🙂")}</span><strong>${esc(unit.name || "对手")}</strong><span><b data-opponent-count>${Math.max(0, number(unit.cardCount, 10))}</b> 张</span></div>`).join("");
      const ruleLabels = { free: "自由出牌", single: "单张", pair: "对子" };
      return `<div class="ux-poker" data-game-root="poker" data-rule="${esc(p.rule || "free")}" data-turn="1"><div class="ux-game-status"><span>轮次 <strong data-ux-turn="1" data-poker-turn>1</strong></span><span>${esc(ruleLabels[p.rule] || ruleLabels.free)}</span><span>手牌 <strong data-poker-count>${cards.length}</strong></span></div><div class="ux-poker__opponents">${opponents}</div><div class="ux-poker__table"><div class="ux-poker__trick" data-poker-trick><span class="ux-poker__waiting">等待出牌</span></div></div><div class="ux-poker-hand" data-ux-hand aria-label="扑克手牌">${hand}</div><div class="ux-game-actions ux-game-actions--spread">${actionButton("poker-play", "出牌", "play", "", "ux-game-action--primary")}${actionButton("poker-hint", "提示", "sparkles")}${actionButton("poker-sort", "理牌", "list")}${actionButton("poker-pass", "不出", "x")}</div>${logHtml(p.hint || "可单选或多选手牌；提示会选择一组符合当前规则的牌。")}</div>`;
    }

    case "auto-chess": {
      const cols = clamp(Math.round(number(p.cols, 6)), 4, 8);
      const rows = clamp(Math.round(number(p.rows, 4)), 2, 6);
      const unitsAt = p.units || [];
      const slots = Array.from({ length: cols * rows }, (_, index) => (p.slots || [])[index] || unitsAt.find((unit) => number(unit.slot, -1) === index) || null);
      const benchSize = clamp(Math.round(number(p.benchSize, 6)), 3, 9);
      const bench = Array.from({ length: benchSize }, (_, index) => (p.bench || [])[index] || null);
      const slotHtml = (unit, index, zone) => `<div class="ux-tactics__slot${unit ? " is-occupied" : ""}" data-ux-slot data-slot-index="${index}" data-zone="${zone}" data-game-act="tactics-slot" role="button" tabindex="0" aria-label="${esc(unit ? `${unit.name || "单位"}，${zone === "board" ? "棋盘" : "备战席"}` : `${zone === "board" ? "棋盘" : "备战席"}空位 ${index + 1}`)}">${unit ? unitToken({ team: "player", ...unit }, true) : ""}</div>`;
      const offers = (p.shop || []).map((unit, index) => `<button class="ux-tactics__offer" type="button" data-game-act="tactics-buy" data-offer-index="${index}" data-cost="${Math.max(1, number(unit.cost, 1))}"><span class="ux-tactics__offer-art">${art(unit.icon, 26, "♟️")}</span><strong>${esc(unit.name || "棋子")}</strong><span>${esc(unit.trait || "无羁绊")}</span><b>🪙 ${Math.max(1, number(unit.cost, 1))}</b><template data-unit-template>${unitToken({ team: "player", ...unit }, true)}</template></button>`).join("");
      const synergies = (p.synergies || []).map((item) => `<span class="ux-tactics__synergy" data-trait-chip="${esc(item.trait || item.name)}"><strong>${esc(item.name || item.trait)}</strong><span data-trait-count data-need="${Math.max(1, number(item.need, 2))}">0/${Math.max(1, number(item.need, 2))}</span></span>`).join("");
      const gold = Math.max(0, number(p.gold, 10));
      const level = Math.max(1, number(p.level, 3));
      const cap = Math.max(1, number(p.cap, level));
      const xpNext = Math.max(1, number(p.xpNext, 8));
      return `<div class="ux-tactics" data-game-root="tactics" data-gold="${gold}" data-level="${level}" data-xp="${Math.max(0, number(p.xp, 0))}" data-xp-next="${xpNext}" data-cap="${cap}" data-turn="1" data-enemy-power="${Math.max(1, number(p.enemyPower, 6))}" data-refresh-cost="${Math.max(0, number(p.refreshCost, 2))}" data-xp-cost="${Math.max(0, number(p.xpCost, 4))}"><div class="ux-game-status ux-tactics__status"><span>🪙 <strong data-tactics-gold>${gold}</strong></span><span>Lv.<strong data-tactics-level>${level}</strong></span><span>经验 <strong data-tactics-xp>0/${xpNext}</strong></span><span>人口 <strong data-tactics-cap>0/${cap}</strong></span><span>回合 <strong data-ux-turn="1" data-tactics-turn>1</strong></span></div><div class="ux-tactics__synergies" data-tactics-synergies>${synergies}</div><div class="ux-tactics__layout"><div class="ux-tactics__board" data-tactics-board style="--tactics-cols:${cols}">${slots.map((unit, index) => slotHtml(unit, index, "board")).join("")}</div><aside class="ux-tactics__panel"><div class="ux-tactics__bench-label">备战席 · 先选棋子，再点目标格</div><div class="ux-tactics__bench" data-tactics-bench>${bench.map((unit, index) => slotHtml(unit, index, "bench")).join("")}</div><div class="ux-tactics__shop" data-tactics-shop>${offers}</div><div class="ux-game-actions ux-game-actions--spread">${actionButton("tactics-refresh", `刷新 ${number(p.refreshCost, 2)}`, "refresh")}${actionButton("tactics-xp", `升级 ${number(p.xpCost, 4)}`, "trending-up")}${actionButton("tactics-battle", "开始战斗", "swords", "", "ux-game-action--primary")}</div>${logHtml(p.hint || "购买棋子到备战席；点击棋子与空格即可上阵或调整站位。")}</aside></div></div>`;
    }

    default:
      return null;
  }
}
