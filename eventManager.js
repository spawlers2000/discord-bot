const db = require('./db');

// =========================
// 取得活動
// =========================
async function getEvent(id) {
  const data = db.load();
  return data.events.find(e => e.id === id) || null;
}

// =========================
// 存回活動（核心）
// =========================
function saveEvent(event) {
  const data = db.load();

  const index = data.events.findIndex(e => e.id === event.id);

  if (index === -1) return;

  data.events[index] = event;

  db.save(data);
}

// =========================
// 加入職業
// =========================
function addPlayerRole(event, userId, role) {

  // 移除舊角色
  event.players = event.players.filter(p => p.id !== userId);

  // 加入新角色
  event.players.push({
    id: userId,
    role
  });

  saveEvent(event);
}

// =========================
// 加入（候補系統用）
// =========================
function addPlayer(event, userId) {

  if (event.players.length < event.maxPlayers) {
    event.players.push({ id: userId, role: "dps" });
  } else {
    event.waitlist.push(userId);
  }

  saveEvent(event);
}

// =========================
// 移除玩家
// =========================
function removePlayer(event, userId) {

  event.players = event.players.filter(p => p.id !== userId);
  event.waitlist = event.waitlist.filter(p => p !== userId);

  saveEvent(event);
}

module.exports = {
  getEvent,
  addPlayer,
  removePlayer,
  addPlayerRole,
  saveEvent
};