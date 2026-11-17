require('dotenv').config({ quiet: true });
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const SqliteStore = require('./session-store');
const passport = require('./passport');
const { flash, csrfToken, csrfProtect } = require('./middleware/common');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const IS_HTTPS = BASE_URL.startsWith('https://');

if (!process.env.SESSION_SECRET) {
  console.warn('[경고] SESSION_SECRET이 설정되지 않아 임시 값을 사용합니다. 서버 재시작 시 모든 로그인이 해제됩니다.');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

const ROLE_LABELS = { admin: '관리자', teacher: '교사', parent: '학부모' };
app.locals.roleLabel = (role) => ROLE_LABELS[role] || role;
// 템플릿 기본값 (요청 처리 중 오류가 나도 레이아웃이 렌더링되도록)
app.locals.user = null;
app.locals.flash = null;
app.locals.csrfToken = '';

// 기본 보안 헤더
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.use(session({
  name: 'roots.sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  store: new SqliteStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_HTTPS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});
app.use(flash);
app.use(csrfToken);
app.use(csrfProtect);

app.use(require('./routes/auth'));

app.get('/', (req, res) => {
  res.render('index');
});

app.use((req, res) => {
  res.status(404).render('error', { title: '페이지를 찾을 수 없습니다', message: '요청하신 페이지가 존재하지 않습니다.' });
});

app.use((err, req, res, next) => {
  if (!err.expose) console.error(err);
  res.status(err.status || 500).render('error', {
    title: err.status === 403 ? '접근할 수 없습니다' : '오류가 발생했습니다',
    message: err.expose ? err.message : '잠시 후 다시 시도해 주세요.',
  });
});

app.listen(PORT, () => {
  console.log(`느티나무 게시판이 ${BASE_URL} 에서 실행 중입니다.`);
});
