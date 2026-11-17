const express = require('express');
const passport = require('./passport');
const db = require('./db');
const { loginAndRedirect } = require('./routes/auth');

const BASE_URL = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

const findSocial = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?');
const insertSocial = db.prepare(`
  INSERT INTO users (nickname, role, status, provider, provider_id)
  VALUES (?, 'parent', 'pending', ?, ?)
`);
const findById = db.prepare('SELECT * FROM users WHERE id = ?');

// 소셜 계정으로 회원 조회, 없으면 '승인 대기' 학부모 회원으로 생성
function upsertSocialUser(provider, providerId, nickname) {
  let user = findSocial.get(provider, String(providerId));
  if (!user) {
    const name = String(nickname || '').trim().slice(0, 20) || `${provider} 회원`;
    const result = insertSocial.run(name, provider, String(providerId));
    user = findById.get(result.lastInsertRowid);
  }
  return user;
}

function verify(provider, pickName) {
  return (accessToken, refreshToken, profile, done) => {
    try {
      const user = upsertSocialUser(provider, profile.id, pickName(profile));
      if (user.status === 'rejected') {
        return done(null, false, { message: '가입이 거절된 계정입니다. 관리자에게 문의하세요.' });
      }
      done(null, user);
    } catch (err) { done(err); }
  };
}

const PROVIDERS = [
  {
    id: 'kakao',
    label: '카카오',
    env: 'KAKAO',
    create: (opts) => new (require('passport-kakao').Strategy)(
      opts,
      verify('kakao', (p) => p.displayName || p.username),
    ),
  },
  {
    id: 'naver',
    label: '네이버',
    env: 'NAVER',
    create: (opts) => new (require('passport-naver-v2').Strategy)(
      opts,
      verify('naver', (p) => p.nickname || p.name),
    ),
  },
  {
    id: 'google',
    label: '구글',
    env: 'GOOGLE',
    scope: ['profile'],
    create: (opts) => new (require('passport-google-oauth20').Strategy)(
      opts,
      verify('google', (p) => p.displayName),
    ),
  },
];

// 환경변수에 키가 설정된 소셜 로그인만 활성화
const enabled = PROVIDERS.filter((p) => process.env[`${p.env}_CLIENT_ID`]);
enabled.forEach((p) => {
  passport.use(p.id, p.create({
    clientID: process.env[`${p.env}_CLIENT_ID`],
    clientSecret: process.env[`${p.env}_CLIENT_SECRET`] || '',
    callbackURL: `${BASE_URL}/auth/${p.id}/callback`,
    state: true,
  }));
});

const router = express.Router();

enabled.forEach((p) => {
  router.get(`/auth/${p.id}`, passport.authenticate(p.id, p.scope ? { scope: p.scope } : {}));

  router.get(`/auth/${p.id}/callback`, (req, res, next) => {
    const returnTo = req.session.returnTo;
    passport.authenticate(p.id, (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        req.flash('error', (info && info.message) || `${p.label} 로그인에 실패했습니다.`);
        return res.redirect('/login');
      }
      loginAndRedirect(req, res, next, user, returnTo);
    })(req, res, next);
  });
});

// 키가 없는 소셜 로그인은 안내 메시지 표시
PROVIDERS.filter((p) => !enabled.includes(p)).forEach((p) => {
  router.get(`/auth/${p.id}`, (req, res) => {
    req.flash('info', `${p.label} 로그인이 아직 설정되지 않았습니다. 관리자에게 문의하거나 일반 로그인을 이용해 주세요.`);
    res.redirect('/login');
  });
});

const socialProviders = PROVIDERS.map(({ id, label }) => ({ id, label }));

module.exports = { router, socialProviders };
