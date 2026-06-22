import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);

// ─── 內建詞庫 ───
const DEFAULT_WORDS = [
  '蘋果','月亮','咖啡','恐龍','鑽石','雨傘','彩虹','鋼琴','巧克力','企鵝',
  '火山','機器人','外星人','太陽眼鏡','泡麵','棒球','聖誕節','章魚','瀑布','電梯',
  '冰淇淋','飛碟','木乃伊','溜滑梯','氣球','摩天輪','仙人掌','藍芽','漢堡','金字塔',
  '北極熊','橡皮擦','望遠鏡','指南針','蘑菇','稻草人','魔術師','珊瑚','口紅','吊橋',
  '貓頭鷹','滅火器','鬧鐘','日記本','螢火蟲','迷宮','拼圖','蹺蹺板','竹蜻蜓','風箏',
  '手術刀','降落傘','樹懶','考古學家','潛水艇','高跟鞋','打字機','龍捲風','防毒面具','萬花筒',
];

const ROLE_NAMES = {
  mayor: '👑 村長', wolf: '🐺 狼人', seer: '🔮 先知', villager: '👤 村民',
};

// ─── 狀態 ───
const state = {
  phase: 'idle', hostId: null, channelId: null, guild: null,
  players: [], word: null,
  order: [], orderIndex: 0, round: 1, maxRounds: 5,
  mayorId: null, collectors: [], turnTimer: null, turnTimeLimit: 0,
};

function reset() {
  state.collectors.forEach(c => { try { c.stop(); } catch {} });
  if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }
  Object.assign(state, {
    phase: 'idle', hostId: null, channelId: null, guild: null,
    players: [], word: null, order: [], orderIndex: 0,
    round: 1, maxRounds: 5, mayorId: null, collectors: [], turnTimer: null, turnTimeLimit: 0,
  });
}

function findPlayer(id) { return state.players.find(p => p.id === id); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRoleConfig(count) {
  if (count <= 6) return { mayor: 1, wolf: 1, seer: 1, villager: count - 3 };
  return { mayor: 1, wolf: 2, seer: 1, villager: count - 4 };
}

// ─── 村長回答面板（含「正確」按鈕）───
async function showMayorPanel(channel, content, askerName) {
  const ts = Date.now();
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mra_${ts}_yes`).setLabel('✅ 是').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mra_${ts}_no`).setLabel('❌ 否').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`mra_${ts}_close`).setLabel('🤏 接近了').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`mra_${ts}_far`).setLabel('🚫 差很多').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`mra_${ts}_unsure`).setLabel('❓ 不確定').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mra_${ts}_correct`).setLabel('🎯 正確！').setStyle(ButtonStyle.Primary),
  );

  const msg = await channel.send({
    embeds: [e(`💬 **${askerName}**：「${content}」\n\n👑 村長請用按鈕回答：`)],
    components: [row1, row2],
  });

  return new Promise((resolve) => {
    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId.startsWith(`mra_${ts}_`) && i.user.id === state.mayorId,
      max: 1, time: 300000,
    });
    collector.on('collect', async (i) => {
      const answer = i.customId.replace(`mra_${ts}_`, '');
      const labels = {
        yes: '✅ 是', no: '❌ 否', close: '🤏 接近了',
        far: '🚫 差很多', unsure: '❓ 不確定', correct: '🎯 正確！',
      };
      await i.update({
        embeds: [e(`💬 **${askerName}**：「${content}」\n\n👑 村長回答：**${labels[answer]}**`)],
        components: [],
      });
      resolve(answer);
    });
    collector.on('end', (c) => {
      if (c.size === 0) {
        msg.edit({ embeds: [e(`💬 **${askerName}**：「${content}」\n\n👑 村長未回答（超時）`)], components: [] }).catch(() => {});
        resolve(null);
      }
    });
    state.collectors.push(collector);
  });
}

// ─── 開始回合 ───
async function startTurn(channel) {
  if (state.phase !== 'playing') return;
  if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }

  const currentPlayerId = state.order[state.orderIndex];
  const mayor = findPlayer(state.mayorId);
  const timeInfo = state.turnTimeLimit > 0 ? ` ｜ ⏱️ ${state.turnTimeLimit / 60000} 分鐘` : '';

  // 順序列表，標記目前輪到的人
  const orderList = state.order.map((id, i) => {
    const p = findPlayer(id);
    const arrow = id === currentPlayerId ? '➡️ ' : '　　';
    return `${arrow}${i + 1}. ${p.name}`;
  }).join('\n');

  await channel.send({
    embeds: [e(`👑 村長：**${mayor.name}**\n\n📋 提問順序：\n${orderList}\n\n🎯 輪到 <@${currentPlayerId}>！\n用 \`!wwg 內容\` 提問或猜詞，或 \`!wwp\` 跳過\n\n第 ${state.round} / ${state.maxRounds} 輪${timeInfo}`)],
  });

  if (state.turnTimeLimit > 0) {
    state.turnTimer = setTimeout(async () => {
      if (state.phase !== 'playing') return;
      const player = findPlayer(currentPlayerId);
      await channel.send({ embeds: [e(`⏰ **${player?.name}** 超時，自動跳過！`)] });
      await advanceTurn(channel);
    }, state.turnTimeLimit);
  }
}

