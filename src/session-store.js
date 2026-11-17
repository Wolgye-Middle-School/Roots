const session = require('express-session');
const db = require('./db');

const ONE_DAY = 24 * 60 * 60 * 1000;

// node:sqlite 기반의 간단한 세션 저장소
class SqliteStore extends session.Store {
  constructor() {
    super();
    this.getStmt = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?');
    this.setStmt = db.prepare(`
      INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires
    `);
    this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStmt = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
    this.cleanupStmt = db.prepare('DELETE FROM sessions WHERE expires <= ?');
    setInterval(() => this.cleanupStmt.run(Date.now()), 60 * 60 * 1000).unref();
  }

  expiresOf(sess) {
    const exp = sess && sess.cookie && sess.cookie.expires;
    return exp ? new Date(exp).getTime() : Date.now() + ONE_DAY;
  }

  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (err) { cb(err); }
  }

  set(sid, sess, cb) {
    try {
      this.setStmt.run(sid, JSON.stringify(sess), this.expiresOf(sess));
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }

  destroy(sid, cb) {
    try {
      this.destroyStmt.run(sid);
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }

  touch(sid, sess, cb) {
    try {
      this.touchStmt.run(this.expiresOf(sess), sid);
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }
}

module.exports = SqliteStore;
