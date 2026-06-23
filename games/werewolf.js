import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);
//
// ─── 角色配置 ───
const ROLE_CONFIGS = {
  6:  { wolf: 2, seer: 1, witch: 1, hunter: 0, guard: 0, villager: 2 },
  7:  { wolf: 2, seer: 1, witch: 1, hunter: 0, guard: 0, villager: 3 },
  8:  { wolf: 3, seer: 1, witch: 1, hunter: 1, guard: 0, villager: 2 },
  9:  { wolf: 3, seer: 1, witch: 1, hunter: 1, guard: 0, villager: 3 },
  10: { wolf: 3, seer: 1, witch: 1, hunter: 1, guard: 1, villager: 3 },
};

const ROLE_NAMES = {
  wolf: '🐺 狼人', seer: '🔮 預言家', witch: '🧪 女巫',
  hunter: '🏹 獵人', guard: '🛡️ 守衛', villager: '👤 村民',
};

// ─── 狀態 ───
const state = {
  phase: 'idle', hostId: null, channelId: null, guild: null,
  players: [], night: 0,
  wolfTarget: null, wolfVotes: new Map(),
  guardTarget: null, lastGuardTarget: null,
  witchHealUsed: false, witchPoisonUsed: false,
  witchHealed: false, witchPoisonTarget: null,
  nightDeaths: [],
  votes: new Map(), voteMsg: null, voteCollector: null,
  collectors: [],
};

function reset() {
  state.collectors.forEach(c => { try { c.stop(); } catch {} });
  if (state.voteCollector) try { state.voteCollector.stop(); } catch {}
  Object.assign(state, {
    phase: 'idle', hostId: null, channelId: null, guild: null,
    players: [], night: 0,
    wolfTarget: null, wolfVotes: new Map(),
    guardTarget: null, lastGuardTarget: null,
    witchHealUsed: false, witchPoisonUsed: false,
    witchHealed: false, witchPoisonTarget: null,
    nightDeaths: [], votes: new Map(), voteMsg: null, voteCollector: null,
    collectors: [],
  });
}

// ─── 工具函數 ───
function getAlivePlayers() { return state.players.filter(p => p.alive); }
function getAliveByRole(role) { return state.players.filter(p => p.alive && p.role === role); }
function hasAliveRole(role) { return state.players.some(p => p.alive && p.role === role); }
function findPlayer(id) { return state.players.find(p => p.id === id); }

// 死亡角色管理
async function addDeadRole(playerId) {
  const roleId = process.env.DEAD_ROLE_ID;
  if (!roleId || !state.guild) { console.log('[狼人殺] DEAD_ROLE_ID 未設定，跳過死亡角色'); return; }
  try {
    const member = await state.guild.members.fetch(playerId);
    await member.roles.add(roleId);
  } catch (err) { console.error('[狼人殺] 無法加上死亡角色:', err.message); }
}

async function removeAllDeadRoles() {
  const roleId = process.env.DEAD_ROLE_ID;
  if (!roleId || !state.guild) return;
  for (const p of state.players) {
    try {
      const member = await state.guild.members.fetch(p.id);
      await member.roles.remove(roleId);
    } catch (err) { console.error('[狼人殺] 無法移除死亡角色:', err.message); }
  }
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkWin() {
  const alive = getAlivePlayers();
  const wolves = alive.filter(p => p.role === 'wolf');
  const goods = alive.filter(p => p.role !== 'wolf');
  const specials = goods.filter(p => !['villager'].includes(p.role));

  if (wolves.length === 0) return 'good';
  if (goods.length === 0) return 'wolf';
  if (specials.length === 0) return 'wolf';
  return null;
}

function buildPlayerButtons(players, prefix, ts) {
  const rows = [];
  for (let i = 0; i < players.length; i += 5) {
    const row = new ActionRowBuilder();
    const chunk = players.slice(i, i + 5);
    for (const p of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${prefix}_${ts}_${p.id}`)
          .setLabel(p.name)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }
  return rows;
}

// 等待玩家透過 DM 按鈕選擇
async function awaitChoice(playerId, embed, targets, prefix, extraButtons, timeout = 600000) {
  const member = await state.guild.members.fetch(playerId);
  const ts = Date.now();
  const rows = buildPlayerButtons(targets, prefix, ts);
  if (extraButtons) {
    const extraRow = new ActionRowBuilder();
    for (const btn of extraButtons) {
      extraRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${prefix}_${ts}_${btn.id}`)
          .setLabel(btn.label)
          .setStyle(btn.style || ButtonStyle.Primary)
      );
    }
    rows.push(extraRow);
  }

  const msg = await member.send({ embeds: [embed], components: rows });

  return new Promise((resolve) => {
    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId.startsWith(`${prefix}_${ts}_`),
      max: 1, time: timeout,
    });
    collector.on('collect', async (i) => {
      const choiceId = i.customId.replace(`${prefix}_${ts}_`, '');
      await i.update({ components: [] });
      resolve(choiceId);
    });
    collector.on('end', (c) => { if (c.size === 0) resolve(null); });
    state.collectors.push(collector);
  });
}

