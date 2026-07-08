import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);

// 每個頻道獨立
const games = new Map();

const EMPTY = '⬜';
const X = '❌';
const O = '⭕';

function checkWin(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8], // 橫
    [0,3,6],[1,4,7],[2,5,8], // 直
    [0,4,8],[2,4,6],         // 斜
  ];
  for (const [a,b,c] of lines) {
    if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  return board.every(c => c !== EMPTY) ? 'draw' : null;
}

function buildBoard(board, ts, disabled = false) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`oo_${ts}_${i}`)
          .setLabel(board[i])
          .setStyle(board[i] === X ? ButtonStyle.Danger : board[i] === O ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(disabled || board[i] !== EMPTY)
      );
    }
    rows.push(row);
  }
  return rows;
}

const commands = {
  async os(message) {
    if (games.has(message.channel.id)) return message.reply({ embeds: [e('❌ 這個頻道已有進行中的 OOXX！')] });

    const target = message.mentions.users.first();
    if (!target) return message.reply({ embeds: [e('❌ 請 @一個對手！例如 `!os @對手`')] });
    if (target.id === message.author.id) return message.reply({ embeds: [e('❌ 不能跟自己玩！')] });
    if (target.bot) return message.reply({ embeds: [e('❌ 不能跟機器人玩！')] });

    const ts = Date.now();
    const challengerName = message.member.displayName;
    const targetMember = await message.guild.members.fetch(target.id);
    const targetName = targetMember.displayName;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`oo_accept_${ts}`).setLabel('✅ 接受').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`oo_reject_${ts}`).setLabel('❌ 拒絕').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`oo_cancel_${ts}`).setLabel('取消挑戰').setStyle(ButtonStyle.Secondary),
    );

    const msg = await message.channel.send({
      content: `<@${target.id}>`,
      embeds: [e(`⭕❌ **${challengerName}** 向 **${targetName}** 發起 OOXX！\n\n是否接受？（⏱️ 60 秒）`)],
      components: [row],
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => (i.user.id === target.id && (i.customId === `oo_accept_${ts}` || i.customId === `oo_reject_${ts}`)) ||
                   (i.user.id === message.author.id && i.customId === `oo_cancel_${ts}`),
      max: 1, time: 60000,
    });

    collector.on('collect', async (i) => {
      if (i.customId === `oo_cancel_${ts}`) {
        await i.update({ embeds: [e('🚫 挑戰已取消')], components: [] });
        return;
      }
      if (i.customId === `oo_reject_${ts}`) {
        await i.update({ embeds: [e(`❌ **${targetName}** 拒絕了挑戰`)], components: [] });
        return;
      }

      // 接受 → 開始遊戲
      await i.update({ embeds: [e(`✅ **${targetName}** 接受了！遊戲開始！`)], components: [] });

      // 隨機先手
      const players = Math.random() < 0.5
        ? [{ id: message.author.id, name: challengerName, mark: X }, { id: target.id, name: targetName, mark: O }]
        : [{ id: target.id, name: targetName, mark: X }, { id: message.author.id, name: challengerName, mark: O }];

      const gameTs = Date.now();
      const state = {
        board: Array(9).fill(EMPTY),
        players,
        turn: 0, // 0 = X先手
        ts: gameTs,
      };
      games.set(message.channel.id, state);

      await startTurn(message.channel, state);
    });

    collector.on('end', (c) => {
      if (c.size === 0) msg.edit({ embeds: [e('⏰ 挑戰超時，已取消')], components: [] }).catch(() => {});
    });
  },

  async oq(message) {
    const game = games.get(message.channel.id);
    if (!game) return message.reply({ embeds: [e('❌ 這個頻道沒有進行中的 OOXX！')] });
    const isPlayer = game.players.some(p => p.id === message.author.id);
    if (!isPlayer) return message.reply({ embeds: [e('❌ 你不在這局 OOXX 中！')] });
    games.delete(message.channel.id);
    message.channel.send({ embeds: [e(`🚫 **${message.member.displayName}** 取消了 OOXX！`)] });
  },
};

async function startTurn(channel, state) {
  const current = state.players[state.turn];
  const ts = state.ts;

  const msg = await channel.send({
    content: `<@${current.id}>`,
    embeds: [e(`⭕❌ **OOXX 對戰**\n\n${current.mark} 輪到 **${current.name}**\n\n${state.players[0].mark} ${state.players[0].name}　vs　${state.players[1].mark} ${state.players[1].name}`)],
    components: buildBoard(state.board, ts),
  });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`oo_${ts}_`),
    time: 60000,
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== current.id) {
      return i.reply({ embeds: [e('❌ 不是你的回合！')], flags: MessageFlags.Ephemeral });
    }

    const idx = parseInt(i.customId.replace(`oo_${ts}_`, ''));
    if (state.board[idx] !== EMPTY) {
      return i.reply({ embeds: [e('❌ 這格已經被佔了！')], flags: MessageFlags.Ephemeral });
    }

    state.board[idx] = current.mark;
    collector.stop('played');

    const result = checkWin(state.board);

    if (result === X || result === O) {
      const winner = state.players.find(p => p.mark === result);
      await i.update({
        embeds: [e(`🏆 **${winner.name}（${winner.mark}）獲勝！**\n\n${state.players[0].mark} ${state.players[0].name}　vs　${state.players[1].mark} ${state.players[1].name}`)],
        components: buildBoard(state.board, ts, true),
      });
      games.delete(channel.id);
      return;
    }

    if (result === 'draw') {
      await i.update({
        embeds: [e(`⚖️ **平手！**\n\n${state.players[0].mark} ${state.players[0].name}　vs　${state.players[1].mark} ${state.players[1].name}`)],
        components: buildBoard(state.board, ts, true),
      });
      games.delete(channel.id);
      return;
    }

    // 換人
    state.turn = 1 - state.turn;
    await i.update({ components: buildBoard(state.board, ts, true) });
    await startTurn(channel, state);
  });

  collector.on('end', (c, reason) => {
    if (reason === 'time') {
      msg.edit({ components: buildBoard(state.board, ts, true) }).catch(() => {});
      const other = state.players[1 - state.turn];
      channel.send({ embeds: [e(`⏰ **${current.name}** 超時！**${other.name}** 獲勝！`)] });
      games.delete(channel.id);
    }
  });
}

export default commands;
