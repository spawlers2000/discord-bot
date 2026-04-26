require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');

const loadEvents = require('./loaders/loadEvents');
const loadSchedulers = require('./loaders/loadSchedulers');
const loadCommands = require('./loaders/loadCommands');

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
  console.log('⚔️ RPG Raid Bot Ready');
   require('./scheduler/guildWar')(client);
});

// ==========================
// LOAD ALL
// ==========================
loadCommands(client);
loadEvents(client);
loadSchedulers(client);

// ==========================
client.login(process.env.TOKEN);