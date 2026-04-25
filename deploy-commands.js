const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { token, clientId, guildId } = require('./config.json');

const commands = [
  new SlashCommandBuilder()
    .setName('event')
    .setDescription('建立活動')

    .addStringOption(o =>
      o.setName('name')
        .setDescription('活動名稱')
        .setRequired(true))

        .addStringOption(o =>
      o.setName('event-time')
        .setDescription('活動開始時間(格式：2026-04-25 00:00)')
        .setRequired(true))

    .addIntegerOption(o =>
      o.setName('max')
        .setDescription('總人數')
        .setRequired(true))

    .addIntegerOption(o =>
      o.setName('tanks')
        .setDescription('需要坦數')
        .setRequired(true))

    .addIntegerOption(o =>
      o.setName('healers')
        .setDescription('需要補數')
        .setRequired(true))

    .addStringOption(o =>
      o.setName('end-time')  // 新增一個結束時間選項
          .setDescription('報名結束時間(格式：2026-04-25 00:00)')
          .setRequired(true)) //  
      
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands }
  );

  console.log("✅ Commands deployed");
})();