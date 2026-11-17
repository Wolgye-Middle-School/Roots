const crypto = require('crypto');

// 세션 기반 플래시 메시지
function flash(req, res, next) {
  req.flash = (type, message) => { req.session.flash = { type, message }; };
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

// CSRF 토큰 발급
function csrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function checkCsrf(req) {
  const sent = String((req.body && req.body._csrf) || req.get('x-csrf-token') || '');
  const expected = req.session.csrfToken || '';
  return expected.length > 0 && sent.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
}

function csrfError() {
  const err = new Error('요청이 만료되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
  err.status = 403;
  err.expose = true;
  return err;
}

// 상태 변경 요청(POST)의 CSRF 토큰 검증.
// multipart 요청은 본문이 아직 파싱되지 않았으므로 업로드 처리 후 verifyCsrf로 검증한다.
// 업로드를 받는 경로(글쓰기, 글수정)만 multipart 예외를 허용
const MULTIPART_ROUTES = /^\/boards\/[a-z]+(\/\d+\/edit)?$/;

function csrfProtect(req, res, next) {
  if (req.method !== 'POST') return next();
  if (req.is('multipart/form-data') && MULTIPART_ROUTES.test(req.path)) return next();
  if (checkCsrf(req)) return next();
  next(csrfError());
}

function verifyCsrf(req, res, next) {
  if (checkCsrf(req)) return next();
  next(csrfError());
}

module.exports = { flash, csrfToken, csrfProtect, verifyCsrf, checkCsrf, csrfError };
