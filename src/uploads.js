const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { httpError } = require('./middleware/auth');
const { checkCsrf, csrfError } = require('./middleware/common');

const { UPLOAD_DIR } = require('./storage');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + EXT[file.mimetype]),
});

const multerUpload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: MAX_FILES, fields: 20 },
  fileFilter: (req, file, cb) => cb(null, !!EXT[file.mimetype]),
}).array('images', MAX_FILES);

// 파일 시그니처(매직 바이트)로 실제 이미지인지 확인
function looksLikeImage(filePath, mime) {
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  try { fs.readSync(fd, buf, 0, 12, 0); } finally { fs.closeSync(fd); }
  switch (mime) {
    case 'image/jpeg': return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'image/png': return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/gif': return buf.subarray(0, 4).toString('ascii') === 'GIF8';
    case 'image/webp': return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
    default: return false;
  }
}

function removeFiles(files) {
  (files || []).forEach((f) => fs.rm(f.path || path.join(UPLOAD_DIR, f.filename), { force: true }, () => {}));
}

// multer 실행 + 오류를 사용자 메시지로 변환 + 위조 파일 제거
function upload(req, res, next) {
  multerUpload(req, res, (err) => {
    if (err) {
      removeFiles(req.files);
      const message = err.code === 'LIMIT_FILE_SIZE' ? '사진은 한 장당 5MB 이하만 올릴 수 있습니다.'
        : (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') ? `사진은 최대 ${MAX_FILES}장까지 올릴 수 있습니다.`
          : '파일 업로드 중 오류가 발생했습니다.';
      return next(httpError(400, message));
    }
    const files = req.files || [];
    // multer는 파일명을 latin1로 해석하므로 한글 파일명을 UTF-8로 복원
    files.forEach((f) => { f.originalname = Buffer.from(f.originalname, 'latin1').toString('utf8'); });
    // CSRF 검증 실패 시 이미 저장된 파일을 제거
    if (!checkCsrf(req)) {
      removeFiles(files);
      return next(csrfError());
    }
    const bad =files.filter((f) => !looksLikeImage(f.path, f.mimetype));
    if (bad.length) {
      removeFiles(files);
      return next(httpError(400, 'JPG, PNG, GIF, WEBP 이미지 파일만 올릴 수 있습니다.'));
    }
    next();
  });
}

module.exports = { upload, removeFiles, UPLOAD_DIR, MAX_FILES };
