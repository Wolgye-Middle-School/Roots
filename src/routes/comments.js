const express = require('express');
const db = require('../db');
const { getBoard, canRead } = require('../boards');
const { requireApproved, httpError } = require('../middleware/auth');

const router = express.Router();

const getPost = db.prepare('SELECT id, board, visibility, user_id FROM posts WHERE id = ?');

function loadReadablePost(req, res, next) {
  const board = getBoard(req.params.board);
  const post = getPost.get(Number(req.params.id));
  if (!board || !post || post.board !== board.slug) return next(httpError(404, '존재하지 않는 게시글입니다.'));
  if (!canRead(req.user, post)) return next(httpError(403, '접근 권한이 없습니다.'));
  req.post = post;
  req.postUrl = `/boards/${board.slug}/${post.id}`;
  next();
}

// 댓글 작성
router.post('/boards/:board/:id/comments', requireApproved, loadReadablePost, (req, res) => {
  const content = String(req.body.content || '').trim();
  if (!content || content.length > 1000) {
    req.flash('error', '댓글은 1~1,000자로 입력해 주세요.');
    return res.redirect(req.postUrl);
  }
  db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)').run(req.post.id, req.user.id, content);
  res.redirect(`${req.postUrl}#comments`);
});

// 댓글 삭제 (작성자 또는 관리자)
router.post('/boards/:board/:id/comments/:commentId/delete', requireApproved, loadReadablePost, (req, res, next) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ? AND post_id = ?').get(Number(req.params.commentId), req.post.id);
  if (!comment) return next(httpError(404, '존재하지 않는 댓글입니다.'));
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') return next(httpError(403, '본인이 작성한 댓글만 삭제할 수 있습니다.'));
  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  req.flash('success', '댓글이 삭제되었습니다.');
  res.redirect(`${req.postUrl}#comments`);
});

// 공감 토글
router.post('/boards/:board/:id/like', requireApproved, loadReadablePost, (req, res) => {
  const removed = db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(req.post.id, req.user.id);
  if (!removed.changes) {
    db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(req.post.id, req.user.id);
  }
  res.redirect(`${req.postUrl}#likes`);
});

module.exports = router;
