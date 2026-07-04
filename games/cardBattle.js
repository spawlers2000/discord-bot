import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import CardPlayer from './models/CardPlayer.js';
import { CARDS, STARTER_DECK, getCard, rollDmg, getRewardCards } from './cardData.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);
const MAX_DECK = 50;
const MAX_HAND = 10;
const ACTION_POINTS = 4;
const START_HP = 100;

// ─── 每個頻道獨立的戰鬥狀態 ───
const battles = new Map(); // channelId → battleState

function getBattle(channelId) { return battles.get(channelId); }

function createBattleState(channelId, p1, p2) {
  return {
    channelId,
    phase: 'playing', // playing, reward, idle
    round: 1,
    turnIndex: 0, // 0 = p1, 1 = p2
    players: [
      { id: p1.id, name: p1.name, hp: START_HP, shield: 0, ap: ACTION_POINTS,
        deck: shuffle([...p1.deck]), hand: [], discard: [],
        buffs: {}, debuffs: {}, usedOnce: new Set(), firstTurn: true },
      { id: p2.id, name: p2.name, hp: START_HP, shield: 0, ap: ACTION_POINTS,
        deck: shuffle([...p2.deck]), hand: [], discard: [],
        buffs: {}, debuffs: {}, usedOnce: new Set(), firstTurn: true },
    ],
    collectors: [],
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 抽牌
function drawCards(player, count) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (player.hand.length >= MAX_HAND) break;
    if (player.deck.length === 0) {
      // 洗回棄牌堆
      if (player.discard.length === 0) break;
      player.deck = shuffle([...player.discard]);
      player.discard = [];
    }
    const card = player.deck.pop();
    player.hand.push(card);
    drawn.push(card);
  }
  return drawn;
}

// 狀態文字
function statusText(battle) {
  const [p1, p2] = battle.players;
  const arrow = battle.turnIndex === 0 ? '➡️' : '　';
  const arrow2 = battle.turnIndex === 1 ? '➡️' : '　';
  const s1 = statusLine(p1);
  const s2 = statusLine(p2);
  return `📋 **第 ${battle.round} 回合**\n\n${arrow} **${p1.name}**\n${s1}\n\n${arrow2} **${p2.name}**\n${s2}`;
}

function statusLine(p) {
  let s = `❤️ ${p.hp}/100 ｜ 🛡️ ${p.shield} ｜ ⚡ ${p.ap}`;
  const effects = [];
  if (p.debuffs.poison) effects.push(`🟣 中毒(${p.debuffs.poison.turns}回合)`);
  if (p.debuffs.paralyze) effects.push(`⚡ 麻痺(${p.debuffs.paralyze.turns}回合)`);
  if (p.buffs.atkBoost) effects.push(`🔥 攻+${p.buffs.atkBoost.pct}%(${p.buffs.atkBoost.turns})`);
  if (p.buffs.defBoost) effects.push(`🛡️ 防+${p.buffs.defBoost.pct}%(${p.buffs.defBoost.turns})`);
  if (p.buffs.dodge) effects.push('✨ 閃避');
  if (p.buffs.endure) effects.push('💪 忍耐');
  if (p.buffs.counter) effects.push(`🔄 反擊(${p.buffs.counter.dmg})`);
  if (p.buffs.smoke) effects.push(`💨 煙幕(${p.buffs.smoke.pct}%)`);
  if (p.buffs.doubleAtk) effects.push('⚔️ 攻擊翻倍');
  if (p.buffs.defDouble) effects.push('🛡️ 防禦翻倍');
  if (effects.length) s += '\n' + effects.join(' ');
  return s;
}

function handText(player) {
  if (player.hand.length === 0) return '（空）';
  const counts = {};
  for (const id of player.hand) {
    const c = getCard(id);
    const label = `${typeIcon(c.type)} ${c.name}（⚡${c.cost}）`;
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts).map(([label, cnt]) => `${label}${cnt > 1 ? ` ×${cnt}` : ''}`).join('\n');
}

function typeIcon(type) {
  return { attack: '⚔️', defense: '🛡️', heal: '💚', special: '💜' }[type] || '🃏';
}

// ─── 回合開始 ───
async function startRound(channel, battle) {
  const [p1, p2] = battle.players;

  // 回合開始：清護盾、處理中毒
  for (const p of battle.players) {
    p.shield = 0;
    p.ap = ACTION_POINTS;
    // 中毒傷害
    if (p.debuffs.poison) {
      const dmg = p.debuffs.poison.dmg;
      p.hp = Math.max(0, p.hp - dmg);
      await channel.send({ embeds: [e(`🟣 **${p.name}** 中毒，受到 ${dmg} 傷害！（❤️ ${p.hp}）`)] });
      p.debuffs.poison.turns--;
      if (p.debuffs.poison.turns <= 0) { delete p.debuffs.poison; await channel.send({ embeds: [e(`🟣 **${p.name}** 的中毒已消退`)] }); }
    }
    // 檢查死亡
    if (p.hp <= 0) {
      await endBattle(channel, battle, p === p1 ? 1 : 0);
      return;
    }
    // 減少增益回合
    for (const key of Object.keys(p.buffs)) {
      if (p.buffs[key].turns !== undefined) {
        p.buffs[key].turns--;
        if (p.buffs[key].turns <= 0) delete p.buffs[key];
      }
    }
    // 減少減益回合
    if (p.debuffs.weakenDef) {
      p.debuffs.weakenDef.turns--;
      if (p.debuffs.weakenDef.turns <= 0) delete p.debuffs.weakenDef;
    }
  }

  battle.turnIndex = 0;
  await startTurn(channel, battle);
}

