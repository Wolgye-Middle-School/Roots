const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const { DATA_DIR } = require('./storage');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'roots.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE,
  password_hash TEXT,
  nickname      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('admin', 'teacher', 'parent')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  provider      TEXT NOT NULL DEFAULT 'local',
  provider_id   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (provider, provider_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  board       TEXT NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'members' CHECK (visibility IN ('public', 'members')),
  pinned      INTEGER NOT NULL DEFAULT 0,
  views       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_posts_board ON posts (board, pinned DESC, id DESC);

CREATE TABLE IF NOT EXISTS attachments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id       INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS likes (
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  sid      TEXT PRIMARY KEY,
  sess     TEXT NOT NULL,
  expires  INTEGER NOT NULL
);
`);

// 기본 관리자 계정 (아이디: admin / 비밀번호: admin)
function seedAdmin() {
  const exists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (exists) return;
  db.prepare(`
    INSERT INTO users (username, password_hash, nickname, role, status, provider)
    VALUES ('admin', ?, '관리자', 'admin', 'approved', 'local')
  `).run(bcrypt.hashSync('admin', 10));
  console.log('기본 관리자 계정(admin / admin)이 생성되었습니다. 운영 전 비밀번호를 변경하세요.');
}
seedAdmin();

module.exports = db;
