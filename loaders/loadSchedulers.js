const fs = require('fs');
const path = require('path');

module.exports = (client) => {

  const schedulerPath = path.join(__dirname, '..', 'scheduler');
  const files = fs.readdirSync(schedulerPath);

  for (const file of files) {

    const scheduler = require(`../scheduler/${file}`);

    if (typeof scheduler === 'function') {
      scheduler(client);
    }
  }

};