// ─── 玩家回合 ───
async function startTurn(channel, battle) {
  const current = battle.players[battle.turnIndex];

  // 麻痺跳過
  if (current.debuffs.paralyze) {
    current.debuffs.paralyze.turns--;
    if (current.debuffs.paralyze.turns <= 0) delete current.debuffs.paralyze;
    await channel.send({ embeds: [e(`⚡ **${current.name}** 被麻痺，無法行動！`)] });
    await endTurn(channel, battle);
    return;
  }

  // 抽牌
  const drawCount = current.firstTurn ? 5 : 3;
  current.firstTurn = false;
  const drawn = drawCards(current, drawCount);
  current.ap = ACTION_POINTS;

  await channel.send({
    content: `<@${current.id}>`,
    embeds: [e(`${statusText(battle)}\n\n🎴 **${current.name}** 抽了 ${drawn.length} 張牌（手牌 ${current.hand.length} 張）\n\n輪到你出牌！⚡ 行動點：${current.ap}`)],
  });

  await showPlayMenu(channel, battle);
}

// ─── 出牌選單 ───
async function showPlayMenu(channel, battle) {
  const current = battle.players[battle.turnIndex];
  const ts = Date.now();

  // 建立手牌下拉選單
  const playable = [];
  const seen = new Set();
  for (let i = 0; i < current.hand.length; i++) {
    const cardId = current.hand[i];
    const card = getCard(cardId);
    if (!card) continue;
    const key = `${cardId}_${i}`;
    if (card.cost > current.ap) continue;
    if (card.oncePerBattle && current.usedOnce.has(cardId)) continue;
    playable.push({ label: `${typeIcon(card.type)} ${card.name}（⚡${card.cost}）`, value: `${i}`, description: card.effect?.substring(0, 50) });
  }

  const rows = [];
  if (playable.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`cardplay_${ts}`)
      .setPlaceholder('選擇要出的牌...')
      .addOptions(playable.slice(0, 25));
    rows.push(new ActionRowBuilder().addComponents(menu));
  }

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cardview_${ts}`).setLabel('🃏 查看手牌').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cardend_${ts}`).setLabel('⏭️ 結束回合').setStyle(ButtonStyle.Danger),
  ));

  const msg = await channel.send({
    embeds: [e(`⚡ **${current.name}** 的行動點：${current.ap} / ${ACTION_POINTS}\n\n${playable.length > 0 ? '選擇要出的牌，或結束回合' : '沒有可出的牌，請結束回合'}`)],
    components: rows,
  });

  const collector = msg.createMessageComponentCollector({ time: 120000 });

  collector.on('collect', async (i) => {
    // 查看手牌（任何玩家都能按看自己的）
    if (i.customId === `cardview_${ts}`) {
      const p = battle.players.find(p => p.id === i.user.id);
      if (!p) return i.reply({ embeds: [e('❌ 你不在這場對戰中！')], flags: MessageFlags.Ephemeral });
      return i.reply({ embeds: [e(`🃏 **你的手牌：**\n${handText(p)}`)], flags: MessageFlags.Ephemeral });
    }

    // 只有當前玩家能操作
    if (i.user.id !== current.id) {
      return i.reply({ embeds: [e('❌ 不是你的回合！')], flags: MessageFlags.Ephemeral });
    }

    // 結束回合
    if (i.customId === `cardend_${ts}`) {
      collector.stop('ended');
      await i.update({ components: [] });
      await endTurn(channel, battle);
      return;
    }

    // 出牌
    if (i.customId === `cardplay_${ts}`) {
      const idx = parseInt(i.values[0]);
      const cardId = current.hand[idx];
      const card = getCard(cardId);

      if (!card || card.cost > current.ap) {
        return i.reply({ embeds: [e('❌ 行動點不足！')], flags: MessageFlags.Ephemeral });
      }
      if (card.oncePerBattle && current.usedOnce.has(cardId)) {
        return i.reply({ embeds: [e('❌ 這張牌本場已經用過了！')], flags: MessageFlags.Ephemeral });
      }

      // 消耗行動點 + 移除手牌
      current.ap -= card.cost;
      current.hand.splice(idx, 1);
      current.discard.push(cardId);
      if (card.oncePerBattle) current.usedOnce.add(cardId);

      // 執行卡牌效果
      const result = await executeCard(battle, battle.turnIndex, card);
      await i.update({ components: [] });
      await channel.send({ embeds: [e(`${typeIcon(card.type)} **${current.name}** 使用了 **${card.name}**！\n\n${result}\n\n${statusText(battle)}`)] });

      // 檢查勝負
      const opponent = battle.players[1 - battle.turnIndex];
      if (opponent.hp <= 0) {
        collector.stop('ko');
        await endBattle(channel, battle, battle.turnIndex);
        return;
      }
      if (current.hp <= 0) {
        collector.stop('ko');
        await endBattle(channel, battle, 1 - battle.turnIndex);
        return;
      }

      // 繼續出牌
      if (current.ap > 0 && current.hand.length > 0) {
        await showPlayMenu(channel, battle);
      } else {
        collector.stop('ended');
        await endTurn(channel, battle);
      }
    }
  });

  collector.on('end', (c, reason) => {
    if (reason === 'time' && battle.phase === 'playing') {
      msg.edit({ components: [] }).catch(() => {});
      channel.send({ embeds: [e(`⏰ **${current.name}** 超時，自動結束回合`)] });
      endTurn(channel, battle);
    }
  });
  battle.collectors.push(collector);
}

