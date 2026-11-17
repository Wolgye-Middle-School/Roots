const express = require('express');
const db = require('../db');
const { BOARDS, getBoard, canRead } = require('../boards');

const router = express.Router();

const LIST_SQL = `
  SELECT p.id, p.board, p.title, p.visibility, p.pinned, p.created_at, u.nickname AS author,
         (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
  FROM posts p JOIN users u ON u.id = p.user_id
`;

router.get('/', (req, res) => {
  const decorate = (p) => ({ ...p, readable: canRead(req.user, p), boardName: (getBoard(p.board) || {}).name });

  const notices = db.prepare(`${LIST_SQL} WHERE p.board = 'notice' ORDER BY p.pinned DESC, p.id DESC LIMIT 5`).all().map(decorate);
  const latest = db.prepare(`${LIST_SQL} ORDER BY p.id DESC LIMIT 8`).all().map(decorate);

  // 반 소개: 상단 고정 글 우선, 없으면 가장 최근 글 (열람 가능한 글만 본문 미리보기)
  const intro = db.prepare(`
    SELECT id, title, content, visibility FROM posts WHERE board = 'intro'
    ${req.user && req.user.status === 'approved' ? '' : "AND visibility = 'public'"}
    ORDER BY pinned DESC, id DESC LIMIT 1
  `).get();

  res.render('index', {
    pageTitle: '홈',
    notices,
    latest,
    intro: intro ? { ...intro, excerpt: intro.content.slice(0, 220) } : null,
    boardsWithDesc: BOARDS,
  });
});

module.exports = router;
