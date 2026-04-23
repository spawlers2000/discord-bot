const { MongoClient } = require('mongodb');
require('dotenv').config();
const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error("❌ MONGO_URI 沒設定（Railway Variables）");
}

const client = new MongoClient(uri);

let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db('discord-bot');
  }
  return db;
}

// 取得活動
async function loadDB() {
  const database = await connectDB();
  const events = await database.collection('events').find().toArray();
  return { events };
}

// 儲存活動（簡化版）
async function saveDB(data) {
  const database = await connectDB();
  const collection = database.collection('events');

  await collection.deleteMany({});
  await collection.insertMany(data.events || []);
}

module.exports = {
  loadDB,
  saveDB
};