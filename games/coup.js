import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);
const REACTION_TIME = 30000; // 30 秒反應視窗

// ─── 角色定義 ───
const ROLES = {
  duke:       { name: '👑 公爵', action: '收稅', block: '外援' },
  assassin:   { name: '🗡️ 殺手', action: '暗殺' },
  captain:    { name: '🏴‍☠️ 隊長', action: '偷竊', block: '偷竊' },
  ambassador: { name: '🔄 大使', action: '換牌', block: '偷竊' },
  contessa:   { name: '🛡️ 貴婦', block: '暗殺' },
};

// ─── 狀態 ───
const state = {
  phase: 'idle', hostId: null, channelId: null, guild: null,
  players: [], deck: [], order: [], orderIndex: 0,
  collectors: [],
};

function reset() {
  state.collectors.forEach(c => { try { c.stop(); } catch {} });
  Object.assign(state, {
    phase: 'idle', hostId: null, channelId: null, guild: null,
    players: [], deck: [], order: [], orderIndex: 0,
    collectors: [],
  });
}

function findPlayer(id) { return state.players.find(p => p.id === id); }
function getAlivePlayers() { return state.players.filter(p => p.alive); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck() {
  const deck = [];
  for (const role of Object.keys(ROLES)) {
    for (let i = 0; i < 3; i++) deck.push(role);
  }
  return shuffle(deck);
}

function getHandText(player) {
  const cards = player.cards.map(c => ROLES[c].name).join('、') || '無';
  const revealed = player.revealedCards.map(c => ROLES[c].name).join('、');
  return `🃏 手牌：${cards}\n${revealed ? `💀 已翻開：${revealed}\n` : ''}💰 金幣：${player.coins}`;
}

function checkWin() {
  const alive = getAlivePlayers();
  if (alive.length === 1) return alive[0];
  return null;
}

// ─── 失去影響力（選擇翻開哪張牌）───
async function loseInfluence(channel, playerId, reason) {
  const player = findPlayer(playerId);
  if (!player || !player.alive) return;

  if (player.cards.length === 1) {
    const card = player.cards.pop();
    player.revealedCards.push(card);
    player.alive = false;
    await channel.send({ embeds: [e(`💀 **${player.name}** 翻開了 ${ROLES[card].name}，失去最後的影響力，出局！`)] });
    return;
  }

  // 有 2 張牌，讓玩家用 ephemeral 選擇翻開哪張
  const ts = Date.now();
  const triggerRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`losetrigger_${ts}`)
      .setLabel('🃏 選擇要翻開的牌')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({
    content: `<@${playerId}>`,
    embeds: [e(`💀 **${player.name}** 必須翻開一張牌！\n\n${reason}\n\n請按下按鈕選擇`)],
    components: [triggerRow],
  });

  return new Promise((resolve) => {
    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId === `losetrigger_${ts}`,
      time: 60000,
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== playerId) {
        return i.reply({ embeds: [e('❌ 不是你要翻牌！')], flags: MessageFlags.Ephemeral });
      }
      collector.stop('picked');

      // ephemeral 顯示牌面讓玩家選
      const pickTs = Date.now();
      const pickRow = new ActionRowBuilder();
      player.cards.forEach((card, idx) => {
        pickRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`losepick_${pickTs}_${idx}`)
            .setLabel(ROLES[card].name)
            .setStyle(ButtonStyle.Danger)
        );
      });

      await i.reply({
        embeds: [e('🃏 **選擇要翻開的牌：**')],
        components: [pickRow],
        flags: MessageFlags.Ephemeral,
      });

      try {
        const reply = await i.fetchReply();
        const pi = await reply.awaitMessageComponent({
          filter: pi => pi.customId.startsWith(`losepick_${pickTs}_`) && pi.user.id === playerId,
          time: 30000,
        });

        const idx = parseInt(pi.customId.replace(`losepick_${pickTs}_`, ''));
        const card = player.cards.splice(idx, 1)[0];
        player.revealedCards.push(card);
        if (player.cards.length === 0) player.alive = false;

        await pi.update({ embeds: [e(`你翻開了 ${ROLES[card].name}`)], components: [] });
        await msg.edit({ embeds: [e(`💀 **${player.name}** 翻開了 ${ROLES[card].name}！${player.alive ? '' : ' 出局！'}`)], components: [] });
        resolve();
      } catch {
        // ephemeral 超時，自動翻第一張
        const card = player.cards.splice(0, 1)[0];
        player.revealedCards.push(card);
        if (player.cards.length === 0) player.alive = false;
        await msg.edit({ embeds: [e(`💀 **${player.name}** 超時，自動翻開 ${ROLES[card].name}！${player.alive ? '' : ' 出局！'}`)], components: [] });
        resolve();
      }
    });

    collector.on('end', (c, reason) => {
      if (reason !== 'picked') {
        const card = player.cards.splice(0, 1)[0];
        player.revealedCards.push(card);
        if (player.cards.length === 0) player.alive = false;
        msg.edit({ embeds: [e(`💀 **${player.name}** 超時，自動翻開 ${ROLES[card].name}！${player.alive ? '' : ' 出局！'}`)], components: [] }).catch(() => {});
        resolve();
      }
    });
    state.collectors.push(collector);
  });
}

