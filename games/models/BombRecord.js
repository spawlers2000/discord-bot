import mongoose from 'mongoose';

const bombRecordSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  count: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('BombRecord', bombRecordSchema);