// ─── 執行卡牌效果 ───
async function executeCard(battle, playerIdx, card) {
  const self = battle.players[playerIdx];
  const opponent = battle.players[1 - playerIdx];
  let log = '';

  // 基礎攻擊傷害
  if (card.type === 'attack' && card.dmg) {
    let dmg = rollDmg(card.dmg[0], card.dmg[1]) + (card.bonus || 0);

    // 增益：攻擊加成
    if (self.buffs.atkBoost) dmg = Math.floor(dmg * (1 + self.buffs.atkBoost.pct / 100));
    if (self.buffs.doubleAtk) { dmg *= 2; delete self.buffs.doubleAtk; }

    // 減益：對手求饒
    if (self.debuffs.atkReduce) dmg = Math.floor(dmg * (1 - self.debuffs.atkReduce.pct / 100));

    // 對手煙幕
    if (opponent.buffs.smoke) {
      if (Math.random() * 100 < opponent.buffs.smoke.pct) {
        delete opponent.buffs.smoke;
        return '💨 攻擊被煙幕閃避了！Miss！';
      }
      delete opponent.buffs.smoke;
    }

    // 對手閃避
    if (opponent.buffs.dodge) {
      delete opponent.buffs.dodge;
      return '✨ 對手完全迴避了攻擊！';
    }

    // 對手減傷
    if (opponent.buffs.reducePct) {
      dmg = Math.floor(dmg * (1 - opponent.buffs.reducePct.pct / 100));
      delete opponent.buffs.reducePct;
    }

    // 對手忍耐
    const hasEndure = !!opponent.buffs.endure;

    // 扣護盾再扣血
    const shieldAbsorb = Math.min(opponent.shield, dmg);
    opponent.shield -= shieldAbsorb;
    const hpDmg = dmg - shieldAbsorb;
    opponent.hp = Math.max(0, opponent.hp - hpDmg);

    // 忍耐：致命傷害存活
    if (opponent.hp <= 0 && hasEndure) {
      opponent.hp = 1;
      delete opponent.buffs.endure;
      log += `💪 忍耐發動！以 1HP 存活！\n`;
    }

    // 反擊
    if (opponent.buffs.counter && dmg > 0) {
      const counterDmg = opponent.buffs.counter.dmg;
      self.hp = Math.max(0, self.hp - counterDmg);
      log += `🔄 反擊！反彈 ${counterDmg} 傷害！\n`;
    }

    log += `造成 ${dmg} 傷害（護盾吸收 ${shieldAbsorb}，實際 ${hpDmg}）`;
  }

  // 基礎防禦
  if (card.type === 'defense' && card.shield) {
    let sh = card.shield;
    if (self.buffs.defDouble) { sh *= 2; delete self.buffs.defDouble; }
    if (self.buffs.defBoost) sh = Math.floor(sh * (1 + self.buffs.defBoost.pct / 100));
    self.shield += sh;
    log += `護盾 +${sh}（目前 ${self.shield}）`;
  }

  // 基礎治療
  if (card.type === 'heal' && card.heal) {
    const before = self.hp;
    self.hp = Math.min(START_HP, self.hp + card.heal);
    log += `回復 ${self.hp - before} HP（❤️ ${self.hp}）`;
  }

  // 特殊效果
  const fn = card.fn;
  if (fn) {
    switch (fn) {
      case 'poison':
        opponent.debuffs.poison = { turns: card.poisonTurns, dmg: card.poisonDmg };
        log += log ? '\n' : '';
        log += `🟣 對手中毒 ${card.poisonTurns} 回合（每回合 ${card.poisonDmg}）`;
        break;
      case 'paralyze':
        opponent.debuffs.paralyze = { turns: 1 };
        log += log ? '\n' : '';
        log += `⚡ 對手麻痺 1 回合！`;
        break;
      case 'applyPoison':
        opponent.debuffs.poison = { turns: card.poisonTurns, dmg: card.poisonDmg };
        log = `🟣 對手中毒 ${card.poisonTurns} 回合（每回合 ${card.poisonDmg}）`;
        break;
      case 'applyParalyze':
        opponent.debuffs.paralyze = { turns: 1 };
        log = `⚡ 對手麻痺 1 回合！`;
        break;
      case 'chain': {
        // 已計算基礎傷害，50% 追加
        if (Math.random() < 0.5) {
          const extra = rollDmg(card.dmg[0], card.dmg[1]);
          const shAbs = Math.min(opponent.shield, extra);
          opponent.shield -= shAbs;
          opponent.hp = Math.max(0, opponent.hp - (extra - shAbs));
          log += `\n⚔️ 追加攻擊！額外 ${extra} 傷害！`;
        } else {
          log += '\n追加攻擊未觸發';
        }
        break;
      }
      case 'selfhurt': {
        const hpCost = Math.floor(self.hp * card.hpCostPct / 100);
        self.hp -= hpCost;
        const atkDmg = Math.floor(hpCost * card.atkPct / 100);
        const shAbs = Math.min(opponent.shield, atkDmg);
        opponent.shield -= shAbs;
        opponent.hp = Math.max(0, opponent.hp - (atkDmg - shAbs));
        log = `自損 ${hpCost} HP → 造成 ${atkDmg} 傷害`;
        break;
      }
      case 'counter':
        self.buffs.counter = { dmg: card.counterDmg };
        log = `🔄 本回合被攻擊時反彈 ${card.counterDmg} 傷害`;
        break;
      case 'dodge':
        opponent.buffs.dodge = {}; // 設在對手身上是錯的，應該設在自己
        // 修正：設在自己身上
        self.buffs.dodge = {};
        log = '✨ 準備閃避下一次攻擊！';
        break;
      case 'reducePct':
        self.buffs.reducePct = { pct: card.reducePct };
        log = `🛡️ 減傷 ${card.reducePct}%`;
        break;
      case 'endure':
        self.buffs.endure = {};
        log = '💪 本場致命傷害時以 1HP 存活！';
        break;
      case 'sacrificeShield': {
        const count = self.hand.length;
        const sh = count * card.perCard;
        self.discard.push(...self.hand);
        self.hand = [];
        self.shield += sh;
        log = `棄掉 ${count} 張手牌 → 護盾 +${sh}`;
        break;
      }
      case 'defBoost':
        self.buffs.defDouble = {};
        log = '🛡️ 本回合防禦牌效果翻倍！';
        break;
      case 'shieldToDmgReduce':
        self.buffs.reducePct = { pct: self.shield };
        log = `🛡️ 護盾 ${self.shield} 轉為減傷值`;
        break;
      case 'shieldBoost':
        self.shield = Math.floor(self.shield * (1 + card.boostPct / 100));
        log = `🛡️ 護盾提升 ${card.boostPct}%（目前 ${self.shield}）`;
        break;
      case 'weakenDef':
        opponent.debuffs.weakenDef = { pct: card.weakenPct, turns: 1 };
        log = `降低對手護盾 ${card.weakenPct}%（1回合）`;
        break;
      case 'cleanse':
        delete self.debuffs.poison;
        delete self.debuffs.paralyze;
        log = '✨ 移除所有負面狀態！';
        break;
      case 'curePoison':
        delete self.debuffs.poison;
        drawCards(self, card.draw);
        log = `🟢 移除中毒 + 抽 ${card.draw} 牌`;
        break;
      case 'cureParalyze':
        delete self.debuffs.paralyze;
        drawCards(self, card.draw);
        log = `⚡ 移除麻痺 + 抽 ${card.draw} 牌`;
        break;
      case 'atkBoostBuff':
        self.buffs.atkBoost = { pct: card.boostPct, turns: card.buffTurns };
        log = `🔥 攻擊力 +${card.boostPct}%（${card.buffTurns} 回合）`;
        break;
      case 'draw':
        drawCards(self, card.draw);
        log = `🎴 抽了 ${card.draw} 張牌`;
        break;
      case 'smoke':
        self.buffs.smoke = { pct: card.missPct };
        log = `💨 對手下次攻擊 ${card.missPct}% 機率 Miss！`;
        break;
      case 'doubleAtk':
        self.buffs.doubleAtk = {};
        log = '⚔️ 本回合攻擊傷害翻倍！';
        break;
      case 'beg':
        opponent.debuffs.atkReduce = { pct: card.reducePct, turns: 1 };
        log = `😢 對手攻擊力 -${card.reducePct}%（1回合）`;
        break;
      case 'purify':
        opponent.buffs = {};
        drawCards(self, card.draw);
        log = `✨ 消除對手所有增益 + 抽 ${card.draw} 牌`;
        break;
      case 'reset':
        self.discard.push(...self.hand);
        self.hand = [];
        drawCards(self, card.drawCount);
        log = `🔄 棄掉所有手牌，重抽 ${card.drawCount} 張`;
        break;
      case 'shareDebuff':
        if (self.debuffs.poison) opponent.debuffs.poison = { ...self.debuffs.poison };
        if (self.debuffs.paralyze) opponent.debuffs.paralyze = { ...self.debuffs.paralyze };
        log = '👥 自己的負面狀態也給對手了！';
        break;
      case 'mercResolve': {
        const cost = Math.floor(self.hp * card.hpCostPct / 100);
        self.hp -= cost;
        self.buffs.atkBoost = { pct: card.boostPct, turns: card.buffTurns };
        self.buffs.defBoost = { pct: card.boostPct, turns: card.buffTurns };
        log = `💥 自損 ${cost}HP → 攻防 +${card.boostPct}%（${card.buffTurns} 回合）`;
        break;
      }
      case 'extraTurn':
        self.ap += ACTION_POINTS;
        log = `⚡ 行動點 +${ACTION_POINTS}！`;
        break;
      case 'extraTurnPlus':
        self.ap += ACTION_POINTS;
        self.buffs.atkBoost = { pct: card.boostPct, turns: 1 };
        log = `⚡ 行動點 +${ACTION_POINTS} + 攻擊力 +${card.boostPct}%！`;
        break;
      case 'lucky': {
        const roll = Math.floor(Math.random() * 3);
        if (roll === 0) { self.buffs.atkBoost = { pct: 20, turns: 1 }; log = '🎲 幸運！攻擊力 +20%（1回合）'; }
        else if (roll === 1) { self.shield += 5; log = `🎲 幸運！護盾 +5（目前 ${self.shield}）`; }
        else { self.buffs.defBoost = { pct: 20, turns: 1 }; log = '🎲 幸運！防禦力 +20%（1回合）'; }
        break;
      }
      case 'revenge': {
        const hpPct = self.hp / START_HP * 100;
        if (hpPct <= card.threshold) {
          const baseDmg = rollDmg(8, 12);
          const dmg = Math.floor(baseDmg * (1 + card.atkBonus / 100));
          const shAbs = Math.min(opponent.shield, dmg);
          opponent.shield -= shAbs;
          opponent.hp = Math.max(0, opponent.hp - (dmg - shAbs));
          log = `🔥 HP≤${card.threshold}% → 復仇一擊！造成 ${dmg} 傷害`;
        } else {
          const baseDmg = rollDmg(8, 12);
          const shAbs = Math.min(opponent.shield, baseDmg);
          opponent.shield -= shAbs;
          opponent.hp = Math.max(0, opponent.hp - (baseDmg - shAbs));
          log = `造成 ${baseDmg} 傷害（HP>${card.threshold}%，未觸發加成）`;
        }
        break;
      }
      case 'atkshield': {
        // 已在基礎攻擊中處理傷害，這裡加護盾
        self.shield += card.shield;
        log += `\n護盾 +${card.shield}`;
        break;
      }
      case 'shieldToAtk': case 'shieldToAtk2': {
        const atkDmg = self.shield + (card.bonus || 0);
        self.shield = 0;
        const shAbs = Math.min(opponent.shield, atkDmg);
        opponent.shield -= shAbs;
        opponent.hp = Math.max(0, opponent.hp - (atkDmg - shAbs));
        log = `護盾 → 攻擊力！造成 ${atkDmg} 傷害`;
        if (card.draw) { drawCards(self, card.draw); log += ` + 抽 ${card.draw} 牌`; }
        break;
      }
      case 'knightAtk': {
        const shAbs = Math.min(opponent.shield, card.bonus);
        opponent.shield -= shAbs;
        opponent.hp = Math.max(0, opponent.hp - (card.bonus - shAbs));
        self.buffs.defBoost = { pct: card.shieldPct, turns: card.buffTurns };
        log = `附加 ${card.bonus} 傷害 + 防禦 +${card.shieldPct}%（${card.buffTurns} 回合）`;
        break;
      }
      case 'masterAtk': {
        const atkCards = self.hand.filter(id => getCard(id)?.type === 'attack').length;
        const dmg = atkCards * card.atkPerCard;
        const shAbs = Math.min(opponent.shield, dmg);
        opponent.shield -= shAbs;
        opponent.hp = Math.max(0, opponent.hp - (dmg - shAbs));
        log = `手牌 ${atkCards} 張攻擊牌 × ${card.atkPerCard} = ${dmg} 傷害！`;
        break;
      }
      case 'victory': {
        const shAbs = Math.min(opponent.shield, card.bonus);
        opponent.shield -= shAbs;
        opponent.hp = Math.max(0, opponent.hp - (card.bonus - shAbs));
        log = `附加 ${card.bonus} 傷害`;
        break;
      }
      case 'freeAtk': {
        self.ap += card.cost; // 退還行動點（因為已經扣了）
        const baseDmg = rollDmg(8, 12) + (card.bonus || 0);
        const shAbs = Math.min(opponent.shield, baseDmg);
        opponent.shield -= shAbs;
        opponent.hp = Math.max(0, opponent.hp - (baseDmg - shAbs));
        log = `免費攻擊！造成 ${baseDmg} 傷害`;
        break;
      }
      case 'dirty': {
        const pct = card.dmgRange[0] + Math.floor(Math.random() * (card.dmgRange[1] - card.dmgRange[0] + 1));
        const baseDmg = Math.floor(rollDmg(8, 12) * pct / 100);
        const shAbs = Math.min(opponent.shield, baseDmg);
        opponent.shield -= shAbs;
        opponent.hp = Math.max(0, opponent.hp - (baseDmg - shAbs));
        drawCards(self, card.draw);
        log = `卑鄙攻擊（${pct}%）！造成 ${baseDmg} 傷害 + 抽 ${card.draw} 牌`;
        break;
      }
      case 'escape': {
        if (Math.random() * 100 < card.successPct) {
          log = '🏃 逃跑成功！戰鬥平局結束';
          // 設 flag 讓外層處理
          battle.escaped = true;
        } else {
          log = '🏃 逃跑失敗！';
        }
        break;
      }
      case 'supplyBoost':
        log = '📦 強化力量泉源（成本+2）';
        break;
      case 'clone':
        log = '👻 幻影複製！（選擇手牌中一張複製）';
        // 簡化：隨機複製手中一張
        if (self.hand.length > 0) {
          const cloneId = self.hand[Math.floor(Math.random() * self.hand.length)];
          self.hand.push(cloneId);
          const cc = getCard(cloneId);
          log = `👻 幻影複製了 **${cc?.name}**！`;
        }
        break;
      default:
        if (!log) log = card.effect || '使用了卡牌';
    }
  }

  return log || card.effect || '使用了卡牌';
}

