import { EmbedBuilder } from 'discord.js';
import BombRecord from './models/BombRecord.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);

// ─── 狀態 ───
const state = {
  phase: 'idle', hostId: null, channelId: null,
  players: [], order: [], orderIndex: 0,
  secret: null, min: 1, max: 100,
};

function reset() {
  Object.assign(state, {
    phase: 'idle', hostId: null, channelId: null,
    players: [], order: [], orderIndex: 0,
    secret: null, min: 1, max: 100,
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function addBomb(userId, name) {
  await BombRecord.findOneAndUpdate({ discordId: userId }, { $inc: { count: 1 }, $set: { name } }, { upsert: true, new: true });
}

async function addParticipation(players) {
  for (const p of players) {
    await BombRecord.findOneAndUpdate({ discordId: p.id }, { $inc: { played: 1 }, $set: { name: p.name } }, { upsert: true, new: true });
  }
}

async function getRanking(limit = 10) {
  return BombRecord.find().sort({ count: -1 }).limit(limit).lean();
}

async function getFullRanking(limit = 10) {
  return BombRecord.find({ played: { $gt: 0 } }).sort({ played: -1 }).limit(limit).lean();
}

// ─── 指令 ───
const commands = {
  async zs(message) {
    if (state.phase !== 'idle') return message.reply({ embeds: [e('❌ 目前已有一局終極密碼進行中！')] });
    reset();
    state.phase = 'waiting'; state.hostId = message.author.id; state.channelId = message.channel.id;
    state.players.push({ id: message.author.id, name: message.member.displayName });
    message.channel.send({ embeds: [e(`💣 **終極密碼開局！**\n👑 主持人：${message.member.displayName}\n\n輸入 \`!zj\` 加入遊戲\n主持人輸入 \`!zb\` 開始遊戲（至少需要 2 人）\n\n目前玩家（1人）：${message.member.displayName}`)] });
  },

  async zj(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有開放加入的終極密碼局！')] });
    if (state.players.find(p => p.id === message.author.id)) return message.reply({ embeds: [e('❌ 你已經加入了！')] });
    state.players.push({ id: message.author.id, name: message.member.displayName });
    const names = state.players.map(p => p.name).join('、');
    message.channel.send({ embeds: [e(`✅ **${message.member.displayName}** 加入終極密碼！\n目前玩家（${state.players.length}人）：${names}`)] });
  },

  async zb(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有等待中的終極密碼局！')] });
    if (message.author.id !== state.hostId) return message.reply({ embeds: [e('❌ 只有主持人才能開始遊戲！')] });
    if (state.players.length < 2) return message.reply({ embeds: [e('❌ 至少需要 2 人才能開始！')] });

    state.secret = Math.floor(Math.random() * 100) + 1;
    state.min = 1; state.max = 100;
    state.order = shuffle(state.players.map(p => p.id)); state.orderIndex = 0; state.phase = 'playing';

    const orderNames = state.order.map((id, i) => `${i + 1}. ${state.players.find(p => p.id === id).name}`).join('\n');
    const firstId = state.order[0];
    message.channel.send({ embeds: [e(`💣 **終極密碼開始！**\n\n密碼範圍：**1 ~ 100**\n\n📋 猜號順序：\n${orderNames}\n\n🎯 輪到 <@${firstId}> 猜！請輸入 \`!zg 數字\``)] });
  },

  async zg(message, args) {
    if (state.phase !== 'playing') return message.reply({ embeds: [e('❌ 目前沒有進行中的終極密碼局！')] });
    const player = state.players.find(p => p.id === message.author.id);
    if (!player) return message.reply({ embeds: [e('❌ 你沒有加入這局終極密碼！')] });
    const currentId = state.order[state.orderIndex];
    if (message.author.id !== currentId) return message.reply({ embeds: [e(`❌ 現在輪到 **${state.players.find(p => p.id === currentId).name}** 猜，還沒輪到你！`)] });

    const num = parseInt(args[0]);
    if (isNaN(num)) return message.reply({ embeds: [e('❌ 請輸入數字！例如 `!zg 50`')] });
    if (num < state.min || num > state.max) return message.reply({ embeds: [e(`❌ 請猜 **${state.min} ~ ${state.max}** 之間的數字！`)] });

    if (num === state.secret) {
      await addBomb(message.author.id, player.name);
      await addParticipation(state.players);
      await message.channel.send({ embeds: [e(`💥💥💥 **爆炸！！！**\n\n<@${message.author.id}> **${player.name}** 踩到了終極密碼 **${state.secret}**！\n\n💀 **${player.name}** 爆炸 +1\n\n輸入 \`!zr\` 查看爆炸排行榜\n輸入 \`!zs\` 開始新一局！`)] });
      reset(); return;
    }

    if (num < state.secret) state.min = num + 1; else state.max = num - 1;

    state.orderIndex = (state.orderIndex + 1) % state.order.length;
    const nextId = state.order[state.orderIndex];
    const nextPlayer = state.players.find(p => p.id === nextId);

    if (state.min === state.max) {
      await addBomb(nextId, nextPlayer.name);
      await addParticipation(state.players);
      await message.channel.send({ embeds: [e(`🔢 **${player.name}** 猜了 **${num}**\n\n📏 範圍縮小為：**${state.min} ~ ${state.max}**\n\n💥💥💥 **爆炸！！！**\n\n<@${nextId}> **${nextPlayer.name}** 無路可逃，踩到終極密碼 **${state.secret}**！\n\n💀 **${nextPlayer.name}** 爆炸 +1\n\n輸入 \`!zr\` 查看爆炸排行榜\n輸入 \`!zs\` 開始新一局！`)] });
      reset(); return;
    }

    message.channel.send({ embeds: [e(`🔢 **${player.name}** 猜了 **${num}**\n\n📏 範圍縮小為：**${state.min} ~ ${state.max}**\n\n🎯 輪到 <@${nextId}> 猜！請輸入 \`!zg 數字\``)] });
  },

  async zl(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的終極密碼局！')] });
    const pi = state.players.findIndex(p => p.id === message.author.id);
    if (pi === -1) return message.reply({ embeds: [e('❌ 你沒有加入這局終極密碼！')] });
    const playerName = message.member.displayName;

    if (state.phase === 'waiting') {
      state.players.splice(pi, 1);
      return message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了終極密碼！\n目前玩家（${state.players.length}人）：${state.players.map(p => p.name).join('、') || '無'}`)] });
    }

    await addBomb(message.author.id, playerName);
    await addParticipation(state.players);
    await message.channel.send({ embeds: [e(`💥 **${playerName}** 中途逃跑，視為爆炸！\n\n💀 ${playerName} 爆炸 +1\n密碼是 **${state.secret}**\n\n輸入 \`!zr\` 查看爆炸排行榜\n輸入 \`!zs\` 開始新一局！`)] });
    reset();
  },

  async zq(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的終極密碼局！')] });
    const isHost = message.author.id === state.hostId;
    const isAdmin = message.author.id === process.env.ANNOUNCE_ADMIN_ID;
    if (!isHost && !isAdmin) return message.reply({ embeds: [e('❌ 只有主持人或管理員才能取消遊戲！')] });
    reset();
    message.channel.send({ embeds: [e(`🚫 **${message.member.displayName}** 取消了這局終極密碼，輸入 \`!zs\` 可以重新開局！`)] });
  },

  async zr(message) {
    const ranking = await getRanking();
    if (!ranking.length) return message.reply({ embeds: [e('📊 還沒有人爆炸過，快來玩 `!zs`！')] });
    const medals = ['🥇', '🥈', '🥉'];
    const list = ranking.map((entry, i) => `${medals[i] || `${i + 1}.`} ${entry.name} — 💥 ${entry.count} 次`).join('\n');
    message.channel.send({ embeds: [e(`💣 **終極密碼爆炸排行榜**\n\n${list}`)] });
  },

  async zp(message) {
    const ranking = await getFullRanking();
    if (!ranking.length) return message.reply({ embeds: [e('📊 還沒有人玩過，快來玩 `!zs`！')] });
    const medals = ['🥇', '🥈', '🥉'];
    const list = ranking.map((entry, i) => {
      const rate = entry.played > 0 ? Math.round((entry.count / entry.played) * 100) : 0;
      return `${medals[i] || `${i + 1}.`} ${entry.name} — 🎮 ${entry.played} 場 ｜ 💥 ${entry.count} 爆 ｜ 💀 ${rate}%`;
    }).join('\n');
    message.channel.send({ embeds: [e(`💣 **終極密碼綜合排行榜**\n\n${list}\n\n🎮 參與場數 ｜ 💥 爆炸次數 ｜ 💀 爆炸率`)] });
  },
};

export default commands;
