import mongoose from 'mongoose';

const bingoRecordSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  wins: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('BingoRecord', bingoRecordSchema);
