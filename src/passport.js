const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const db = require('./db');

const findById = db.prepare('SELECT id, username, nickname, role, status, provider FROM users WHERE id = ?');
const findLocal = db.prepare("SELECT * FROM users WHERE username = ? AND provider = 'local'");

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  try {
    const user = findById.get(id);
    // 거절된 회원은 즉시 로그아웃 처리
    done(null, user && user.status !== 'rejected' ? { ...user } : false);
  } catch (err) { done(err); }
});

passport.use(new LocalStrategy((username, password, done) => {
  try {
    const user = findLocal.get(String(username).trim());
    if (!user || !user.password_hash || !bcrypt.compareSync(String(password), user.password_hash)) {
      return done(null, false, { message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    if (user.status === 'rejected') {
      return done(null, false, { message: '가입이 거절된 계정입니다. 관리자에게 문의하세요.' });
    }
    done(null, user);
  } catch (err) { done(err); }
}));

module.exports = passport;
