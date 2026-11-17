function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  req.flash('info', '로그인이 필요합니다.');
  res.redirect('/login');
}

// 관리자 승인을 받은 회원만 허용
function requireApproved(req, res, next) {
  if (!req.user) return requireLogin(req, res, next);
  if (req.user.status === 'approved') return next();
  next(httpError(403, '관리자의 가입 승인 후 이용할 수 있습니다.'));
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return requireLogin(req, res, next);
    if (req.user.status === 'approved' && roles.includes(req.user.role)) return next();
    next(httpError(403, '접근 권한이 없습니다.'));
  };
}

module.exports = { requireLogin, requireApproved, requireRole, httpError };
