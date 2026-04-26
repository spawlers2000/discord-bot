const { SlashCommandBuilder } = require('discord.js');
const { createEvent } = require('../handlers/eventHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('建立活動'),

  async execute(interaction) {
    return await createEvent(interaction);
  }
};