// ─── 質疑解決 ───
async function resolveChallenge(channel, challengerId, targetId, claimedRole) {
  const challenger = findPlayer(challengerId);
  const target = findPlayer(targetId);
  const hasRole = target.cards.includes(claimedRole);

  if (hasRole) {
    // 真的有 → 質疑者失去影響力，被質疑者換牌
    await channel.send({ embeds: [e(`❓ **${challenger.name}** 質疑 **${target.name}** 是否有 ${ROLES[claimedRole].name}...\n\n✅ **${target.name}** 翻開了 ${ROLES[claimedRole].name}，質疑失敗！`)] });

    // 被質疑者：移除該牌放回牌庫，重抽一張
    const idx = target.cards.indexOf(claimedRole);
    target.cards.splice(idx, 1);
    state.deck.push(claimedRole);
    state.deck = shuffle(state.deck);
    const newCard = state.deck.pop();
    target.cards.push(newCard);

    // 質疑者失去影響力
    await loseInfluence(channel, challengerId, '質疑失敗，失去一點影響力');
    return true; // 行動繼續
  } else {
    // 沒有 → 被質疑者失去影響力
    await channel.send({ embeds: [e(`❓ **${challenger.name}** 質疑 **${target.name}** 是否有 ${ROLES[claimedRole].name}...\n\n❌ **${target.name}** 沒有 ${ROLES[claimedRole].name}，被抓到說謊！`)] });
    await loseInfluence(channel, targetId, '說謊被抓，失去一點影響力');
    return false; // 行動失敗
  }
}

// ─── 反應視窗 ───
async function showReactionWindow(channel, actionPlayerId, actionText, canChallenge, blockInfo) {
  // blockInfo: { targetId, blockRoles: ['contessa'], blockText: '阻礙暗殺' } 或 null
  const ts = Date.now();
  const row = new ActionRowBuilder();

  if (canChallenge) {
    row.addComponents(new ButtonBuilder().setCustomId(`react_${ts}_challenge`).setLabel('❓ 質疑').setStyle(ButtonStyle.Danger));
  }
  if (blockInfo) {
    row.addComponents(new ButtonBuilder().setCustomId(`react_${ts}_block`).setLabel(`🛡️ 阻礙`).setStyle(ButtonStyle.Primary));
  }

  const msg = await channel.send({
    embeds: [e(`${actionText}\n\n⏱️ 30 秒內可以反應，無人反應則行動成功`)],
    components: [row],
  });

  return new Promise((resolve) => {
    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId.startsWith(`react_${ts}_`) && i.user.id !== actionPlayerId,
      max: 1, time: REACTION_TIME,
    });
    collector.on('collect', async (i) => {
      const action = i.customId.replace(`react_${ts}_`, '');
      if (action === 'block') {
        // 只有合法的阻礙者能按
        if (blockInfo && blockInfo.targetId && i.user.id !== blockInfo.targetId) {
          // 外援的阻礙任何人都能按
          if (!blockInfo.anyoneCanBlock) {
            await i.reply({ embeds: [e('❌ 你不能阻礙這個行動！')], flags: MessageFlags.Ephemeral });
            return; // 不 resolve，collector 繼續
          }
        }
      }
      await i.update({ components: [] });
      resolve({ type: action, playerId: i.user.id });
    });
    collector.on('end', (c) => {
      if (c.size === 0) {
        msg.edit({ embeds: [e(`${actionText}\n\n✅ 無人反應，行動成功！`)], components: [] }).catch(() => {});
        resolve({ type: 'pass' });
      }
    });
    state.collectors.push(collector);
  });
}