// 推進回合
async function advanceTurn(channel) {
  state.orderIndex++;
  if (state.orderIndex >= state.order.length) {
    state.orderIndex = 0;
    state.round++;
    if (state.round > state.maxRounds) {
      await channel.send({ embeds: [e(`⏰ **${state.maxRounds} 輪已結束！沒有人猜出答案。**\n答案是：**${state.word}**\n\n接下來投票猜誰是狼人...`)] });
      await startVillagerVote(channel);
      return;
    }
    await channel.send({ embeds: [e(`📋 **第 ${state.round} 輪開始！**`)] });
  }
  await startTurn(channel);
}

// ─── 狼人投票猜先知（猜對答案後）───
async function startWolfVote(channel) {
  state.phase = 'wolf_vote';
  const wolves = state.players.filter(p => p.role === 'wolf');
  const candidates = state.players.filter(p => p.role !== 'wolf' && p.role !== 'mayor');

  const ts = Date.now();
  const rows = [];
  for (let i = 0; i < candidates.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const p of candidates.slice(i, i + 5)) {
      row.addComponents(new ButtonBuilder().setCustomId(`wvote_${ts}_${p.id}`).setLabel(p.name).setStyle(ButtonStyle.Secondary));
    }
    rows.push(row);
  }

  const wolfNames = wolves.map(w => `<@${w.id}>`).join('、');
  const msg = await channel.send({
    embeds: [e(`🐺 **狼人投票時間！**\n\n${wolfNames}，猜猜誰是先知？\n猜中 → 狼人勝利！猜不中 → 好人勝利！`)],
    components: rows,
  });

  const wolfIds = new Set(wolves.map(w => w.id));
  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`wvote_${ts}_`) && wolfIds.has(i.user.id),
    max: 1, time: 300000,
  });
  collector.on('collect', async (i) => {
    const targetId = i.customId.replace(`wvote_${ts}_`, '');
    const target = findPlayer(targetId);
    const isSeer = target?.role === 'seer';
    await i.update({ components: [] });
    const roleList = state.players.map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
    if (isSeer) {
      await channel.send({ embeds: [e(`🐺 **狼人猜中了！** ${target.name} 就是先知！\n\n🐺🐺🐺 **狼人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
    } else {
      await channel.send({ embeds: [e(`🐺 狼人猜了 ${target.name}，但不是先知！\n\n🎉🎉🎉 **好人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
    }
    reset();
  });
  collector.on('end', (c) => {
    if (c.size === 0) {
      const roleList = state.players.map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
      channel.send({ embeds: [e(`⏰ 狼人未投票，好人陣營勝利！\n\n📋 **角色公布：**\n${roleList}`)] });
      reset();
    }
  });
  state.collectors.push(collector);
}

// ─── 村民投票猜狼人（沒猜出答案後）───
async function startVillagerVote(channel) {
  state.phase = 'villager_vote';
  const voters = state.players.filter(p => p.role !== 'mayor');
  const candidates = state.players.filter(p => p.role !== 'mayor');
  const votes = new Map();
  const ts = Date.now();

  function buildVoteEmbed() {
    let text = '🗳️ **投票猜狼人！**\n\n點按鈕投票，可以改票。主持人按確認後結算。\n\n';
    const tally = {};
    for (const [voterId, targetId] of votes) {
      if (!tally[targetId]) tally[targetId] = [];
      tally[targetId].push(findPlayer(voterId)?.name);
    }
    if (Object.keys(tally).length === 0) {
      text += '目前還沒有人投票。';
    } else {
      for (const [tid, vnames] of Object.entries(tally)) {
        text += `**${findPlayer(tid)?.name}**（${vnames.length} 票）：${vnames.join('、')}\n`;
      }
    }
    text += `\n已投票：${votes.size} / ${voters.length}`;
    return e(text);
  }

  function buildComponents() {
    const rows = [];
    for (let i = 0; i < candidates.length; i += 5) {
      const row = new ActionRowBuilder();
      for (const p of candidates.slice(i, i + 5)) {
        row.addComponents(new ButtonBuilder().setCustomId(`cvote_${ts}_${p.id}`).setLabel(p.name).setStyle(ButtonStyle.Secondary));
      }
      rows.push(row);
    }
    if (rows.length < 5) {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cvoteconfirm_${ts}`).setLabel('✅ 確認結算').setStyle(ButtonStyle.Success)
      ));
    }
    return rows;
  }

  const msg = await channel.send({ embeds: [buildVoteEmbed()], components: buildComponents() });
  const voterIds = new Set(voters.map(v => v.id));
  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`cvote_${ts}_`) || i.customId === `cvoteconfirm_${ts}`,
    time: 3600000,
  });

  collector.on('collect', async (i) => {
    if (i.customId === `cvoteconfirm_${ts}`) {
      if (i.user.id !== state.hostId) return i.reply({ embeds: [e('❌ 只有主持人才能確認結算！')], ephemeral: true });
      collector.stop();
      await i.update({ components: [] });
      const tally = {};
      for (const [, tid] of votes) tally[tid] = (tally[tid] || 0) + 1;
      const roleList = state.players.map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
      if (Object.keys(tally).length === 0) {
        await channel.send({ embeds: [e(`沒有人投票！\n\n🐺🐺🐺 **狼人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
        reset(); return;
      }
      const maxVotes = Math.max(...Object.values(tally));
      const topIds = Object.keys(tally).filter(id => tally[id] === maxVotes);
      if (topIds.length > 1) {
        await channel.send({ embeds: [e(`⚖️ 平票！\n\n🐺🐺🐺 **狼人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
        reset(); return;
      }
      const voted = findPlayer(topIds[0]);
      if (voted?.role === 'wolf') {
        await channel.send({ embeds: [e(`🎯 **${voted.name}** 被票選出局，是狼人！\n\n🎉🎉🎉 **好人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
      } else {
        await channel.send({ embeds: [e(`😱 **${voted.name}** 被票選出局，但不是狼人！\n\n🐺🐺🐺 **狼人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
      }
      reset(); return;
    }
    if (!voterIds.has(i.user.id)) return i.reply({ embeds: [e('❌ 你不在這局遊戲中！')], ephemeral: true });
    const targetId = i.customId.replace(`cvote_${ts}_`, '');
    votes.set(i.user.id, targetId);
    await i.update({ embeds: [buildVoteEmbed()], components: buildComponents() });
  });
  state.collectors.push(collector);
}

// ─── 指令 ───
const commands = {
  async wws(message) {
    if (state.phase !== 'idle') return message.reply({ embeds: [e('❌ 目前已有一局狼人真言進行中！')] });
    reset();
    state.phase = 'waiting'; state.hostId = message.author.id;
    state.channelId = message.channel.id; state.guild = message.guild;
    state.players.push({ id: message.author.id, name: message.member.displayName, role: null });
    message.channel.send({ embeds: [e(`🔮 **狼人真言開局！**\n👑 主持人：${message.member.displayName}\n\n輸入 \`!wwj\` 加入遊戲\n主持人輸入 \`!wwb\` 開始遊戲（至少 4 人）\n\n目前玩家（1人）：${message.member.displayName}`)] });
  },

  async wwj(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有開放加入的狼人真言局！')] });
    if (state.players.find(p => p.id === message.author.id)) return message.reply({ embeds: [e('❌ 你已經加入了！')] });
    if (state.players.length >= 10) return message.reply({ embeds: [e('❌ 已滿 10 人！')] });
    state.players.push({ id: message.author.id, name: message.member.displayName, role: null });
    const names = state.players.map(p => p.name).join('、');
    message.channel.send({ embeds: [e(`✅ **${message.member.displayName}** 加入狼人真言！\n目前玩家（${state.players.length}人）：${names}`)] });
  },

  async wwb(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有等待中的狼人真言局！')] });
    if (message.author.id !== state.hostId) return message.reply({ embeds: [e('❌ 只有主持人才能開始遊戲！')] });
    if (state.players.length < 4) return message.reply({ embeds: [e('❌ 至少需要 4 人！')] });

    const config = getRoleConfig(state.players.length);
    const roles = [];
    for (const [role, num] of Object.entries(config)) { for (let i = 0; i < num; i++) roles.push(role); }
    const shuffled = shuffle(roles);
    state.players.forEach((p, i) => { p.role = shuffled[i]; });

    const mayor = state.players.find(p => p.role === 'mayor');
    state.mayorId = mayor.id;
    state.guild = message.guild;

    // 主持人選擇限時
    const tsTime = Date.now();
    const timeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`timelimit_${tsTime}_0`).setLabel('⏳ 不限時').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`timelimit_${tsTime}_120`).setLabel('⏱️ 2 分鐘').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`timelimit_${tsTime}_180`).setLabel('⏱️ 3 分鐘').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`timelimit_${tsTime}_300`).setLabel('⏱️ 5 分鐘').setStyle(ButtonStyle.Primary),
    );
    const timeMsg = await message.channel.send({
      embeds: [e(`⏱️ **主持人請選擇每回合限時：**`)],
      components: [timeRow],
    });

    state.turnTimeLimit = await new Promise((resolve) => {
      const collector = timeMsg.createMessageComponentCollector({
        filter: i => i.customId.startsWith(`timelimit_${tsTime}_`) && i.user.id === state.hostId,
        max: 1, time: 60000,
      });
      collector.on('collect', async (i) => {
        const seconds = parseInt(i.customId.replace(`timelimit_${tsTime}_`, ''));
        const label = seconds === 0 ? '不限時' : `${seconds / 60} 分鐘`;
        await i.update({ embeds: [e(`⏱️ 每回合限時：**${label}**`)], components: [] });
        resolve(seconds * 1000);
      });
      collector.on('end', (c) => {
        if (c.size === 0) {
          timeMsg.edit({ embeds: [e('⏱️ 主持人超時，預設不限時')], components: [] }).catch(() => {});
          resolve(0);
        }
      });
      state.collectors.push(collector);
    });

    // 如果等待期間被取消了，中止
    if (state.phase === 'idle') return;

    // 頻道內讓村長設定詞彙
    const ts = Date.now();
    const setupRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wordsetup_${ts}_custom`).setLabel('✏️ 自訂詞彙').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`wordsetup_${ts}_random`).setLabel('🎲 隨機選詞').setStyle(ButtonStyle.Secondary),
    );
    const setupMsg = await message.channel.send({
      embeds: [e(`👑 **等待村長設定詞彙...**\n\n<@${mayor.id}> 請選擇自訂詞彙或隨機選詞。`)],
      components: [setupRow],
    });

    const word = await new Promise((resolve) => {
      const collector = setupMsg.createMessageComponentCollector({
        filter: i => i.customId.startsWith(`wordsetup_${ts}_`) && i.user.id === mayor.id,
        max: 1, time: 120000,
      });
      collector.on('collect', async (i) => {
        if (i.customId === `wordsetup_${ts}_random`) {
          const w = DEFAULT_WORDS[Math.floor(Math.random() * DEFAULT_WORDS.length)];
          await setupMsg.edit({ embeds: [e('👑 村長已設定詞彙！')], components: [] });
          await i.reply({ embeds: [e(`👑 你設定的詞彙是：**${w}**\n（只有你看得到）`)], ephemeral: true });
          resolve(w);
        } else {
          const modal = new ModalBuilder()
            .setCustomId(`wordmodal_${ts}`)
            .setTitle('設定魔法咒語')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('word_input')
                  .setLabel('輸入你的詞彙')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('例如：蘋果')
                  .setRequired(true)
                  .setMaxLength(20)
              )
            );
          await i.showModal(modal);
          try {
            const submitted = await i.awaitModalSubmit({ time: 120000 });
            const w = submitted.fields.getTextInputValue('word_input').trim();
            await setupMsg.edit({ embeds: [e('👑 村長已設定詞彙！')], components: [] });
            await submitted.reply({ embeds: [e(`👑 你設定的詞彙是：**${w}**\n（只有你看得到）`)], ephemeral: true });
            resolve(w);
          } catch {
            const w = DEFAULT_WORDS[Math.floor(Math.random() * DEFAULT_WORDS.length)];
            await setupMsg.edit({ embeds: [e('👑 村長超時，已隨機選詞！')], components: [] });
            resolve(w);
          }
        }
      });
      collector.on('end', (c) => {
        if (c.size === 0) {
          const w = DEFAULT_WORDS[Math.floor(Math.random() * DEFAULT_WORDS.length)];
          setupMsg.edit({ embeds: [e('👑 村長超時，已隨機選詞！')], components: [] }).catch(() => {});
          resolve(w);
        }
      });
      state.collectors.push(collector);
    });

    state.word = word;

    // 如果等待期間被取消了，中止
    if (state.phase === 'idle') return;

    // 私訊角色 + 詞彙
    for (const p of state.players) {
      try {
        const member = await message.guild.members.fetch(p.id);
        if (p.role === 'mayor') {
          await member.send({ embeds: [e(`你的角色是：${ROLE_NAMES[p.role]}\n\n🔑 魔法咒語是：**${state.word}**`)] });
        } else if (p.role === 'wolf' || p.role === 'seer') {
          await member.send({ embeds: [e(`你的角色是：${ROLE_NAMES[p.role]}\n\n🔑 魔法咒語是：**${state.word}**`)] });
        } else {
          await member.send({ embeds: [e(`你的角色是：${ROLE_NAMES[p.role]}`)] });
        }
      } catch {
        await message.channel.send({ embeds: [e(`⚠️ 無法私訊 ${p.name}！`)] });
      }
    }

    // 設定提問順序（不含村長）
    state.order = shuffle(state.players.filter(p => p.role !== 'mayor').map(p => p.id));
    state.orderIndex = 0; state.round = 1; state.phase = 'playing';

    const orderNames = state.order.map((id, i) => `${i + 1}. ${findPlayer(id).name}`).join('\n');
    await message.channel.send({ embeds: [e(`🔮 **狼人真言開始！共 ${state.players.length} 人**\n\n👑 村長：**${mayor.name}**\n\n📋 提問順序：\n${orderNames}\n\n共 ${state.maxRounds} 輪機會，開始！`)] });
    await startTurn(message.channel);
  },

  async wwg(message, args) {
    if (state.phase !== 'playing') return message.reply({ embeds: [e('❌ 目前沒有進行中的狼人真言！')] });
    const currentPlayerId = state.order[state.orderIndex];
    if (message.author.id !== currentPlayerId) {
      return message.reply({ embeds: [e(`❌ 現在輪到 **${findPlayer(currentPlayerId)?.name}**，還沒輪到你！`)] });
    }
    const content = args.join(' ').trim();
    if (!content) return message.reply({ embeds: [e('❌ 請輸入內容！例如 `!wwg 是動物嗎` 或 `!wwg 蘋果`')] });

    // 清除計時器
    if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }

    // 顯示村長回答面板
    const answer = await showMayorPanel(message.channel, content, findPlayer(currentPlayerId).name);

    // 村長按了「正確」
    if (answer === 'correct') {
      await message.channel.send({ embeds: [e(`🎉 **答案猜中了！**\n\n接下來狼人要猜出誰是先知...`)] });
      await startWolfVote(message.channel);
      return;
    }

    // 其他回答 → 下一個人
    await advanceTurn(message.channel);
  },

  async wwp(message) {
    if (state.phase !== 'playing') return;
    const currentPlayerId = state.order[state.orderIndex];
    if (message.author.id !== currentPlayerId) return;
    if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }
    await message.channel.send({ embeds: [e(`⏭️ **${findPlayer(currentPlayerId).name}** 跳過了這回合。`)] });
    await advanceTurn(message.channel);
  },

  async wwq(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的狼人真言局！')] });
    const isHost = message.author.id === state.hostId;
    const isAdmin = message.author.id === process.env.ANNOUNCE_ADMIN_ID;
    const isPlayer = state.players.some(p => p.id === message.author.id);
    if (!isHost && !isAdmin && !isPlayer) return message.reply({ embeds: [e('❌ 只有參加的玩家才能取消遊戲！')] });
    const roleList = state.players.filter(p => p.role).map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
    const wordInfo = state.word ? `\n🔑 答案是：**${state.word}**` : '';
    reset();
    message.channel.send({ embeds: [e(`🚫 **${message.member.displayName}** 取消了狼人真言！${wordInfo}\n\n${roleList ? `📋 角色公布：\n${roleList}` : ''}`)] });
  },

  async wwl(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的狼人真言局！')] });
    const pi = state.players.findIndex(p => p.id === message.author.id);
    if (pi === -1) return message.reply({ embeds: [e('❌ 你沒有加入這局狼人真言！')] });
    const playerName = message.member.displayName;

    if (state.phase === 'waiting') {
      state.players.splice(pi, 1);
      if (message.author.id === state.hostId && state.players.length > 0) {
        state.hostId = state.players[0].id;
        return message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了！\n👑 主持人轉移給 **${state.players[0].name}**`)] });
      }
      if (state.players.length === 0) { reset(); return; }
      return message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了！\n目前玩家（${state.players.length}人）：${state.players.map(p => p.name).join('、')}`)] });
    }

    const roleList = state.players.filter(p => p.role).map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
    const wordInfo = state.word ? `\n🔑 答案是：**${state.word}**` : '';
    reset();
    message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了，遊戲中斷！${wordInfo}\n\n📋 角色公布：\n${roleList}`)] });
  },
};

export default commands;
