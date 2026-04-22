const db = require('./db');

async function getEvent(id) {
  return new Promise((resolve) => {
    db.get("SELECT * FROM events WHERE id = ?", [id], (err, row) => {
      if (!row) return resolve(null);
      row.players = JSON.parse(row.players || "[]");
      row.waitlist = JSON.parse(row.waitlist || "[]");
      resolve(row);
    });
  });
}

function saveEvent(event) {
  db.run(`
    UPDATE events SET
      players = ?,
      waitlist = ?
    WHERE id = ?
  `, [
    JSON.stringify(event.players || []),
    JSON.stringify(event.waitlist || []),
    event.id
  ]);
}



function addPlayerRole(event, userId, role) {

  // 先移除舊角色
  event.players = event.players.filter(p => p.id !== userId);

  // 加入新角色
  event.players.push({ id: userId, role });

  saveEvent(event);
}


function addPlayer(event, userId) {
  if (event.players.length < event.maxPlayers) {
    event.players.push(userId);
  } else {
    event.waitlist.push(userId);
  }

  saveEvent(event);
}

function removePlayer(event, userId) {
  event.players = event.players.filter(p => p.id !== userId);
  event.waitlist = event.waitlist.filter(p => p.id !== userId);

  saveEvent(event);
}

module.exports = {
  getEvent,
  addPlayer,
  removePlayer,
  addPlayerRole,
  saveEvent 
};