// ─── 結束回合 ───
async function endTurn(channel, battle) {
  if (battle.phase !== 'playing') return;
  if (battle.escaped) {
    // 平局結束
    await channel.send({ embeds: [e('🏃 戰鬥以平局結束！雙方不計勝敗。')] });
    battles.delete(battle.channelId);
    return;
  }

  if (battle.turnIndex === 0) {
    battle.turnIndex = 1;
    await startTurn(channel, battle);
  } else {
    // 雙方都出完 → 下一回合
    battle.round++;
    await startRound(channel, battle);
  }
}

// ─── 戰鬥結束 ───
async function endBattle(channel, battle, winnerIdx) {
  const winner = battle.players[winnerIdx];
  const loser = battle.players[1 - winnerIdx];

  await channel.send({ embeds: [e(`🏆🏆🏆 **${winner.name} 獲勝！**\n\n❤️ ${winner.name}：${winner.hp}HP\n💀 ${loser.name}：${loser.hp}HP\n\n回合數：${battle.round}`)] });

  // 更新資料庫
  const winnerDoc = await CardPlayer.findOne({ discordId: winner.id });
  const loserDoc = await CardPlayer.findOne({ discordId: loser.id });
  if (winnerDoc) { winnerDoc.wins++; winnerDoc.loseStreak = 0; await winnerDoc.save(); }
  if (loserDoc) { loserDoc.losses++; loserDoc.loseStreak++; await loserDoc.save(); }

  // 勝者三選一獎勵
  battle.phase = 'reward';
  await showReward(channel, battle, winner.id, '🏆 勝利獎勵！選擇一張卡牌加入牌組：');

  // 檢查敗者連敗獎勵
  if (loserDoc && loserDoc.loseStreak >= 5 && loserDoc.loseStreak % 5 === 0) {
    await showReward(channel, battle, loser.id, `😢 連敗 ${loserDoc.loseStreak} 場安慰獎！選擇一張卡牌：`);
  }

  battles.delete(battle.channelId);
}

