const express = require('express');
const db = require('../db');
const { getBoard, isApproved, canWrite, canRead, canManage, canPin } = require('../boards');
const { requireLogin, httpError } = require('../middleware/auth');

const router = express.Router();
const PAGE_SIZE = 15;

const getPost = db.prepare(`
  SELECT p.*, u.nickname AS author, u.role AS author_role
  FROM posts p JOIN users u ON u.id = p.user_id
  WHERE p.id = ?
`);

function loadBoard(req, res, next) {
  const board = getBoard(req.params.board);
  if (!board) return next(httpError(404, '존재하지 않는 게시판입니다.'));
  req.board = board;
  res.locals.board = board;
  next();
}

function loadPost(req, res, next) {
  const post = getPost.get(Number(req.params.id));
  if (!post || post.board !== req.board.slug) return next(httpError(404, '존재하지 않는 게시글입니다.'));
  req.post = post;
  next();
}

function requireWrite(req, res, next) {
  if (!req.user) return requireLogin(req, res, next);
  if (canWrite(req.user, req.board)) return next();
  if (req.user.status !== 'approved') return next(httpError(403, '관리자의 가입 승인 후 글을 작성할 수 있습니다.'));
  next(httpError(403, `${req.board.name} 게시판에는 글을 작성할 권한이 없습니다.`));
}

function requireManage(req, res, next) {
  if (!req.user) return requireLogin(req, res, next);
  if (canManage(req.user, req.post)) return next();
  next(httpError(403, '본인이 작성한 글만 수정·삭제할 수 있습니다.'));
}

function readForm(req) {
  return {
    title: String(req.body.title || '').trim(),
    content: String(req.body.content || '').trim(),
    visibility: req.body.visibility === 'public' ? 'public' : 'members',
    pinned: canPin(req.user) && req.body.pinned ? 1 : 0,
  };
}

function validate(form) {
  if (!form.title) return '제목을 입력해 주세요.';
  if (form.title.length > 100) return '제목은 100자 이내로 입력해 주세요.';
  if (!form.content) return '내용을 입력해 주세요.';
  if (form.content.length > 20000) return '내용은 20,000자 이내로 입력해 주세요.';
  return null;
}

// 목록
router.get('/boards/:board', loadBoard, (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 50);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const where = q ? 'WHERE p.board = ? AND p.title LIKE ?' : 'WHERE p.board = ?';
  const params = q ? [req.board.slug, `%${q}%`] : [req.board.slug];

  const total = db.prepare(`SELECT COUNT(*) AS n FROM posts p ${where}`).get(...params).n;
  const posts = db.prepare(`
    SELECT p.id, p.title, p.visibility, p.pinned, p.views, p.created_at, p.user_id,
           u.nickname AS author, u.role AS author_role,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
    FROM posts p JOIN users u ON u.id = p.user_id
    ${where}
    ORDER BY p.pinned DESC, p.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);

  res.render('board/list', {
    pageTitle: req.board.name,
    posts: posts.map((p) => ({ ...p, readable: canRead(req.user, p) })),
    q,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    canWrite: canWrite(req.user, req.board),
  });
});

// 글쓰기
router.get('/boards/:board/new', loadBoard, requireWrite, (req, res) => {
  res.render('board/form', {
    pageTitle: `${req.board.name} 글쓰기`,
    form: { visibility: 'members' },
    error: null,
    action: `/boards/${req.board.slug}`,
    canPin: canPin(req.user),
  });
});

router.post('/boards/:board', loadBoard, requireWrite, (req, res) => {
  const form = readForm(req);
  const error = validate(form);
  if (error) {
    return res.status(400).render('board/form', {
      pageTitle: `${req.board.name} 글쓰기`, form, error, action: `/boards/${req.board.slug}`, canPin: canPin(req.user),
    });
  }
  const result = db.prepare(`
    INSERT INTO posts (board, user_id, title, content, visibility, pinned) VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.board.slug, req.user.id, form.title, form.content, form.visibility, form.pinned);
  req.flash('success', '게시글이 등록되었습니다.');
  res.redirect(`/boards/${req.board.slug}/${result.lastInsertRowid}`);
});

// 상세
router.get('/boards/:board/:id', loadBoard, loadPost, (req, res, next) => {
  const post = req.post;
  if (!canRead(req.user, post)) {
    if (!req.user) return requireLogin(req, res, next);
    return next(httpError(403, '회원 전용 게시글입니다. 관리자의 가입 승인 후 열람할 수 있습니다.'));
  }

  // 같은 세션에서는 조회수를 한 번만 증가
  req.session.viewed = req.session.viewed || [];
  if (!req.session.viewed.includes(post.id)) {
    req.session.viewed = [...req.session.viewed.slice(-199), post.id];
    db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(post.id);
    post.views += 1;
  }

  const comments = db.prepare(`
    SELECT c.*, u.nickname AS author, u.role AS author_role
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? ORDER BY c.id
  `).all(post.id);
  const likeCount = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?').get(post.id).n;
  const liked = !!(req.user && db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(post.id, req.user.id));

  res.render('board/view', {
    pageTitle: post.title,
    post,
    comments,
    likeCount,
    liked,
    canInteract: isApproved(req.user),
    canManage: canManage(req.user, post),
  });
});

// 수정
router.get('/boards/:board/:id/edit', loadBoard, loadPost, requireManage, (req, res) => {
  res.render('board/form', {
    pageTitle: '게시글 수정',
    form: req.post,
    error: null,
    action: `/boards/${req.board.slug}/${req.post.id}/edit`,
    canPin: canPin(req.user),
  });
});

router.post('/boards/:board/:id/edit', loadBoard, loadPost, requireManage, (req, res) => {
  const form = readForm(req);
  const error = validate(form);
  if (error) {
    return res.status(400).render('board/form', {
      pageTitle: '게시글 수정', form, error, action: `/boards/${req.board.slug}/${req.post.id}/edit`, canPin: canPin(req.user),
    });
  }
  if (!canPin(req.user)) form.pinned = req.post.pinned;
  db.prepare(`
    UPDATE posts SET title = ?, content = ?, visibility = ?, pinned = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(form.title, form.content, form.visibility, form.pinned, req.post.id);
  req.flash('success', '게시글이 수정되었습니다.');
  res.redirect(`/boards/${req.board.slug}/${req.post.id}`);
});

// 삭제
router.post('/boards/:board/:id/delete', loadBoard, loadPost, requireManage, (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.post.id);
  req.flash('success', '게시글이 삭제되었습니다.');
  res.redirect(`/boards/${req.board.slug}`);
});

module.exports = router;