// ─── 阻礙後的質疑視窗 ───
async function showBlockChallengeWindow(channel, blockerId, blockerName, claimedRole) {
  const ts = Date.now();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`blockreact_${ts}_challenge`).setLabel('❓ 質疑阻礙').setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({
    embeds: [e(`🛡️ **${blockerName}** 宣稱有 ${ROLES[claimedRole].name}，阻礙行動！\n\n⏱️ 30 秒內可以質疑，無人質疑則阻礙成功`)],
    components: [row],
  });

  return new Promise((resolve) => {
    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId === `blockreact_${ts}_challenge` && i.user.id !== blockerId,
      max: 1, time: REACTION_TIME,
    });
    collector.on('collect', async (i) => {
      await i.update({ components: [] });
      resolve({ type: 'challenge', playerId: i.user.id });
    });
    collector.on('end', (c) => {
      if (c.size === 0) {
        msg.edit({ embeds: [e(`🛡️ **${blockerName}** 的阻礙成功！無人質疑，行動取消。`)], components: [] }).catch(() => {});
        resolve({ type: 'pass' });
      }
    });
    state.collectors.push(collector);
  });
}

// ─── 大使換牌 ───
async function executeExchange(channel, playerId) {
  const player = findPlayer(playerId);
  // 從牌庫抽 2 張
  const drawn = [state.deck.pop(), state.deck.pop()];
  const allCards = [...player.cards, ...drawn];

  // 讓玩家選擇保留哪些牌（保留原本手牌數量）
  const keepCount = player.cards.length;
  const ts = Date.now();
  const selected = [];

  async function showSelection(interaction) {
    const rows = [];
    const row = new ActionRowBuilder();
    allCards.forEach((card, idx) => {
      const isSelected = selected.includes(idx);
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`exchange_${ts}_${idx}`)
          .setLabel(`${isSelected ? '✅ ' : ''}${ROLES[card].name}`)
          .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
    });
    rows.push(row);

    if (selected.length === keepCount) {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`exchange_${ts}_confirm`).setLabel('✅ 確認選擇').setStyle(ButtonStyle.Primary)
      ));
    }

    const embed = e(`🔄 **換牌：選擇 ${keepCount} 張牌保留**\n\n已選：${selected.length} / ${keepCount}`);
    if (interaction) {
      await interaction.update({ embeds: [embed], components: rows });
    }
    return { embeds: [embed], components: rows };
  }

  const msgData = await showSelection(null);
  const msg = await channel.send({ ...msgData, content: `<@${playerId}>` });

  return new Promise((resolve) => {
    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId.startsWith(`exchange_${ts}_`) && i.user.id === playerId,
      time: 60000,
    });

    collector.on('collect', async (i) => {
      if (i.customId === `exchange_${ts}_confirm`) {
        collector.stop('done');
        const kept = selected.map(idx => allCards[idx]);
        const returned = allCards.filter((_, idx) => !selected.includes(idx));
        player.cards = kept;
        state.deck.push(...returned);
        state.deck = shuffle(state.deck);
        await i.update({ embeds: [e('🔄 換牌完成！')], components: [] });
        resolve();
        return;
      }

      const idx = parseInt(i.customId.replace(`exchange_${ts}_`, ''));
      if (selected.includes(idx)) {
        selected.splice(selected.indexOf(idx), 1);
      } else if (selected.length < keepCount) {
        selected.push(idx);
      }
      await showSelection(i);
    });

    collector.on('end', (c, reason) => {
      if (reason !== 'done') {
        // 超時，保留原本的牌
        state.deck.push(...drawn);
        state.deck = shuffle(state.deck);
        msg.edit({ embeds: [e('🔄 超時，保留原本的牌')], components: [] }).catch(() => {});
        resolve();
      }
    });
    state.collectors.push(collector);
  });
}

