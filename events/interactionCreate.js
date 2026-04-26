module.exports = (client) => {

  client.on('interactionCreate', async (interaction) => {

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction);
    }

    if (interaction.isButton()) {
      const handler = require('../handlers/eventHandler');
      await handler.handleButton(interaction);
    }

  });

};