import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

export function getDatabase(customPath = null) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const targetPath = customPath || config.dbPath;
  const db = new DatabaseSync(targetPath);

  // Enable foreign keys and WAL mode for reliability
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Initialize schema if not exists
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

export const db = {
  get instance() {
    return getDatabase();
  },

  query(sql, params = []) {
    const stmt = getDatabase().prepare(sql);
    return stmt.all(...params);
  },

  get(sql, params = []) {
    const stmt = getDatabase().prepare(sql);
    return stmt.get(...params);
  },

  run(sql, params = []) {
    const stmt = getDatabase().prepare(sql);
    return stmt.run(...params);
  },

  exec(sql) {
    return getDatabase().exec(sql);
  },

  close() {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
  }
};

export default db;
