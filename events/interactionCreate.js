const eventHandler = require('../handlers/eventHandler');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction) {

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'event') {
        return eventHandler.createEvent(interaction);
      }
    }

    if (interaction.isButton()) {
      return eventHandler.handleButton(interaction);
    }
  }
};