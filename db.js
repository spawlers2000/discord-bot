const fs = require('fs');
const path = './data.json';

// 讀資料
function loadDB() {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify({ events: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(path));
}

// 存資料
function saveDB(data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

module.exports = {
  loadDB,
  saveDB
};