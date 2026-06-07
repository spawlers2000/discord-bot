// utils/announceConfig.js
// 公告設定存取（MongoDB 版，重啟不消失）

import { AnnounceConfig } from "./db.js";

// ─────────────────────────────────────────────────────
//  取得單一伺服器設定
// ─────────────────────────────────────────────────────
export async function getGuildConfig(guildId) {
  let cfg = await AnnounceConfig.findOne({ guildId });
  if (!cfg) cfg = await AnnounceConfig.create({ guildId });
  return cfg;
}

// ─────────────────────────────────────────────────────
//  更新單一伺服器設定
// ─────────────────────────────────────────────────────
export async function setGuildConfig(guildId, partial) {
  return AnnounceConfig.findOneAndUpdate(
    { guildId },
    { $set: partial },
    { upsert: true, new: true }
  );
}

// ─────────────────────────────────────────────────────
//  取得所有已啟用的伺服器設定
// ─────────────────────────────────────────────────────
export async function getAllEnabledConfigs() {
  return AnnounceConfig.find({ enabled: true });
}

// ─────────────────────────────────────────────────────
//  權限檢查
// ─────────────────────────────────────────────────────
export function canControlAnnounce(member) {
  if (member.permissions.has("Administrator")) return true;
  const adminId = process.env.ANNOUNCE_ADMIN_ID;
  return adminId && member.id === adminId;
}