// ─── 回合處理 ───
async function startTurn(channel) {
  if (state.phase !== 'playing') return;

  const winner = checkWin();
  if (winner) {
    const cardList = state.players.map(p => {
      const cards = [...p.cards.map(c => ROLES[c].name), ...p.revealedCards.map(c => `~~${ROLES[c].name}~~`)].join('、') || '無';
      return `${p.alive ? '👑' : '💀'} ${p.name} — ${cards}（💰${p.coins}）`;
    }).join('\n');
    await channel.send({ embeds: [e(`🏆🏆🏆 **${winner.name} 獲勝！**\n\n最後的生存者！\n\n📋 **最終狀態：**\n${cardList}`)] });
    reset();
    return;
  }

  // 跳過已出局的玩家
  let currentId = state.order[state.orderIndex];
  let player = findPlayer(currentId);
  while (!player.alive) {
    state.orderIndex = (state.orderIndex + 1) % state.order.length;
    currentId = state.order[state.orderIndex];
    player = findPlayer(currentId);
  }

  // 10 金幣強制政變
  if (player.coins >= 10) {
    await channel.send({ content: `<@${currentId}>`, embeds: [e(`⚔️ **${player.name}** 持有 ${player.coins} 金幣，必須發動政變！\n\n選擇政變對象：`)] });
    await handleForcedCoup(channel, player);
    return;
  }

  // 顯示行動按鈕
  const ts = Date.now();
  const statusText = getAlivePlayers().map(p => {
    const cardIcons = '🃏'.repeat(p.cards.length) + p.revealedCards.map(c => `~~${ROLES[c].name}~~`).join('');
    return `${p.id === currentId ? '➡️ ' : '　　'}${p.name}（💰${p.coins}）${cardIcons}`;
  }).join('\n');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`act_${ts}_income`).setLabel('💰 收入(+1)').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`act_${ts}_foreign_aid`).setLabel('💵 外援(+2)').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`act_${ts}_coup`).setLabel(`⚔️ 政變(-7)`).setStyle(ButtonStyle.Danger).setDisabled(player.coins < 7),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`act_${ts}_tax`).setLabel('👑 收稅(+3)').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`act_${ts}_assassinate`).setLabel('🗡️ 暗殺(-3)').setStyle(ButtonStyle.Primary).setDisabled(player.coins < 3),
    new ButtonBuilder().setCustomId(`act_${ts}_steal`).setLabel('🏴‍☠️ 偷竊').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`act_${ts}_exchange`).setLabel('🔄 換牌').setStyle(ButtonStyle.Primary),
  );

  const msg = await channel.send({
    content: `<@${currentId}>`,
    embeds: [e(`📋 **場上狀態：**\n${statusText}\n\n🎯 輪到 **${player.name}** 行動！`)],
    components: [row1, row2],
  });

  // 等待行動選擇
  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`act_${ts}_`),
    time: 120000,
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== currentId) {
      return i.reply({ embeds: [e('❌ 不是你的回合！')], flags: MessageFlags.Ephemeral });
    }
    collector.stop('acted');
    const action = i.customId.replace(`act_${ts}_`, '');
    await i.update({ components: [] });
    await processAction(channel, player, action);
  });

  collector.on('end', (c, reason) => {
    if (reason !== 'acted' && state.phase === 'playing') {
      msg.edit({ components: [] }).catch(() => {});
      // 超時自動收入
      player.coins += 1;
      channel.send({ embeds: [e(`⏰ **${player.name}** 超時，自動收入 +1 💰`)] });
      state.orderIndex = (state.orderIndex + 1) % state.order.length;
      startTurn(channel);
    }
  });
  state.collectors.push(collector);
}

// ─── 強制政變 ───
async function handleForcedCoup(channel, player) {
  const targets = getAlivePlayers().filter(p => p.id !== player.id);
  const ts = Date.now();
  const rows = [];
  for (let i = 0; i < targets.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const t of targets.slice(i, i + 5)) {
      row.addComponents(new ButtonBuilder().setCustomId(`couptar_${ts}_${t.id}`).setLabel(t.name).setStyle(ButtonStyle.Danger));
    }
    rows.push(row);
  }

  const msg = await channel.send({ embeds: [e(`⚔️ **${player.name}** 必須政變！選擇目標：`)], components: rows });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`couptar_${ts}_`) && i.user.id === player.id,
    max: 1, time: 60000,
  });

  collector.on('collect', async (i) => {
    const targetId = i.customId.replace(`couptar_${ts}_`, '');
    const target = findPlayer(targetId);
    await i.update({ components: [] });
    player.coins -= 7;
    await channel.send({ embeds: [e(`⚔️ **${player.name}** 發動政變，對 **${target.name}** 使用了 7 💰！`)] });
    await loseInfluence(channel, targetId, '被政變，失去一點影響力');
    state.orderIndex = (state.orderIndex + 1) % state.order.length;
    await startTurn(channel);
  });

  collector.on('end', (c) => {
    if (c.size === 0) {
      // 超時，隨機選目標
      const targets = getAlivePlayers().filter(p => p.id !== player.id);
      const target = targets[Math.floor(Math.random() * targets.length)];
      player.coins -= 7;
      msg.edit({ components: [] }).catch(() => {});
      channel.send({ embeds: [e(`⏰ **${player.name}** 超時，隨機政變 **${target.name}**！`)] });
      loseInfluence(channel, target.id, '被政變，失去一點影響力').then(() => {
        state.orderIndex = (state.orderIndex + 1) % state.order.length;
        startTurn(channel);
      });
    }
  });
  state.collectors.push(collector);
}

