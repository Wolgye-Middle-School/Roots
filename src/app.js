require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.disable('x-powered-by');

const ROLE_LABELS = { admin: '관리자', teacher: '교사', parent: '학부모' };
app.locals.roleLabel = (role) => ROLE_LABELS[role] || role;

app.use(express.urlencoded({ extended: false }));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
  res.locals.user = null;
  res.locals.flash = null;
  next();
});

app.get('/', (req, res) => {
  res.render('index');
});

app.use((req, res) => {
  res.status(404).render('error', { title: '페이지를 찾을 수 없습니다', message: '요청하신 페이지가 존재하지 않습니다.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).render('error', { title: '오류가 발생했습니다', message: err.expose ? err.message : '잠시 후 다시 시도해 주세요.' });
});

app.listen(PORT, () => {
  console.log(`느티나무 게시판이 http://localhost:${PORT} 에서 실행 중입니다.`);
});