// ─── 夜晚流程 ───
async function startNight(channel) {
  state.night++;
  state.phase = 'night';
  state.wolfTarget = null;
  state.wolfVotes.clear();
  state.guardTarget = null;
  state.witchHealed = false;
  state.witchPoisonTarget = null;
  state.nightDeaths = [];

  await channel.send({ embeds: [e(`🌙 **第 ${state.night} 夜降臨，所有人閉眼...**`)] });
  await sleep(1500);

  // 1. 守衛
  if (hasAliveRole('guard')) {
    await guardPhase(channel);
  }

  // 2. 狼人
  await wolfPhase(channel);

  // 3. 女巫
  if (hasAliveRole('witch')) {
    await witchPhase(channel);
  }

  // 4. 預言家
  if (hasAliveRole('seer')) {
    await seerPhase(channel);
  }

  // 結算夜晚
  await resolveNight(channel);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── 守衛 ───
async function guardPhase(channel) {
  await channel.send({ embeds: [e('🛡️ 守衛正在行動...（限時 2 分鐘）')] });
  const guard = getAliveByRole('guard')[0];
  const targets = getAlivePlayers().filter(p => p.id !== state.lastGuardTarget);

  const choice = await awaitChoice(
    guard.id,
    e(`🛡️ **你是守衛**\n${state.lastGuardTarget ? `上一晚守了 **${findPlayer(state.lastGuardTarget)?.name}**，本晚不能再守同一人。` : ''}\n\n選擇要保護的人（限時 2 分鐘）：`),
    targets, 'guard', null, 120000
  );

  state.guardTarget = choice;
  const targetName = choice ? findPlayer(choice)?.name : '無';
  const member = await state.guild.members.fetch(guard.id);
  await member.send({ embeds: [e(`🛡️ 你選擇保護 **${targetName}**`)] });
}

// ─── 狼人 ───
async function wolfPhase(channel) {
  await channel.send({ embeds: [e('🐺 狼人正在行動...（限時 3 分鐘）')] });
  const wolves = getAliveByRole('wolf');
  const targets = getAlivePlayers();

  while (true) {
    state.wolfVotes.clear();
    const wolfTeamInfo = (wolfId) => {
      const mates = wolves.filter(w => w.id !== wolfId).map(w => w.name);
      return mates.length ? `你的狼隊友：${mates.join('、')}` : '你是唯一的狼人';
    };

    const promises = wolves.map(wolf =>
      awaitChoice(
        wolf.id,
        e(`🐺 **你是狼人**\n${wolfTeamInfo(wolf.id)}\n\n選擇要擊殺的目標（限時 3 分鐘）：`),
        targets, 'wolf', null, 180000
      ).then(choice => {
        state.wolfVotes.set(wolf.id, choice);
      })
    );

    await Promise.all(promises);

    // 只有一隻狼直接通過
    if (wolves.length === 1) {
      state.wolfTarget = state.wolfVotes.values().next().value;
      break;
    }

    // 檢查是否一致
    const choices = [...state.wolfVotes.values()];
    if (new Set(choices).size === 1 && choices[0]) {
      state.wolfTarget = choices[0];
      const targetName = findPlayer(state.wolfTarget)?.name;
      for (const wolf of wolves) {
        const member = await state.guild.members.fetch(wolf.id);
        await member.send({ embeds: [e(`🐺 所有狼人同意擊殺 **${targetName}**！`)] });
      }
      break;
    } else {
      // 不一致，重新選
      for (const wolf of wolves) {
        const member = await state.guild.members.fetch(wolf.id);
        const voteInfo = [...state.wolfVotes.entries()].map(([wid, tid]) => {
          const wName = findPlayer(wid)?.name;
          const tName = findPlayer(tid)?.name || '未選';
          return `${wName} → ${tName}`;
        }).join('\n');
        await member.send({ embeds: [e(`❌ **狼隊意見不一致！請重新選擇。**\n\n各人選擇：\n${voteInfo}`)] });
      }
    }
  }
}

// ─── 女巫 ───
async function witchPhase(channel) {
  await channel.send({ embeds: [e('🧪 女巫正在行動...（限時 2 分鐘）')] });
  const witch = getAliveByRole('witch')[0];

  // 判斷狼刀是否被守衛擋下
  const wolfKill = state.wolfTarget;
  const guardedTarget = state.guardTarget;
  const actuallyKilled = (wolfKill && wolfKill !== guardedTarget) ? wolfKill : null;
  const killedName = actuallyKilled ? findPlayer(actuallyKilled)?.name : null;

  const hasHeal = !state.witchHealUsed;
  const hasPoison = !state.witchPoisonUsed;

  if (!hasHeal && !hasPoison) return; // 兩瓶都用完了

  let promptText = '🧪 **你是女巫**\n\n';
  if (hasHeal && actuallyKilled) {
    promptText += `昨晚 **${killedName}** 被殺了。\n`;
  } else if (hasHeal && !actuallyKilled) {
    promptText += `昨晚沒有人被殺（被守衛擋下或狼人自刀失敗）。\n`;
  }
  promptText += `\n💊 解藥：${hasHeal ? '✅ 有' : '❌ 已用'}\n☠️ 毒藥：${hasPoison ? '✅ 有' : '❌ 已用'}\n\n選擇行動：`;

  const extraBtns = [];
  if (hasHeal && actuallyKilled) {
    extraBtns.push({ id: `heal_${actuallyKilled}`, label: `💊 救 ${killedName}`, style: ButtonStyle.Success });
  }
  extraBtns.push({ id: 'pass', label: '🚫 不使用', style: ButtonStyle.Secondary });

  // 毒藥目標：所有活人除了自己和被殺的人
  const poisonTargets = hasPoison
    ? getAlivePlayers().filter(p => p.id !== witch.id && p.id !== actuallyKilled)
    : [];

  const ts = Date.now();
  const components = [];

  // 毒藥目標按鈕
  if (poisonTargets.length > 0) {
    for (let i = 0; i < poisonTargets.length; i += 5) {
      const row = new ActionRowBuilder();
      for (const p of poisonTargets.slice(i, i + 5)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`witch_${ts}_poison_${p.id}`)
            .setLabel(`☠️ ${p.name}`)
            .setStyle(ButtonStyle.Danger)
        );
      }
      components.push(row);
    }
  }

  // 救人 + 跳過
  const actionRow = new ActionRowBuilder();
  for (const btn of extraBtns) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`witch_${ts}_${btn.id}`)
        .setLabel(btn.label)
        .setStyle(btn.style)
    );
  }
  components.push(actionRow);

  const member = await state.guild.members.fetch(witch.id);
  const msg = await member.send({ embeds: [e(promptText)], components });

  const choice = await new Promise((resolve) => {
    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId.startsWith(`witch_${ts}_`),
      max: 1, time: 120000,
    });
    collector.on('collect', async (i) => {
      await i.update({ components: [] });
      resolve(i.customId.replace(`witch_${ts}_`, ''));
    });
    collector.on('end', (c) => { if (c.size === 0) resolve('pass'); });
    state.collectors.push(collector);
  });

  if (choice.startsWith('heal_')) {
    state.witchHealed = true;
    state.witchHealUsed = true;
    await member.send({ embeds: [e(`💊 你使用了解藥，救了 **${killedName}**！`)] });
  } else if (choice.startsWith('poison_')) {
    const targetId = choice.replace('poison_', '');
    state.witchPoisonTarget = targetId;
    state.witchPoisonUsed = true;
    const targetName = findPlayer(targetId)?.name;
    await member.send({ embeds: [e(`☠️ 你使用了毒藥，毒了 **${targetName}**！`)] });
  } else {
    await member.send({ embeds: [e('🚫 你選擇不使用藥水。')] });
  }
}