// ─── 處理行動 ───
async function processAction(channel, player, action) {
  const targets = getAlivePlayers().filter(p => p.id !== player.id);

  switch (action) {
    case 'income': {
      player.coins += 1;
      await channel.send({ embeds: [e(`💰 **${player.name}** 收入 +1（現有 ${player.coins} 💰）`)] });
      state.orderIndex = (state.orderIndex + 1) % state.order.length;
      await startTurn(channel);
      break;
    }

    case 'foreign_aid': {
      // 可被公爵阻礙
      const reaction = await showReactionWindow(channel, player.id,
        `💵 **${player.name}** 要拿外援 +2 💰`,
        false, // 不能質疑（一般行動）
        { targetId: null, anyoneCanBlock: true }
      );

      if (reaction.type === 'block') {
        const blocker = findPlayer(reaction.playerId);
        const blockResult = await showBlockChallengeWindow(channel, blocker.id, blocker.name, 'duke');
        if (blockResult.type === 'challenge') {
          const success = await resolveChallenge(channel, blockResult.playerId, blocker.id, 'duke');
          if (success) {
            // 阻礙成功（阻礙者真的有公爵）
            await channel.send({ embeds: [e(`🛡️ 阻礙成功！**${player.name}** 的外援被擋下。`)] });
          } else {
            // 阻礙失敗（阻礙者沒有公爵）
            player.coins += 2;
            await channel.send({ embeds: [e(`💵 阻礙失敗！**${player.name}** 外援成功 +2（現有 ${player.coins} 💰）`)] });
          }
        }
        // 沒人質疑阻礙 → 阻礙成功，不拿錢
      } else {
        player.coins += 2;
        await channel.send({ embeds: [e(`💵 **${player.name}** 外援成功 +2（現有 ${player.coins} 💰）`)] });
      }
      state.orderIndex = (state.orderIndex + 1) % state.order.length;
      await startTurn(channel);
      break;
    }

    case 'coup': {
      // 選目標
      const targetId = await selectTarget(channel, player, targets, '⚔️ 選擇政變目標：');
      if (!targetId) break;
      const target = findPlayer(targetId);
      player.coins -= 7;
      await channel.send({ embeds: [e(`⚔️ **${player.name}** 發動政變，對 **${target.name}** 使用了 7 💰！`)] });
      await loseInfluence(channel, targetId, '被政變，失去一點影響力');
      state.orderIndex = (state.orderIndex + 1) % state.order.length;
      await startTurn(channel);
      break;
    }

    case 'tax': {
      const reaction = await showReactionWindow(channel, player.id,
        `👑 **${player.name}** 宣稱自己是公爵，收稅 +3 💰`,
        true, null
      );

      if (reaction.type === 'challenge') {
        const success = await resolveChallenge(channel, reaction.playerId, player.id, 'duke');
        if (success) {
          player.coins += 3;
          await channel.send({ embeds: [e(`👑 **${player.name}** 收稅成功 +3（現有 ${player.coins} 💰）`)] });
        }
      } else {
        player.coins += 3;
        await channel.send({ embeds: [e(`👑 **${player.name}** 收稅成功 +3（現有 ${player.coins} 💰）`)] });
      }
      state.orderIndex = (state.orderIndex + 1) % state.order.length;
      await startTurn(channel);
      break;
    }

    case 'assassinate': {
      const targetId = await selectTarget(channel, player, targets, '🗡️ 選擇暗殺目標：');
      if (!targetId) break;
      const target = findPlayer(targetId);
      player.coins -= 3;

      // 反應視窗：質疑 + 被暗殺者可阻礙
      const reaction = await showReactionWindow(channel, player.id,
        `🗡️ **${player.name}** 宣稱自己是殺手，暗殺 **${target.name}**！（已付 3 💰）`,
        true,
        { targetId: target.id, anyoneCanBlock: false }
      );

      if (reaction.type === 'challenge') {
        const success = await resolveChallenge(channel, reaction.playerId, player.id, 'assassin');
        if (success) {
          // 質疑失敗，暗殺繼續，但目標還能阻礙
          if (target.alive) {
            const blockReaction = await showReactionWindow(channel, player.id,
              `🗡️ 暗殺繼續！**${target.name}** 可以阻礙（宣稱貴婦）`,
              false, { targetId: target.id, anyoneCanBlock: false }
            );
            if (blockReaction.type === 'block') {
              await handleBlock(channel, player, target, blockReaction, 'contessa', '暗殺', targetId);
            } else if (target.alive) {
              await loseInfluence(channel, targetId, '被暗殺，失去一點影響力');
            }
          }
        } else {
          // 質疑成功，暗殺失敗，退錢
          player.coins += 3;
          await channel.send({ embeds: [e(`💰 暗殺失敗，退還 3 💰 給 **${player.name}**`)] });
        }
      } else if (reaction.type === 'block') {
        await handleBlock(channel, player, target, reaction, 'contessa', '暗殺', targetId);
      } else {
        // 無人反應，暗殺成功
        if (target.alive) {
          await loseInfluence(channel, targetId, '被暗殺，失去一點影響力');
        }
      }
      state.orderIndex = (state.orderIndex + 1) % state.order.length;
      await startTurn(channel);
      break;
    }

    case 'steal': {
      const targetId = await selectTarget(channel, player, targets, '🏴‍☠️ 選擇偷竊目標：');
      if (!targetId) break;
      const target = findPlayer(targetId);

      const reaction = await showReactionWindow(channel, player.id,
        `🏴‍☠️ **${player.name}** 宣稱自己是隊長，偷 **${target.name}** 的錢！`,
        true,
        { targetId: target.id, anyoneCanBlock: false }
      );

      if (reaction.type === 'challenge') {
        const success = await resolveChallenge(channel, reaction.playerId, player.id, 'captain');
        if (success) {
          // 質疑失敗，偷竊繼續，但目標還能阻礙
          if (target.alive) {
            const blockReaction = await showReactionWindow(channel, player.id,
              `🏴‍☠️ 偷竊繼續！**${target.name}** 可以阻礙（宣稱隊長或大使）`,
              false, { targetId: target.id, anyoneCanBlock: false }
            );
            if (blockReaction.type === 'block') {
              await handleStealBlock(channel, player, target, blockReaction);
            } else {
              const stolen = Math.min(2, target.coins);
              target.coins -= stolen;
              player.coins += stolen;
              await channel.send({ embeds: [e(`🏴‍☠️ **${player.name}** 偷了 **${target.name}** ${stolen} 💰！`)] });
            }
          }
        } else {
          await channel.send({ embeds: [e(`🏴‍☠️ 偷竊失敗！`)] });
        }
      } else if (reaction.type === 'block') {
        await handleStealBlock(channel, player, target, reaction);
      } else {
        const stolen = Math.min(2, target.coins);
        target.coins -= stolen;
        player.coins += stolen;
        await channel.send({ embeds: [e(`🏴‍☠️ **${player.name}** 偷了 **${target.name}** ${stolen} 💰！`)] });
      }
      state.orderIndex = (state.orderIndex + 1) % state.order.length;
      await startTurn(channel);
      break;
    }

    case 'exchange': {
      const reaction = await showReactionWindow(channel, player.id,
        `🔄 **${player.name}** 宣稱自己是大使，要換牌！`,
        true, null
      );

      if (reaction.type === 'challenge') {
        const success = await resolveChallenge(channel, reaction.playerId, player.id, 'ambassador');
        if (success && player.alive) {
          await executeExchange(channel, player.id);
        }
      } else {
        await executeExchange(channel, player.id);
      }
      state.orderIndex = (state.orderIndex + 1) % state.order.length;
      await startTurn(channel);
      break;
    }
  }
}

