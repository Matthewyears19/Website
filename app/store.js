import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { seed } from './config.js';
export const token = () => randomBytes(32).toString('hex');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password, stored) {
  const [salt, digest] = stored.split(':');
  return timingSafeEqual(
    Buffer.from(passwordHash(password, salt).split(':')[1], 'hex'),
    Buffer.from(digest, 'hex'),
  );
}
export function openStore(file, key) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
    INSERT OR IGNORE INTO schema_version VALUES(1);
    CREATE TABLE IF NOT EXISTS content(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, user_id INTEGER REFERENCES users(id), action TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT, state TEXT NOT NULL, created INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL, provider_id TEXT);
  `);
  db.prepare('INSERT OR IGNORE INTO content VALUES(1,1,?)').run(JSON.stringify(seed));
  const encrypt = (value) => {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), data].map((v) => v.toString('base64')).join('.');
  };
  const decrypt = (value) => {
    const [iv, tag, data] = value.split('.').map((v) => Buffer.from(v, 'base64'));
    const c = createDecipheriv('aes-256-gcm', key, iv);
    c.setAuthTag(tag);
    return JSON.parse(Buffer.concat([c.update(data), c.final()]).toString('utf8'));
  };
  return {
    db,
    encrypt,
    decrypt,
    content() {
      const r = db.prepare('SELECT * FROM content WHERE id=1').get();
      return { ...JSON.parse(r.body), revision: r.revision };
    },
    saveContent(value, userId) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const r = db
          .prepare('UPDATE content SET body=?,revision=revision+1 WHERE id=1 AND revision=?')
          .run(JSON.stringify({ prices: value.prices, news: value.news }), value.revision);
        if (!r.changes)
          throw Object.assign(
            new Error('Someone else saved changes. Reload before editing again.'),
            { status: 409 },
          );
        db.prepare('INSERT INTO audit(user_id,action) VALUES(?,?)').run(
          userId,
          'Updated prices and news',
        );
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
