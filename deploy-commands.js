// deploy-commands.js
// 向 Discord 註冊斜線指令，新增或修改指令後執行一次即可
// 執行方式：node deploy-commands.js

import "dotenv/config";
import { REST, Routes } from "discord.js";
import * as partyCommand    from "./commands/party.js";
import * as announceCommand from "./commands/announce.js";

const commands = [
  partyCommand.data.toJSON(),
  announceCommand.data.toJSON(),
];
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error("❌  請先在 .env 填寫 DISCORD_TOKEN 和 CLIENT_ID");
    process.exit(1);
  }

  try {
    console.log("🔄  開始部署斜線指令...");

    if (process.env.GUILD_ID) {
      const result = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`✅  已在伺服器部署 ${result.length} 個指令（即時生效）`);
    } else {
      const result = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log(`✅  已全域部署 ${result.length} 個指令（最多 1 小時後生效）`);
    }
  } catch (err) {
    console.error("❌  部署失敗：", err);
  }
})();
