import bingoCommands from './bingo.js';
import bombCommands from './bomb.js';
import werewolfCommands from './werewolf.js';
import werewordsCommands from './werewords.js';
import undercoverCommands from './undercover.js';
import coupCommands from './coup.js';

// 賓果指令對應
const bingoMap = { bs: 'bs', bj: 'bj', bb: 'bb', bc: 'bc', bl: 'bl', bq: 'bq', br: 'br' };
// 終極密碼指令對應
const bombMap = { zs: 'zs', zj: 'zj', zb: 'zb', zg: 'zg', zl: 'zl', zq: 'zq', zr: 'zr' };
// 狼人殺指令對應
const wolfMap = { ws: 'ws', wj: 'wj', wb: 'wb', wq: 'wq', wl: 'wl' };
// 狼人真言指令對應
const wwMap = { wws: 'wws', wwj: 'wwj', wwb: 'wwb', wwg: 'wwg', wwp: 'wwp', wwq: 'wwq', wwl: 'wwl' };
// 誰是臥底指令對應
const ucMap = { us: 'us', uj: 'uj', ub: 'ub', ud: 'ud', uq: 'uq', ul: 'ul' };
// 政變指令對應
const coupMap = { cs: 'cs', cj: 'cj', cb: 'cb', cc: 'cc', ch: 'ch', cq: 'cq', cl: 'cl' };

export function setupGameRouter(client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    try {
      // 賓果指令
      if (bingoMap[cmd]) {
        const channelId = process.env.BINGO_CHANNEL_ID;
        if (channelId && message.channel.id !== channelId) return;
        await bingoCommands[cmd](message, args);
        return;
      }

      // 終極密碼指令
      if (bombMap[cmd]) {
        const channelId = process.env.BOMB_CHANNEL_ID;
        if (channelId && message.channel.id !== channelId) return;
        await bombCommands[cmd](message, args);
        return;
      }

      // 狼人殺指令
      if (wolfMap[cmd]) {
        const channelId = process.env.WEREWOLF_CHANNEL_ID;
        if (channelId && message.channel.id !== channelId) return;
        await werewolfCommands[cmd](message, args);
        return;
      }

      // 狼人真言指令
      if (wwMap[cmd]) {
        const channelId = process.env.WEREWORDS_CHANNEL_ID;
        if (channelId && message.channel.id !== channelId) return;
        await werewordsCommands[cmd](message, args);
        return;
      }

      // 誰是臥底指令
      if (ucMap[cmd]) {
        const channelId = process.env.UNDERCOVER_CHANNEL_ID;
        if (channelId && message.channel.id !== channelId) return;
        await undercoverCommands[cmd](message, args);
        return;
      }

      // 政變指令
      if (coupMap[cmd]) {
        const channelId = process.env.COUP_CHANNEL_ID;
        if (channelId && message.channel.id !== channelId) return;
        await coupCommands[cmd](message, args);
        return;
      }
    } catch (err) {
      console.error(`[遊戲指令錯誤] ${cmd}:`, err);
      message.reply('❌ 指令執行錯誤').catch(() => {});
    }
  });
}
