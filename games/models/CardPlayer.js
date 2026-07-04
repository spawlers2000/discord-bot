import mongoose from 'mongoose';

const cardPlayerSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  deck: { type: [String], default: [] },       // 卡牌 ID 陣列
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  loseStreak: { type: Number, default: 0 },     // 連敗計數
  registeredAt: { type: Date, default: Date.now },
});

export default mongoose.model('CardPlayer', cardPlayerSchema);
