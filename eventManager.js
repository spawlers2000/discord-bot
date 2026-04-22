const db = require('./db');

function getEvent(id) {
  const data = db.loadDB();
  return data.events.find(e => e.id === id);
}

function saveEvent(event) {
  const data = db.loadDB();
  const index = data.events.findIndex(e => e.id === event.id);

  if (index !== -1) {
    data.events[index] = event;
  }

  db.saveDB(data);
}

function addPlayerRole(event, userId, role) {
  event.players = event.players.filter(p => p.id !== userId);
  event.players.push({ id: userId, role });
  saveEvent(event);
}

module.exports = {
  getEvent,
  saveEvent,
  addPlayerRole
};