// ─── 三選一獎勵 ───
async function showReward(channel, battle, playerId, title) {
  const rewards = getRewardCards(3);
  const ts = Date.now();
  const player = await CardPlayer.findOne({ discordId: playerId });
  if (!player) return;

  const row = new ActionRowBuilder();
  for (const cardId of rewards) {
    const card = getCard(cardId);
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`reward_${ts}_${cardId}`)
        .setLabel(`${card.name}（⚡${card.cost}）`)
        .setStyle(ButtonStyle.Primary)
    );
  }
  row.addComponents(
    new ButtonBuilder().setCustomId(`reward_${ts}_skip`).setLabel('❌ 都不要').setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({
    content: `<@${playerId}>`,
    embeds: [e(`${title}\n\n${rewards.map(id => { const c = getCard(id); return `${typeIcon(c.type)} **${c.name}**（⚡${c.cost}）\n${c.effect}`; }).join('\n\n')}`)],
    components: [row],
  });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`reward_${ts}_`) && i.user.id === playerId,
    max: 1, time: 120000,
  });

  collector.on('collect', async (i) => {
    const choice = i.customId.replace(`reward_${ts}_`, '');
    if (choice === 'skip') {
      await i.update({ embeds: [e('❌ 跳過獎勵')], components: [] });
      return;
    }

    const card = getCard(choice);
    if (player.deck.length >= MAX_DECK) {
      // 滿了要先丟一張
      await i.update({ embeds: [e(`📦 牌組已滿 ${MAX_DECK} 張！選擇新牌 **${card.name}** 後，需要丟棄一張舊牌。`)], components: [] });
      await discardForReward(channel, playerId, choice);
    } else {
      player.deck.push(choice);
      await player.save();
      await i.update({ embeds: [e(`✅ 獲得 **${card.name}**！（牌組 ${player.deck.length}/${MAX_DECK}）`)], components: [] });
    }
  });

  collector.on('end', (c) => {
    if (c.size === 0) msg.edit({ embeds: [e('⏰ 超時，跳過獎勵')], components: [] }).catch(() => {});
  });
}

