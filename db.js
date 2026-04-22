const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data.db');

db.run(`
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT,
  time INTEGER,
  maxPlayers INTEGER,
  maxTanks INTEGER,
  maxHealers INTEGER,
  maxDps INTEGER,
  tanks INTEGER DEFAULT 0,
  healers INTEGER DEFAULT 0,
  dps INTEGER DEFAULT 0,
  players TEXT,
  waitlist TEXT,
  channelId TEXT,
  messageId TEXT,
  endTime INTEGER,
  eventTime INTEGER
)
`);
module.exports = db;