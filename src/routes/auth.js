const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('../passport');
const db = require('../db');

const router = express.Router();

// 간단한 로그인 시도 제한 (IP당 15분에 10회)
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
function loginLimiter(req, res, next) {
  const now = Date.now();
  const rec = attempts.get(req.ip) || { count: 0, start: now };
  if (now - rec.start > WINDOW) { rec.count = 0; rec.start = now; }
  rec.count += 1;
  attempts.set(req.ip, rec);
  if (rec.count > 10) {
    req.flash('error', '로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.');
    return res.redirect('/login');
  }
  next();
}

function safeRedirect(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

// 로그인 성공 후 공통 처리 (passport가 로그인 시 세션을 재발급하므로 returnTo를 미리 보관해 둔다)
function loginAndRedirect(req, res, next, user, returnTo) {
  req.login(user, (err) => {
    if (err) return next(err);
    if (user.status === 'pending') {
      req.flash('info', '가입 승인 대기 중입니다. 관리자 승인 후 회원 전용 게시글을 볼 수 있습니다.');
    } else {
      req.flash('success', `${user.nickname}님, 환영합니다!`);
    }
    res.redirect(safeRedirect(returnTo));
  });
}

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/login', { pageTitle: '로그인' });
});

router.post('/login', loginLimiter, (req, res, next) => {
  const returnTo = req.session.returnTo;
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error', (info && info.message) || '로그인에 실패했습니다.');
      return res.redirect('/login');
    }
    attempts.delete(req.ip);
    loginAndRedirect(req, res, next, user, returnTo);
  })(req, res, next);
});

router.get('/signup', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/signup', { pageTitle: '회원가입', form: {}, error: null });
});

router.post('/signup', (req, res, next) => {
  const form = {
    username: String(req.body.username || '').trim(),
    nickname: String(req.body.nickname || '').trim(),
    role: req.body.role === 'teacher' ? 'teacher' : 'parent',
  };
  const password = String(req.body.password || '');
  const passwordConfirm = String(req.body.passwordConfirm || '');

  let error = null;
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(form.username)) error = '아이디는 영문, 숫자, 밑줄(_) 4~20자로 입력해 주세요.';
  else if (password.length < 8) error = '비밀번호는 8자 이상이어야 합니다.';
  else if (password !== passwordConfirm) error = '비밀번호 확인이 일치하지 않습니다.';
  else if (form.nickname.length < 2 || form.nickname.length > 20) error = '이름(닉네임)은 2~20자로 입력해 주세요.';
  else if (!req.body.agree) error = '개인정보 수집 및 이용에 동의해 주세요.';
  else if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(form.username)) error = '이미 사용 중인 아이디입니다.';

  if (error) return res.status(400).render('auth/signup', { pageTitle: '회원가입', form, error });

  const result = db.prepare(`
    INSERT INTO users (username, password_hash, nickname, role, status, provider)
    VALUES (?, ?, ?, ?, 'pending', 'local')
  `).run(form.username, bcrypt.hashSync(password, 10), form.nickname, form.role);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  loginAndRedirect(req, res, next, user, '/');
});

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.regenerate(() => res.redirect('/'));
  });
});

module.exports = router;
module.exports.loginAndRedirect = loginAndRedirect;
