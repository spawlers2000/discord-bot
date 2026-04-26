const fs = require('fs');
const path = require('path');

module.exports = (client) => {

  const eventsPath = path.join(__dirname, '..', 'events');
  const files = fs.readdirSync(eventsPath);

  for (const file of files) {

    const event = require(`../events/${file}`);

    // ✅ 支援兩種寫法（彈性）
    if (typeof event === 'function') {
      event(client);
    } else if (event.name && event.execute) {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

};