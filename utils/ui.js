const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const ROLE = {
  tank: { icon: '🛡️', name: '坦克' },
  healer: { icon: '💚', name: '治療' },
  dps: { icon: '⚔️', name: '輸出' }
};

function buildEmbed(event, formatTime) {

  const tanks = event.players.filter(p => p.role === 'tanks');
  const healers = event.players.filter(p => p.role === 'healers');
  const dps = event.players.filter(p => p.role === 'dps');
  const queue = event.queue || [];

  const list = (arr, icon) =>
    arr.length ? arr.map(p => `${icon} <@${p.id}>`).join('\n') : '—';

  const status =
    event.players.length >= event.maxPlayers ? '🔴 已滿'
    : event.players.length >= event.maxPlayers * 0.7 ? '🟡 即將滿'
    : '🟢 招募中';

  return new EmbedBuilder()
    .setTitle(`⚔️ ${event.name}`)
    .addFields(
      { name: '👑 團長', value: `<@${event.ownerId}>`, inline: true },
      { name: '📊 狀態', value: status, inline: true },
      { name: '👥 人數', value: `${event.players.length}/${event.maxPlayers}`, inline: true },

      { name: '📅 活動開始', value: event.eventTime ? formatTime(event.eventTime) : '未設定', inline: true },
      { name: '⏳ 報名截止', value: event.endTime ? formatTime(event.endTime) : '未設定', inline: true },
      { name: '\u200b', value: '\u200b', inline: true },

      { name: `🛡 坦 (${tanks.length}/${event.maxTanks})`, value: list(tanks, '🛡️'), inline: true },
      { name: `💚 補 (${healers.length}/${event.maxHealers})`, value: list(healers, '💚'), inline: true },
      { name: `⚔️ 輸出 (${dps.length})`, value: list(dps, '⚔️'), inline: true },

      { name: '📥 候補', value: queue.length ? queue.map(q => `⏳ <@${q.id}>`).join('\n') : '—' }
    );
}

function buttons(event) {

  const tanks = event.players.filter(p => p.role === 'tanks').length;
  const healers = event.players.filter(p => p.role === 'healers').length;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tank').setLabel('🛡️ 坦').setStyle(ButtonStyle.Primary).setDisabled(tanks >= event.maxTanks),
    new ButtonBuilder().setCustomId('healer').setLabel('💚 補').setStyle(ButtonStyle.Success).setDisabled(healers >= event.maxHealers),
    new ButtonBuilder().setCustomId('dps').setLabel('⚔️ 輸出').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('leave').setLabel('❌ 離隊').setStyle(ButtonStyle.Danger)
  );
}

function ownerBtn(event) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`delete_${event.id}`)
      .setLabel('🗑️ 解散隊伍')
      .setStyle(ButtonStyle.Danger)
  );
}

module.exports = { buildEmbed, buttons, ownerBtn };