// 處理暗殺的阻礙
async function handleBlock(channel, attacker, target, reaction, blockRole, actionName, targetId) {
  const blocker = findPlayer(reaction.playerId);
  const blockResult = await showBlockChallengeWindow(channel, blocker.id, blocker.name, blockRole);
  if (blockResult.type === 'challenge') {
    const success = await resolveChallenge(channel, blockResult.playerId, blocker.id, blockRole);
    if (success) {
      await channel.send({ embeds: [e(`🛡️ 阻礙成功！${actionName}被擋下。`)] });
    } else {
      if (target.alive) {
        await loseInfluence(channel, targetId, `阻礙失敗，${actionName}生效`);
      }
    }
  }
  // 沒人質疑 → 阻礙成功
}

// 處理偷竊的阻礙（可宣稱隊長或大使）
async function handleStealBlock(channel, stealer, target, reaction) {
  const blocker = findPlayer(reaction.playerId);
  // 阻礙偷竊可以宣稱隊長或大使，先問宣稱什麼
  const ts = Date.now();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`stealblock_${ts}_captain`).setLabel('🏴‍☠️ 宣稱隊長').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`stealblock_${ts}_ambassador`).setLabel('🔄 宣稱大使').setStyle(ButtonStyle.Primary),
  );

  const msg = await channel.send({
    content: `<@${blocker.id}>`,
    embeds: [e(`🛡️ **${blocker.name}** 要阻礙偷竊，宣稱什麼角色？`)],
    components: [row],
  });

  const claimedRole = await new Promise((resolve) => {
    const coll = msg.createMessageComponentCollector({
      filter: i => i.customId.startsWith(`stealblock_${ts}_`) && i.user.id === blocker.id,
      max: 1, time: 30000,
    });
    coll.on('collect', async (i) => {
      const role = i.customId.replace(`stealblock_${ts}_`, '');
      await i.update({ components: [] });
      resolve(role);
    });
    coll.on('end', (c) => { if (c.size === 0) { msg.edit({ components: [] }).catch(() => {}); resolve('captain'); } });
    state.collectors.push(coll);
  });

  const blockResult = await showBlockChallengeWindow(channel, blocker.id, blocker.name, claimedRole);
  if (blockResult.type === 'challenge') {
    const success = await resolveChallenge(channel, blockResult.playerId, blocker.id, claimedRole);
    if (success) {
      await channel.send({ embeds: [e(`🛡️ 阻礙成功！偷竊被擋下。`)] });
    } else {
      const stolen = Math.min(2, target.coins);
      target.coins -= stolen;
      stealer.coins += stolen;
      await channel.send({ embeds: [e(`🏴‍☠️ 阻礙失敗！**${stealer.name}** 偷了 **${target.name}** ${stolen} 💰！`)] });
    }
  }
  // 沒人質疑 → 阻礙成功
}