// ─── 預言家 ───
async function seerPhase(channel) {
  await channel.send({ embeds: [e('🔮 預言家正在行動...（限時 2 分鐘）')] });
  const seer = getAliveByRole('seer')[0];
  const targets = getAlivePlayers().filter(p => p.id !== seer.id);

  const choice = await awaitChoice(
    seer.id,
    e('🔮 **你是預言家**\n\n選擇要查驗的人（限時 2 分鐘）：'),
    targets, 'seer', null, 120000
  );

  if (choice) {
    const target = findPlayer(choice);
    const isWolf = target?.role === 'wolf';
    const member = await state.guild.members.fetch(seer.id);
    await member.send({
      embeds: [e(`🔮 查驗結果：**${target.name}** 是 ${isWolf ? '🐺 **狼人**' : '👤 **好人**'}`)],
    });
  }
}

// ─── 結算夜晚 ───
async function resolveNight(channel) {
  const deaths = [];

  // 狼刀結果
  if (state.wolfTarget) {
    const isGuarded = state.wolfTarget === state.guardTarget;
    const isHealed = state.witchHealed;

    if (!isGuarded && !isHealed) {
      const victim = findPlayer(state.wolfTarget);
      if (victim && victim.alive) {
        victim.alive = false;
        victim.causeOfDeath = 'wolf';
        await addDeadRole(victim.id);
        deaths.push(victim);
      }
    }
  }

  // 女巫毒殺（守衛擋不住）
  if (state.witchPoisonTarget) {
    const victim = findPlayer(state.witchPoisonTarget);
    if (victim && victim.alive) {
      victim.alive = false;
      victim.causeOfDeath = 'poison';
      await addDeadRole(victim.id);
      deaths.push(victim);
    }
  }

  // 更新守衛記錄
  state.lastGuardTarget = state.guardTarget;

  state.nightDeaths = deaths;

  // 進入白天
  await startDay(channel);
}

