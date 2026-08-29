// utils/persistentMap.js
// 把 Map 存到 JSON 檔案，重啟自動載回

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export function createPersistentMap(filePath) {
  // 確保資料夾存在
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // 載入舊資料
  let data = new Map();
  try {
    if (existsSync(filePath)) {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
      data = new Map(Object.entries(raw));
      console.log(`📂 載入 ${data.size} 筆資料 from ${filePath}`);
    }
  } catch (err) {
    console.error(`⚠️ 載入 ${filePath} 失敗:`, err.message);
  }

  // 儲存函數
  function save() {
    try {
      const obj = Object.fromEntries(data);
      writeFileSync(filePath, JSON.stringify(obj, null, 2));
    } catch (err) {
      console.error(`⚠️ 儲存 ${filePath} 失敗:`, err.message);
    }
  }

  // 包裝 Map，set/delete 時自動存檔
  return {
    get(key) { return data.get(key); },
    set(key, value) { data.set(key, value); save(); return this; },
    delete(key) { const r = data.delete(key); save(); return r; },
    has(key) { return data.has(key); },
    get size() { return data.size; },
    entries() { return data.entries(); },
    values() { return data.values(); },
    keys() { return data.keys(); },
    forEach(fn) { data.forEach(fn); },
    [Symbol.iterator]() { return data[Symbol.iterator](); },
  };
}