// 選擇目標
async function selectTarget(channel, player, targets, prompt) {
  const ts = Date.now();
  const rows = [];
  for (let i = 0; i < targets.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const t of targets.slice(i, i + 5)) {
      row.addComponents(new ButtonBuilder().setCustomId(`target_${ts}_${t.id}`).setLabel(t.name).setStyle(ButtonStyle.Secondary));
    }
    rows.push(row);
  }

  const msg = await channel.send({
    content: `<@${player.id}>`,
    embeds: [e(prompt)],
    components: rows,
  });

  return new Promise((resolve) => {
    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId.startsWith(`target_${ts}_`) && i.user.id === player.id,
      max: 1, time: 60000,
    });
    collector.on('collect', async (i) => {
      const targetId = i.customId.replace(`target_${ts}_`, '');
      await i.update({ components: [] });
      resolve(targetId);
    });
    collector.on('end', (c) => {
      if (c.size === 0) { msg.edit({ components: [] }).catch(() => {}); resolve(null); }
    });
    state.collectors.push(collector);
  });
}

// ─── 指令 ───
const commands = {
  async cs(message) {
    if (state.phase !== 'idle') return message.reply({ embeds: [e('❌ 目前已有一局政變進行中！')] });
    reset();
    state.phase = 'waiting'; state.hostId = message.author.id;
    state.channelId = message.channel.id; state.guild = message.guild;
    state.players.push({ id: message.author.id, name: message.member.displayName, coins: 0, cards: [], revealedCards: [], alive: true });
    message.channel.send({ embeds: [e(`🃏 **政變開局！**\n👑 開局人：${message.member.displayName}\n\n輸入 \`!cj\` 加入遊戲\n開局人輸入 \`!cb\` 開始遊戲（2~6 人）\n\n目前玩家（1人）：${message.member.displayName}`)] });
  },

  async cj(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有開放加入的政變局！')] });
    if (state.players.find(p => p.id === message.author.id)) return message.reply({ embeds: [e('❌ 你已經加入了！')] });
    if (state.players.length >= 6) return message.reply({ embeds: [e('❌ 已滿 6 人！')] });
    state.players.push({ id: message.author.id, name: message.member.displayName, coins: 0, cards: [], revealedCards: [], alive: true });
    const names = state.players.map(p => p.name).join('、');
    message.channel.send({ embeds: [e(`✅ **${message.member.displayName}** 加入政變！\n目前玩家（${state.players.length}人）：${names}`)] });
  },

  async cb(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有等待中的政變局！')] });
    if (message.author.id !== state.hostId) return message.reply({ embeds: [e('❌ 只有開局人才能開始遊戲！')] });
    if (state.players.length < 2) return message.reply({ embeds: [e('❌ 至少需要 2 人！')] });

    state.guild = message.guild;
    state.deck = buildDeck();

    // 發牌 + 給金幣
    for (const p of state.players) {
      p.cards = [state.deck.pop(), state.deck.pop()];
      p.coins = 2;
    }

    // 隨機順序
    state.order = shuffle(state.players.map(p => p.id));
    state.phase = 'playing';

    // DM 手牌
    for (const p of state.players) {
      try {
        const member = await message.guild.members.fetch(p.id);
        await member.send({ embeds: [e(`🃏 **你的手牌：**\n${p.cards.map(c => ROLES[c].name).join('、')}\n\n💰 金幣：${p.coins}`)] });
      } catch {
        await message.channel.send({ embeds: [e(`⚠️ 無法私訊 ${p.name}！`)] });
      }
    }

    const orderNames = state.order.map((id, i) => `${i + 1}. ${findPlayer(id).name}`).join('\n');
    await message.channel.send({ embeds: [e(`🃏 **政變開始！共 ${state.players.length} 人**\n\n每人 2 張牌 + 2 💰\n手牌已透過 DM 發送！\n\n📋 行動順序：\n${orderNames}`)] });

    await startTurn(message.channel);
  },

  async cc(message) {
    if (state.phase !== 'playing') return message.reply({ embeds: [e('❌ 目前沒有進行中的政變局！')] });
    const player = findPlayer(message.author.id);
    if (!player) return message.reply({ embeds: [e('❌ 你沒有加入這局政變！')] });
    await message.reply({ embeds: [e(getHandText(player))], flags: MessageFlags.Ephemeral });
  },

  async cq(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的政變局！')] });
    const isHost = message.author.id === state.hostId;
    const isAdmin = message.author.id === process.env.ANNOUNCE_ADMIN_ID;
    const isPlayer = state.players.some(p => p.id === message.author.id);
    if (!isHost && !isAdmin && !isPlayer) return message.reply({ embeds: [e('❌ 只有參加的玩家才能取消！')] });

    const cardList = state.players.map(p => {
      const cards = [...p.cards.map(c => ROLES[c].name), ...p.revealedCards.map(c => `~~${ROLES[c].name}~~`)].join('、') || '無';
      return `${p.name} — ${cards}（💰${p.coins}）`;
    }).join('\n');
    reset();
    message.channel.send({ embeds: [e(`🚫 **${message.member.displayName}** 取消了政變！\n\n📋 **牌面公布：**\n${cardList}`)] });
  },

  async cl(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的政變局！')] });
    const pi = state.players.findIndex(p => p.id === message.author.id);
    if (pi === -1) return message.reply({ embeds: [e('❌ 你沒有加入這局政變！')] });
    const playerName = message.member.displayName;

    if (state.phase === 'waiting') {
      state.players.splice(pi, 1);
      if (message.author.id === state.hostId && state.players.length > 0) {
        state.hostId = state.players[0].id;
        return message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了！\n👑 開局人轉移給 **${state.players[0].name}**`)] });
      }
      if (state.players.length === 0) { reset(); return; }
      return message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了！\n目前玩家（${state.players.length}人）：${state.players.map(p => p.name).join('、')}`)] });
    }

    // 遊戲中離開 = 出局
    const player = state.players[pi];
    player.alive = false;
    player.revealedCards.push(...player.cards);
    player.cards = [];
    await message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了遊戲，直接出局！`)] });

    const winner = checkWin();
    if (winner) {
      await message.channel.send({ embeds: [e(`🏆🏆🏆 **${winner.name} 獲勝！**`)] });
      reset();
    }
  },
};

export default commands;
