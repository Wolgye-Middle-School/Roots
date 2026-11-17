const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { getBoard } = require('../boards');
const { requireRole, httpError } = require('../middleware/auth');
const { removeFiles } = require('../uploads');

const router = express.Router();
router.use('/admin', requireRole('admin'));

const STATUS_LABELS = { pending: '승인 대기', approved: '승인', rejected: '거절' };
const PROVIDER_LABELS = { local: '일반', kakao: '카카오', naver: '네이버', google: '구글' };

router.get('/admin', (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
  const users = db.prepare(`
    SELECT id, username, nickname, role, status, provider, created_at FROM users
    ${status ? 'WHERE status = ?' : ''}
    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC
  `).all(...(status ? [status] : []));

  const counts = Object.fromEntries(
    db.prepare('SELECT status, COUNT(*) AS n FROM users GROUP BY status').all().map((r) => [r.status, r.n]),
  );
  const posts = db.prepare(`
    SELECT p.id, p.board, p.title, p.visibility, p.created_at, u.nickname AS author
    FROM posts p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 20
  `).all().map((p) => ({ ...p, boardName: (getBoard(p.board) || {}).name || p.board }));
  const postCount = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;

  const admin = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  const defaultPassword = !!(admin && admin.password_hash && bcrypt.compareSync('admin', admin.password_hash));

  res.render('admin/index', {
    pageTitle: '관리자',
    users,
    posts,
    counts,
    postCount,
    status,
    defaultPassword,
    STATUS_LABELS,
    PROVIDER_LABELS,
  });
});

function loadTarget(req, res, next) {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!target) return next(httpError(404, '존재하지 않는 회원입니다.'));
  if (target.id === req.user.id) return next(httpError(400, '본인 계정은 변경할 수 없습니다.'));
  req.target = target;
  next();
}

function back(req, res) {
  res.redirect(`/admin${req.body.status ? `?status=${encodeURIComponent(req.body.status)}` : ''}#users`);
}

// 승인 / 거절
router.post('/admin/users/:id/status', loadTarget, (req, res) => {
  const value = req.body.value;
  if (!['approved', 'rejected', 'pending'].includes(value)) return back(req, res);
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(value, req.target.id);
  req.flash('success', `${req.target.nickname} 님을 '${STATUS_LABELS[value]}' 상태로 변경했습니다.`);
  back(req, res);
});

// 역할 변경
router.post('/admin/users/:id/role', loadTarget, (req, res) => {
  const value = req.body.value;
  if (!['admin', 'teacher', 'parent'].includes(value)) return back(req, res);
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(value, req.target.id);
  req.flash('success', `${req.target.nickname} 님의 역할을 '${req.app.locals.roleLabel(value)}'(으)로 변경했습니다.`);
  back(req, res);
});

// 회원 삭제 (작성한 글·댓글·사진도 함께 삭제)
router.post('/admin/users/:id/delete', loadTarget, (req, res) => {
  const files = db.prepare(`
    SELECT a.filename FROM attachments a JOIN posts p ON p.id = a.post_id WHERE p.user_id = ?
  `).all(req.target.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.target.id);
  removeFiles(files);
  req.flash('success', `${req.target.nickname} 님의 계정을 삭제했습니다.`);
  back(req, res);
});

module.exports = router;
