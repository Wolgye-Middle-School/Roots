const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireLogin, httpError } = require('../middleware/auth');

const router = express.Router();

function requireLocal(req, res, next) {
  if (req.user.provider !== 'local') return next(httpError(400, '소셜 로그인 계정은 해당 서비스에서 비밀번호를 관리합니다.'));
  next();
}

router.get('/account/password', requireLogin, requireLocal, (req, res) => {
  res.render('auth/password', { pageTitle: '비밀번호 변경', error: null });
});

router.post('/account/password', requireLogin, requireLocal, (req, res) => {
  const current = String(req.body.current || '');
  const next = String(req.body.password || '');
  const confirm = String(req.body.passwordConfirm || '');
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);

  let error = null;
  if (!row || !bcrypt.compareSync(current, row.password_hash)) error = '현재 비밀번호가 올바르지 않습니다.';
  else if (next.length < 8) error = '새 비밀번호는 8자 이상이어야 합니다.';
  else if (next !== confirm) error = '새 비밀번호 확인이 일치하지 않습니다.';
  else if (next === current) error = '현재 비밀번호와 다른 비밀번호를 입력해 주세요.';
  if (error) return res.status(400).render('auth/password', { pageTitle: '비밀번호 변경', error });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id);
  // 다른 기기의 세션은 그대로 두되, 현재 세션은 재발급
  const user = req.user;
  req.session.regenerate((err) => {
    if (err) return res.redirect('/');
    req.login(user, () => {
      req.flash('success', '비밀번호가 변경되었습니다.');
      res.redirect('/');
    });
  });
});

module.exports = router;