// ─── 白天流程 ───
async function startDay(channel) {
  state.phase = 'day';
  await sleep(1500);

  // 公布死亡
  if (state.nightDeaths.length === 0) {
    await channel.send({ embeds: [e('☀️ **天亮了！**\n\n昨晚是平安夜，沒有人死亡。')] });
  } else {
    const deathNames = state.nightDeaths.map(p => `**${p.name}**`).join('、');
    await channel.send({ embeds: [e(`☀️ **天亮了！**\n\n昨晚 ${deathNames} 死了。`)] });
  }

  // 獵人開槍（如果獵人在夜晚死亡且不是被毒死）
  for (const dead of state.nightDeaths) {
    if (dead.role === 'hunter' && dead.causeOfDeath !== 'poison') {
      await handleHunterShot(channel, dead);
    }
  }

  // 檢查勝利
  const win = checkWin();
  if (win) { await announceWin(channel, win); return; }

  // 討論 + 投票按鈕（主持人專用）
  const ts = Date.now();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`startvote_${ts}`)
      .setLabel('📝 開始投票')
      .setStyle(ButtonStyle.Primary)
  );
  const msg = await channel.send({
    embeds: [e('💬 **自由討論時間**\n\n主持人覺得討論夠了，點下方按鈕開始投票。')],
    components: [row],
  });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId === `startvote_${ts}` && i.user.id === state.hostId,
    max: 1, time: 3600000,
  });
  collector.on('collect', async (i) => {
    await i.update({ components: [] });
    await startVoting(channel);
  });
  state.collectors.push(collector);
}

