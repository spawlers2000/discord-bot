// utils/announceConfig.js
// 讀寫公告開關狀態到 data/announceConfig.json

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "../data/announceConfig.json");

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
  catch { return {}; }
}

export function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

export function getGuildConfig(guildId) {
  const all = loadConfig();
  return all[guildId] ?? { enabled: false, lastFired: null };
}

export function setGuildConfig(guildId, partial) {
  const all    = loadConfig();
  all[guildId] = { ...(all[guildId] ?? {}), ...partial };
  saveConfig(all);
  return all[guildId];
}

// 權限檢查：只有 .env 設定的 ANNOUNCE_ADMIN_ID 或伺服器管理員可以操作
export function canControlAnnounce(member) {
  if (member.permissions.has("Administrator")) return true;
  const adminId = process.env.ANNOUNCE_ADMIN_ID;
  return adminId && member.id === adminId;
}
