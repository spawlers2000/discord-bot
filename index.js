require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');

const interactionCreate = require('./events/interactionCreate');
const guildWarScheduler = require('./scheduler/guildWar');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==========================
// READY
// ==========================
client.once(Events.ClientReady, () => {
  console.log("⚔️ RPG Raid Bot Ready");

  // 啟動排程
  guildWarScheduler(client);
});

// ==========================
// 載入事件
// ==========================
interactionCreate(client);

// ==========================
client.login(process.env.TOKEN);