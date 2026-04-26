const fs = require('fs');
const path = require('path');

module.exports = (client) => {

  client.commands = new Map();

  const commandsPath = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(commandsPath);

  for (const file of files) {

    const command = require(`../commands/${file}`);

    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
    }
  }

};