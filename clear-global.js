const { REST, Routes } = require('discord.js');
const { token, clientId } = require('./config.json');

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: [] }
  );

  console.log('🧹 Global commands cleared');
})();