// 滿 50 張時選新牌後丟舊牌
async function discardForReward(channel, playerId, newCardId) {
  const player = await CardPlayer.findOne({ discordId: playerId });
  if (!player) return;

  const ts = Date.now();
  const counts = {};
  for (const id of player.deck) {
    const c = getCard(id);
    if (!counts[id]) counts[id] = { name: c?.name || id, count: 0 };
    counts[id].count++;
  }

  const options = Object.entries(counts).map(([id, info]) => ({
    label: `${info.name}${info.count > 1 ? ` ×${info.count}` : ''}`,
    value: id,
  })).slice(0, 25);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`discard_reward_${ts}`)
    .setPlaceholder('選擇要丟棄的牌...')
    .addOptions(options);

  const msg = await channel.send({
    content: `<@${playerId}>`,
    embeds: [e('🗑️ 選擇要丟棄的一張牌：')],
    components: [new ActionRowBuilder().addComponents(menu)],
  });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId === `discard_reward_${ts}` && i.user.id === playerId,
    max: 1, time: 60000,
  });

  collector.on('collect', async (i) => {
    const discardId = i.values[0];
    const idx = player.deck.indexOf(discardId);
    if (idx !== -1) player.deck.splice(idx, 1);
    player.deck.push(newCardId);
    await player.save();
    const newCard = getCard(newCardId);
    const oldCard = getCard(discardId);
    await i.update({ embeds: [e(`🗑️ 丟棄了 **${oldCard?.name}** → 獲得 **${newCard?.name}**！（牌組 ${player.deck.length}/${MAX_DECK}）`)], components: [] });
  });

  collector.on('end', (c) => {
    if (c.size === 0) {
      msg.edit({ embeds: [e('⏰ 超時，跳過獎勵')], components: [] }).catch(() => {});
    }
  });
}