// ─── 獵人開槍 ───
async function handleHunterShot(channel, hunter) {
  const targets = getAlivePlayers();
  if (targets.length === 0) return;

  await channel.send({ embeds: [e('🏹 有人發動了技能，正在選擇目標...')] });

  const choice = await awaitChoice(
    hunter.id,
    e('🏹 **你是獵人，你死了！**\n\n選擇要帶走的人：'),
    targets, 'hunter_shot', null, 120000
  );

  if (choice) {
    const victim = findPlayer(choice);
    if (victim) {
      victim.alive = false;
      victim.causeOfDeath = 'hunter';
      await addDeadRole(victim.id);
      await channel.send({ embeds: [e(`🏹 **${victim.name}** 被帶走了！`)] });

      if (victim.role === 'hunter' && victim.causeOfDeath !== 'poison') {
        await handleHunterShot(channel, victim);
      }
    }
  } else {
    await channel.send({ embeds: [e('🏹 技能超時，無人被帶走。')] });
  }
}

// ─── 投票 ───
async function startVoting(channel) {
  state.phase = 'voting';
  state.votes.clear();

  const alive = getAlivePlayers();
  const ts = Date.now();

  function buildVoteEmbed() {
    let voteText = '🗳️ **投票放逐**\n\n點按鈕投票，可以改票。\n主持人按「確認結算」結束投票。\n\n';
    const tally = {};
    for (const [voterId, targetId] of state.votes) {
      if (!tally[targetId]) tally[targetId] = [];
      tally[targetId].push(findPlayer(voterId)?.name || voterId);
    }
    if (Object.keys(tally).length === 0) {
      voteText += '目前還沒有人投票。';
    } else {
      for (const [targetId, voters] of Object.entries(tally)) {
        const targetName = findPlayer(targetId)?.name || '?';
        voteText += `**${targetName}**（${voters.length} 票）：${voters.join('、')}\n`;
      }
    }
    const voted = state.votes.size;
    voteText += `\n已投票：${voted} / ${alive.length}`;
    return e(voteText);
  }

  function buildVoteComponents() {
    const rows = [];
    for (let i = 0; i < alive.length; i += 5) {
      const row = new ActionRowBuilder();
      for (const p of alive.slice(i, i + 5)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`vote_${ts}_${p.id}`)
            .setLabel(p.name)
            .setStyle(ButtonStyle.Secondary)
        );
      }
      rows.push(row);
    }
    // 確認按鈕（獨立一行）
    if (rows.length < 5) {
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`voteconfirm_${ts}`)
          .setLabel('✅ 確認結算')
          .setStyle(ButtonStyle.Success)
      );
      rows.push(confirmRow);
    }
    return rows;
  }

  const voteMsg = await channel.send({
    embeds: [buildVoteEmbed()],
    components: buildVoteComponents(),
  });
  state.voteMsg = voteMsg;

  const voteCollector = voteMsg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`vote_${ts}_`) || i.customId === `voteconfirm_${ts}`,
    time: 3600000,
  });

  state.voteCollector = voteCollector;

  voteCollector.on('collect', async (i) => {
    // 確認結算
    if (i.customId === `voteconfirm_${ts}`) {
      if (i.user.id !== state.hostId) {
        return i.reply({ embeds: [e('❌ 只有主持人才能確認結算！')], ephemeral: true });
      }
      voteCollector.stop();
      await i.update({ components: [] });
      await resolveVote(channel);
      return;
    }

    // 投票
    const targetId = i.customId.replace(`vote_${ts}_`, '');
    const voter = findPlayer(i.user.id);
    if (!voter || !voter.alive) {
      return i.reply({ embeds: [e('❌ 你不在這局遊戲中或已死亡！')], ephemeral: true });
    }
    // 不能投自己
    if (targetId === i.user.id) {
      return i.reply({ embeds: [e('❌ 不能投自己！')], ephemeral: true });
    }

    state.votes.set(i.user.id, targetId);
    await i.update({ embeds: [buildVoteEmbed()], components: buildVoteComponents() });
  });
}

