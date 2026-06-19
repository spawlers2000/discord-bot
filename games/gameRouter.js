import bingoCommands from './bingo.js';
import bombCommands from './bomb.js';
import werewolfCommands from './werewolf.js';

// 賓果指令對應
const bingoMap = { bs: 'bs', bj: 'bj', bb: 'bb', bc: 'bc', bl: 'bl', bq: 'bq', br: 'br' };
// 終極密碼指令對應
const bombMap = { zs: 'zs', zj: 'zj', zb: 'zb', zg: 'zg', zl: 'zl', zq: 'zq', zr: 'zr' };
// 狼人殺指令對應
const wolfMap = { ws: 'ws', wj: 'wj', wb: 'wb', wq: 'wq', wl: 'wl' };

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
    } catch (err) {
      console.error(`[遊戲指令錯誤] ${cmd}:`, err);
      message.reply('❌ 指令執行錯誤').catch(() => {});
    }
  });
}
