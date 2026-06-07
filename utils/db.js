// utils/db.js
// MongoDB 連線與 Schema 定義

import mongoose from "mongoose";

// ─────────────────────────────────────────────────────
//  Schema
// ─────────────────────────────────────────────────────
const announceSchema = new mongoose.Schema({
  guildId:    { type: String, required: true, unique: true },
  enabled:    { type: Boolean, default: false },
  lastFired:  { type: String,  default: null },
});

export const AnnounceConfig = mongoose.model("AnnounceConfig", announceSchema);

// ─────────────────────────────────────────────────────
//  連線
// ─────────────────────────────────────────────────────
export async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.error("❌  找不到 MONGO_URI，公告設定將無法持久化");
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅  MongoDB 已連線");
  } catch (err) {
    console.error("❌  MongoDB 連線失敗：", err.message);
  }
}