// ─── 結算投票 ───
async function resolveVote(channel) {
  const tally = {};
  for (const [, targetId] of state.votes) {
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  if (Object.keys(tally).length === 0) {
    await channel.send({ embeds: [e('⚖️ 沒有人投票，本輪沒有人被放逐。')] });
    await startNight(channel);
    return;
  }

  const maxVotes = Math.max(...Object.values(tally));
  const topIds = Object.keys(tally).filter(id => tally[id] === maxVotes);

  if (topIds.length > 1) {
    const names = topIds.map(id => `**${findPlayer(id)?.name}**`).join('、');
    await channel.send({ embeds: [e(`⚖️ ${names} 各 ${maxVotes} 票，平票！本輪沒有人被放逐。`)] });
    await startNight(channel);
    return;
  }

  const exiledId = topIds[0];
  const exiled = findPlayer(exiledId);
  exiled.alive = false;
  exiled.causeOfDeath = 'vote';
  await addDeadRole(exiled.id);

  await channel.send({ embeds: [e(`⚖️ **${exiled.name}** 被放逐了！（${maxVotes} 票）`)] });

  // 獵人被放逐 → 開槍
  if (exiled.role === 'hunter' && exiled.causeOfDeath !== 'poison') {
    await handleHunterShot(channel, exiled);
  }

  // 檢查勝利
  const win = checkWin();
  if (win) { await announceWin(channel, win); return; }

  // 進入夜晚
  await startNight(channel);
}

// ─── 勝利公告 ───
async function announceWin(channel, side) {
  const roleList = state.players.map(p =>
    `${p.alive ? '✅' : '💀'} ${p.name} — ${ROLE_NAMES[p.role]}`
  ).join('\n');

  if (side === 'good') {
    await channel.send({ embeds: [e(`🎉🎉🎉 **好人陣營勝利！**\n\n所有狼人已被消滅！\n\n📋 **角色公布：**\n${roleList}`)] });
  } else {
    await channel.send({ embeds: [e(`🐺🐺🐺 **狼人陣營勝利！**\n\n好人陣營已無力回天！\n\n📋 **角色公布：**\n${roleList}`)] });
  }
  await removeAllDeadRoles();
  reset();
}

// ─── 指令 ───
const commands = {
  async ws(message) {
    if (state.phase !== 'idle') return message.reply({ embeds: [e('❌ 目前已有一局狼人殺進行中！')] });
    reset();
    state.phase = 'waiting'; state.hostId = message.author.id;
    state.channelId = message.channel.id; state.guild = message.guild;
    state.players.push({ id: message.author.id, name: message.member.displayName, role: null, alive: true, causeOfDeath: null });
    message.channel.send({ embeds: [e(`🐺 **狼人殺開局！**\n👑 主持人：${message.member.displayName}\n\n輸入 \`!wj\` 加入遊戲\n主持人輸入 \`!wb\` 開始遊戲（需要 6~10 人）\n\n目前玩家（1人）：${message.member.displayName}`)] });
  },

  async wj(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有開放加入的狼人殺局！')] });
    if (state.players.find(p => p.id === message.author.id)) return message.reply({ embeds: [e('❌ 你已經加入了！')] });
    if (state.players.length >= 10) return message.reply({ embeds: [e('❌ 已滿 10 人！')] });
    state.players.push({ id: message.author.id, name: message.member.displayName, role: null, alive: true, causeOfDeath: null });
    const names = state.players.map(p => p.name).join('、');
    message.channel.send({ embeds: [e(`✅ **${message.member.displayName}** 加入狼人殺！\n目前玩家（${state.players.length}人）：${names}`)] });
  },

  async wb(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有等待中的狼人殺局！')] });
    if (message.author.id !== state.hostId) return message.reply({ embeds: [e('❌ 只有主持人才能開始遊戲！')] });
    const count = state.players.length;
    if (count < 6) return message.reply({ embeds: [e('❌ 至少需要 6 人才能開始！')] });
    if (count > 10) return message.reply({ embeds: [e('❌ 最多 10 人！')] });

    const config = ROLE_CONFIGS[count];
    if (!config) return message.reply({ embeds: [e(`❌ 不支援 ${count} 人配置！`)] });

    // 分配角色
    const roles = [];
    for (const [role, num] of Object.entries(config)) {
      for (let i = 0; i < num; i++) roles.push(role);
    }
    const shuffledRoles = shuffle(roles);
    state.players.forEach((p, i) => { p.role = shuffledRoles[i]; });

    state.phase = 'night';
    state.guild = message.guild;

    // 公告
    await message.channel.send({ embeds: [e(`🐺 **狼人殺開始！共 ${count} 人**\n\n角色已透過私訊分配，請查看 DM。\n\n即將進入第一個夜晚...`)] });

    // 私訊角色
    for (const p of state.players) {
      try {
        const member = await message.guild.members.fetch(p.id);
        let roleInfo = `你的角色是：${ROLE_NAMES[p.role]}`;
        if (p.role === 'wolf') {
          const mates = state.players.filter(pp => pp.role === 'wolf' && pp.id !== p.id).map(pp => pp.name);
          roleInfo += `\n\n🐺 你的狼隊友：${mates.length ? mates.join('、') : '只有你自己'}`;
        }
        await member.send({ embeds: [e(roleInfo)] });
      } catch {
        await message.channel.send({ embeds: [e(`⚠️ 無法私訊 ${p.name}，請開啟私訊功能！`)] });
      }
    }

    await sleep(2000);
    await startNight(message.channel);
  },

  async wq(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的狼人殺局！')] });
    const isHost = message.author.id === state.hostId;
    const isAdmin = message.author.id === process.env.ANNOUNCE_ADMIN_ID;
    if (!isHost && !isAdmin) return message.reply({ embeds: [e('❌ 只有主持人或管理員才能取消遊戲！')] });
    const roleList = state.players.filter(p => p.role).map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
    await removeAllDeadRoles();
    reset();
    message.channel.send({ embeds: [e(`🚫 **${message.member.displayName}** 取消了這局狼人殺！\n\n${roleList ? `📋 角色公布：\n${roleList}` : ''}\n\n輸入 \`!ws\` 可以重新開局！`)] });
  },

  async wl(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的狼人殺局！')] });
    const pi = state.players.findIndex(p => p.id === message.author.id);
    if (pi === -1) return message.reply({ embeds: [e('❌ 你沒有加入這局狼人殺！')] });
    const playerName = message.member.displayName;
    const wasHost = message.author.id === state.hostId;

    if (state.phase === 'waiting') {
      state.players.splice(pi, 1);
      // 主持人離開 → 轉移給下一個人
      if (wasHost && state.players.length > 0) {
        state.hostId = state.players[0].id;
        await message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了狼人殺！\n👑 主持人轉移給 **${state.players[0].name}**\n\n目前玩家（${state.players.length}人）：${state.players.map(p => p.name).join('、')}`)] });
      } else {
        await message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了狼人殺！\n目前玩家（${state.players.length}人）：${state.players.map(p => p.name).join('、') || '無'}`)] });
      }
      if (state.players.length === 0) reset();
      return;
    }

    // 遊戲中離開 = 死亡
    const player = state.players[pi];
    player.alive = false;
    player.causeOfDeath = 'leave';
    await addDeadRole(player.id);

    // 主持人離開 → 轉移給下一個活著的人
    if (wasHost) {
      const nextHost = getAlivePlayers().find(p => p.id !== message.author.id);
      if (nextHost) {
        state.hostId = nextHost.id;
        await message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了遊戲，視為死亡。\n👑 主持人轉移給 **${nextHost.name}**`)] });
      } else {
        await message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了遊戲，視為死亡。`)] });
      }
    } else {
      await message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了遊戲，視為死亡。`)] });
    }

    const win = checkWin();
    if (win) await announceWin(message.channel, win);
  },
};

export default commands;
