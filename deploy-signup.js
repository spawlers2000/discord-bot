import { REST, Routes } from 'discord.js';
import { data } from './games/gameSignup.js';
import dotenv from 'dotenv';
dotenv.config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const commands = [data.toJSON()];

(async () => {
  try {
    console.log('正在部署 Slash Command...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );
    console.log('✅ Slash Command 部署成功！');
  } catch (error) {
    console.error('❌ 部署失敗:', error);
  }
})();