// ─── 指令 ───
const commands = {
  // 註冊
  async reg(message) {
    const existing = await CardPlayer.findOne({ discordId: message.author.id });
    if (existing) return message.reply({ embeds: [e(`❌ 你已經註冊過了！（牌組 ${existing.deck.length}/${MAX_DECK}）`)] });
    const player = new CardPlayer({
      discordId: message.author.id,
      name: message.member.displayName,
      deck: [...STARTER_DECK],
    });
    await player.save();
    message.channel.send({ embeds: [e(`✅ **${message.member.displayName}** 註冊成功！\n\n🃏 獲得 ${STARTER_DECK.length} 張基礎卡牌\n\n輸入 \`!ri\` 查看個人資料\n輸入 \`!rd @對手\` 發起對戰`)] });
  },

  // 個人資料（按鈕 ephemeral）
  async ri(message) {
    const player = await CardPlayer.findOne({ discordId: message.author.id });
    if (!player) return message.reply({ embeds: [e('❌ 你還沒有註冊！輸入 `!reg` 註冊')] });

    const ts = Date.now();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`profile_${ts}`).setLabel('📋 查看個人資料').setStyle(ButtonStyle.Secondary)
    );
    const msg = await message.channel.send({ embeds: [e('📋 點擊按鈕查看個人資料：')], components: [row] });

    const collector = msg.createMessageComponentCollector({ filter: i => i.customId === `profile_${ts}`, time: 60000 });
    collector.on('collect', async (i) => {
      if (i.user.id !== message.author.id) return i.reply({ embeds: [e('❌ 這不是你的資料！')], flags: MessageFlags.Ephemeral });
      const p = await CardPlayer.findOne({ discordId: i.user.id });
      const total = p.wins + p.losses;
      const rate = total > 0 ? Math.round(p.wins / total * 100) : 0;

      // 統計牌組
      const counts = {};
      for (const id of p.deck) {
        const c = getCard(id);
        const name = c?.name || id;
        counts[name] = (counts[name] || 0) + 1;
      }
      const deckList = Object.entries(counts).map(([name, cnt]) => `${name}${cnt > 1 ? ` ×${cnt}` : ''}`).join('、');

      await i.reply({
        embeds: [e(`📋 **${p.name}** 的個人資料\n\n⚔️ 勝場：${p.wins} ｜ 敗場：${p.losses} ｜ 勝率：${rate}%\n🔥 目前連敗：${p.loseStreak}\n🃏 牌組：${p.deck.length} / ${MAX_DECK}\n\n📦 牌組內容：\n${deckList}`)],
        flags: MessageFlags.Ephemeral,
      });
    });
    collector.on('end', () => { msg.edit({ components: [] }).catch(() => {}); });
  },

  // 發起對戰
  async rd(message) {
    const battle = getBattle(message.channel.id);
    if (battle) return message.reply({ embeds: [e('❌ 這個頻道已有進行中的對戰！')] });

    const target = message.mentions.users.first();
    if (!target) return message.reply({ embeds: [e('❌ 請 @一個對手！例如 `!rd @對手`')] });
    if (target.id === message.author.id) return message.reply({ embeds: [e('❌ 不能挑戰自己！')] });

    const p1 = await CardPlayer.findOne({ discordId: message.author.id });
    const p2 = await CardPlayer.findOne({ discordId: target.id });
    if (!p1) return message.reply({ embeds: [e('❌ 你還沒有註冊！輸入 `!reg`')] });
    if (!p2) return message.reply({ embeds: [e(`❌ ${target.username} 還沒有註冊！`)] });

    const ts = Date.now();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`accept_${ts}`).setLabel('✅ 接受').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`reject_${ts}`).setLabel('❌ 拒絕').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`cancel_${ts}`).setLabel('取消挑戰').setStyle(ButtonStyle.Secondary),
    );

    const msg = await message.channel.send({
      content: `<@${target.id}>`,
      embeds: [e(`⚔️ **${message.member.displayName}** 向 **${target.username}** 發起卡牌對戰！\n\n是否接受挑戰？（⏱️ 5 分鐘）`)],
      components: [row],
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => (i.user.id === target.id && (i.customId === `accept_${ts}` || i.customId === `reject_${ts}`)) ||
                   (i.user.id === message.author.id && i.customId === `cancel_${ts}`),
      max: 1, time: 300000,
    });

    collector.on('collect', async (i) => {
      if (i.customId === `cancel_${ts}`) {
        await i.update({ embeds: [e('🚫 挑戰已取消')], components: [] });
        return;
      }
      if (i.customId === `reject_${ts}`) {
        await i.update({ embeds: [e(`❌ **${target.username}** 拒絕了挑戰`)], components: [] });
        return;
      }
      if (i.customId === `accept_${ts}`) {
        await i.update({ embeds: [e(`✅ **${target.username}** 接受了挑戰！對戰開始！`)], components: [] });

        // 建立戰鬥
        const battleState = createBattleState(message.channel.id,
          { id: message.author.id, name: message.member.displayName, deck: p1.deck },
          { id: target.id, name: target.username, deck: p2.deck }
        );
        battles.set(message.channel.id, battleState);

        // 隨機先手
        if (Math.random() < 0.5) {
          [battleState.players[0], battleState.players[1]] = [battleState.players[1], battleState.players[0]];
        }

        await message.channel.send({ embeds: [e(`🎴 **${battleState.players[0].name}** 先手！\n\n${statusText(battleState)}`)] });
        await startRound(message.channel, battleState);
      }
    });

    collector.on('end', (c) => {
      if (c.size === 0) msg.edit({ embeds: [e('⏰ 挑戰超時，已取消')], components: [] }).catch(() => {});
    });
  },

  // 丟棄牌（下拉選單）
  async rr(message) {
    const player = await CardPlayer.findOne({ discordId: message.author.id });
    if (!player) return message.reply({ embeds: [e('❌ 你還沒有註冊！')] });
    if (player.deck.length === 0) return message.reply({ embeds: [e('❌ 牌組是空的！')] });

    const ts = Date.now();
    const counts = {};
    for (const id of player.deck) {
      const c = getCard(id);
      if (!counts[id]) counts[id] = { name: c?.name || id, count: 0 };
      counts[id].count++;
    }

    const options = Object.entries(counts).map(([id, info]) => ({
      label: `${info.name}${info.count > 1 ? ` ×${info.count}` : ''}`,
      value: id,
      description: getCard(id)?.effect?.substring(0, 50),
    })).slice(0, 25);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`discard_${ts}`)
      .setPlaceholder('選擇要丟棄的牌...')
      .addOptions(options);

    const msg = await message.channel.send({
      content: `<@${message.author.id}>`,
      embeds: [e(`🗑️ 選擇要丟棄的牌（目前 ${player.deck.length}/${MAX_DECK}）：`)],
      components: [new ActionRowBuilder().addComponents(menu)],
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId === `discard_${ts}` && i.user.id === message.author.id,
      max: 1, time: 60000,
    });

    collector.on('collect', async (i) => {
      const discardId = i.values[0];
      const idx = player.deck.indexOf(discardId);
      if (idx !== -1) player.deck.splice(idx, 1);
      await player.save();
      const card = getCard(discardId);
      await i.update({ embeds: [e(`🗑️ 丟棄了 **${card?.name}**！（牌組 ${player.deck.length}/${MAX_DECK}）`)], components: [] });
    });

    collector.on('end', (c) => {
      if (c.size === 0) msg.edit({ components: [] }).catch(() => {});
    });
  },

  // 投降
  async rq(message) {
    const battle = getBattle(message.channel.id);
    if (!battle || battle.phase !== 'playing') return message.reply({ embeds: [e('❌ 這個頻道沒有進行中的對戰！')] });
    const pi = battle.players.findIndex(p => p.id === message.author.id);
    if (pi === -1) return message.reply({ embeds: [e('❌ 你不在這場對戰中！')] });
    battle.collectors.forEach(c => { try { c.stop(); } catch {} });
    await endBattle(message.channel, battle, 1 - pi);
  },

  // 查看手牌
  async rc(message) {
    const battle = getBattle(message.channel.id);
    if (!battle) return message.reply({ embeds: [e('❌ 這個頻道沒有進行中的對戰！')] });
    const p = battle.players.find(p => p.id === message.author.id);
    if (!p) return message.reply({ embeds: [e('❌ 你不在這場對戰中！')] });

    const ts = Date.now();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`viewbattle_${ts}`).setLabel('🃏 查看手牌').setStyle(ButtonStyle.Secondary)
    );
    const msg = await message.channel.send({ embeds: [e('🃏 點擊查看手牌：')], components: [row] });
    const collector = msg.createMessageComponentCollector({ filter: i => i.customId === `viewbattle_${ts}`, time: 60000 });
    collector.on('collect', async (i) => {
      const bp = battle.players.find(bp => bp.id === i.user.id);
      if (!bp) return i.reply({ embeds: [e('❌ 你不在對戰中！')], flags: MessageFlags.Ephemeral });
      await i.reply({ embeds: [e(`🃏 **你的手牌（${bp.hand.length}/${MAX_HAND}）：**\n⚡ 行動點：${bp.ap}\n\n${handText(bp)}`)], flags: MessageFlags.Ephemeral });
    });
    collector.on('end', () => { msg.edit({ components: [] }).catch(() => {}); });
  },
};

export default commands;
