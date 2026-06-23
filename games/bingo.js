import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import BingoRecord from './models/BingoRecord.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);

// ─── 狀態 ───
const state = {
  phase: 'idle', hostId: null, channelId: null,
  players: [], order: [], orderIndex: 0,
  cards: {}, checked: {}, called: new Set(),
  collector: null, btnMsg: null,
};

function reset() {
  if (state.collector) { state.collector.stop(); state.collector = null; }
  if (state.btnMsg) { state.btnMsg.edit({ components: [] }).catch(() => {}); state.btnMsg = null; }
  Object.assign(state, {
    phase: 'idle', hostId: null, channelId: null,
    players: [], order: [], orderIndex: 0,
    cards: {}, checked: {}, called: new Set(),
  });
}

function generateCard() {
  const nums = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function countLines(userId) {
  const card = state.cards[userId];
  const checked = state.checked[userId];
  let lines = 0;
  const rows = [];
  for (let r = 0; r < 5; r++) rows.push(card.slice(r * 5, r * 5 + 5));
  for (const row of rows) { if (row.every(n => checked.has(n))) lines++; }
  for (let c = 0; c < 5; c++) { if ([0,1,2,3,4].every(r => checked.has(rows[r][c]))) lines++; }
  if ([0,1,2,3,4].every(i => checked.has(rows[i][i]))) lines++;
  if ([0,1,2,3,4].every(i => checked.has(rows[i][4-i]))) lines++;
  return lines;
}

function checkBingo(userId) { return countLines(userId) >= 3; }

function renderCard(userId) {
  const card = state.cards[userId];
  const checked = state.checked[userId];
  let out = '```\n';
  for (let r = 0; r < 5; r++) {
    const row = card.slice(r * 5, r * 5 + 5).map(n => checked.has(n) ? ' ✅' : String(n).padStart(3));
    out += row.join(' ') + '\n';
  }
  return out + '```';
}

async function sendTurnMessage(channel, playerId) {
  if (state.collector) { state.collector.stop(); state.collector = null; }
  if (state.btnMsg) { state.btnMsg.edit({ components: [] }).catch(() => {}); state.btnMsg = null; }

  const btnId = 'bingo_card_' + Date.now();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(btnId).setLabel('📋 查看我的賓果卡').setStyle(ButtonStyle.Primary)
  );

  const btnMsg = await channel.send({
    content: `<@${playerId}>`,
    embeds: [e(`🎲 輪到 **${state.players.find(p => p.id === playerId)?.name}** 叫號！請輸入 \`!bc 數字\``)],
    components: [row],
  });
  state.btnMsg = btnMsg;

  const collector = btnMsg.createMessageComponentCollector({ filter: i => i.customId === btnId, time: 3600000 });
  collector.on('collect', async (interaction) => {
    const player = state.players.find(p => p.id === interaction.user.id);
    if (!player) return interaction.reply({ embeds: [e('❌ 你沒有加入這局賓果！')], ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const lines = countLines(interaction.user.id);
    await interaction.editReply({ embeds: [e(`🎯 **你的賓果卡：**\n${renderCard(interaction.user.id)}\n目前連線：${lines} / 3 條`)] });
  });
  state.collector = collector;
}

async function addWin(userId, name) {
  await BingoRecord.findOneAndUpdate({ discordId: userId }, { $inc: { wins: 1 }, $set: { name } }, { upsert: true, new: true });
}

async function getBingoRanking(limit = 10) {
  return BingoRecord.find().sort({ wins: -1 }).limit(limit).lean();
}

// ─── 指令 ───
const commands = {
  async bs(message) {
    if (state.phase !== 'idle') return message.reply({ embeds: [e('❌ 目前已有一局賓果進行中！')] });
    reset();
    state.phase = 'waiting'; state.hostId = message.author.id; state.channelId = message.channel.id;
    state.players.push({ id: message.author.id, name: message.member.displayName });
    message.channel.send({ embeds: [e(`🎯 **賓果遊戲開局！**\n👑 主持人：${message.member.displayName}\n\n輸入 \`!bj\` 加入遊戲\n主持人輸入 \`!bb\` 開始遊戲（至少需要 2 人）\n\n目前玩家（1人）：${message.member.displayName}`)] });
  },

  async bj(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有開放加入的賓果局！')] });
    if (state.players.find(p => p.id === message.author.id)) return message.reply({ embeds: [e('❌ 你已經加入了！')] });
    state.players.push({ id: message.author.id, name: message.member.displayName });
    const names = state.players.map(p => p.name).join('、');
    message.channel.send({ embeds: [e(`✅ **${message.member.displayName}** 加入賓果！\n目前玩家（${state.players.length}人）：${names}`)] });
  },

  async bb(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有等待開始的賓果局！')] });
    if (message.author.id !== state.hostId) return message.reply({ embeds: [e('❌ 只有主持人才能開始遊戲！')] });
    if (state.players.length < 2) return message.reply({ embeds: [e('❌ 至少需要 2 人才能開始！')] });

    for (const p of state.players) { state.cards[p.id] = generateCard(); state.checked[p.id] = new Set(); }
    state.order = shuffle(state.players.map(p => p.id)); state.orderIndex = 0; state.phase = 'playing';

    const orderNames = state.order.map((id, i) => `${i + 1}. ${state.players.find(p => p.id === id).name}`).join('\n');
    await message.channel.send({ embeds: [e(`🎮 **賓果遊戲開始！**\n\n📋 叫號順序：\n${orderNames}\n\n規則：輪到你才能用 \`!bc 數字\` 叫號\n機器人自動判斷 BINGO！`)] });

    for (const p of state.players) {
      try { const member = await message.guild.members.fetch(p.id); await member.send({ embeds: [e(`🎯 **你的賓果卡（請勿截圖給別人！）**\n${renderCard(p.id)}`)] }); } catch {}
    }
    await sendTurnMessage(message.channel, state.order[0]);
  },

  async bc(message, args) {
    if (state.phase !== 'playing') return message.reply({ embeds: [e('❌ 目前沒有進行中的賓果局！')] });
    const player = state.players.find(p => p.id === message.author.id);
    if (!player) return message.reply({ embeds: [e('❌ 你沒有加入這局賓果！')] });
    const currentId = state.order[state.orderIndex];
    if (message.author.id !== currentId) return message.reply({ embeds: [e(`❌ 現在輪到 **${state.players.find(p => p.id === currentId).name}** 叫號，還沒輪到你！`)] });

    const num = parseInt(args[0]);
    if (isNaN(num) || num < 1 || num > 25) return message.reply({ embeds: [e('❌ 請輸入 1~25 的數字！')] });
    if (state.called.has(num)) return message.reply({ embeds: [e(`❌ **${num}** 已經叫過了！`)] });

    state.called.add(num);
    for (const p of state.players) state.checked[p.id].add(num);

    const calledList = [...state.called].sort((a, b) => a - b).join('、');
    await message.channel.send({ embeds: [e(`📢 **${player.name}** 叫號：**${num}**\n已叫出：${calledList}`)] });

    for (const p of state.players) {
      try {
        const member = await message.guild.members.fetch(p.id);
        const lines = countLines(p.id);
        await member.send({ embeds: [e(`🔢 叫號 **${num}**！你的賓果卡更新：\n${renderCard(p.id)}\n目前連線：${lines} / 3 條`)] });
      } catch {}
    }

    for (const p of state.players) {
      if (checkBingo(p.id)) {
        await addWin(p.id, p.name);
        await message.channel.send({ embeds: [e(`🎉🎉🎉 **BINGO！**\n\n🏆 **${p.name}** 獲得勝利！\n\n輸入 \`!br\` 查看勝利排行榜\n輸入 \`!bs\` 開始新一局！`)] });
        reset(); return;
      }
    }

    state.orderIndex = (state.orderIndex + 1) % state.order.length;
    await sendTurnMessage(message.channel, state.order[state.orderIndex]);
  },

  async bl(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的賓果局！')] });
    const userId = message.author.id;
    const pi = state.players.findIndex(p => p.id === userId);
    if (pi === -1) return message.reply({ embeds: [e('❌ 你沒有加入這局賓果！')] });
    const playerName = message.member.displayName;

    if (state.phase === 'waiting') {
      state.players.splice(pi, 1);
      return message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了賓果！\n目前玩家（${state.players.length}人）：${state.players.map(p => p.name).join('、') || '無'}`)] });
    }

    const currentTurnId = state.order[state.orderIndex];
    const oi = state.order.indexOf(userId);
    state.order.splice(oi, 1);
    if (!state.order.length) { reset(); return message.channel.send({ embeds: [e('👋 所有玩家都離開了，賓果局已結束！')] }); }
    if (oi < state.orderIndex) state.orderIndex--;
    else if (oi === state.orderIndex && state.orderIndex >= state.order.length) state.orderIndex = 0;
    state.players.splice(pi, 1); delete state.cards[userId]; delete state.checked[userId];
    await message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了賓果！`)] });

    if (state.players.length === 1) {
      const w = state.players[0]; await addWin(w.id, w.name);
      await message.channel.send({ embeds: [e(`🎉🎉🎉 **BINGO！**\n\n🏆 **${w.name}** 獲得勝利！（其他人都跑了）\n\n輸入 \`!br\` 查看勝利排行榜\n輸入 \`!bs\` 開始新一局！`)] });
      reset(); return;
    }
    if (currentTurnId === userId) await sendTurnMessage(message.channel, state.order[state.orderIndex]);
  },

  async bq(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的賓果局！')] });
    const isHost = message.author.id === state.hostId;
    const isAdmin = message.author.id === process.env.ANNOUNCE_ADMIN_ID;
    if (!isHost && !isAdmin) return message.reply({ embeds: [e('❌ 只有主持人或管理員才能取消遊戲！')] });
    reset();
    message.channel.send({ embeds: [e(`🚫 **${message.member.displayName}** 取消了這局賓果，輸入 \`!bs\` 可以重新開局！`)] });
  },

  async br(message) {
    const ranking = await getBingoRanking();
    if (!ranking.length) return message.reply({ embeds: [e('📊 還沒有人贏過賓果，快來玩 `!bs`！')] });
    const medals = ['🥇', '🥈', '🥉'];
    const list = ranking.map((entry, i) => `${medals[i] || `${i + 1}.`} ${entry.name} — 🏆 ${entry.wins} 勝`).join('\n');
    message.channel.send({ embeds: [e(`🎯 **賓果勝利排行榜**\n\n${list}`)] });
  },
};

export default commands;
