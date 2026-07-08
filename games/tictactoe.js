import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);

const games = new Map();

const EMPTY = '⬜';
const MARKS = ['❌', '⭕'];
const SIZE_NAME = { 1: '小', 2: '中', 3: '大' };

function topPiece(cell) {
  return cell.length > 0 ? cell[cell.length - 1] : null;
}

function cellLabel(cell) {
  const top = topPiece(cell);
  if (!top) return EMPTY;
  return `${MARKS[top.player]}${SIZE_NAME[top.size]}`;
}

function checkWin(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (const [a,b,c] of lines) {
    const ta = topPiece(board[a]);
    const tb = topPiece(board[b]);
    const tc = topPiece(board[c]);
    if (ta && tb && tc && ta.player === tb.player && tb.player === tc.player) {
      return ta.player;
    }
  }
  return null;
}

function canPlace(cell, size) {
  const top = topPiece(cell);
  if (!top) return true;
  return size > top.size;
}

function buildBoardButtons(board, ts, disabled = false) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const top = topPiece(board[i]);
      const label = cellLabel(board[i]);
      let style = ButtonStyle.Secondary;
      if (top) style = top.player === 0 ? ButtonStyle.Danger : ButtonStyle.Primary;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`oo_${ts}_${i}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled)
      );
    }
    rows.push(row);
  }
  return rows;
}

function boardText(state) {
  const p = state.players;
  return `${MARKS[0]} **${p[0].name}**（小×${p[0].pieces[1]} 中×${p[0].pieces[2]} 大×${p[0].pieces[3]}）\n${MARKS[1]} **${p[1].name}**（小×${p[1].pieces[1]} 中×${p[1].pieces[2]} 大×${p[1].pieces[3]}）`;
}

const commands = {
  async os(message) {
    if (games.has(message.channel.id)) return message.reply({ embeds: [e('❌ 這個頻道已有進行中的大吃小！')] });

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
      embeds: [e(`⭕❌ **${challengerName}** 向 **${targetName}** 發起大吃小圈叉棋！\n\n是否接受？（⏱️ 60 秒）`)],
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

      await i.update({ embeds: [e(`✅ **${targetName}** 接受了！遊戲開始！`)], components: [] });

      const players = Math.random() < 0.5
        ? [{ id: message.author.id, name: challengerName, pieces: { 1: 2, 2: 2, 3: 2 } },
           { id: target.id, name: targetName, pieces: { 1: 2, 2: 2, 3: 2 } }]
        : [{ id: target.id, name: targetName, pieces: { 1: 2, 2: 2, 3: 2 } },
           { id: message.author.id, name: challengerName, pieces: { 1: 2, 2: 2, 3: 2 } }];

      const state = {
        board: Array.from({ length: 9 }, () => []),
        players,
        turn: 0,
        selectedSize: null,
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
    if (!game) return message.reply({ embeds: [e('❌ 這個頻道沒有進行中的大吃小！')] });
    const isPlayer = game.players.some(p => p.id === message.author.id);
    if (!isPlayer) return message.reply({ embeds: [e('❌ 你不在這局遊戲中！')] });
    games.delete(message.channel.id);
    message.channel.send({ embeds: [e(`🚫 **${message.member.displayName}** 放棄了大吃小！`)] });
  },
};

async function startTurn(channel, state) {
  const current = state.players[state.turn];
  const ts = Date.now();
  state.selectedSize = null;

  // 棋子選擇按鈕
  const sizeRow = new ActionRowBuilder();
  for (const size of [1, 2, 3]) {
    sizeRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`sz_${ts}_${size}`)
        .setLabel(`${SIZE_NAME[size]}（剩 ${current.pieces[size]}）`)
        .setStyle(size === 1 ? ButtonStyle.Secondary : size === 2 ? ButtonStyle.Primary : ButtonStyle.Danger)
        .setDisabled(current.pieces[size] <= 0)
    );
  }

  const boardRows = buildBoardButtons(state.board, ts, true);

  const msg = await channel.send({
    content: `<@${current.id}>`,
    embeds: [e(`⭕❌ **大吃小圈叉棋**\n\n${boardText(state)}\n\n${MARKS[state.turn]} 輪到 **${current.name}**\n\n先選擇棋子大小：`)],
    components: [sizeRow, ...boardRows],
  });

  // 第一步：選大小
  const sizeCollector = msg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`sz_${ts}_`) || i.customId.startsWith(`oo_${ts}_`),
    time: 60000,
  });

  sizeCollector.on('collect', async (i) => {
    if (i.user.id !== current.id) {
      return i.reply({ embeds: [e('❌ 不是你的回合！')], flags: MessageFlags.Ephemeral });
    }

    // 選擇大小
    if (i.customId.startsWith(`sz_${ts}_`)) {
      const size = parseInt(i.customId.replace(`sz_${ts}_`, ''));
      state.selectedSize = size;

      // 更新：大小按鈕標記已選，格子按鈕啟用可放的位置
      const newSizeRow = new ActionRowBuilder();
      for (const s of [1, 2, 3]) {
        newSizeRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`sz_${ts}_${s}`)
            .setLabel(`${s === size ? '✅ ' : ''}${SIZE_NAME[s]}（剩 ${current.pieces[s]}）`)
            .setStyle(s === size ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(current.pieces[s] <= 0)
        );
      }

      const newBoardRows = [];
      for (let r = 0; r < 3; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 3; c++) {
          const idx = r * 3 + c;
          const top = topPiece(state.board[idx]);
          const label = cellLabel(state.board[idx]);
          let style = ButtonStyle.Secondary;
          if (top) style = top.player === 0 ? ButtonStyle.Danger : ButtonStyle.Primary;
          const canP = canPlace(state.board[idx], size);
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`oo_${ts}_${idx}`)
              .setLabel(label)
              .setStyle(style)
              .setDisabled(!canP)
          );
        }
        newBoardRows.push(row);
      }

      await i.update({
        embeds: [e(`⭕❌ **大吃小圈叉棋**\n\n${boardText(state)}\n\n${MARKS[state.turn]} **${current.name}** 選了 **${SIZE_NAME[size]}**\n\n選擇要放的位置：`)],
        components: [newSizeRow, ...newBoardRows],
      });
      return;
    }

    // 放棋子
    if (i.customId.startsWith(`oo_${ts}_`)) {
      if (state.selectedSize === null) {
        return i.reply({ embeds: [e('❌ 先選擇棋子大小！')], flags: MessageFlags.Ephemeral });
      }

      const idx = parseInt(i.customId.replace(`oo_${ts}_`, ''));
      const size = state.selectedSize;

      if (!canPlace(state.board[idx], size)) {
        return i.reply({ embeds: [e('❌ 這格放不下！')], flags: MessageFlags.Ephemeral });
      }

      // 放棋子
      state.board[idx].push({ player: state.turn, size });
      current.pieces[size]--;
      sizeCollector.stop('placed');

      // 檢查勝負
      const winner = checkWin(state.board);

      if (winner !== null) {
        const winnerPlayer = state.players[winner];
        await i.update({
          embeds: [e(`🏆 **${winnerPlayer.name}（${MARKS[winner]}）獲勝！**\n\n${boardText(state)}`)],
          components: buildBoardButtons(state.board, ts, true),
        });
        games.delete(channel.id);
        return;
      }

      // 檢查是否雙方都沒棋子了
      const p0left = state.players[0].pieces[1] + state.players[0].pieces[2] + state.players[0].pieces[3];
      const p1left = state.players[1].pieces[1] + state.players[1].pieces[2] + state.players[1].pieces[3];
      if (p0left === 0 && p1left === 0) {
        await i.update({
          embeds: [e(`⚖️ **平手！** 雙方棋子用完\n\n${boardText(state)}`)],
          components: buildBoardButtons(state.board, ts, true),
        });
        games.delete(channel.id);
        return;
      }

      // 換人
      state.turn = 1 - state.turn;
      await i.update({ components: buildBoardButtons(state.board, ts, true) });
      await startTurn(channel, state);
    }
  });

  sizeCollector.on('end', (c, reason) => {
    if (reason === 'time') {
      const other = state.players[1 - state.turn];
      msg.edit({ components: buildBoardButtons(state.board, ts, true) }).catch(() => {});
      channel.send({ embeds: [e(`⏰ **${current.name}** 超時！**${other.name}** 獲勝！`)] });
      games.delete(channel.id);
    }
  });
}

export default commands;
